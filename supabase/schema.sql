-- ==============================================================================
-- MINETECH 80/20 OUTBOUND SYSTEM — SUPABASE POSTGRESQL SCHEMA
-- Execute this entire script in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent')),
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. LEADS (CRM) TABLE
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  full_name TEXT DEFAULT '',
  email TEXT UNIQUE,
  phone TEXT DEFAULT '',
  company TEXT DEFAULT '',
  job_title TEXT DEFAULT '',
  website TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  niche TEXT DEFAULT '',
  location JSONB DEFAULT '{"city": "", "state": "", "country": "", "timezone": "America/New_York"}'::jsonb,
  status TEXT NOT NULL DEFAULT 'NEW',
  pipeline_stage TEXT NOT NULL DEFAULT 'NEW',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  score NUMERIC DEFAULT 0,
  is_dnc BOOLEAN NOT NULL DEFAULT false,
  dnc_reason TEXT DEFAULT '',
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  enrich_data JSONB DEFAULT '{}'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CALLS (TWILIO VOICE) TABLE
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  direction TEXT DEFAULT 'outbound',
  from_number TEXT DEFAULT '',
  to_number TEXT DEFAULT '',
  duration INTEGER DEFAULT 0,
  status TEXT DEFAULT 'initiated',
  recording_url TEXT DEFAULT '',
  transcription TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  outcome TEXT DEFAULT '',
  sentiment TEXT DEFAULT 'neutral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SMS MESSAGES (TWILIO SMS) TABLE
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid TEXT UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  direction TEXT DEFAULT 'outbound',
  from_number TEXT DEFAULT '',
  to_number TEXT DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. SENDING INBOXES TABLE
CREATE TABLE IF NOT EXISTS public.sending_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT DEFAULT '',
  provider TEXT DEFAULT 'resend',
  daily_limit INTEGER DEFAULT 50,
  sent_today INTEGER DEFAULT 0,
  warmup_active BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. EMAIL TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  body_plain TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'outbound',
  variables TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. EMAIL SEQUENCES TABLE
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  steps JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. EMAIL CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  body_plain TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  campaign_type TEXT NOT NULL DEFAULT 'standard',
  master_prompt TEXT DEFAULT '',
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  sending_inbox_id UUID REFERENCES public.sending_inboxes(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  stats JSONB DEFAULT '{"sent": 0, "opened": 0, "clicked": 0, "replied": 0, "bounced": 0}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. EMAIL RECIPIENTS (CAMPAIGN DISPATCH QUEUE) TABLE
CREATE TABLE IF NOT EXISTS public.email_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  claimed_by TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  resend_id TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  tokens JSONB DEFAULT '{}'::jsonb,
  generated_subject TEXT,
  generated_body TEXT,
  generation_status TEXT NOT NULL DEFAULT 'ready' CHECK (generation_status IN ('pending', 'generating', 'ready', 'failed')),
  generation_error TEXT DEFAULT '',
  generation_locked_at TIMESTAMPTZ,
  generation_claimed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_campaign_lead UNIQUE(campaign_id, lead_id)
);


-- 10. EMAIL THREADS (UNIFIED INBOX) TABLE
CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  subject TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'OPEN',
  snippet TEXT DEFAULT '',
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. EMAIL MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.email_threads(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  direction TEXT DEFAULT 'outbound',
  sender TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  subject TEXT DEFAULT '',
  body_html TEXT DEFAULT '',
  body_plain TEXT DEFAULT '',
  resend_id TEXT DEFAULT '',
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. EMAIL WEBHOOK EVENTS (DEDUPLICATION & AUDIT) TABLE
CREATE TABLE IF NOT EXISTS public.email_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  provider_message_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE & ATTRIBUTION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON public.leads (pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON public.calls (lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON public.calls (call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON public.calls (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_lead_id ON public.sms_messages (lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_message_sid ON public.sms_messages (message_sid);
CREATE INDEX IF NOT EXISTS idx_sms_created_at ON public.sms_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_queue ON public.email_recipients (status, scheduled_at, locked_at);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_generation ON public.email_recipients (generation_status, generation_locked_at);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.email_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_resend_id ON public.email_recipients (resend_id);

CREATE INDEX IF NOT EXISTS idx_email_threads_lead ON public.email_threads (lead_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON public.email_messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_resend_id ON public.email_messages (resend_id);
CREATE INDEX IF NOT EXISTS idx_email_webhook_events_event_id ON public.email_webhook_events (event_id);
CREATE INDEX IF NOT EXISTS idx_email_webhook_events_msg_id ON public.email_webhook_events (provider_message_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_lead ON public.activity_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);

-- ==============================================================================
-- POSTGRESQL RPC: ATOMIC CAMPAIGN RECIPIENT CLAIMING (FOR UPDATE SKIP LOCKED)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.claim_next_email_recipient(
  p_worker_id TEXT DEFAULT 'worker-default',
  p_timeout_minutes INTEGER DEFAULT 5,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS SETOF public.email_recipients
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_id UUID;
  v_stale_threshold TIMESTAMPTZ := NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;
BEGIN
  -- Atomically select and lock the next eligible recipient without blocking concurrent workers
  SELECT r.id INTO v_recipient_id
  FROM public.email_recipients r
  INNER JOIN public.email_campaigns c ON c.id = r.campaign_id
  WHERE (
    (r.status IN ('PENDING', 'pending') AND (r.scheduled_at <= NOW() + INTERVAL '2 seconds'))
    OR
    (r.status IN ('PROCESSING', 'processing') AND r.locked_at < v_stale_threshold)
  )
  AND (p_campaign_id IS NULL OR r.campaign_id = p_campaign_id)
  AND c.status = 'RUNNING'
  AND (r.generation_status = 'ready' OR r.generation_status IS NULL)
  ORDER BY r.created_at ASC
  LIMIT 1
  FOR UPDATE OF r SKIP LOCKED;

  IF v_recipient_id IS NOT NULL THEN
    RETURN QUERY
    UPDATE public.email_recipients
    SET
      status = 'PROCESSING',
      claimed_by = p_worker_id,
      locked_at = NOW(),
      updated_at = NOW()
    WHERE id = v_recipient_id
    RETURNING *;
  END IF;

  RETURN;
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full bypass / access for backend operations
CREATE POLICY "Service Role Full Access Users" ON public.users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Leads" ON public.leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Campaigns" ON public.email_campaigns FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Recipients" ON public.email_recipients FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Threads" ON public.email_threads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Messages" ON public.email_messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Activity" ON public.activity_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Audit" ON public.audit_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Webhooks" ON public.email_webhook_events FOR ALL USING (auth.role() = 'service_role');

-- Authenticated User Policies (Admins have access to application CRM records)
CREATE POLICY "Authenticated Read Leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Modify Leads" ON public.leads FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated Read Threads" ON public.email_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Modify Threads" ON public.email_threads FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated Read Messages" ON public.email_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Modify Messages" ON public.email_messages FOR ALL TO authenticated USING (true);

-- ==============================================================================
-- DEFAULT ADMIN USER SEED (HASHED BCRYPT ONLY)
-- ==============================================================================
INSERT INTO public.users (email, password, name, role, approved)
VALUES (
  'admin@8020aquisition.com',
  '$2a$10$w8g8U8sOaLdG76fI.q1d9uA3.h1nK.v3/y3pM0pZkGz/xGzL4N73q',
  'Admin',
  'admin',
  true
)
ON CONFLICT (email) DO NOTHING;

