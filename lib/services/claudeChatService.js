import { supabaseAdmin } from '../supabase.js';
import fs from 'fs';
import path from 'path';

export const CLAUDE_MODELS = {
  SONNET: {
    id: 'claude-sonnet-4-6',
    name: 'MineTech AI',
    displayName: 'MineTech AI (Sonnet 4.6)',
    description: 'High-capability model for general everyday tasks, coding, analysis, and writing',
    supportsThinking: true,
  },
  OPUS: {
    id: 'claude-opus-4-6',
    name: 'MineTech AI High',
    displayName: 'MineTech AI High (Opus 4.6)',
    description: 'Premium reasoning for advanced instructions, architectural logic, and deep analysis',
    supportsThinking: true,
  },
  HAIKU: {
    id: 'claude-haiku-4-5',
    name: 'MineTech Fast',
    displayName: 'MineTech Fast (Haiku 4.5)',
    description: 'Fast, lightweight responses for summarization, quick questions, and high-frequency tasks',
    supportsThinking: false,
  },
};

export const DEFAULT_MODEL_ID = CLAUDE_MODELS.SONNET.id;

const GENERAL_SYSTEM_PROMPT = `You are MineTech AI, a helpful, thoughtful, and highly capable AI assistant built into the MineTech Outbound platform. 
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
  } catch (e) { }
}

function getLocalConversations() {
  ensureLocalStorage();
  const filePath = path.join(LOCAL_STORAGE_DIR, 'conversations.json');
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) { }
  return [];
}

function saveLocalConversations(convs) {
  ensureLocalStorage();
  const filePath = path.join(LOCAL_STORAGE_DIR, 'conversations.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(convs, null, 2), 'utf8');
  } catch (e) { }
}

export const CRM_READ_TOOLS = [
  {
    name: 'search_leads',
    description: 'Search the MineTech CRM database for leads by keyword, company name, contact name, email, or classification (Buyer, Seller, Buyer & Seller). Returns authentic CRM records.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for name, company, email, or mineral products' },
        classification: { type: 'string', enum: ['ALL', 'Buyer', 'Seller', 'Buyer & Seller', 'Unassigned'], description: 'Optional classification filter' },
        limit: { type: 'number', description: 'Number of results to return (default 10, max 25)' },
      },
    },
  },
  {
    name: 'get_lead_details',
    description: 'Get full profile, notes, contact information, classification, and scoring for a specific lead by UUID or exact company name.',
    input_schema: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'UUID of the lead' },
        companyOrName: { type: 'string', description: 'Company name or contact name if UUID is not known' },
      },
    },
  },
  {
    name: 'get_crm_interaction_history',
    description: 'Fetch real email messages, outbound campaigns, call logs, and follow-ups for a specific lead or company. Never guess or fabricate interactions; use this tool to verify.',
    input_schema: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'UUID of the lead' },
        emailOrCompany: { type: 'string', description: 'Email address or company name if UUID is not known' },
      },
    },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Get live CRM sales pipeline summary with total lead counts, breakdown by stage (New Lead, Contacted, Engaged, Technical Evaluation, Commercial Discussion, Trial Order, Approved Supplier, Recurring Customer) and breakdown by role (Buyers, Sellers, Buyer & Seller, Unassigned).',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_campaign_stats',
    description: 'Get all marketing and outbound outreach campaigns in the system with their status, recipient count, sent count, delivered count, and creation dates.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max campaigns to return (default 10)' },
      },
    },
  },
];

async function executeCrmTool(name, input) {
  try {
    switch (name) {
      case 'search_leads': {
        const { query = '', classification = 'ALL', limit = 10 } = input || {};
        let q = supabaseAdmin.from('leads').select('id, full_name, company, email, phone, job_title, status, score, custom_fields').limit(Math.min(limit, 25));
        if (query) {
          q = q.or(`full_name.ilike.%${query}%,company.ilike.%${query}%,email.ilike.%${query}%`);
        }
        if (classification && classification !== 'ALL') {
          q = q.or(`custom_fields->>classification.eq.${classification},custom_fields->>leadRole.eq.${classification},custom_fields->>lead_role.eq.${classification}`);
        }
        const { data: rows, error } = await q;
        if (error) return { error: error.message };
        return {
          totalReturned: rows?.length || 0,
          leads: (rows || []).map((r) => ({
            id: r.id,
            name: r.full_name,
            company: r.company,
            email: r.email,
            jobTitle: r.job_title,
            classification: r.custom_fields?.classification || r.custom_fields?.leadRole || 'Unassigned',
            status: r.status,
            score: r.score,
            materials: r.custom_fields?.materials || r.custom_fields?.product_category || '',
          })),
        };
      }
      case 'get_lead_details': {
        const { leadId, companyOrName } = input || {};
        let query = supabaseAdmin.from('leads').select('*');
        if (leadId) {
          query = query.eq('id', leadId);
        } else if (companyOrName) {
          query = query.or(`company.ilike.%${companyOrName}%,full_name.ilike.%${companyOrName}%`);
        } else {
          return { error: 'leadId or companyOrName is required' };
        }
        const { data, error } = await query.limit(1).maybeSingle();
        if (error) return { error: error.message };
        if (!data) return { found: false, message: 'No matching lead found in CRM.' };
        return {
          found: true,
          lead: {
            id: data.id,
            name: data.full_name,
            company: data.company,
            email: data.email,
            phone: data.phone,
            jobTitle: data.job_title,
            classification: data.custom_fields?.classification || data.custom_fields?.leadRole || 'Unassigned',
            status: data.status,
            pipelineStage: data.pipeline_stage || data.status,
            score: data.score,
            notes: data.notes,
            customFields: data.custom_fields,
            created_at: data.created_at,
            last_contacted_at: data.last_contacted_at,
          },
        };
      }
      case 'get_crm_interaction_history': {
        const { leadId, emailOrCompany } = input || {};
        let resolvedLeadId = leadId;
        if (!resolvedLeadId && emailOrCompany) {
          const { data: foundLead } = await supabaseAdmin.from('leads').select('id, email, company').or(`email.ilike.%${emailOrCompany}%,company.ilike.%${emailOrCompany}%`).limit(1).maybeSingle();
          if (foundLead) resolvedLeadId = foundLead.id;
        }
        if (!resolvedLeadId) {
          return { interactionsFound: false, message: 'Lead not identified in CRM database.' };
        }
        const [msgRes, callRes, recRes] = await Promise.all([
          supabaseAdmin.from('email_messages').select('id, direction, sender, recipient, subject, sent_at, status').eq('lead_id', resolvedLeadId).order('sent_at', { ascending: false }).limit(10),
          supabaseAdmin.from('call_logs').select('id, direction, status, duration_seconds, notes, created_at').eq('lead_id', resolvedLeadId).order('created_at', { ascending: false }).limit(5),
          supabaseAdmin.from('email_recipients').select('campaign_id, status, scheduled_at, email_campaigns(name, status)').eq('lead_id', resolvedLeadId).limit(5),
        ]);
        const messages = msgRes.data || [];
        const calls = callRes.data || [];
        const campaigns = recRes.data || [];
        return {
          interactionsFound: messages.length > 0 || calls.length > 0 || campaigns.length > 0,
          emailMessagesCount: messages.length,
          messages,
          callsCount: calls.length,
          calls,
          campaignsCount: campaigns.length,
          campaigns,
        };
      }
      case 'get_pipeline_summary': {
        const { data: allLeads } = await supabaseAdmin.from('leads').select('status, pipeline_stage, custom_fields');
        const leads = allLeads || [];
        const stages = {};
        const roles = { Buyer: 0, Seller: 0, 'Buyer & Seller': 0, Unassigned: 0 };
        leads.forEach((l) => {
          const s = (l.status || l.pipeline_stage || 'NEW').toUpperCase();
          stages[s] = (stages[s] || 0) + 1;
          const r = l.custom_fields?.classification || l.custom_fields?.leadRole || l.custom_fields?.lead_role || 'Unassigned';
          if (roles[r] !== undefined) roles[r]++;
          else if (r.toLowerCase().includes('buyer') && r.toLowerCase().includes('seller')) roles['Buyer & Seller']++;
          else if (r.toLowerCase().includes('buyer')) roles['Buyer']++;
          else if (r.toLowerCase().includes('seller')) roles['Seller']++;
          else roles['Unassigned']++;
        });
        return {
          totalLeads: leads.length,
          stageBreakdown: stages,
          classificationBreakdown: roles,
        };
      }
      case 'get_campaign_stats': {
        const { limit = 10 } = input || {};
        const { data: camps } = await supabaseAdmin.from('email_campaigns').select('id, name, status, campaign_type, stats, created_at').order('created_at', { ascending: false }).limit(limit);
        return {
          campaignsCount: camps?.length || 0,
          campaigns: (camps || []).map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            type: c.campaign_type || 'standard',
            draftsCount: Array.isArray(c.stats?.drafts) ? c.stats.drafts.length : 0,
            created_at: c.created_at,
          })),
        };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
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
    throw new Error('MineTech AI API key is not configured (ANTHROPIC_API_KEY).');
  }

  // Validate model - never silently downgrade if valid
  const validModels = Object.values(CLAUDE_MODELS).map((m) => m.id);
  const selectedModel = validModels.includes(model) ? model : DEFAULT_MODEL_ID;

  // Clean and prepare message history (preserving prompt integrity)
  let conversationMessages = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
  }));

  if (conversationMessages.length === 0) {
    throw new Error('Chat request must include at least one message.');
  }

  const effectiveSystemPrompt = systemPrompt || GENERAL_SYSTEM_PROMPT;

  const payload = {
    model: selectedModel,
    system: effectiveSystemPrompt,
    messages: conversationMessages,
    tools: CRM_READ_TOOLS,
    max_tokens: maxTokens || (enableThinking ? 8192 : 4096),
  };

  // Thinking configuration for models that support it
  if (enableThinking && (selectedModel.includes('sonnet') || selectedModel.includes('opus'))) {
    payload.thinking = { type: 'enabled', budget_tokens: 1024 };
  } else {
    payload.temperature = temperature;
  }

  console.log(`[MineTech AI] Dispatched model: ${selectedModel} | Requested: ${model} | Thinking: ${enableThinking ? 'enabled' : 'disabled'} | History turns: ${conversationMessages.length}`);

  const startTime = Date.now();
  let currentTurn = 0;
  const maxToolTurns = 4;
  let finalData = null;
  let totalUsage = { input_tokens: 0, output_tokens: 0 };

  while (currentTurn < maxToolTurns) {
    currentTurn++;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      const errorMessage = errorJson.error?.message || `MineTech AI error (${res.status})`;
      throw new Error(`MineTech AI Error: ${errorMessage}`);
    }

    finalData = await res.json();
    if (finalData.usage) {
      totalUsage.input_tokens += finalData.usage.input_tokens || 0;
      totalUsage.output_tokens += finalData.usage.output_tokens || 0;
    }

    if (finalData.stop_reason !== 'tool_use') {
      break;
    }

    // Process tool use
    const toolUseBlocks = (finalData.content || []).filter((b) => b.type === 'tool_use');
    if (toolUseBlocks.length === 0) break;

    // Append assistant's response to history
    payload.messages.push({
      role: 'assistant',
      content: finalData.content,
    });

    // Execute each tool and append tool results
    const toolResultContent = [];
    for (const toolBlock of toolUseBlocks) {
      const toolOutput = await executeCrmTool(toolBlock.name, toolBlock.input);
      toolResultContent.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: JSON.stringify(toolOutput),
      });
    }

    payload.messages.push({
      role: 'user',
      content: toolResultContent,
    });
  }

  const responseTimeMs = Date.now() - startTime;

  let replyText = '';
  let thinkingContent = '';

  if (Array.isArray(finalData?.content)) {
    for (const block of finalData.content) {
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
    model: finalData?.model || selectedModel,
    usage: totalUsage,
    responseTimeMs,
    stopReason: finalData?.stop_reason,
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
  } catch (e) { }

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
  } catch (e) { }

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
  } catch (e) { }

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
  } catch (e) { }

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
  } catch (e) { }

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
  } catch (e) { }

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
