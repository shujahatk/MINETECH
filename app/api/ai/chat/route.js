import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import {
  executeClaudeChat,
  saveChatMessage,
  createConversation,
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

    let conversationId = incomingConvId;
    let messageList = Array.isArray(messages) ? [...messages] : [];

    // If single prompt provided without messages array
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

    // Create a new conversation if none exists
    if (!conversationId) {
      const firstUserMessage = messageList.find((m) => m.role === 'user');
      const initialTitle = firstUserMessage?.content
        ? firstUserMessage.content.slice(0, 40) + '...'
        : 'New Chat';

      const newConv = await createConversation({
        title: initialTitle,
        model,
        userId,
      });
      conversationId = newConv.id;
    }

    // Call Claude
    const response = await executeClaudeChat({
      messages: messageList,
      model,
      enableThinking,
      systemPrompt,
      conversationId,
    });

    // Persist the latest user message
    const lastUserMsg = [...messageList].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      await saveChatMessage({
        conversationId,
        role: 'user',
        content: lastUserMsg.content,
      });
    }

    // Persist the assistant response
    await saveChatMessage({
      conversationId,
      role: 'assistant',
      content: response.content,
      model: response.model,
      thinking: response.thinking || null,
      tokensUsed: response.usage,
    });

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        content: response.content,
        model: response.model,
        thinking: response.thinking || null,
        usage: response.usage,
      },
    });
  } catch (err) {
    console.error('[Claude General Chat API] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to complete Claude request.',
      },
      { status: 500 }
    );
  }
}
