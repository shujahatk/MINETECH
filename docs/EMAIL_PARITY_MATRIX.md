# EMAIL FEATURE PARITY MATRIX
## MineTech Outbound vs 80/20 Outbound (Supabase PostgreSQL Backed)

This document tracks forensic feature parity between the 80/20 Outbound system and the MineTech email architecture powered by **Supabase PostgreSQL**.

| Category | Feature | 80/20 Implementation | MineTech Implementation | Status | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sender & Mailbox** | Multi-inbox support | Supported (MongoDB/Env) | Supported (`sending_inboxes` table) | **PASS** | `scripts/test_email_parity.js` |
| **Sender & Mailbox** | Custom From Name & Email | Supported in config/env | Supported (`senderName`, `senderEmail`) | **PASS** | `scripts/test_email_parity.js` |
| **Sender & Mailbox** | Dedicated Reply-To header | Supported (`replyTo`) | Supported (`replyTo` in DB & headers) | **PASS** | `scripts/test_email_parity.js` |
| **Sender & Mailbox** | Provider config & switching | Resend / Listmonk / SMTP | `lib/services/emailProvider.js` abstraction | **PASS** | `scripts/test_email_parity.js` |
| **Campaigns** | Campaign creation & metadata | Name, subject, HTML, text | Supabase `email_campaigns` table | **PASS** | `scripts/test_email_parity.js` |
| **Campaigns** | Pre-send audience audit | Status, tags, uncontacted filter | `auditCampaignAudience()` in Supabase | **PASS** | `scripts/test_email_parity.js` |
| **Campaigns** | DNC suppression exclusion | Auto-filters DNC/Opt-outs | Suppressed via `leads.is_dnc` | **PASS** | `scripts/test_email_parity.js` |
| **Campaigns** | Duplicate lead elimination | Deduplicates by normalized email | Deduplicated in `email_recipients` uq | **PASS** | `scripts/test_email_parity.js` |
| **Campaigns** | Campaign controls (Pause/Resume/Cancel) | Supported via status flags | Atomic status updates in Supabase | **PASS** | `scripts/test_email_parity.js` |
| **Sending Engine** | Standard Email Mode (No AI) | Supported (Pure merge tags) | Supported (Claude NEVER called) | **PASS** | `scripts/test_email_parity.js` |
| **Sending Engine** | Claude AI Mode (Optional) | Supported (Claude 3.5 Sonnet) | Supported (`/api/ai/claude` generate/tweak)| **PASS** | `scripts/test_email_parity.js` |
| **Sending Engine** | Shared Pipeline for both modes | Same queue, limits, providers | `lib/services/personalizationEngine.js` | **PASS** | `scripts/test_email_parity.js` |
| **Sending Engine** | Daily & hourly sending limits | Supported in settings/inbox | Supported in `sending_inboxes.daily_limit`| **PASS** | `scripts/test_email_parity.js` |
| **Sending Engine** | Randomized interval delays | 30s–90s pacing | Configurable `delayInterval` in queue | **PASS** | `scripts/test_email_parity.js` |
| **Sending Engine** | Mailbox warmup pacing | +10% daily volume scaling | `sending_inboxes.warmup_active` | **PASS** | `scripts/test_email_parity.js` |
| **Queue & Workers** | Atomic queue claiming | MongoDB `findOneAndUpdate` | PostgreSQL `claimNextPendingRecipient` | **PASS** | `scripts/test_email_parity.js` |
| **Queue & Workers** | Send idempotency & duplicate prevention | UQ constraints & state locks | `uq_campaign_lead` & `locked_at` | **PASS** | `scripts/test_email_parity.js` |
| **Queue & Workers** | Stale lock recovery | 5-min timeout release | Auto-release in `claimNextPendingRecipient`| **PASS** | `scripts/test_email_parity.js` |
| **Queue & Workers** | Safe error handling & retry count | Retries on transient failure | `attempt_count` & permanent fail on DNC | **PASS** | `scripts/test_email_parity.js` |
| **Templates** | Template CRUD & Categories | HTML/text, subject, variables | Supabase `email_templates` table | **PASS** | `scripts/test_email_parity.js` |
| **Personalization** | Centralized merge variable substitution | `{{firstName}}`, `{{company}}`, etc. | `substituteMergeVariables()` in engine | **PASS** | `scripts/test_email_parity.js` |
| **Personalization** | Fallback defaults for missing fields | Inserts fallback values | Safe fallbacks ('there', 'your team') | **PASS** | `scripts/test_email_parity.js` |
| **Sequences** | Automated multi-step drip sequences | Multi-touch sequence engine | `lib/services/sequenceEngine.js` | **PASS** | `scripts/test_email_parity.js` |
| **Sequences** | Stopping conditions (Reply, Meeting, DNC) | Auto-stops sequence on reply | Checked in `sequenceEngine.js` | **PASS** | `scripts/test_email_parity.js` |
| **Tracking** | Open tracking pixel | 1x1 GIF / webhook event | Supported via Resend / Listmonk webhook | **PASS** | `scripts/test_email_parity.js` |
| **Tracking** | Link click tracking | URL redirect tracking | Supported via Resend / Listmonk webhook | **PASS** | `scripts/test_email_parity.js` |
| **Tracking** | Delivery & bounce webhooks | Resend/Listmonk webhook route | `app/api/webhooks/resend/route.js` | **PASS** | `scripts/test_email_parity.js` |
| **Compliance** | 1-Click List-Unsubscribe header | RFC 8058 compliant headers | Appended to outbound headers | **PASS** | `scripts/test_email_parity.js` |
| **Compliance** | Physical company address footer | CAN-SPAM / GDPR footer | Appended to outbound HTML/Text | **PASS** | `scripts/test_email_parity.js` |
| **Compliance** | Automatic suppression list enforcement | DNC status updates | Auto-updates `leads.is_dnc` | **PASS** | `scripts/test_email_parity.js` |
| **CSV System** | CSV import pipeline | Alias mapping, validation | `lib/services/leadService.js` mapCsvHeaders | **PASS** | `scripts/test_email_parity.js` |
| **CSV System** | Invalid & duplicate email detection | Rejects invalid / duplicates | Validated before insert | **PASS** | `scripts/test_email_parity.js` |
| **Unified Inbox** | Two-way thread & conversation tracking | Threads & message history | Supabase `email_threads` & `email_messages`| **PASS** | `scripts/test_email_parity.js` |
| **Analytics** | Live real-time campaign statistics | Sent, opened, clicked, bounced | Aggregated from Supabase tables | **PASS** | `scripts/test_email_parity.js` |
| **Security & RLS** | Supabase Row-Level Security & RBAC | Server-side role validation | Admin / Manager / Agent RBAC guards | **PASS** | `scripts/test_email_parity.js` |
