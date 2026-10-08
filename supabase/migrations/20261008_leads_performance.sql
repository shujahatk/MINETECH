-- =====================================================================
-- MineTech 80/20 — Leads performance migration (20261008)
--
-- PURELY ADDITIVE and idempotent:
--   * no table/column is created, altered, dropped or truncated
--   * no data is modified
--   * every index uses IF NOT EXISTS and is created inside a guarded block, so an
--     index that cannot be built on a drifted schema is skipped with a NOTICE instead of failing
--   * Calls / SMS tables and migrations are untouched
--
-- Safe to re-run. Roll back by dropping the indexes / function named below.
-- NOTE: indexes are built without CONCURRENTLY (not allowed inside a transaction block). On a very
-- large leads table, run the statements individually with CONCURRENTLY in the SQL editor instead.
-- =====================================================================

-- Trigram support for fast `ILIKE '%term%'` search (Supabase installs extensions into the "extensions" schema)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm unavailable (%): trigram search indexes will be skipped', SQLERRM;
  END;
END $$;

DO $$
DECLARE
  stmt text;
BEGIN
  FOREACH stmt IN ARRAY ARRAY[
    -- Sorting + status filter on the Leads table (default sort is created_at DESC)
    'CREATE INDEX IF NOT EXISTS idx_leads_status_created ON public.leads (status, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON public.leads (updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads (score DESC NULLS LAST)',
    'CREATE INDEX IF NOT EXISTS idx_leads_company_sort ON public.leads (company)',
    'CREATE INDEX IF NOT EXISTS idx_leads_full_name_sort ON public.leads (full_name)',

    -- Owner filter
    'CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads (assigned_to) WHERE assigned_to IS NOT NULL',

    -- Tag filter (tags @> ARRAY[...])
    'CREATE INDEX IF NOT EXISTS idx_leads_tags_gin ON public.leads USING GIN (tags)',

    -- Priority / follow-up filters read these JSON keys
    'CREATE INDEX IF NOT EXISTS idx_leads_cf_priority ON public.leads ((custom_fields->>''priority''))',
    'CREATE INDEX IF NOT EXISTS idx_leads_cf_next_action_date ON public.leads ((custom_fields->>''next_action_date''))',

    -- Debounced search (ILIKE %term%) across name / email / company
    'CREATE INDEX IF NOT EXISTS idx_leads_full_name_trgm ON public.leads USING GIN (full_name gin_trgm_ops)',
    'CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON public.leads USING GIN (email gin_trgm_ops)',
    'CREATE INDEX IF NOT EXISTS idx_leads_company_trgm ON public.leads USING GIN (company gin_trgm_ops)',

    -- Campaign filter + per-lead lookups (the unique key is campaign-first, so lead-first lookups had no index)
    'CREATE INDEX IF NOT EXISTS idx_email_recipients_lead_sent ON public.email_recipients (lead_id, sent_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_email_recipients_email_trgm ON public.email_recipients USING GIN (email gin_trgm_ops)',

    -- Drawer timeline + last-contact aggregate
    'CREATE INDEX IF NOT EXISTS idx_email_messages_lead_created ON public.email_messages (lead_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_email_messages_recipient_trgm ON public.email_messages USING GIN (recipient gin_trgm_ops)',
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_lead_created ON public.activity_logs (lead_id, created_at DESC)',

    -- Sidebar unread badge (head-only COUNT)
    'CREATE INDEX IF NOT EXISTS idx_email_threads_unread ON public.email_threads (last_message_at DESC) WHERE unread_count > 0'
  ] LOOP
    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skipped index (%): %', SQLERRM, stmt;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Last contact per lead for a page of leads: ONE aggregate lookup instead of one query per row.
-- (leads.last_contacted_at is never written by the email pipeline, so it is derived from real sends.)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leads_last_contact(p_lead_ids uuid[])
RETURNS TABLE (lead_id uuid, last_contacted_at timestamptz)
LANGUAGE sql
STABLE
AS $$
  SELECT t.lead_id, MAX(t.ts) AS last_contacted_at
  FROM (
    SELECT m.lead_id, COALESCE(m.sent_at, m.created_at) AS ts
    FROM public.email_messages m
    WHERE m.lead_id = ANY (p_lead_ids)
      AND m.direction = 'outbound'
    UNION ALL
    SELECT r.lead_id, r.sent_at AS ts
    FROM public.email_recipients r
    WHERE r.lead_id = ANY (p_lead_ids)
      AND r.sent_at IS NOT NULL
  ) t
  GROUP BY t.lead_id;
$$;

-- Server-side (service role) use only
REVOKE ALL ON FUNCTION public.leads_last_contact(uuid[]) FROM PUBLIC;
DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.leads_last_contact(uuid[]) FROM anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.leads_last_contact(uuid[]) TO service_role;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'Supabase roles not present; skipped grants for leads_last_contact';
END $$;

-- ---------------------------------------------------------------------
-- Pipeline counts per status in ONE grouped query (replaces downloading every lead's status;
-- PostgREST caps unpaged selects at 1000 rows so the old counts were wrong above that size).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lead_status_counts()
RETURNS TABLE (status text, total bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(UPPER(l.status), ''), 'NEW') AS status, COUNT(*)::bigint AS total
  FROM public.leads l
  GROUP BY 1;
$$;

REVOKE ALL ON FUNCTION public.lead_status_counts() FROM PUBLIC;
DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.lead_status_counts() FROM anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.lead_status_counts() TO service_role;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'Supabase roles not present; skipped grants for lead_status_counts';
END $$;

-- Refresh planner statistics for the tables whose access paths changed
ANALYZE public.leads;
ANALYZE public.email_recipients;
ANALYZE public.email_messages;
