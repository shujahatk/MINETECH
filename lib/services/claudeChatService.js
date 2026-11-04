import { supabaseAdmin } from '../supabase.js';
import fs from 'fs';
import path from 'path';

export const CLAUDE_MODELS = {
  SONNET: {
    id: 'claude-sonnet-4-6',
    name: 'MineTech AI',
    displayName: 'MineTech AI (Claude Sonnet 4.6)',
    description: 'High-capability model for general everyday tasks, coding, analysis, and writing',
    supportsThinking: true,
  },
  OPUS: {
    id: 'claude-opus-4-6',
    name: 'MineTech AI High',
    displayName: 'MineTech AI High (Claude Opus 4.6)',
    description: 'Premium reasoning for advanced instructions, architectural logic, and deep analysis',
    supportsThinking: true,
  },
  HAIKU: {
    id: 'claude-haiku-4-5',
    name: 'MineTech Fast',
    displayName: 'MineTech Fast (Claude Haiku 4.5)',
    description: 'Fast, lightweight responses for summarization, quick questions, and high-frequency tasks',
    supportsThinking: false,
  },
};

export const DEFAULT_MODEL_ID = CLAUDE_MODELS.SONNET.id;

const GENERAL_SYSTEM_PROMPT = `You are Claude, a helpful, thoughtful, and highly capable AI assistant built into the MineTech Outbound platform. 
You assist users with general questions, multi-step tasks, research, business analysis, coding, document creation, summarization, and strategic planning.
Always maintain prompt integrity: respect the exact instructions, formatting, and constraints given by the user. Do not force user prompts into sales or mining contexts unless requested.
Provide well-structured, clear, and actionable responses with clean markdown formatting.`;

// Local file-based fallback storage for chat history if Supabase chat tables are not yet migrated
const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.data', 'chat');
function ensureLocalStorage() {
  try {
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
    }
  } catch (e) {}
}

function getLocalConversations() {
  ensureLocalStorage();
  const filePath = path.join(LOCAL_STORAGE_DIR, 'conversations.json');
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveLocalConversations(convs) {
  ensureLocalStorage();
  const filePath = path.join(LOCAL_STORAGE_DIR, 'conversations.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(convs, null, 2), 'utf8');
  } catch (e) {}
}

/**
 * Execute a general-purpose chat request with Anthropic API
 */
export async function executeClaudeChat({
  messages = [],
  model = DEFAULT_MODEL_ID,
  systemPrompt = null,
  enableThinking = false,
  maxTokens = null,
  temperature = 0.7,
}) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured (ANTHROPIC_API_KEY).');
  }

  // Validate model - never silently downgrade if valid
  const validModels = Object.values(CLAUDE_MODELS).map((m) => m.id);
  const selectedModel = validModels.includes(model) ? model : DEFAULT_MODEL_ID;

  // Clean and prepare message history (preserving prompt integrity)
  const formattedMessages = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
  }));

  if (formattedMessages.length === 0) {
    throw new Error('Chat request must include at least one message.');
  }

  const effectiveSystemPrompt = systemPrompt || GENERAL_SYSTEM_PROMPT;

  const payload = {
    model: selectedModel,
    system: effectiveSystemPrompt,
    messages: formattedMessages,
    max_tokens: maxTokens || (enableThinking ? 8192 : 4096),
  };

  // Thinking configuration for models that support it
  if (enableThinking && (selectedModel.includes('sonnet') || selectedModel.includes('opus'))) {
    payload.thinking = { type: 'enabled', budget_tokens: 1024 };
    // Temperature cannot be set when thinking is enabled in Anthropic API
  } else {
    payload.temperature = temperature;
  }

  console.log(`[Claude API] Dispatched model: ${selectedModel} | Requested: ${model} | Thinking: ${enableThinking ? 'enabled' : 'disabled'} | History turns: ${formattedMessages.length}`);

  const startTime = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseTimeMs = Date.now() - startTime;

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const errorMessage = errorJson.error?.message || `Anthropic API error (${res.status})`;
    throw new Error(`Claude API Error: ${errorMessage}`);
  }

  const data = await res.json();

  let replyText = '';
  let thinkingContent = '';

  if (Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === 'text') {
        replyText += block.text;
      } else if (block.type === 'thinking') {
        thinkingContent += block.thinking;
      }
    }
  }

  return {
    content: replyText,
    thinking: thinkingContent || null,
    model: data.model || selectedModel,
    usage: data.usage || {},
    responseTimeMs,
    stopReason: data.stop_reason,
  };
}

/**
 * List conversations for a user
 */
export async function listConversations(userId = null) {
  try {
    let query = supabaseAdmin
      .from('chat_conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (!error && data) {
      return data;
    }
  } catch (e) {}

  // Fallback to local storage
  const local = getLocalConversations();
  if (userId) {
    return local.filter((c) => c.user_id === userId);
  }
  return local;
}

/**
 * Create a new conversation
 */
export async function createConversation({ title = 'New Conversation', model = DEFAULT_MODEL_ID, userId = null }) {
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_conversations')
      .insert({
        title,
        model,
        user_id: userId,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (!error && data) return data;
  } catch (e) {}

  // Fallback to local storage
  const convId = 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const newConv = {
    id: convId,
    title,
    model,
    user_id: userId,
    created_at: now,
    updated_at: now,
    messages: [],
  };
  const list = getLocalConversations();
  list.unshift(newConv);
  saveLocalConversations(list);
  return newConv;
}

/**
 * Get conversation by ID with all its messages
 */
export async function getConversation(conversationId) {
  try {
    const { data: conv, error: convErr } = await supabaseAdmin
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (!convErr && conv) {
      const { data: msgs } = await supabaseAdmin
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      return {
        ...conv,
        messages: msgs || [],
      };
    }
  } catch (e) {}

  // Fallback to local storage
  const list = getLocalConversations();
  const found = list.find((c) => c.id === conversationId);
  if (found) {
    return {
      ...found,
      messages: found.messages || [],
    };
  }
  return null;
}

/**
 * Update conversation title
 */
export async function updateConversation(conversationId, { title, model }) {
  const now = new Date().toISOString();
  const updates = { updated_at: now };
  if (title !== undefined) updates.title = title;
  if (model !== undefined) updates.model = model;

  try {
    const { data, error } = await supabaseAdmin
      .from('chat_conversations')
      .update(updates)
      .eq('id', conversationId)
      .select('*')
      .single();

    if (!error && data) return data;
  } catch (e) {}

  // Fallback to local storage
  const list = getLocalConversations();
  const idx = list.findIndex((c) => c.id === conversationId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    saveLocalConversations(list);
    return list[idx];
  }
  return null;
}

export async function renameConversation(conversationId, title) {
  return await updateConversation(conversationId, { title });
}

export async function getConversationMessages(conversationId) {
  const conv = await getConversation(conversationId);
  return conv ? conv.messages || [] : [];
}

/**
 * Delete conversation
 */
export async function deleteConversation(conversationId) {
  try {
    await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId);

    const { error } = await supabaseAdmin
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);

    if (!error) return { success: true };
  } catch (e) {}

  // Fallback to local storage
  let list = getLocalConversations();
  list = list.filter((c) => c.id !== conversationId);
  saveLocalConversations(list);
  return { success: true };
}

/**
 * Save message to conversation history
 */
export async function saveChatMessage({ conversationId, role, content, model, tokensUsed = null }) {
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        model,
        tokens_used: tokensUsed,
        created_at: now,
      })
      .select('*')
      .single();

    // Touch conversation updated_at
    await supabaseAdmin
      .from('chat_conversations')
      .update({ updated_at: now })
      .eq('id', conversationId);

    if (!error && data) return data;
  } catch (e) {}

  // Fallback to local storage
  const list = getLocalConversations();
  const conv = list.find((c) => c.id === conversationId);
  if (conv) {
    if (!conv.messages) conv.messages = [];
    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      conversation_id: conversationId,
      role,
      content,
      model,
      tokens_used: tokensUsed,
      created_at: now,
    };
    conv.messages.push(msg);
    conv.updated_at = now;
    saveLocalConversations(list);
    return msg;
  }
  return null;
}
