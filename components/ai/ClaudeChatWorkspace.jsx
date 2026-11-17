'use client';
import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Edit2,
  Check,
  Copy,
  RotateCcw,
  Square,
  ChevronDown,
  ChevronRight,
  BrainCircuit,
  MessageSquare,
  Clock,
  Layers,
  HelpCircle,
  FileCode,
  Search,
  Mail,
  ExternalLink,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import { extractEmailDraft } from '@/lib/utils/emailDraftParser';
import { ensureMineTechSignatureText } from '@/lib/utils/signature';

// Optional email composer, loaded only when the user opens an email draft
const ComposeModal = dynamic(() => import('@/components/email/ComposeModal'), { ssr: false });

export const AVAILABLE_MODELS = [
  {
    id: 'claude-sonnet-4-6',
    name: 'MineTech AI',
    subname: 'Sonnet',
    tag: 'Default',
    desc: 'General everyday tasks, strong writing, analysis and coding',
    supportsThinking: true,
  },
  {
    id: 'claude-opus-4-6',
    name: 'MineTech AI High',
    subname: 'Opus',
    tag: 'Advanced Reasoning',
    desc: 'Complex multi-step instructions, deep logic, and architectural analysis',
    supportsThinking: true,
  },
];

const STARTER_PROMPTS = [
  {
    title: 'Business Analysis',
    prompt: 'Analyse European supply chain risks for industrial minerals like Kaolin and Bentonite in 2026.',
  },
  {
    title: 'Code & Debugging',
    prompt: 'Write a Python script that calculates factorials with memoization and input validation.',
  },
  {
    title: 'General Explanation',
    prompt: 'Explain cybersecurity and modern zero-trust architecture in detail.',
  },
  {
    title: 'Email Drafting',
    prompt: 'Write a professional email to a supplier requesting mineral sample specifications.',
  },
];

/**
 * Formats inline Markdown: **bold**, *italic*, `code`
 */
function formatInline(str) {
  if (!str) return '';
  const tokens = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(str.substring(lastIdx, match.index));
    }
    const token = match[1];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={match.index}
          className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-primary border border-border/50"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < str.length) {
    tokens.push(str.substring(lastIdx));
  }

  return tokens.length > 0 ? tokens : str;
}

/**
 * Rich Markdown renderer supporting headings, code blocks, lists, and tables
 */
function MarkdownRenderer({ content, onCopyCode }) {
  if (!content) return null;

  // Split content by code blocks
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: content.substring(lastIndex, match.index),
      });
    }
    parts.push({
      type: 'code',
      language: match[1] || 'code',
      code: match[2].trim(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      value: content.substring(lastIndex),
    });
  }

  return (
    <div className="space-y-3 leading-relaxed text-xs sm:text-sm">
      {parts.map((part, pIdx) => {
        if (part.type === 'code') {
          return (
            <div
              key={pIdx}
              className="my-3 rounded-xl border border-border bg-[#0d1117] text-slate-100 overflow-hidden shadow-sm"
            >
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#161b22] border-b border-border/40 text-[11px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <Terminal className="h-3 w-3 text-primary" />
                  {part.language || 'code'}
                </span>
                <button
                  type="button"
                  onClick={() => onCopyCode(part.code)}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                  title="Copy code"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </button>
              </div>
              <pre className="p-3.5 text-xs font-mono overflow-x-auto leading-relaxed text-slate-200">
                <code>{part.code}</code>
              </pre>
            </div>
          );
        }

        // Split text lines and handle headings, lists, blockquotes
        const lines = part.value.split('\n');
        return (
          <div key={pIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-2" />;

              // Headings
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="text-sm font-semibold text-foreground mt-3 mb-1">
                    {formatInline(trimmed.substring(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="text-base font-bold text-foreground mt-3.5 mb-1.5">
                    {formatInline(trimmed.substring(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={lIdx} className="text-lg font-bold text-foreground mt-4 mb-2">
                    {formatInline(trimmed.substring(2))}
                  </h2>
                );
              }

              // Bullet lists
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-primary mt-1 font-bold">•</span>
                    <span className="flex-1">{formatInline(trimmed.substring(2))}</span>
                  </div>
                );
              }

              // Numbered lists
              const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
              if (numMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="font-semibold text-muted-foreground text-[11px] min-w-[1.2rem]">
                      {numMatch[1]}.
                    </span>
                    <span className="flex-1">{formatInline(numMatch[2])}</span>
                  </div>
                );
              }

              // Blockquotes
              if (trimmed.startsWith('> ')) {
                return (
                  <blockquote
                    key={lIdx}
                    className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-1.5"
                  >
                    {formatInline(trimmed.substring(2))}
                  </blockquote>
                );
              }

              return <p key={lIdx}>{formatInline(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function ClaudeChatWorkspace() {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6');
  const [enableThinking, setEnableThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [convSearch, setConvSearch] = useState('');
  const [expandedThinking, setExpandedThinking] = useState({});

  // Optional Email Composer Integration
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerDraft, setComposerDraft] = useState(null);

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/ai/conversations');
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setConversations(list);
        if (list.length > 0 && !activeConvId) {
          selectConversation(list[0].id);
        }
      }
    } catch (e) {
      console.warn('Failed to load conversations:', e);
    }
  };

  const selectConversation = async (convId) => {
    setActiveConvId(convId);
    try {
      const res = await fetch(`/api/ai/conversations/${convId}`);
      if (res.ok) {
        const json = await res.json();
        const conv = json.data;
        if (conv) {
          setMessages(conv.messages || []);
          if (conv.model) setSelectedModel(conv.model);
        }
      }
    } catch (e) {
      console.warn('Failed to load conversation details:', e);
    }
  };

  const handleNewConversation = async () => {
    try {
      const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation', model: selectedModel }),
      });
      if (res.ok) {
        const json = await res.json();
        const newConv = json.data;
        setConversations([newConv, ...conversations]);
        setActiveConvId(newConv.id);
        setMessages([]);
      }
    } catch (e) {
      toast.error('Failed to create new conversation');
    }
  };

  const handleDeleteConversation = async (convId, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const res = await fetch(`/api/ai/conversations/${convId}`, { method: 'DELETE' });
      if (res.ok) {
        const updated = conversations.filter((c) => c.id !== convId);
        setConversations(updated);
        if (activeConvId === convId) {
          if (updated.length > 0) {
            selectConversation(updated[0].id);
          } else {
            setActiveConvId(null);
            setMessages([]);
          }
        }
        toast.success('Conversation deleted');
      }
    } catch (e) {
      toast.error('Failed to delete conversation');
    }
  };

  const handleRenameConversation = async (convId) => {
    if (!editTitleValue.trim()) {
      setIsEditingTitle(null);
      return;
    }
    try {
      const res = await fetch(`/api/ai/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitleValue.trim() }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: editTitleValue.trim() } : c))
        );
        setIsEditingTitle(null);
      }
    } catch (e) {
      toast.error('Failed to rename conversation');
    }
  };

  // Model switching: preserves the conversation history completely
  const handleModelSwitch = async (newModelId) => {
    if (newModelId === selectedModel) return;
    setSelectedModel(newModelId);
    toast.info(`Switched model to ${newModelId === 'claude-opus-4-6' ? 'MineTech AI High (Opus)' : 'MineTech AI (Sonnet)'}`);

    if (activeConvId) {
      try {
        await fetch(`/api/ai/conversations/${activeConvId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: newModelId }),
        });
      } catch (err) {}
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (customPrompt = null) => {
    const textToSend = customPrompt || inputPrompt;
    if (!textToSend.trim() || isLoading) return;

    const userMessage = {
      id: 'temp_' + Date.now(),
      role: 'user',
      content: textToSend.trim(),
      created_at: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputPrompt('');
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
          enableThinking,
          conversationId: activeConvId,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const assistantMsg = {
          id: 'asst_' + Date.now(),
          role: 'assistant',
          content: json.data.content,
          thinking: json.data.thinking,
          model: json.data.model,
          usage: json.data.usage,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // If conversation ID was generated on backend
        if (json.data.conversationId && json.data.conversationId !== activeConvId) {
          setActiveConvId(json.data.conversationId);
          fetchConversations();
        }
      } else {
        toast.error(json.error || 'Failed to generate response');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Request failed: ' + err.message);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      toast.info('Generation stopped');
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleRegenerate = () => {
    if (messages.length === 0) return;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      const trimmed = messages.slice(0, messages.length - (messages[messages.length - 1].role === 'assistant' ? 1 : 0));
      setMessages(trimmed);
      handleSendMessage(lastUserMessage.content);
    }
  };

  // Open detected email draft inside ComposeModal
  const handleOpenInComposer = (draft) => {
    setComposerDraft({
      subject: draft.subject,
      body: ensureMineTechSignatureText(draft.body),
    });
    setIsComposerOpen(true);
  };

  const handleCopyEmail = (draft) => {
    const formatted = `Subject: ${draft.subject}\n\n${ensureMineTechSignatureText(draft.body)}`;
    navigator.clipboard.writeText(formatted);
    toast.success('Email draft copied to clipboard');
  };

  const filteredConversations = conversations.filter((c) =>
    (c.title || '').toLowerCase().includes(convSearch.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      {/* 1. Conversation History Sidebar */}
      <div className="w-72 shrink-0 border-r border-border bg-card/60 flex flex-col justify-between hidden md:flex">
        <div className="p-3 border-b border-border flex flex-col gap-2.5">
          <Button
            onClick={handleNewConversation}
            className="w-full gap-2 shadow-sm font-medium text-xs h-9 justify-start"
          >
            <Plus className="h-4 w-4" />
            <span>New Conversation</span>
          </Button>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chats..."
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background pl-8 pr-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {convSearch ? 'No matching chats' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`group relative flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground/80 hover:bg-muted/80'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <MessageSquare
                      className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    {isEditingTitle === conv.id ? (
                      <input
                        type="text"
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onBlur={() => handleRenameConversation(conv.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameConversation(conv.id)}
                        autoFocus
                        className="w-full bg-background border border-primary rounded px-1 text-xs text-foreground"
                      />
                    ) : (
                      <span className="truncate">{conv.title || 'Untitled'}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingTitle(conv.id);
                        setEditTitleValue(conv.title || '');
                      }}
                      className="p-1 hover:text-foreground text-muted-foreground"
                      title="Rename"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="p-1 hover:text-destructive text-muted-foreground"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-border bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            MineTech AI Assistant
          </span>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">v2.0</span>
        </div>
      </div>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Header Bar */}
        <div className="h-14 border-b border-border bg-card/40 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground flex items-center gap-2">
                MineTech AI Drafting & Intelligence
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  Unrestricted
                </Badge>
              </h1>
              <p className="text-[11px] text-muted-foreground">
                General-purpose intelligence with optional email drafting
              </p>
            </div>
          </div>

          {/* Model Selector & Reasoning Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border">
              {AVAILABLE_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  id={`model-select-${m.id}`}
                  onClick={() => handleModelSwitch(m.id)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                    selectedModel === m.id
                      ? 'bg-card text-foreground shadow-sm border border-border font-semibold text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={m.desc}
                >
                  <span>{m.name}</span>
                  <span className="text-[10px] opacity-70 hidden sm:inline">({m.subname})</span>
                </button>
              ))}
            </div>

            {/* Extended Thinking Toggle */}
            <Button
              variant={enableThinking ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEnableThinking(!enableThinking)}
              className={`h-8 gap-1.5 text-xs ${enableThinking ? 'bg-primary text-primary-foreground' : ''}`}
              title="Enable MineTech AI extended thinking (deep multi-step reasoning)"
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Thinking</span>
            </Button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-sm">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">How can MineTech AI help you today?</h2>
              <p className="text-xs text-muted-foreground mb-8 max-w-md">
                Full-capability MineTech AI intelligence. Enter any query for business strategy, deep coding, general
                explanations, document drafting, or ask to write an email.
              </p>

              {/* Starter Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                {STARTER_PROMPTS.map((sp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(sp.prompt)}
                    className="p-3.5 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-primary/40 transition-all text-xs group"
                  >
                    <div className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors flex items-center justify-between">
                      <span>{sp.title}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-muted-foreground line-clamp-2 leading-relaxed">{sp.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const emailDraft = !isUser ? extractEmailDraft(msg.content) : null;

                return (
                  <div
                    key={msg.id || index}
                    className={`flex gap-3 text-sm ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}

                    <div
                      className={`relative max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed ${
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-card border border-border text-foreground shadow-sm rounded-bl-sm'
                      }`}
                    >
                      {/* Collapsible Thinking Process if available */}
                      {!isUser && msg.thinking && (
                        <div className="mb-3 rounded-lg border border-border/80 bg-muted/30 overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedThinking((prev) => ({
                                ...prev,
                                [msg.id || index]: !prev[msg.id || index],
                              }))
                            }
                            className="w-full flex items-center justify-between px-3 py-1.5 text-muted-foreground hover:text-foreground font-medium bg-muted/40"
                          >
                            <span className="flex items-center gap-1.5">
                              <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                              Thought Process ({msg.thinking.length} chars)
                            </span>
                            {expandedThinking[msg.id || index] ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                          {expandedThinking[msg.id || index] && (
                            <div className="p-3 font-mono text-[11px] leading-relaxed text-muted-foreground bg-muted/10 whitespace-pre-wrap border-t border-border">
                              {msg.thinking}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Optional Email Draft Card (Renders ONLY if an email draft is requested/detected) */}
                      {!isUser && emailDraft && (
                        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 shadow-sm">
                          <div className="flex items-center justify-between gap-2 border-b border-primary/15 pb-2 mb-2.5">
                            <div className="flex items-center gap-1.5 font-semibold text-xs text-primary">
                              <Mail className="h-3.5 w-3.5" />
                              <span>Email Draft Detected</span>
                            </div>
                            <span className="text-[10px] bg-background border border-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                              Ready for Composer
                            </span>
                          </div>

                          <div className="text-xs space-y-1 mb-3">
                            <div className="font-semibold text-foreground">
                              Subject:{' '}
                              <span className="font-normal text-foreground/90">{emailDraft.subject}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenInComposer(emailDraft)}
                              className="h-7 px-3 text-xs gap-1.5 font-medium shadow-sm"
                            >
                              <Mail className="h-3 w-3" />
                              <span>Open in Email Composer</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyEmail(emailDraft)}
                              className="h-7 px-2.5 text-xs gap-1"
                            >
                              <Copy className="h-3 w-3" />
                              <span>Copy Email</span>
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Main Message Content rendered with rich Markdown */}
                      {isUser ? (
                        <div className="whitespace-pre-wrap break-words text-xs sm:text-sm">
                          {msg.content}
                        </div>
                      ) : (
                        <MarkdownRenderer content={msg.content} onCopyCode={handleCopy} />
                      )}

                      {/* Assistant Action Bar */}
                      {!isUser && (
                        <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="text-[10px] font-mono opacity-80">
                            {(msg.model || selectedModel).includes('opus') ? 'MineTech AI High (Opus)' : 'MineTech AI (Sonnet)'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.content)}
                              className="hover:text-foreground flex items-center gap-1"
                              title="Copy response"
                            >
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </button>
                            {index === messages.length - 1 && (
                              <button
                                type="button"
                                onClick={handleRegenerate}
                                className="hover:text-foreground flex items-center gap-1"
                                title="Regenerate response"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Retry</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="h-7 w-7 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Streaming / Loading indicator */}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 animate-pulse">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl px-4 py-3 text-xs text-muted-foreground shadow-sm flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span>MineTech AI is thinking and responding...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 3. Input Console */}
        <div className="p-4 border-t border-border bg-card/60">
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-sm">
              <textarea
                id="claude-chat-input"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask MineTech AI anything, or ask to write an email... (Shift+Enter for new line)"
                rows={2}
                disabled={isLoading}
                className="w-full resize-none bg-transparent px-3.5 py-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />

              <div className="px-3 pb-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                  {selectedModel === 'claude-opus-4-6' ? 'MineTech AI High' : 'MineTech AI'} •{' '}
                  {enableThinking ? 'Thinking On' : 'Standard'}
                </span>

                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleStopGeneration}
                      className="h-7 px-2.5 text-xs gap-1.5"
                    >
                      <Square className="h-3 w-3 fill-current" />
                      <span>Stop</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      id="claude-chat-send"
                      size="sm"
                      onClick={() => handleSendMessage()}
                      disabled={!inputPrompt.trim()}
                      className="h-7 px-3 text-xs gap-1.5 font-medium"
                    >
                      <span>Send</span>
                      <Send className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              MineTech AI Assistant • Conversational intelligence and optional email generation.
            </p>
          </div>
        </div>
      </div>

      {/* Optional Email Composer Modal */}
      {isComposerOpen && (
        <ComposeModal
          initialDraft={composerDraft}
          onClose={() => setIsComposerOpen(false)}
          onSent={() => {
            setIsComposerOpen(false);
            toast.success('Email sent successfully');
          }}
        />
      )}
    </div>
  );
}
