-- ==============================================================================
-- MINETECH MASTER ENHANCEMENTS MIGRATION
-- 1. Buyer/Seller Lead Classification
-- 2. Campaign-Lead Junction (Many-to-Many Relationship)
-- 3. General-Purpose Claude AI Chat (Conversations & Messages)
-- 4. Professional Email Drafts Storage
-- ==============================================================================

-- 1. BUYER/SELLER CLASSIFICATION ON LEADS
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS classification VARCHAR(50) DEFAULT 'Unclassified';

CREATE INDEX IF NOT EXISTS idx_leads_classification 
  ON public.leads(classification);

-- 2. CAMPAIGN-LEADS JUNCTION TABLE (Many-to-Many Association)
CREATE TABLE IF NOT EXISTS public.campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_campaign_leads_rel UNIQUE (campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign 
  ON public.campaign_leads(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead 
  ON public.campaign_leads(lead_id);

-- Populate campaign_leads from existing email_recipients if any exist
INSERT INTO public.campaign_leads (campaign_id, lead_id, status, created_at, updated_at)
SELECT DISTINCT r.campaign_id, r.lead_id, 'ACTIVE', COALESCE(r.created_at, NOW()), COALESCE(r.updated_at, NOW())
FROM public.email_recipients r
WHERE r.campaign_id IS NOT NULL AND r.lead_id IS NOT NULL
ON CONFLICT (campaign_id, lead_id) DO NOTHING;

-- 3. GENERAL-PURPOSE CLAUDE AI CONVERSATIONS & MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user 
  ON public.chat_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,
  tokens_used JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv 
  ON public.chat_messages(conversation_id, created_at ASC);

-- 4. PROFESSIONAL EMAIL DRAFTS STORAGE
CREATE TABLE IF NOT EXISTS public.email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  recipient TEXT,
  to_list TEXT[],
  cc TEXT[],
  bcc TEXT[],
  subject TEXT DEFAULT '',
  body_html TEXT DEFAULT '',
  body_text TEXT DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_user 
  ON public.email_drafts(user_id, updated_at DESC);

