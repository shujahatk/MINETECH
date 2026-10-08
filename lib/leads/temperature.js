/**
 * Lead temperature (Hot / Warm / Cold).
 *
 * Single source of truth shared by the API (list mapping + SQL filters) and the UI.
 *
 * Rule:
 *  1. A manual priority set in the lead drawer wins: HOT / STRATEGIC -> HOT, WARM -> WARM, COLD -> COLD.
 *  2. Otherwise the AI/composite lead score decides, using the same bands as leadScoringService:
 *       score >= 80  -> HOT
 *       score >= 50  -> WARM
 *       otherwise    -> COLD   (unscored leads count as 0)
 *
 * Other stored priority values (e.g. import tiers "A"/"B"/"C", "HIGH_VOLUME") are not a temperature
 * and fall through to the score.
 */
export const HOT_MIN_SCORE = 80;
export const WARM_MIN_SCORE = 50;

export const EXPLICIT_HOT = ['HOT', 'STRATEGIC'];
export const EXPLICIT_WARM = ['WARM'];
export const EXPLICIT_COLD = ['COLD'];
export const EXPLICIT_ALL = [...EXPLICIT_HOT, ...EXPLICIT_WARM, ...EXPLICIT_COLD];

export const TEMPERATURES = ['HOT', 'WARM', 'COLD'];

export function deriveTemperature({ priority, score } = {}) {
  const p = String(priority ?? '').trim().toUpperCase();
  if (EXPLICIT_HOT.includes(p)) return 'HOT';
  if (EXPLICIT_WARM.includes(p)) return 'WARM';
  if (EXPLICIT_COLD.includes(p)) return 'COLD';

  const n = Number(score);
  const value = Number.isFinite(n) ? n : 0;
  if (value >= HOT_MIN_SCORE) return 'HOT';
  if (value >= WARM_MIN_SCORE) return 'WARM';
  return 'COLD';
}

/**
 * PostgREST `or=(...)` expressions that select exactly the rows deriveTemperature() maps to a bucket.
 * Reads the manual priority from custom_fields->>priority and falls back to the score column.
 */
const NOT_EXPLICIT = `or(custom_fields->>priority.is.null,custom_fields->>priority.not.in.(${EXPLICIT_ALL.join(',')}))`;

export const TEMPERATURE_FILTERS = {
  HOT: `custom_fields->>priority.in.(${EXPLICIT_HOT.join(',')}),and(score.gte.${HOT_MIN_SCORE},${NOT_EXPLICIT})`,
  WARM: `custom_fields->>priority.in.(${EXPLICIT_WARM.join(',')}),and(score.gte.${WARM_MIN_SCORE},score.lt.${HOT_MIN_SCORE},${NOT_EXPLICIT})`,
  COLD: `custom_fields->>priority.in.(${EXPLICIT_COLD.join(',')}),and(or(score.lt.${WARM_MIN_SCORE},score.is.null),${NOT_EXPLICIT})`,
};

export default deriveTemperature;
