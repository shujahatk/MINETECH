import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import {
  executeClaudeChat,
  saveChatMessage,
  createConversation,
  getConversation,
  updateConversation,
  DEFAULT_MODEL_ID,
} from '@/lib/services/claudeChatService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const body = await request.json();
    const {
      messages = [],
      prompt,
      model = DEFAULT_MODEL_ID,
      conversationId: incomingConvId,
      enableThinking = false,
      systemPrompt = null,
    } = body;

    let conversationId = incomingConvId || null;
    let messageList = Array.isArray(messages) ? [...messages] : [];

    if (prompt && messageList.length === 0) {
      messageList.push({ role: 'user', content: prompt });
    }

    if (messageList.length === 0) {
      return NextResponse.json(
        { success: false, error: 'A user prompt or messages array is required.' },
        { status: 400 }
      );
    }

    const userId = auth.user?.id || auth.user?._id || null;
    const lastUserMsg = [...messageList].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg || !String(lastUserMsg.content || '').trim()) {
      return NextResponse.json(
        { success: false, error: 'User message content cannot be empty.' },
        { status: 400 }
      );
    }

    let generatedTitle = null;

    // 1. Ensure a persistent conversation exists in Supabase
    if (!conversationId) {
      const cleanPreview = String(lastUserMsg.content).trim().replace(/\s+/g, ' ');
      generatedTitle = cleanPreview.length > 48 ? `${cleanPreview.slice(0, 48)}…` : cleanPreview;

      const newConv = await createConversation({
        title: generatedTitle || 'New Conversation',
        model,
        userId,
      });
      conversationId = newConv.id;
    } else {
      // Auto-title if still default "New Conversation" or "New Chat"
      const existingConv = await getConversation(conversationId, userId);
      if (existingConv && ['New Conversation', 'New Chat'].includes(existingConv.title)) {
        const cleanPreview = String(lastUserMsg.content).trim().replace(/\s+/g, ' ');
        generatedTitle = cleanPreview.length > 48 ? `${cleanPreview.slice(0, 48)}…` : cleanPreview;
        await updateConversation(conversationId, { title: generatedTitle }, userId);
      }
      // Reconstruct authoritative conversation context from Supabase + latest user prompt
      if (existingConv && Array.isArray(existingConv.messages) && existingConv.messages.length > 0) {
        const storedMsgs = existingConv.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const lastStored = storedMsgs[storedMsgs.length - 1];
        if (!lastStored || lastStored.role !== 'user' || lastStored.content !== lastUserMsg.content) {
          messageList = [...storedMsgs, { role: 'user', content: lastUserMsg.content }];
        } else {
          messageList = storedMsgs;
        }
      }
    }

    // 2. Persist the user message IMMEDIATELY so it is never lost even if AI call fails
    const savedUserMsg = await saveChatMessage({
      conversationId,
      role: 'user',
      content: lastUserMsg.content,
      model,
    });

    // 3. Execute MineTech AI (Claude) with live CRM tools & controlled context
    const response = await executeClaudeChat({
      messages: messageList,
      model,
      enableThinking,
      systemPrompt,
      conversationId,
    });

    // 4. Persist the assistant response in Supabase
    const savedAssistantMsg = await saveChatMessage({
      conversationId,
      role: 'assistant',
      content: response.content,
      model: response.model,
      thinking: response.thinking || null,
      toolCalls: response.toolsUsed || [],
      tokensUsed: response.usage,
    });

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        title: generatedTitle,
        userMessageId: savedUserMsg?.id || null,
        assistantMessageId: savedAssistantMsg?.id || null,
        content: response.content,
        model: response.model,
        thinking: response.thinking || null,
        toolsUsed: response.toolsUsed || [],
        usage: response.usage,
      },
    });
  } catch (err) {
    console.error('[MineTech AI General Chat API] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to complete MineTech AI request.',
      },
      { status: 500 }
    );
  }
}
