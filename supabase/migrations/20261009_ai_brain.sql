-- ====================================================================
-- MINETECH OUTBOUND - AI BRAIN v1 MEMORY
-- Migration Version: 20261009_ai_brain.sql
-- Description: Additive, forward-only. Two tables:
--   ai_lead_intelligence : one cached structured study per lead
--   ai_decisions         : append-only AI outputs + human feedback (learning history)
-- The application degrades gracefully if this migration has not been applied.
-- No prompts or raw model responses are stored.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.ai_lead_intelligence (
  lead_id UUID PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_ANALYZED'
    CHECK (status IN ('NOT_ANALYZED', 'PENDING', 'READY', 'FAILED')), -- STALE is derived from source_hash
  source_hash TEXT,
  analysis_version INTEGER,
  prompt_version TEXT,
  model TEXT,
  priority TEXT CHECK (priority IS NULL OR priority IN ('HOT', 'WARM', 'COLD')),
  confidence NUMERIC(4,2),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  thread_id UUID,
  message_id UUID,                          -- inbound email_messages.id this output relates to
  kind TEXT NOT NULL
    CHECK (kind IN ('CLASSIFICATION', 'NEXT_ACTION', 'EMAIL_DRAFT', 'REPLY_DRAFT')),
  status TEXT NOT NULL DEFAULT 'SUGGESTED'
    CHECK (status IN ('SUGGESTED', 'APPROVED', 'EDITED', 'REJECTED', 'DISMISSED', 'SENT')),
  output JSONB NOT NULL DEFAULT '{}'::jsonb, -- structured result only
  recommended_action TEXT,
  classification TEXT,
  confidence NUMERIC(4,2),
  policy JSONB,                              -- { allowed, blockedBy[], reasons[] }
  stop_reason TEXT,
  draft_original TEXT,                       -- what Claude wrote (truncated)
  draft_final TEXT,                          -- what the human edited / actually sent (truncated)
  edit_stats JSONB,                          -- { charsAdded, charsRemoved, similarity, wasEdited }
  useful BOOLEAN,                            -- explicit thumbs up / down
  outcome TEXT,
  model TEXT,
  prompt_version TEXT,
  created_by TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_lead_created ON public.ai_decisions (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_message_kind ON public.ai_decisions (message_id, kind) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_decisions_kind_status ON public.ai_decisions (kind, status);
CREATE INDEX IF NOT EXISTS idx_ai_lead_intelligence_status ON public.ai_lead_intelligence (status);

-- Server-only tables: RLS on with no policies = service role access only (anon/authenticated blocked).
ALTER TABLE public.ai_lead_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;
