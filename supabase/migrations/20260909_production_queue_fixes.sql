-- ====================================================================
-- MINDTECH OUTBOUND CRM - PRODUCTION QUEUE, WORKER & IDEMPOTENCY MIGRATION
-- Migration Version: 20260909_production_queue_fixes.sql
-- Description: Adds canonical generation columns, webhook events lifecycle,
--              atomic RPCs for recipient/generation claiming, and distributed locking.
-- ====================================================================

-- 1. Canonical AI Generation & Attribution Columns on email_recipients
ALTER TABLE IF EXISTS email_recipients 
  ADD COLUMN IF NOT EXISTS generation_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS generation_worker_id TEXT,
  ADD COLUMN IF NOT EXISTS generation_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generation_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generation_error TEXT,
  ADD COLUMN IF NOT EXISTS resend_id TEXT,
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Backfill generation_status from legacy JSON tokens if present
UPDATE email_recipients 
SET generation_status = COALESCE(tokens->>'generation_status', 'ready')
WHERE generation_status IS NULL OR generation_status = 'pending' AND status = 'sent';

-- 2. resend_id on email_messages
ALTER TABLE IF EXISTS email_messages 
  ADD COLUMN IF NOT EXISTS resend_id TEXT;

-- 3. Dedicated Webhook Events Table with State Machine
CREATE TABLE IF NOT EXISTS email_webhook_events (
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

-- 4. Distributed System Locks Table for Schedulers & Workers
CREATE TABLE IF NOT EXISTS system_locks (
  lock_key TEXT PRIMARY KEY,
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 5. Performance & Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_email_recipients_blast_id_status 
  ON email_recipients(blast_id, status);

CREATE INDEX IF NOT EXISTS idx_email_recipients_generation_status 
  ON email_recipients(blast_id, generation_status);

CREATE INDEX IF NOT EXISTS idx_email_recipients_resend_id 
  ON email_recipients(resend_id);

CREATE INDEX IF NOT EXISTS idx_email_messages_resend_id 
  ON email_messages(resend_id);

CREATE INDEX IF NOT EXISTS idx_email_webhook_events_event_id 
  ON email_webhook_events(event_id);

CREATE INDEX IF NOT EXISTS idx_email_webhook_events_status 
  ON email_webhook_events(status);

CREATE INDEX IF NOT EXISTS idx_calls_call_sid 
  ON calls(call_sid);

CREATE INDEX IF NOT EXISTS idx_sms_logs_message_sid 
  ON sms_logs(message_sid);

-- 6. RPC: Atomic Email Recipient Claim (Send Queue)
CREATE OR REPLACE FUNCTION claim_next_email_recipient(
  p_blast_id UUID,
  p_worker_id TEXT,
  p_stale_interval_seconds INT DEFAULT 300
)
RETURNS TABLE (
  id UUID,
  blast_id UUID,
  lead_id UUID,
  email TEXT,
  status VARCHAR,
  custom_subject TEXT,
  custom_body TEXT,
  scheduled_at TIMESTAMPTZ,
  tokens JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_id UUID;
  v_stale_threshold TIMESTAMPTZ := NOW() - (p_stale_interval_seconds || ' seconds')::INTERVAL;
BEGIN
  -- Select candidate with row lock SKIP LOCKED
  -- AI blasts require generation_status = 'ready' (or NULL/skipped for non-AI blasts)
  SELECT r.id INTO v_recipient_id
  FROM email_recipients r
  JOIN email_blasts b ON b.id = r.blast_id
  WHERE r.blast_id = p_blast_id
    AND (
      -- Pending candidate ready to be sent
      (r.status = 'pending' AND (r.scheduled_at IS NULL OR r.scheduled_at <= NOW()))
      OR
      -- Stale processing lock recovery
      (r.status = 'processing' AND r.claimed_at < v_stale_threshold)
    )
    AND (
      b.ai_enabled IS NOT TRUE 
      OR r.generation_status = 'ready'
      OR r.generation_status IS NULL
    )
  ORDER BY r.scheduled_at ASC NULLS FIRST, r.created_at ASC
  LIMIT 1
  FOR UPDATE OF r SKIP LOCKED;

  IF v_recipient_id IS NULL THEN
    RETURN;
  END IF;

  -- Atomically claim candidate
  UPDATE email_recipients
  SET 
    status = 'processing',
    claimed_by = p_worker_id,
    claimed_at = NOW()
  WHERE email_recipients.id = v_recipient_id;

  -- Return claimed row
  RETURN QUERY
  SELECT 
    r.id,
    r.blast_id,
    r.lead_id,
    r.email,
    r.status,
    r.custom_subject,
    r.custom_body,
    r.scheduled_at,
    r.tokens
  FROM email_recipients r
  WHERE r.id = v_recipient_id;
END;
$$;

-- 7. RPC: Atomic AI Generation Recipient Claim
CREATE OR REPLACE FUNCTION claim_next_generation_recipient(
  p_blast_id UUID,
  p_worker_id TEXT,
  p_stale_interval_seconds INT DEFAULT 300
)
RETURNS TABLE (
  id UUID,
  blast_id UUID,
  lead_id UUID,
  email TEXT,
  generation_status VARCHAR,
  tokens JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_id UUID;
  v_stale_threshold TIMESTAMPTZ := NOW() - (p_stale_interval_seconds || ' seconds')::INTERVAL;
BEGIN
  SELECT r.id INTO v_recipient_id
  FROM email_recipients r
  WHERE r.blast_id = p_blast_id
    AND (
      r.generation_status = 'pending'
      OR (r.generation_status = 'processing' AND r.generation_claimed_at < v_stale_threshold)
    )
    AND r.status = 'pending'
  ORDER BY r.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_recipient_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE email_recipients
  SET 
    generation_status = 'processing',
    generation_worker_id = p_worker_id,
    generation_claimed_at = NOW(),
    generation_attempts = COALESCE(generation_attempts, 0) + 1
  WHERE email_recipients.id = v_recipient_id;

  RETURN QUERY
  SELECT 
    r.id,
    r.blast_id,
    r.lead_id,
    r.email,
    r.generation_status,
    r.tokens
  FROM email_recipients r
  WHERE r.id = v_recipient_id;
END;
$$;

-- 8. RPC: Atomic Campaign Stat Increment
CREATE OR REPLACE FUNCTION increment_campaign_stat(
  p_blast_id UUID,
  p_field TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_field = 'sent' THEN
    UPDATE email_blasts
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{sent}', (COALESCE((stats->>'sent')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  ELSIF p_field = 'delivered' THEN
    UPDATE email_blasts
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{delivered}', (COALESCE((stats->>'delivered')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  ELSIF p_field = 'opened' THEN
    UPDATE email_blasts
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{opened}', (COALESCE((stats->>'opened')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  ELSIF p_field = 'clicked' THEN
    UPDATE email_blasts
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{clicked}', (COALESCE((stats->>'clicked')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  ELSIF p_field = 'bounced' THEN
    UPDATE email_blasts
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{bounced}', (COALESCE((stats->>'bounced')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  END IF;
END;
$$;

-- 9. RPC: Distributed Locking
CREATE OR REPLACE FUNCTION acquire_system_lock(
  p_lock_key TEXT,
  p_worker_id TEXT,
  p_ttl_seconds INT DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_acquired BOOLEAN := FALSE;
BEGIN
  -- Clean up expired locks first
  DELETE FROM system_locks WHERE lock_key = p_lock_key AND expires_at < NOW();

  -- Attempt to insert new lock
  INSERT INTO system_locks (lock_key, locked_by, locked_at, expires_at)
  VALUES (p_lock_key, p_worker_id, NOW(), NOW() + (p_ttl_seconds || ' seconds')::INTERVAL)
  ON CONFLICT (lock_key) DO NOTHING;

  IF FOUND THEN
    v_acquired := TRUE;
  END IF;

  RETURN v_acquired;
END;
$$;

CREATE OR REPLACE FUNCTION release_system_lock(
  p_lock_key TEXT,
  p_worker_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM system_locks 
  WHERE lock_key = p_lock_key AND locked_by = p_worker_id;
  RETURN FOUND;
END;
$$;

-- 10. RLS Policies
ALTER TABLE email_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on email_webhook_events" ON email_webhook_events;
CREATE POLICY "Service role full access on email_webhook_events" ON email_webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on system_locks" ON system_locks;
CREATE POLICY "Service role full access on system_locks" ON system_locks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
