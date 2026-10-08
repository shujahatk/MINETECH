# 80/20 CRM — BRAIN & KNOWLEDGE BASE (brain.md)

> **MANDATORY CONTEXT FOR AI ASSISTANTS**:
> Read this file FIRST before making any change. Do not perform lengthy codebase excavations or rediscover architecture from scratch. This document is the single source of truth for repository structure, active state, verified patterns, commands, and rules.

---

## 1. System Identity & Repository Scope

- **Project**: 80/20 Outbound CRM (Enterprise High-Ticket Sales & Omnichannel Outbound CRM)
- **Active Codebase Directory**: `C:\Users\Asus\Desktop\8020 CRM`
- **Current Git HEAD**: `653c833` (`Complete 80/20 CRM production implementation`)
- **Git Branch**: `main`
- **Original Client Spec**: `80-20_CRM_Simple_Developer_Brief_Updated.pdf` (8 pages, SHA-256: `A067692B2F2BDFBB697FE717C617510F9AAE9962A43CC1B8B2DFAD5E7F15F90A`)
- **Historical Git Rules**:
  - NEVER commit or push unless explicitly requested by the user.
  - NEVER rewrite working modules.
  - Zero git resets (`git reset --hard` is forbidden).
  - All database changes MUST be strictly forward-only additive SQL migrations.

---

## 2. Technology Stack & Frameworks

- **Framework**: Next.js 16.3.5 (App Router, Turbopack, React 19, Server Components & Server Actions)
- **Language**: TypeScript 5.9+ (strict mode, `--noEmit` route types)
- **Styling**: Tailwind CSS v4 + Vanilla CSS Design System (`src/app/globals.css`)
- **Database**: PostgreSQL 15+ via Supabase (Row-Level Security, composite tenant foreign keys)
- **In-Memory / Local DB Engine**: PGlite 0.5.8 for zero-dependency local database testing
- **Authentication**: Supabase Auth (invite-only, server session cookies, privileged MFA)
- **Icons**: Lucide React
- **Validation**: Zod 4.6.5 schemas on all external boundaries and environment variables
- **Testing**: Vitest v5.0.1 (Unit & Database projects) + Playwright 1.63.0 (E2E & Responsive Viewports)

---

## 3. Database Schema & Migration Ledger

All migrations reside in `supabase/migrations/` and run in numeric order. **Migrations 001–008 are frozen baselines and must never be altered.**

| Migration File | Description & Core Objects Added |
|---|---|
| `202609230001_phase1_baseline.sql` | Baseline setup, roles, schemas (`api`, `crm`, `private`), core types |
| `202609230002_phase2_core_crm.sql` | `crm.workspaces`, `crm.leads`, `crm.contacts`, `crm.tasks`, 13 pipeline stages |
| `202609230003_phase3_sales_eod_reports.sql` | `crm.meetings`, `crm.deals`, `crm.payments`, `crm.eod_reports`, sales commands |
| `202609230004_phase4_capture_attribution_vsl.sql`| `crm.forms`, `crm.form_submissions`, `crm.visitor_sessions`, `crm.vsl_analytics` |
| `202609230005_phase5_communications_engine.sql` | `crm.conversations`, `crm.messages`, `crm.campaigns`, `crm.sequences`, `crm.templates` |
| `202609230006_phase6a0_security_platform.sql` | RLS tenant isolation on every table, SECURITY DEFINER search_paths, RBAC |
| `202609230007_phase6a1_provider_infrastructure.sql`| `crm.message_dispatch_jobs`, `crm.suppressions`, provider adapter registry |
| `202609230008_phase6b_resend_email.sql` | Resend email dispatch, Svix webhook signature verification, email status updates |
| `202609230009_canonical_security_followup.sql` | Revokes public function execution, hardens RLS session setting functions |
| `202609230010_trusted_runtime_boundary.sql` | Establishes `crm_ingress` and `crm_worker` role privileges |
| `202609230011_form_intake_integrity.sql` | `crm.identity_conflicts`, anti-phantom lead intake, email/phone deduplication |
| `202609230012_vsl_telemetry_integrity.sql` | Bounded heartbeats (<=60s), interval-union algorithm, `crm.vsl_heartbeat_idempotency` |
| `202609230013_provider_integrations.sql` | `private.normalize_phone`, `api.ingest_twilio_webhook`, `api.ingest_calendly_webhook` |
| `202609230014_background_workers_and_reminders.sql`| `crm.meeting_reminders`, `api.recover_stale_dispatch_leases`, `api.tick_meeting_reminders` |

### Database Roles & Security Rules:
- `crm_owner`: Table owner with administrative and DDL grants.
- `crm_ingress`: Dedicated identity for server-side public forms and webhooks. Cannot directly mutate sales/deal tables.
- `crm_worker`: Dedicated background identity for dispatching queues, stale leases, and reminders.
- `PUBLIC`, `anon`, `authenticated`: All execute grants on `api` and `private` routines are revoked.
- All `SECURITY DEFINER` functions MUST have `SET search_path = pg_catalog, public, api, crm, private`.

---

### Recent UI Enhancements:
- **Financial Revenue Hero Section (ReportView)**: Prominently elevated **Deal value (USD 95000.00)** and **Net cash (USD 47500.00)** into executive-grade KPI hero cards with currency badges, financial icons, and bold 3xl typography placed directly on top of the operational conversion metrics.

## 4. UI Architecture & Route Inventory (Port 3001)

Local Preview Mode runs when `APP_ENV=development` and `CRM_UI_PREVIEW=true`.
Demo Workspace ID: `d3b07384-d113-4e00-8438-d9d59f3e49e2`

| Route | Page File | Functionality |
|---|---|---|
| `/workspaces` | `src/app/workspaces/page.tsx` | Workspace selector portal & invitations |
| `/[workspace]` | `src/app/(workspace)/[workspace]/page.tsx` | Workspace redirector -> `/dashboard` |
| `/[workspace]/dashboard` | `src/app/(workspace)/[workspace]/dashboard/page.tsx` | KPI cards (Active leads, tasks due, new 7d, unassigned, at-risk), daily sales metrics |
| `/[workspace]/leads` | `src/app/(workspace)/[workspace]/leads/page.tsx` | Leads directory table, multi-filter, setter/closer, next action indicator, new lead modal |
| `/[workspace]/leads/[lead]`| `src/app/(workspace)/[workspace]/leads/[lead]/page.tsx`| Lead drawer: timeline, notes, custom fields, meetings, deals |
| `/[workspace]/pipeline` | `src/app/(workspace)/[workspace]/pipeline/page.tsx` | 13-stage kanban board with quick-move action dropdowns |
| `/[workspace]/tasks` | `src/app/(workspace)/[workspace]/tasks/page.tsx` | Today / Overdue / Upcoming task manager, priority flags, setter assignments |
| `/[workspace]/conversations` | `src/app/(workspace)/[workspace]/conversations/page.tsx` | Omnichannel inbox (Email, SMS, WhatsApp), message history, Inbound Review Queue |
| `/[workspace]/campaigns` | `src/app/(workspace)/[workspace]/campaigns/page.tsx` | Broadcast campaigns, audience builder, recipient snapshots |
| `/[workspace]/templates` | `src/app/(workspace)/[workspace]/templates/page.tsx` | Versioned templates, message variables (`{{first_name}}`, etc.) |
| `/[workspace]/sequences` | `src/app/(workspace)/[workspace]/sequences/page.tsx` | Automated multi-step nurture sequences with delay triggers |
| `/[workspace]/forms` | `src/app/(workspace)/[workspace]/forms/page.tsx` | 10 field types builder, target stage/setter, embed snippet, identity conflict controls |
| `/[workspace]/eod` | `src/app/(workspace)/[workspace]/eod/page.tsx` | Daily End-of-Day rollups, qualitative notes, frozen daily revisions |
| `/[workspace]/reports` | `src/app/(workspace)/[workspace]/reports/page.tsx` | Setter/Closer performance cohorts, revenue totals, conversion rates |
| `/[workspace]/attribution`| `src/app/(workspace)/[workspace]/attribution/page.tsx`| First-touch and last-touch attribution, UTM parameter breakdown |
| `/[workspace]/vsl` | `src/app/(workspace)/[workspace]/vsl/page.tsx` | Video retention graphs, drop-off heatmaps, unique watch time |
| `/[workspace]/settings/integrations`| `src/app/(workspace)/[workspace]/settings/integrations/page.tsx`| Provider connection status (Resend, Twilio, WhatsApp, Calendly, Meta) |
| `/[workspace]/settings/profile` | `src/app/(workspace)/[workspace]/settings/profile/page.tsx` | User profile, role badges, workspace settings |

---

## 5. API Endpoints & Webhooks

- **Background Worker Tick**: `POST /api/internal/jobs/tick` (Bearer auth via `CRON_SECRET`)
- **Public Form Definition**: `GET /api/public/forms/[publicKey]`
- **Public Form Submission**: `POST /api/public/forms/[publicKey]/submit`
- **VSL Public Session**: `POST /api/public/vsl/[publicKey]/session`
- **VSL Public Heartbeat**: `POST /api/public/vsl/[publicKey]/heartbeat`
- **VSL Public Event**: `POST /api/public/vsl/[publicKey]/event`
- **Resend Webhook**: `POST /api/webhooks/resend` (`svix-signature`)
- **Twilio SMS Webhook**: `POST /api/webhooks/twilio` (`X-Twilio-Signature`)
- **WhatsApp Webhook**: `GET` (Challenge) & `POST /api/webhooks/whatsapp` (`X-Hub-Signature-256`)
- **Calendly Webhook**: `POST /api/webhooks/calendly` (`Calendly-Webhook-Signature`)
- **Meta Lead Ads Webhook**: `POST /api/webhooks/meta` (`X-Hub-Signature-256`)

---

## 6. External Provider Adapters (`src/server/providers/`)

1. **Resend (`resend/`)**:
   - `adapter.ts`: Email dispatch with suppression checking.
   - `webhook.ts`: Svix HMAC signature verifier.
2. **Twilio (`twilio/`)**:
   - `client.ts`: Twilio REST client wrapper.
   - `adapter.ts`: SMS dispatch, phone normalization (`private.normalize_phone`).
   - `webhook.ts`: Twilio signature verifier, STOP/START DNC handling, unassociated inbound review routing.
3. **WhatsApp (`whatsapp/`)**:
   - `client.ts`: Meta Graph API client.
   - `adapter.ts`: Enforces 24-hour service care window (blocks free-form text outside window, mandates templates).
   - `webhook.ts`: Inbound message and read status handler.
4. **Calendly (`calendly/`)**:
   - `adapter.ts`: Event parsing, invitee email/phone lead matching, closer attribution via event host.
   - `webhook.ts`: Replay tolerance check (<3 min timestamp window).
   - Triggers: Automatically schedules 24h and 1h reminders in `crm.meeting_reminders`.
5. **Meta Lead Ads & CAPI (`meta/`)**:
   - `adapter.ts`: Lead ads form mapping, attribution linking.
   - `capi.ts`: Conversions API dispatcher with consent-gated SHA-256 PII hashing.
   - `webhook.ts`: Meta HMAC verifier.
6. **VSL Bridge (`vsl/bridge.ts`)**:
   - Universal player event bridge (play, pause, seek, heartbeat, end).
   - Normalized playback spans; interval union guarantees skipped video earns zero watch credit.
7. **80/20 Contract (`outbound/contract.ts`)**:
   - Versioned Zod schemas (`v1.0.0`) for external CRM-to-system integrations.
   - HMAC generator and validator (`X-8020-Signature`).

---

## 7. Critical Business Rules & Invariants

1. **Anti-Phantom Lead Guarantee**:
   - Unknown inbound SMS/WhatsApp messages route to `crm.inbound_message_reviews`. NEVER auto-create unverified leads.
   - Form submissions with contradictory identities (e.g. Email matching Lead A, Phone matching Lead B) route to `crm.identity_conflicts` with `lead_id = null`.
   - Form submissions with zero personal identity preserve answers with `lead_id = null`.
2. **Bounded Telemetry**:
   - VSL heartbeats must be `<=60s` apart.
   - Seeks forward never increment watch credit.
   - Replayed heartbeats with existing idempotency keys return cached state.
3. **Suppression & DNC Precedence**:
   - Inbound `STOP`, `UNSUBSCRIBE`, `CANCEL`, `QUIT` immediately creates active suppression row.
   - Every dispatch path (campaigns, sequences, manual sends) checks suppressions just-in-time prior to send.
4. **Preview Mode Fail-Closed**:
   - Fictional preview is ONLY allowed when `APP_ENV === 'development'` AND `CRM_UI_PREVIEW === 'true'`.
   - In staging or production (`APP_ENV === 'production'`), preview mode fails closed and redirects to `/login`.
5. **Secret Protection**:
   - No credentials in logs (structured logger masks `password`, `secret`, `token`, `key`).
   - `.env.local` is gitignored and must never be tracked.

---

## 8. Verification Commands & Health Runbook

Run these commands from `C:\Users\Asus\Desktop\8020 CRM`:

```bash
# 1. Typecheck (zero errors)
npm run typecheck

# 2. Linting (zero errors, zero warnings)
npm run lint

# 3. Unit Tests (132 tests pass)
npm test

# 4. Database Tests (312 tests pass across 13 suites)
npm run test:db

# 5. Playwright E2E & Responsive Viewports (24 pass, 2 skipped live-only)
npm run test:e2e

# 6. Secret Leakage Audit (0 findings across 265 files)
npm run security:scan

# 7. Production Next.js Turbopack Build (35 routes compile cleanly)
npm run build

# 8. Git Whitespace Integrity (clean exit 0)
git diff --check
```

---

## 9. How to Make Changes Safely (Step-by-Step Protocol)

When the user asks you to make a change:

1. **Consult this file (`brain.md`)**: Locate the relevant module, route, provider, or database table.
2. **Preserve Functionality**: Do not delete existing sales, CRM, analytics, or communication features. Keep the design clean, premium, and clutter-free.
3. **Database Changes**: If modifying schema, create a new numbered migration (e.g., `202609230015_...sql`). NEVER modify existing migrations 001–014. Always set `search_path` and revoke public execution.
4. **UI Changes**: Ensure all responsive viewports (1440, 1280, 1024, 768, 390) maintain zero horizontal page overflow. Maintain `"use client";` at the very first line of interactive components.
5. **Run Verification Gates**: Run `npm run typecheck`, `npm run lint`, and the relevant test suite before reporting back.
6. **No Git Commits Without Authorization**: Keep working tree changes uncommitted until the user explicitly directs you to commit.
7. **Update `brain.md`**: When new modules, routes, or migrations are added, update this document so the system's memory remains current.
