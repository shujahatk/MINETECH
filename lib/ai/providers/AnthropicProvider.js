import { AIProvider, AIProviderError } from './AIProvider.js';
import { getAnthropicModelConfig, MODEL_NOT_CONFIGURED_MESSAGE, MODEL_UNRESOLVED_MESSAGE } from '../modelConfig.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';
const ANTHROPIC_VERSION = '2023-06-01';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Anthropic (Claude) implementation of AIProvider.
 *
 * Adds what the legacy scattered `fetch` calls lacked: request timeout, bounded retries
 * with backoff on 429/5xx/network, model fallback on 404/400 "model" errors, usage
 * reporting, and an injectable `fetchImpl` so tests never touch the network.
 */
export class AnthropicProvider extends AIProvider {
  constructor({
    apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
    model = getAnthropicModelConfig().primary,
    fallbackModels = getAnthropicModelConfig().fallbacks,
    timeoutMs = 30000,
    maxRetries = 2,
    retryBaseMs = 400,
    fetchImpl = (...args) => fetch(...args),
  } = {}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.fallbackModels = fallbackModels;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.retryBaseMs = retryBaseMs;
    this.fetchImpl = fetchImpl;
    this._resolvedModels = null;
  }

  get name() {
    return 'anthropic';
  }

  /** True when a usable Anthropic API key is present. Model id can be resolved later. */
  isConfigured() {
    return typeof this.apiKey === 'string' && this.apiKey.startsWith('sk-ant');
  }

  async complete({ system, messages, maxTokens = 800, temperature = 0.2, model, timeoutMs } = {}) {
    if (!this.isConfigured()) {
      throw new AIProviderError(MODEL_NOT_CONFIGURED_MESSAGE, { code: 'NOT_CONFIGURED' });
    }

    const candidates = await this.#modelCandidates(model);
    let lastError = null;

    for (const candidate of candidates) {
      try {
        return await this.#callWithRetry({
          model: candidate,
          system,
          messages,
          maxTokens,
          temperature,
          timeoutMs: timeoutMs || this.timeoutMs,
        });
      } catch (err) {
        lastError = err;
        // Only fall through to the next model when the model itself is the problem.
        if (err instanceof AIProviderError && err.code === 'MODEL_UNAVAILABLE') continue;
        throw err;
      }
    }

    throw lastError || new AIProviderError(MODEL_UNRESOLVED_MESSAGE, { code: 'MODEL_UNAVAILABLE' });
  }

  /**
   * Prefer ANTHROPIC_MODEL / ANTHROPIC_FALLBACK_MODELS. If those are empty, ask Anthropic
   * which current models this key can use. No model id is hard-coded here.
   */
  async #modelCandidates(override) {
    const pinned = [...new Set([override, this.model, ...this.fallbackModels].filter(Boolean))];
    if (pinned.length) return pinned;

    if (!this._resolvedModels) {
      this._resolvedModels = this.#discoverModels().catch((err) => {
        this._resolvedModels = null;
        throw err;
      });
    }
    const discovered = await this._resolvedModels;
    if (!discovered.length) {
      throw new AIProviderError(MODEL_UNRESOLVED_MESSAGE, { code: 'MODEL_UNAVAILABLE' });
    }
    return discovered;
  }

  async #discoverModels() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(ANTHROPIC_MODELS_URL, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
      });
      if (!response.ok) {
        throw new AIProviderError(MODEL_UNRESOLVED_MESSAGE, { code: 'MODEL_UNAVAILABLE', status: response.status });
      }
      const data = await response.json().catch(() => ({}));
      const ids = (Array.isArray(data?.data) ? data.data : [])
        .map((row) => row?.id)
        .filter((id) => typeof id === 'string' && id.startsWith('claude-'));
      return pickDiscoveredModels(ids);
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(MODEL_UNRESOLVED_MESSAGE, { code: 'MODEL_UNAVAILABLE', cause: err });
    } finally {
      clearTimeout(timer);
    }
  }

  async #callWithRetry(params) {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await this.#callOnce(params);
      } catch (err) {
        const retryable = err instanceof AIProviderError && err.retryable;
        if (!retryable || attempt >= this.maxRetries) throw err;
        attempt += 1;
        await sleep(this.retryBaseMs * 2 ** (attempt - 1) + Math.random() * 100);
      }
    }
  }

  async #callOnce({ model, system, messages, maxTokens, temperature, timeoutMs }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await this.fetchImpl(ANTHROPIC_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages,
        }),
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new AIProviderError(`Claude request timed out after ${timeoutMs}ms`, {
          code: 'TIMEOUT',
          retryable: true,
          cause: err,
        });
      }
      throw new AIProviderError(`Claude network error: ${err?.message || 'unknown'}`, {
        code: 'NETWORK',
        retryable: true,
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const status = response.status;
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.error?.message || '';
      } catch {
        /* ignore body parse errors */
      }

      if (status === 429) {
        throw new AIProviderError(`Claude rate limited${detail ? `: ${detail}` : ''}`, {
          code: 'RATE_LIMITED',
          status,
          retryable: true,
        });
      }
      if (status >= 500) {
        throw new AIProviderError(`Claude server error (${status})`, { code: 'HTTP_ERROR', status, retryable: true });
      }
      if ((status === 404 || status === 400) && /model/i.test(detail)) {
        throw new AIProviderError(`Claude model unavailable: ${model}`, { code: 'MODEL_UNAVAILABLE', status });
      }
      throw new AIProviderError(`Claude request failed (${status})${detail ? `: ${detail}` : ''}`, {
        code: 'HTTP_ERROR',
        status,
      });
    }

    const data = await response.json();
    const text = (data?.content || [])
      .filter((block) => block?.type === 'text' || typeof block?.text === 'string')
      .map((block) => block.text)
      .join('')
      .trim();

    if (!text) {
      throw new AIProviderError('Claude returned an empty response', { code: 'EMPTY_RESPONSE' });
    }

    return {
      text,
      model: data?.model || model,
      provider: this.name,
      usage: {
        inputTokens: data?.usage?.input_tokens || 0,
        outputTokens: data?.usage?.output_tokens || 0,
      },
    };
  }
}

/**
 * Choose current Claude models from Anthropic's live list. Prefer newest Sonnet, then
 * newest Haiku, then the first remaining current id. Ids themselves come from the API.
 */
export function pickDiscoveredModels(ids = []) {
  const unique = [...new Set(ids.filter(Boolean))];
  const sonnet = unique.filter((id) => /sonnet/i.test(id) && !/opus/i.test(id));
  const haiku = unique.filter((id) => /haiku/i.test(id));
  const rest = unique.filter((id) => !sonnet.includes(id) && !haiku.includes(id));
  return [...sonnet, ...haiku, ...rest].slice(0, 4);
}

export default AnthropicProvider;
