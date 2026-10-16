-- ==============================================================================
-- MINETECH EMAIL INFRASTRUCTURE PRODUCTION FINALIZATION MIGRATION
-- Migration Version: 20261016_email_production_finalization.sql
-- Description: Adds RFC 2822 threading headers, CC/BCC, attachments,
--              Google Workspace/Gmail synchronization states, and idempotent
--              webhook lifecycle tracking.
-- ==============================================================================

-- 1. Extend email_messages with Threading, Delivery, and Gmail Sync Columns
ALTER TABLE IF EXISTS public.email_messages
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS in_reply_to TEXT,
  ADD COLUMN IF NOT EXISTS "references" TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cc TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bcc TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gmail_synced BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT,
  ADD COLUMN IF NOT EXISTS gmail_sync_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS gmail_sync_error TEXT;

-- Backfill message_id from resend_id if message_id is null and resend_id looks like an RFC Message-ID
UPDATE public.email_messages
SET message_id = resend_id
WHERE message_id IS NULL AND resend_id LIKE '<%@%>';

-- 2. Extend email_threads with Participant and Timestamp Tracking
ALTER TABLE IF EXISTS public.email_threads
  ADD COLUMN IF NOT EXISTS participants TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ;

-- 3. Dedicated Webhook Events Table with Idempotency State Machine
CREATE TABLE IF NOT EXISTS public.email_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'resend',
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'received', -- 'received', 'processing', 'processed', 'failed', 'pending_reconciliation'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Distributed System Locks Table for Background Schedulers & Workers
CREATE TABLE IF NOT EXISTS public.system_locks (
  lock_key TEXT PRIMARY KEY,
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 5. Performance Indexes for Query Routing and Threading
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id 
  ON public.email_messages (message_id);

CREATE INDEX IF NOT EXISTS idx_email_messages_in_reply_to 
  ON public.email_messages (in_reply_to);

CREATE INDEX IF NOT EXISTS idx_email_messages_resend_id 
  ON public.email_messages (resend_id);

CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_sync_status 
  ON public.email_messages (gmail_sync_status);

CREATE INDEX IF NOT EXISTS idx_email_threads_lead_id 
  ON public.email_threads (lead_id);

CREATE INDEX IF NOT EXISTS idx_email_webhook_events_event_id 
  ON public.email_webhook_events (event_id);

CREATE INDEX IF NOT EXISTS idx_email_webhook_events_status 
  ON public.email_webhook_events (status);

-- 6. Row Level Security Policies
ALTER TABLE public.email_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service Role Full Access Webhook Events" ON public.email_webhook_events;
CREATE POLICY "Service Role Full Access Webhook Events" 
  ON public.email_webhook_events FOR ALL 
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service Role Full Access System Locks" ON public.system_locks;
CREATE POLICY "Service Role Full Access System Locks" 
  ON public.system_locks FOR ALL 
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated Read Webhook Events" ON public.email_webhook_events;
CREATE POLICY "Authenticated Read Webhook Events" 
  ON public.email_webhook_events FOR SELECT 
  TO authenticated 
  USING (true);
