import { AIProvider, AIProviderError } from './AIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { getBrainConfig } from '../brain/config.js';

let activeProvider = null;

/**
 * Lazily builds the default provider (Anthropic). Tests and future vendors can replace it
 * with `setAIProvider()`.
 */
export function getAIProvider() {
  if (!activeProvider) {
    const cfg = getBrainConfig();
    activeProvider = new AnthropicProvider({
      model: cfg.model.primary,
      fallbackModels: cfg.model.fallbacks,
      timeoutMs: cfg.provider.timeoutMs,
      maxRetries: cfg.provider.maxRetries,
    });
  }
  return activeProvider;
}

export function setAIProvider(provider) {
  activeProvider = provider;
}

export { AIProvider, AIProviderError, AnthropicProvider };
