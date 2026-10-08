# MineTech 80/20 Outbound System — Complete Architecture & Technical Documentation

---

## 1. Executive System Overview

The **MineTech 80/20 Outbound System (v2.0)** is an enterprise-grade, high-throughput outbound sales engagement platform designed for targeted B2B prospecting, multi-channel outreach, and pipeline acceleration. 

The architecture is built on a **Single-Admin** operational model, integrating real-time telemetry, automated email sequencing, high-volume campaign blasts, browser-based WebRTC telephony, bidirectional SMS messaging, and Anthropic Claude AI intelligence into a unified command center.

---

## 2. Core Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 14+ (App Router)** | Modern React architecture with Server & Client components |
| **Styling & UI Design** | **Tailwind CSS + Lucide React** | Cyberpunk/Obsidian theme (`#030712`), glassmorphism, responsive micro-animations |
| **Backend & API** | **Next.js Route Handlers** | High-throughput REST API with zero-cache headers and rate limiting |
| **Database & Storage** | **Supabase (PostgreSQL 15)** | Relational database with Row Level Security (RLS) and Service Role access |
| **Email Infrastructure** | **Resend API + Listmonk Docker** | Transactional & sequence emails via Resend HTTPS; blast campaigns via worker + Listmonk sync |
| **Telephony & SMS** | **Twilio Voice SDK + SMS** | Browser-based WebRTC outbound dialing, call recordings, and inbound/outbound SMS |
| **AI Intelligence** | **Anthropic Claude 3.5 Sonnet** | Automated reply generation, prospect sentiment classification, and conversation summaries |
| **Security & Auth** | **JWT (JSON Web Tokens) + bcrypt** | Single-admin role-gating (`admin`/`owner`), timing-safe password validation |

---

## 3. System Architecture & Component Trace

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Interface (Next.js 14 App Router)"]
        UI_Cockpit["Outbound Sales Cockpit"]
        UI_Analytics["Performance Overview & Telemetry"]
        UI_Inbox["Unified Inbox & Claude AI Co-pilot"]
        UI_Blast["Campaign Blast Wizard"]
        UI_Dialer["Twilio WebRTC Dialer"]
    end

    subgraph ServerLayer ["Next.js Backend & API Route Handlers"]
        AuthGuard["JWT Auth Guard & Rate Limiter"]
        AnalyticsSvc["Analytics Service"]
        CampaignSvc["Campaign & Sequence Service"]
        TwilioSvc["Twilio Telephony Service"]
        ClaudeSvc["Claude AI Service"]
        BlastWorker["Email Blast Worker"]
    end

    subgraph DataLayer ["Data & State Tier"]
        SupabaseDB[("Supabase PostgreSQL (Primary DB)")]
        ListmonkDB[("Listmonk PostgreSQL (Docker)")]
    end

    subgraph ExternalEngines ["External Providers & Engines"]
        ResendHTTPS["Resend HTTPS API"]
        TwilioVoice["Twilio Voice & Messaging API"]
        ClaudeAPI["Anthropic Claude API"]
        ListmonkDocker["Listmonk Campaign Server"]
    end

    UI_Cockpit --> AuthGuard
    UI_Analytics --> AuthGuard
    UI_Inbox --> AuthGuard
    UI_Blast --> AuthGuard
    UI_Dialer --> AuthGuard

    AuthGuard --> AnalyticsSvc
    AuthGuard --> CampaignSvc
    AuthGuard --> TwilioSvc
    AuthGuard --> ClaudeSvc

    AnalyticsSvc --> SupabaseDB
    CampaignSvc --> SupabaseDB
    CampaignSvc --> ListmonkDocker
    TwilioSvc --> SupabaseDB
    TwilioSvc --> TwilioVoice
    ClaudeSvc --> ClaudeAPI

    BlastWorker --> SupabaseDB
    BlastWorker --> ResendHTTPS

    ListmonkDocker --> ListmonkDB
    ListmonkDocker -.-> ResendHTTPS
```

---

## 4. Subsystems & Functional Modules

### 4.1 Outbound Sales Cockpit & High-Priority Queue
* **Live Telemetry:** Tracks calls placed, connection rates, emails sent, bounce rates, and replies with sub-4-second real-time polling.
* **Lead Scoring Engine:** Dynamically sorts prospects based on engagement signals (opens, clicks, replies, stage qualification) to prioritize high-value targets.
* **Rapid Action Drawer:** Direct 1-click calling, 1-to-1 personalized emailing, and SMS dispatch without leaving the cockpit.

### 4.2 Email Architecture & Dispatch System

The system operates four distinct email paths engineered to eliminate duplicate sends while maintaining audit trails:

1. **1-to-1 Direct Outreach:**
   $$\text{Cockpit / Compose Modal} \longrightarrow \text{Resend HTTPS API} \longrightarrow \text{Recipient} \longrightarrow \text{Supabase Log}$$
2. **Automated Multi-Step Sequences:**
   $$\text{Sequence Scheduler} \longrightarrow \text{Step Interval Evaluator} \longrightarrow \text{Resend HTTPS API} \longrightarrow \text{Supabase Log}$$
3. **High-Volume Campaign Blasts:**
   $$\text{Blast Wizard} \longrightarrow \text{Supabase } \texttt{email\_recipients} \text{ Queue} \longrightarrow \texttt{emailBlastWorker} \longrightarrow \text{Resend HTTPS API}$$
4. **Listmonk Campaign Engine (Dockerized):**
   * Synchronizes recipient lists and campaign templates via Listmonk REST API (`http://127.0.0.1:9000`).
   * Maintained in `'draft'` mode during application blast launches to prevent race-condition double-sending.

### 4.3 Telephony & Voice Intelligence (Twilio WebRTC)
* **Browser Softphone:** Uses `@twilio/voice-sdk` to establish browser-to-phone WebRTC audio streams via TwiML voice endpoints (`/api/webhooks/twilio/twiml`).
* **Disposition Tracking:** Logs call duration, connection status (`completed`, `busy`, `no-answer`), and timestamped call notes directly into the prospect's CRM profile.
* **Bidirectional SMS:** Sends outbound SMS via Twilio Messaging and handles inbound webhooks (`/api/webhooks/twilio/sms`) with auto-threading in the Unified Inbox.

### 4.4 Claude AI Co-pilot & Unified Inbox
* **AI Draft Generator:** Powered by `claude-3-5-sonnet-20241022` to analyze full thread history, prospect objections, and company context to generate high-converting reply drafts.
* **Sentiment Classification:** Automatically scores inbound responses as `INTERESTED`, `QUESTION`, `OBJECTION`, or `NOT_INTERESTED`.
* **One-Click Dispatch:** Sales reps can inspect, refine, and send AI-composed drafts instantly.

---

## 5. Database Schema & Data Models (Supabase)

```mermaid
erDiagram
    LEADS ||--o{ EMAIL_THREADS : "has"
    LEADS ||--o{ CALLS : "has"
    LEADS ||--o{ SMS_MESSAGES : "has"
    LEADS ||--o{ ACTIVITY_LOGS : "logs"
    EMAIL_CAMPAIGNS ||--o{ EMAIL_RECIPIENTS : "contains"
    EMAIL_THREADS ||--o{ EMAIL_MESSAGES : "contains"
    EMAIL_SEQUENCES ||--o{ EMAIL_SEQUENCE_STEPS : "defines"

    LEADS {
        uuid id PK
        string first_name
        string last_name
        string full_name
        string email
        string phone
        string company
        string job_title
        int score
        string status
        timestamp created_at
    }

    EMAIL_CAMPAIGNS {
        uuid id PK
        string name
        string subject
        text content
        string status
        jsonb stats
        timestamp created_at
    }

    EMAIL_RECIPIENTS {
        uuid id PK
        uuid campaign_id FK
        uuid lead_id FK
        string email
        string status
        timestamp sent_at
    }

    EMAIL_THREADS {
        uuid id PK
        uuid lead_id FK
        string subject
        string last_message_snippet
        timestamp last_message_at
    }

    EMAIL_MESSAGES {
        uuid id PK
        uuid thread_id FK
        string direction
        string sender
        string recipient
        string subject
        text body_html
        string status
        timestamp created_at
    }

    CALLS {
        uuid id PK
        uuid lead_id FK
        string call_sid
        string to_number
        string status
        int duration
        text notes
        timestamp created_at
    }

    ACTIVITY_LOGS {
        uuid id PK
        uuid lead_id FK
        string type
        text description
        jsonb metadata
        timestamp created_at
    }
```

---

## 6. Security, Authentication & Single-Admin Model

* **Single-Admin Enforcement:** The platform is purpose-built for single-user administrative operation. Role checks in [authGuard.js](file:///c:/Users/Asus/Desktop/80-20-OUTBOUND-SYSTEM-main/80-20-OUTBOUND-SYSTEM-main/OldCode/lib/middleware/authGuard.js) strictly enforce `admin` / `owner` access.
* **Server-Side API Keys:** `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `TWILIO_AUTH_TOKEN`, and `SUPABASE_SERVICE_ROLE_KEY` are isolated to server-side Node.js execution and never leaked to client bundles.
* **Rate Limiting:** Sliding-window rate limiters protect auth routes (`/api/auth/login`), email dispatch endpoints, and Twilio token generation.
* **Anti-Caching:** Telemetry routes emit `Cache-Control: no-store, no-cache, must-revalidate` headers to ensure accurate live reporting.

---

## 7. Operational Environment Reference (`.env`)

```ini
# Application & Core
PORT=3000
JWT_SECRET=super_secret_jwt_token_key_change_me_8020
ADMIN_EMAIL=admin@8020aquisition.com
ADMIN_PASSWORD=AdminPassword2026!

# Supabase PostgreSQL
NEXT_PUBLIC_SUPABASE_URL=https://oatkydlnhenemojbaxwx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres:...@db.oatkydlnhenemojbaxwx.supabase.co:5432/postgres

# Email Engine (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=outreach@8020outbound.com
EMAIL_FROM_NAME=MineTech Outreach

# Listmonk Campaign Server (Docker)
LISTMONK_URL=http://127.0.0.1:9000
LISTMONK_API_USERNAME=listmonk
LISTMONK_API_PASSWORD=listmonk_secure_password

# Telephony & Messaging (Twilio)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+14155550199
TWILIO_TWIML_APP_SID=AP...

# Artificial Intelligence (Anthropic Claude)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

---

## 8. Verification & Diagnostic Commands

```bash
# 1. Run Next.js Linter
npm run lint

# 2. Build Production Bundle
npm run build

# 3. Execute Full Regression Suite (42 test points)
node scripts/test_full_system_regression.js

# 4. Live Claude AI Verification
node scripts/test_live_claude_ai.js

# 5. Live Supabase Database Test (17 test points)
node scripts/test_supabase_database.js

# 6. Security 20-Point Verification
node scripts/test_security_20_point_verification.js

# 7. Production Acceptance Flow (33 test points)
node scripts/test_production_acceptance.js

# 8. Reset/Purge Database to Pristine 0-State
node scripts/purge_test_data.js
```
