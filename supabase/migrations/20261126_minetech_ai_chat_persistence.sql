-- ==============================================================================
-- MINETECH AI PERSISTENT CHAT SYSTEM MIGRATION
-- Ensures full Supabase PostgreSQL persistence for MineTech AI conversations,
-- messages, tool-call telemetry, user/organization ownership, and RLS policies.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL DEFAULT 'minetech-default',
  title TEXT NOT NULL DEFAULT 'New Conversation',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated
  ON public.chat_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_org_updated
  ON public.chat_conversations(organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,
  thinking TEXT,
  tool_calls JSONB DEFAULT '[]'::jsonb,
  tokens_used JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
  ON public.chat_messages(conversation_id, created_at ASC);

-- Enable Row Level Security
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies (service_role bypasses RLS automatically; authenticated users isolated by user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_conversations' AND policyname = 'chat_conversations_owner_all'
  ) THEN
    CREATE POLICY chat_conversations_owner_all ON public.chat_conversations
      FOR ALL
      USING (auth.uid() = user_id OR user_id IS NULL)
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_owner_all'
  ) THEN
    CREATE POLICY chat_messages_owner_all ON public.chat_messages
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.chat_conversations c
          WHERE c.id = chat_messages.conversation_id
            AND (c.user_id = auth.uid() OR c.user_id IS NULL)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.chat_conversations c
          WHERE c.id = chat_messages.conversation_id
            AND (c.user_id = auth.uid() OR c.user_id IS NULL)
        )
      );
  END IF;
END $$;
