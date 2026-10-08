/**
 * Anthropic model configuration - the single place model ids are read.
 *
 * No model id is hard-coded anywhere in this layer. Model ids are retired regularly, so the
 * operator can pin one through the environment:
 *
 *   ANTHROPIC_API_KEY=<sk-ant-...>                     (required to draft)
 *   ANTHROPIC_MODEL=<current-model-id>                 (optional pin)
 *   ANTHROPIC_FALLBACK_MODELS=<id>,<id>                (optional, tried only if the primary
 *                                                       is reported as unavailable)
 *
 * If ANTHROPIC_MODEL is omitted, AnthropicProvider asks Anthropic which models the key can
 * use and picks a current one. That keeps drafting working when only the API key is set.
 */

const parseList = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function getAnthropicModelConfig(env = process.env) {
  const primary = String(env.ANTHROPIC_MODEL || '').trim() || null;
  const fallbacks = parseList(env.ANTHROPIC_FALLBACK_MODELS).filter((m) => m !== primary);
  return { primary, fallbacks };
}

export const MODEL_NOT_CONFIGURED_MESSAGE =
  'Claude is not configured. Set ANTHROPIC_API_KEY in the server environment.';

export const MODEL_UNRESOLVED_MESSAGE =
  'Claude is connected, but no model id is available. Set ANTHROPIC_MODEL to a current Anthropic model id.';
