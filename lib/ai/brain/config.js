/**
 * MineTech AI Brain - runtime configuration
 *
 * Autonomy model
 * --------------
 * LEVEL 1 (the only level implemented in v1): AI-assisted.
 *   Claude may analyze, classify, score, recommend, personalize and draft.
 *   Claude may NOT send, override DNC, change permissions, bypass campaign rules,
 *   delete data or alter configuration. Every outbound message needs a human click.
 *
 * LEVEL 2 (future): AI may execute a whitelist of low-risk actions.
 *   The hooks exist (`autonomyLevel`, `flags`) but v1 clamps the level to 1 no matter
 *   what the environment says, so a misconfigured env var can never enable auto-send.
 */

import { getAnthropicModelConfig } from '../modelConfig.js';

export const BRAIN_VERSION = 1;

/** Bump when a prompt changes in a way that should invalidate cached outputs. */
export const PROMPT_VERSIONS = Object.freeze({
  leadIntelligence: 'li-1',
  emailPersonalization: 'ep-1',
  replyClassification: 'rc-1',
  replyDraft: 'rd-1',
  commandDraft: 'cd-1',
});

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function getBrainConfig(env = process.env) {
  const requestedLevel = num(env.AI_BRAIN_AUTONOMY_LEVEL, 1);

  return Object.freeze({
    enabled: String(env.AI_BRAIN_ENABLED ?? 'true').toLowerCase() !== 'false',

    // v1 hard clamp: autonomy above 1 is not implemented.
    autonomyLevel: 1,
    requestedAutonomyLevel: requestedLevel,

    // Reserved for Level 2. Ignored in v1 (see clamp above).
    flags: Object.freeze({
      autoSendReplies: false,
      autoSendFollowUps: false,
    }),

    // Read from ANTHROPIC_MODEL / ANTHROPIC_FALLBACK_MODELS only; never hard-coded (see ../modelConfig.js).
    model: getAnthropicModelConfig(env),

    provider: {
      timeoutMs: num(env.AI_BRAIN_TIMEOUT_MS, 30000),
      maxRetries: num(env.AI_BRAIN_MAX_RETRIES, 2),
      maxJsonRepairAttempts: 1,
    },

    // Cost / performance guards
    limits: {
      maxThreadMessages: 8,
      maxMessageChars: 2000,
      maxFieldChars: 600,
      pendingStaleAfterMs: 5 * 60 * 1000,
      failedRetryAfterMs: 2 * 60 * 1000,
      maxStoredBodyChars: 8000,
    },

    // Deterministic outreach limits enforced by the policy engine
    policy: {
      maxFollowUps: num(env.AI_BRAIN_MAX_FOLLOW_UPS, 3),
      cooldownHours: num(env.AI_BRAIN_COOLDOWN_HOURS, 48),
      duplicateWindowHours: num(env.AI_BRAIN_DUPLICATE_WINDOW_HOURS, 72),
    },
  });
}
