/**
 * AIProvider - the only interface the AI Brain depends on.
 *
 * Swapping the model vendor means implementing `complete()` on a new subclass and
 * registering it with `setAIProvider()`. Nothing in lib/ai/brain imports a vendor SDK
 * or knows an HTTP endpoint.
 */

export class AIProviderError extends Error {
  constructor(message, { code = 'PROVIDER_ERROR', status = null, retryable = false, cause = null } = {}) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code; // NOT_CONFIGURED | TIMEOUT | RATE_LIMITED | HTTP_ERROR | NETWORK | EMPTY_RESPONSE | INVALID_JSON
    this.status = status;
    this.retryable = retryable;
    if (cause) this.cause = cause;
  }
}

export class AIProvider {
  /** @returns {string} stable provider id, e.g. "anthropic" */
  get name() {
    return 'abstract';
  }

  /** @returns {boolean} true when credentials are present and a call can be attempted */
  isConfigured() {
    return false;
  }

  /**
   * Run one completion.
   * @param {{
   *   system: string,
   *   messages: Array<{role: 'user'|'assistant', content: string}>,
   *   maxTokens?: number,
   *   temperature?: number,
   *   model?: string,
   *   timeoutMs?: number,
   * }} request
   * @returns {Promise<{ text: string, model: string, usage: { inputTokens: number, outputTokens: number }, provider: string }>}
   * @throws {AIProviderError}
   */
  // eslint-disable-next-line no-unused-vars
  async complete(request) {
    throw new AIProviderError('AIProvider.complete() is not implemented', { code: 'NOT_IMPLEMENTED' });
  }
}
