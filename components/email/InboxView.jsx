'use client';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';

import React, { useState, useEffect, useRef } from 'react';
import {
  Inbox,
  Mail,
  Send,
  Archive,
  Search,
  User,
  Sparkles,
  Building,
  RefreshCw,
  Zap,
  CornerDownLeft,
  ExternalLink,
  Check,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Bot,
  Trash2,
  MessageSquareReply,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import dynamic from 'next/dynamic';
import { useVisibleInterval } from '@/lib/hooks/useVisibleInterval';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import ReplyAiBrain from '@/components/ai/ReplyAiBrain';
import AiDraftBar from '@/components/ai/AiDraftBar';

// The lead drawer is heavy and only needed when a lead is opened from the inbox.
const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer'), { ssr: false });

export default function InboxView() {
  const [loadError, setLoadError] = useState('');
  const [threads, setThreads] = useState([]);
  const [counts, setCounts] = useState({ unread: 0, total: 0, replies: 0 });
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'individual', 'outbound', 'replies', 'unread', 'archived'
  const [search, setSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [threadDetail, setThreadDetail] = useState(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  // Set when the reply box was filled from an AI Brain draft; sent along so the server can
  // run the send policy and record what the human actually sent.
  const [aiReplyDecisionId, setAiReplyDecisionId] = useState(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isAnalyzingReply, setIsAnalyzingReply] = useState(false);
  const [conversationIntel, setConversationIntel] = useState(null);
  const [showAIPanel, setShowAIPanel] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  const messagesEndRef = useRef(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchConversationIntel = async (leadId) => {
    if (!leadId) {
      setConversationIntel(null);
      return;
    }
    try {
      const res = await fetch(`/api/leads/${leadId}/conversation-intelligence`);
      if (res.ok) {
        const json = await res.json();
        setConversationIntel(json.data || null);
      }
    } catch (e) {
      console.warn('Failed to load conversation intel for lead:', e);
    }
  };

  const fetchThreads = async (silent = false) => {
    try {
      if (!silent) setLoadingThreads(true);
      const res = await fetch(`/api/email/inbox?filter=${activeFilter}&search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error('Request failed');
      if (res.ok) {
        setLoadError('');
        const json = await res.json();
        const data = json.data || [];
        setThreads(data);
        setCounts(json.counts || { unread: 0, total: 0, replies: 0 });
        if (data.length > 0 && !selectedThreadId) {
          setSelectedThreadId(data[0]._id || data[0].id);
        }
      }
    } catch (err) {
      setLoadError('Could not refresh the inbox. Please try again.');
      if (!silent) console.error('Failed to load inbox threads:', err);
    } finally {
      if (!silent) setLoadingThreads(false);
    }
  };

  const fetchThreadDetail = async (id, silent = false) => {
    if (!id) return;
    if (!silent) setLoadingDetail(true);
    try {
      const res = await fetch(`/api/email/threads/${id}`);
      if (res.ok) {
        const json = await res.json();
        setThreadDetail(json.data);
        const lId = json.data?.thread?.leadId?._id || json.data?.thread?.leadId?.id || (typeof json.data?.thread?.leadId === 'string' ? json.data?.thread?.leadId : null);
        // Background refreshes keep the intel already on screen; only (re)load it for a real open.
        if (!silent) {
          if (lId) {
            fetchConversationIntel(lId);
          } else {
            setConversationIntel(null);
          }
        }
      }
    } catch (err) {
      if (!silent) console.error('Failed to load thread detail:', err);
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  };

  // Initial and on filter/search change
  // Search is debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => fetchThreads(false), search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, search]);

  // Background refresh: only while the tab is visible, every 20s (was an unconditional 6s poll
  // that also re-fetched conversation intelligence every time).
  useVisibleInterval(() => {
    fetchThreads(true);
    if (selectedThreadId) {
      fetchThreadDetail(selectedThreadId, true);
    }
  }, 20000);

  // Load detail on thread selection
  useEffect(() => {
    if (selectedThreadId) {
      setAiReplyDecisionId(null);
      fetchThreadDetail(selectedThreadId, false);
    }
  }, [selectedThreadId]);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    await fetchThreads(false);
    if (selectedThreadId) {
      await fetchThreadDetail(selectedThreadId, false);
    }
    setTimeout(() => setIsManualSyncing(false), 500);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadDetail?.messages]);

  // Send reply handler
  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if (!replyBody.trim() || !selectedThreadId) return;

    setSendingReply(true);
    setStatusMessage('');
    try {
      const res = await fetch(`/api/email/threads/${selectedThreadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyHtml: `<p>${replyBody.replace(/\n/g, '<br/>')}</p>`,
          bodyText: replyBody,
          ...(aiReplyDecisionId ? { aiDecisionId: aiReplyDecisionId } : {}),
        }),
      });

      if (res.ok) {
        setReplyBody('');
        setAiReplyDecisionId(null);
        setStatusMessage('Reply dispatched successfully!');
        setTimeout(() => setStatusMessage(''), 3000);
        await fetchThreadDetail(selectedThreadId);
        await fetchThreads();
      } else {
        const json = await res.json();
        alert(json.message || 'Failed to send reply');
      }
    } catch (err) {
      alert('Error sending reply: ' + err.message);
    } finally {
      setSendingReply(false);
    }
  };

  // Permanently Delete Entire Thread Handler
  const handleDeleteThread = async (threadId, e) => {
    if (e) e.stopPropagation();
    const idToDelete = threadId || selectedThreadId;
    if (!idToDelete) return;

    if (!confirm('Are you sure you want to permanently delete this email thread and all messages from database memory?')) {
      return;
    }

    setDeletingId(idToDelete);
    try {
      const res = await fetch(`/api/email/threads/${idToDelete}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setThreads((prev) => prev.filter((t) => (t._id || t.id) !== idToDelete));
        setCounts((prev) => ({
          ...prev,
          total: Math.max(0, (prev.total || 1) - 1),
        }));

        if (selectedThreadId === idToDelete) {
          setSelectedThreadId(null);
          setThreadDetail(null);
        }
        setStatusMessage('Thread permanently deleted from DB.');
        setTimeout(() => setStatusMessage(''), 3000);
      } else {
        const json = await res.json();
        alert(json.message || 'Failed to delete thread');
      }
    } catch (err) {
      alert('Error deleting thread: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Permanently Delete Individual Message Handler
  const handleDeleteMessage = async (messageId) => {
    if (!messageId) return;
    if (!confirm('Permanently delete this email message from database memory?')) return;

    try {
      const res = await fetch(`/api/email/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setThreadDetail((prev) => {
          if (!prev) return prev;
          const updatedMsgs = (prev.messages || []).filter((m) => (m._id || m.id) !== messageId);
          return {
            ...prev,
            messages: updatedMsgs,
          };
        });
        fetchThreads();
        setStatusMessage('Message permanently deleted from DB.');
        setTimeout(() => setStatusMessage(''), 3000);
      } else {
        const json = await res.json();
        alert(json.message || 'Failed to delete message');
      }
    } catch (err) {
      alert('Error deleting message: ' + err.message);
    }
  };

  // Archive / Toggle Status Handler
  const handleArchiveThread = async () => {
    if (!selectedThreadId) return;
    try {
      const nextStatus = activeFilter === 'archived' ? 'OPEN' : 'ARCHIVED';
      await fetch(`/api/email/threads/${selectedThreadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      setSelectedThreadId(null);
      setThreadDetail(null);
      fetchThreads();
    } catch (e) {}
  };

  // AI Reply Analysis (Claude Inbound Understanding)
  const handleAnalyzeReply = async () => {
    const lead = threadDetail?.thread?.leadId;
    const leadId = lead?.id || lead?._id || (typeof lead === 'string' ? lead : null);
    if (!leadId) return;

    const lastInbound = threadDetail.messages?.filter((m) => m.direction === 'inbound').pop();
    if (!lastInbound) {
      alert('No inbound supplier reply detected in this conversation to analyze.');
      return;
    }

    setIsAnalyzingReply(true);
    setStatusMessage('Analyzing supplier reply with Claude...');
    try {
      const res = await fetch('/api/email/inbox/analyze-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          threadId: selectedThreadId,
          messageId: lastInbound.id || lastInbound._id || `msg-${Date.now()}`,
          messageText: lastInbound.bodyText || lastInbound.body_plain || lastInbound.bodyHtml || '',
          sender: lastInbound.sender || lead.email,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setConversationIntel(json.data);
          setStatusMessage('Conversation intelligence extracted & saved.');
          setTimeout(() => setStatusMessage(''), 3500);
        }
      } else {
        const errJson = await res.json();
        alert(errJson.message || 'Failed to analyze reply');
      }
    } catch (e) {
      console.error(e);
      alert('Error analyzing reply: ' + e.message);
    } finally {
      setIsAnalyzingReply(false);
    }
  };

  // AI Contextual Reply Copilot (Claude + Confirmed Conversation Facts)
  const handleGenerateAIReply = async () => {
    const lead = threadDetail?.thread?.leadId;
    const leadId = lead?.id || lead?._id || (typeof lead === 'string' ? lead : null);
    if (!leadId) return;

    setIsGeneratingAI(true);
    setStatusMessage('Generating smart reply omitting resolved questions...');
    try {
      const res = await fetch('/api/email/inbox/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          objective: 'Advance business negotiation, acknowledge confirmed facts, ask remaining unknowns if necessary, move towards quotation or technical sample.',
          tone: 'Professional',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data?.body) {
          setReplyBody(json.data.body);
          setStatusMessage('Smart reply drafted from confirmed facts.');
          setTimeout(() => setStatusMessage(''), 3500);
        }
      } else {
        // Fallback to general compose if lead has no prior study
        const lastMsg = threadDetail.messages?.filter((m) => m.direction === 'inbound').pop() || threadDetail.messages?.[0];
        const fbRes = await fetch('/api/ai/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId,
            prompt: `Reply to message: "${lastMsg?.bodyText || lastMsg?.subject || 'Let us discuss'}", acknowledge stated facts, book 15-min call.`,
            tone: 'Professional',
            goal: 'Schedule Discovery Call',
          }),
        });
        if (fbRes.ok) {
          const fbJson = await fbRes.json();
          if (fbJson.data?.body) {
            setReplyBody(fbJson.data.body);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // ---- Presentation (no behaviour changes below this line) ----
  const wide = useMediaQuery('(min-width: 1440px)');
  const threadLead = threadDetail?.thread?.leadId;
  const brainLeadId =
    threadLead?.id || threadLead?._id || (typeof threadLead === 'string' ? threadLead : null);
  const inboundMsgs = (threadDetail?.messages || []).filter((m) => m.direction === 'inbound');
  const latestInbound = inboundMsgs[inboundMsgs.length - 1];
  const brainMessageId = latestInbound?.id || latestInbound?._id;
  const hasInbound = inboundMsgs.length > 0;
  const threadLeadObj = threadLead && typeof threadLead === 'object' ? threadLead : null;
  const threadLeadName = threadLeadObj?.fullName || threadLeadObj?.email || 'Prospect';

  const initialsOf = (name) =>
    String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';

  const FILTERS = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'replies', label: 'Replies', count: counts.replies, hot: true },
    { key: 'unread', label: 'Unread', count: counts.unread, hot: true },
    { key: 'individual', label: 'Direct', count: counts.individual },
    { key: 'outbound', label: 'Campaigns', count: counts.blast || counts.outbound },
    { key: 'archived', label: 'Archived' },
  ];

  const sourceChip = (isBlast) =>
    isBlast ? (
      <span className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded border border-primary/20 bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
        <Zap className="h-2.5 w-2.5" /> Campaign
      </span>
    ) : (
      <span className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded border border-border bg-muted/70 px-1.5 text-[10px] font-medium text-muted-foreground">
        <User className="h-2.5 w-2.5" /> Direct
      </span>
    );

  // Lead + AI context: a right-hand rail on wide screens, a collapsible block above the composer otherwise.
  const intelligenceBody = (
    <div className="space-y-3">
      {threadLeadObj && (
        <div className="rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold text-foreground">
              {initialsOf(threadLeadName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">{threadLeadName}</p>
              {threadLeadObj.company && (
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Building className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{threadLeadObj.company}</span>
                </p>
              )}
              {threadLeadObj.email && <p className="truncate text-xs text-muted-foreground">{threadLeadObj.email}</p>}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedLeadId(brainLeadId)}
            className="mt-3 h-8 w-full gap-1.5 text-xs"
          >
            <span>Open lead dossier</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      )}

      {brainLeadId && brainMessageId && (
        <ReplyAiBrain
          variant="panel"
          leadId={brainLeadId}
          messageId={brainMessageId}
          threadId={selectedThreadId}
          onUseDraft={({ text, decisionId }) => {
            setReplyBody(text);
            setAiReplyDecisionId(decisionId || null);
          }}
        />
      )}

      {threadLead && (
        <div className="rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                <Bot className="h-3 w-3" />
              </div>
              <span className="text-xs font-semibold text-foreground">Conversation facts</span>
              {conversationIntel?.supplierIntent && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    conversationIntel.supplierIntent === 'positive'
                      ? 'tone-success'
                      : conversationIntel.supplierIntent === 'negative'
                      ? 'tone-danger'
                      : 'tone-warning'
                  }`}
                >
                  {conversationIntel.supplierIntent}
                </span>
              )}
            </div>
            {hasInbound && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAnalyzeReply}
                disabled={isAnalyzingReply}
                className="h-6 gap-1 px-2 text-[11px]"
              >
                <Sparkles className={`h-3 w-3 text-primary ${isAnalyzingReply ? 'animate-spin' : ''}`} />
                <span>{isAnalyzingReply ? 'Analyzing...' : conversationIntel ? 'Re-analyze' : 'Analyze'}</span>
              </Button>
            )}
          </div>

          <div className="mt-3 space-y-2.5 text-xs">
            {conversationIntel?.conflictsDetected?.length > 0 && (
              <div className="flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <strong className="font-semibold">Conflict detected</strong>
                  <div className="mt-0.5 space-y-0.5 text-foreground/80">
                    {conversationIntel.conflictsDetected.map((c, idx) => (
                      <div key={idx}>
                        {c.dimension}: &quot;{c.latestStatement}&quot; (previously &quot;{c.priorStatement}&quot;)
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {conversationIntel ? (
              <>
                <div>
                  <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-success">
                    <CheckCircle2 className="h-3 w-3" /> Confirmed
                  </span>
                  {conversationIntel.confirmedFacts?.length > 0 ? (
                    <ul className="space-y-1 text-foreground">
                      {conversationIntel.confirmedFacts.slice(0, 5).map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 leading-snug">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-success" aria-hidden="true" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] italic text-muted-foreground">Nothing confirmed yet.</p>
                  )}
                </div>

                <div>
                  <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-warning">
                    <HelpCircle className="h-3 w-3" /> Still unknown
                  </span>
                  {conversationIntel.remainingUnknowns?.length > 0 ? (
                    <ul className="space-y-1 text-foreground">
                      {conversationIntel.remainingUnknowns.slice(0, 5).map((u, i) => (
                        <li key={i} className="flex items-start gap-1.5 leading-snug">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
                          <span>{u}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] italic text-muted-foreground">All core questions resolved.</p>
                  )}
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                  <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
                    <Lightbulb className="h-3 w-3" /> Recommended next step
                  </span>
                  <p className="text-[12px] font-medium leading-snug text-foreground">
                    {conversationIntel.nextBestAction || conversationIntel.recommendedNextAction || 'Request quotation + MOQ.'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleGenerateAIReply}
                    disabled={isGeneratingAI}
                    className="mt-2 h-7 w-full gap-1 text-[11px]"
                  >
                    <Sparkles className={`h-3 w-3 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingAI ? 'Drafting...' : 'Draft smart reply'}</span>
                  </Button>
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-center text-[11px] text-muted-foreground">
                {hasInbound
                  ? 'No facts extracted yet. Choose Analyze to pull confirmations and intent from the prospect’s replies.'
                  : 'Facts appear here once the prospect replies.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-[720px] flex-col space-y-3 xl:h-[calc(100dvh-8.5rem)]">
      {loadError && <ErrorState message={loadError} onRetry={() => fetchThreads()} />}

      <PageHeader
        icon={Inbox}
        title="Inbox"
        meta={counts.unread > 0 ? `${counts.unread} unread` : undefined}
        description="One stream for 1-to-1 outreach, campaign replies and AI-assisted drafting."
        className="mb-0 shrink-0"
        actions={
          <>
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              Live sync
            </span>
            <Button variant="outline" size="sm" onClick={handleManualSync} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isManualSyncing || (loadingThreads && !threads.length) ? 'animate-spin' : ''}`} />
              <span>Sync mailbox</span>
            </Button>
          </>
        }
      />

      <Card
        className={`grid min-h-0 flex-1 overflow-hidden p-0 ${
          wide ? 'grid-cols-[320px_minmax(0,1fr)_340px]' : 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]'
        }`}
      >
        {/* ================= LEFT: conversations ================= */}
        <section className="flex max-h-[360px] min-h-0 flex-col border-b border-border lg:max-h-none lg:border-b-0 lg:border-r" aria-label="Conversations">
          <div className="space-y-2.5 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="text"
                aria-label="Search conversations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Mailbox view">
              {FILTERS.map((f) => {
                const active = activeFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveFilter(f.key)}
                    className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary/25 bg-primary/10 text-primary'
                        : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span
                        className={`rounded px-1 text-[10px] font-semibold tabular-nums ${
                          f.hot && !active ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/15' : 'bg-muted'
                        }`}
                      >
                        {f.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingThreads ? (
              <LoadingState rows={6} label="Loading conversations" />
            ) : threads.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={search ? 'No matching conversations' : 'Nothing here yet'}
                description={search ? 'Try a different name, subject or email.' : 'Threads in this view will appear here.'}
              />
            ) : (
              <ul>
                {threads.map((thread) => {
                  const lead = thread.leadId || thread.lead || {};
                  const id = thread._id || thread.id;
                  const isSelected = selectedThreadId === id;
                  const leadName =
                    lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email || 'Prospect';
                  const when = thread.lastMessageAt || thread.last_message_at;
                  return (
                    <li key={id} className="border-b border-border/70">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedThreadId(id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedThreadId(id);
                          }
                        }}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`group relative cursor-pointer px-3.5 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 ${
                          isSelected ? 'row-selected' : thread.unread ? 'bg-primary/[0.035] hover:bg-muted/50' : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {thread.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                            <span className={`truncate text-[13px] ${thread.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'}`}>
                              {leadName}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteThread(id, e)}
                              title="Permanently delete thread"
                              aria-label="Permanently delete thread"
                              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {when ? new Date(when).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}
                            </span>
                          </div>
                        </div>

                        <p className={`mt-0.5 truncate text-xs ${thread.unread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                          {thread.subject || '(No subject)'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground/90">{thread.snippet || 'No preview available'}</p>

                        <div className="mt-2 flex items-center gap-1.5">
                          {sourceChip(thread.isBlast)}
                          {thread.hasInbound && (
                            <span className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded border border-warning/30 bg-warning/10 px-1.5 text-[10px] font-medium text-warning">
                              <MessageSquareReply className="h-2.5 w-2.5" /> Replied
                            </span>
                          )}
                          {lead.company && <span className="min-w-0 truncate text-[11px] text-muted-foreground">{lead.company}</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ================= CENTER: thread + composer ================= */}
        <section className="flex min-h-[460px] min-w-0 flex-col bg-card lg:min-h-0" aria-label="Conversation">
          {loadingDetail ? (
            <LoadingState rows={4} label="Loading messages" />
          ) : !threadDetail ? (
            <EmptyState icon={Inbox} title="No conversation selected" description="Pick a thread from the list to read messages and reply." />
          ) : (
            <div key={selectedThreadId} className="anim-fade-in flex h-full min-h-0 flex-1 flex-col overflow-hidden">
              {/* Thread header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                      {threadDetail.thread?.subject || '(No subject)'}
                    </h2>
                    {sourceChip(threadDetail.thread?.isBlast)}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setSelectedLeadId(brainLeadId)}
                      className="font-medium text-primary hover:underline"
                    >
                      {threadLeadName}
                    </button>
                    {threadLeadObj?.company && <span> · {threadLeadObj.company}</span>}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleArchiveThread}
                    className="h-8 w-8"
                    title={activeFilter === 'archived' ? 'Restore thread' : 'Archive thread'}
                    aria-label={activeFilter === 'archived' ? 'Restore thread' : 'Archive thread'}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteThread(selectedThreadId)}
                    disabled={deletingId === selectedThreadId}
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    title="Permanently delete thread"
                    aria-label="Permanently delete thread"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-muted/20 p-4">
                {!threadDetail.messages || threadDetail.messages.length === 0 ? (
                  <p className="py-12 text-center text-xs text-muted-foreground">No messages in this thread yet.</p>
                ) : (
                  threadDetail.messages.map((msg, idx) => {
                    const isInbound = msg.direction === 'inbound';
                    const msgId = msg._id || msg.id;
                    return (
                      <div key={msgId || idx} className={`group/msg flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}>
                        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {isInbound ? threadLeadObj?.fullName || msg.sender || 'Prospect' : 'MineTech'}
                          </span>
                          {isInbound ? (
                            <span className="rounded border border-warning/30 bg-warning/10 px-1.5 py-px text-[10px] font-medium text-warning">Reply</span>
                          ) : (
                            sourceChip(msg.isBlast)
                          )}
                          <span className="tabular-nums">
                            {msg.sentAt || msg.createdAt ? new Date(msg.sentAt || msg.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                          </span>
                          {msgId && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msgId)}
                              title="Delete this message"
                              aria-label="Delete this message"
                              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/msg:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        <div
                          className={`max-w-[44rem] rounded-xl border px-4 py-3 text-[13px] leading-relaxed shadow-subtle ${
                            isInbound
                              ? 'rounded-tl-sm border-border bg-card text-foreground'
                              : msg.isBlast
                              ? 'rounded-tr-sm border-primary/20 bg-primary/10 text-foreground'
                              : 'rounded-tr-sm border-border bg-secondary/60 text-foreground'
                          }`}
                        >
                          {msg.bodyHtml ? (
                            <div className="email-html" dangerouslySetInnerHTML={{ __html: msg.bodyHtml }} />
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.bodyText || msg.body_plain}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Below the wide breakpoint the lead / AI context sits above the composer */}
              {!wide && threadLead && (
                <div className="shrink-0 border-t border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setShowAIPanel(!showAIPanel)}
                    aria-expanded={showAIPanel}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      Lead &amp; AI insights
                    </span>
                    {showAIPanel ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  {showAIPanel && <div className="max-h-[260px] overflow-y-auto border-t border-border/70 bg-muted/20 p-3">{intelligenceBody}</div>}
                </div>
              )}

              {/* Composer */}
              <form onSubmit={handleSendReply} className="shrink-0 space-y-2.5 border-t border-border bg-card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Reply to {threadLeadName}</span>
                    {aiReplyDecisionId && (
                      <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Sparkles className="h-2.5 w-2.5" /> AI draft · review before sending
                      </span>
                    )}
                    {statusMessage && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-success">
                        <Check className="h-3 w-3" /> {statusMessage}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateAIReply}
                    disabled={isGeneratingAI}
                    className="h-7 gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                    {isGeneratingAI ? 'Generating...' : 'Suggest smart reply'}
                  </Button>
                </div>

                <Textarea
                  value={replyBody}
                  onChange={(e) => {
                    setReplyBody(e.target.value);
                    if (!e.target.value.trim()) setAiReplyDecisionId(null);
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  rows={3}
                  aria-label="Reply message"
                  placeholder="Write your reply..."
                  className="text-[13px]"
                />

                {brainLeadId && (
                  <AiDraftBar
                    leadId={brainLeadId}
                    surface="reply"
                    threadId={selectedThreadId}
                    currentDraft={replyBody.trim() ? { subject: threadDetail.thread?.subject || '', body: replyBody } : null}
                    disabled={sendingReply}
                    onAccept={({ body: nextBody, decisionId }) => {
                      setReplyBody(nextBody);
                      setAiReplyDecisionId(decisionId || null);
                    }}
                  />
                )}

                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[11px] text-muted-foreground">
                    From outreach@minetechresources.com · <kbd className="kbd">Ctrl</kbd> <kbd className="kbd">Enter</kbd> to send
                  </span>
                  <Button type="submit" disabled={sendingReply || !replyBody.trim()} className="h-8 shrink-0 gap-2 px-4">
                    <Send className="h-3.5 w-3.5" />
                    <span>{sendingReply ? 'Sending...' : 'Send reply'}</span>
                    <CornerDownLeft className="h-3 w-3 opacity-60" />
                  </Button>
                </div>
              </form>
            </div>
          )}
        </section>

        {/* ================= RIGHT: lead & AI rail (wide screens) ================= */}
        {wide && (
          <aside className="min-h-0 overflow-y-auto border-l border-border bg-muted/20 p-3" aria-label="Lead and AI insights">
            {threadDetail && threadLead ? (
              <div key={selectedThreadId} className="anim-fade-in">{intelligenceBody}</div>
            ) : (
              <EmptyState icon={Bot} title="Lead & AI insights" description="Select a conversation to see the lead, reply analysis and suggested next step." />
            )}
          </aside>
        )}
      </Card>

      {/* Lead drawer */}
      {selectedLeadId && (
        <LeadDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdated={() => {
            fetchThreads();
            if (selectedThreadId) fetchThreadDetail(selectedThreadId);
          }}
        />
      )}
    </div>
  );
}
