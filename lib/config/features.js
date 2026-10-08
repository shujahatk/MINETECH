/**
 * Runtime feature flags.
 *
 * MineTech is an email-first outbound platform. Voice calling and SMS are kept in the
 * codebase (API routes, webhooks, tables, DialerModal) so they can be re-enabled, but they
 * are OFF by default and are not part of the active product flow.
 *
 * To roll back, set NEXT_PUBLIC_TELEPHONY_ENABLED=true and rebuild.
 */
export const TELEPHONY_ENABLED = process.env.NEXT_PUBLIC_TELEPHONY_ENABLED === 'true';

export default { TELEPHONY_ENABLED };
