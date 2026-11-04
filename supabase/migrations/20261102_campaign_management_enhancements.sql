-- ==============================================================================
-- MINETECH CAMPAIGN MANAGEMENT OVERHAUL & RLS ENHANCEMENTS
-- Migration Version: 20261102_campaign_management_enhancements.sql
-- Description: Ensures email_campaigns has canonical columns, fixes
--              increment_campaign_stat to target email_campaigns, adds
--              performance indexes and authenticated RLS policies.
-- ==============================================================================

-- 1. Ensure canonical columns on public.email_campaigns
ALTER TABLE IF EXISTS public.email_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS master_prompt TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sending_inbox_id UUID REFERENCES public.sending_inboxes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Backfill campaign_type and master_prompt from stats JSONB if present
UPDATE public.email_campaigns
SET
  campaign_type = COALESCE(campaign_type, stats->>'campaign_type', 'standard'),
  master_prompt = COALESCE(master_prompt, stats->>'master_prompt', '')
WHERE campaign_type IS NULL OR master_prompt IS NULL;

-- 2. Performance Indexes for Campaign Querying & Filtering
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status
  ON public.email_campaigns (status);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at
  ON public.email_campaigns (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_recipients_campaign_lead
  ON public.email_recipients (campaign_id, lead_id);

CREATE INDEX IF NOT EXISTS idx_email_recipients_status_campaign
  ON public.email_recipients (campaign_id, status);

-- 3. Atomic Campaign Stat Increment RPC (Targeting public.email_campaigns)
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
    UPDATE public.email_campaigns
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{sent}', (COALESCE((stats->>'sent')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  ELSIF p_field = 'delivered' THEN
    UPDATE public.email_campaigns
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{delivered}', (COALESCE((stats->>'delivered')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  ELSIF p_field = 'opened' THEN
    UPDATE public.email_campaigns
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{opened}', (COALESCE((stats->>'opened')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  ELSIF p_field = 'clicked' THEN
    UPDATE public.email_campaigns
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{clicked}', (COALESCE((stats->>'clicked')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  ELSIF p_field = 'bounced' THEN
    UPDATE public.email_campaigns
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{bounced}', (COALESCE((stats->>'bounced')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  ELSIF p_field = 'failed' THEN
    UPDATE public.email_campaigns
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{failed}', (COALESCE((stats->>'failed')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  ELSIF p_field = 'replied' THEN
    UPDATE public.email_campaigns
    SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{replied}', (COALESCE((stats->>'replied')::int, 0) + 1)::text::jsonb)
    WHERE id = p_blast_id;
  END IF;
END;
$$;

-- 4. Row Level Security Policies for Authenticated Application Users
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recipients ENABLE ROW LEVEL SECURITY;

-- Service Role Full Access
DROP POLICY IF EXISTS "Service Role Full Access Campaigns" ON public.email_campaigns;
CREATE POLICY "Service Role Full Access Campaigns"
  ON public.email_campaigns FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service Role Full Access Recipients" ON public.email_recipients;
CREATE POLICY "Service Role Full Access Recipients"
  ON public.email_recipients FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated Users Access (Application CRM access)
DROP POLICY IF EXISTS "Authenticated Read Campaigns" ON public.email_campaigns;
CREATE POLICY "Authenticated Read Campaigns"
  ON public.email_campaigns FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated Modify Campaigns" ON public.email_campaigns;
CREATE POLICY "Authenticated Modify Campaigns"
  ON public.email_campaigns FOR ALL
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated Read Recipients" ON public.email_recipients;
CREATE POLICY "Authenticated Read Recipients"
  ON public.email_recipients FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated Modify Recipients" ON public.email_recipients;
CREATE POLICY "Authenticated Modify Recipients"
  ON public.email_recipients FOR ALL
  TO authenticated
  USING (true);

