'use client';

import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Mail,
  Send,
  Archive,
  Search,
  ChevronRight,
  User,
  Clock,
  Sparkles,
  Phone,
  MessageSquare,
  AlertCircle,
  Building,
  CheckCircle,
  Flame,
} from 'lucide-react';
import LeadDrawer from '@/components/leads/LeadDrawer';

export default function InboxView() {
  const [threads, setThreads] = useState([]);
  const [counts, setCounts] = useState({ unread: 0, total: 0 });
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'unread', 'replies', 'archived'
  const [search, setSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [threadDetail, setThreadDetail] = useState(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const fetchThreads = async () => {
    try {
      const res = await fetch(`/api/email/inbox?filter=${activeFilter}&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const json = await res.json();
        setThreads(json.data || []);
        setCounts(json.counts || { unread: 0, total: 0 });
        if (json.data?.length > 0 && !selectedThreadId) {
          setSelectedThreadId(json.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load inbox threads:', err);
    } finally {
      setLoadingThreads(false);
    }
  };

  const fetchThreadDetail = async (id) => {
    if (!id) return;
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/email/threads/${id}`);
      if (res.ok) {
        const json = await res.json();
        setThreadDetail(json.data);
      }
    } catch (err) {
      console.error('Failed to load thread detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [activeFilter, search]);

  useEffect(() => {
    if (selectedThreadId) {
      fetchThreadDetail(selectedThreadId);
    }
  }, [selectedThreadId]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim() || !selectedThreadId) return;

    setSendingReply(true);
    try {
      const res = await fetch(`/api/email/threads/${selectedThreadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyHtml: `<p>${replyBody.replace(/\n/g, '<br/>')}</p>`,
          bodyText: replyBody,
        }),
      });

      if (res.ok) {
        setReplyBody('');
        fetchThreadDetail(selectedThreadId);
        fetchThreads();
      } else {
        const json = await res.json();
        alert(json.message || 'Failed to send reply');
      }
    } catch (err) {
      alert('Error sending reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleGenerateAIReply = async () => {
    if (!threadDetail?.thread?.leadId) return;
    setIsGeneratingAI(true);
    try {
      const lead = threadDetail.thread.leadId;
      const lastMsg = threadDetail.messages?.find((m) => m.direction === 'inbound') || threadDetail.messages?.[0];
      const res = await fetch('/api/email/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Reply to their message: "${lastMsg?.bodyText || ''}"`,
          tone: 'Professional',
          goal: 'Answer questions and book a 15-minute call',
          leadContext: {
            name: lead.fullName || lead.firstName,
            company: lead.company,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const cleanBody = json.data.bodyHtml.replace(/<[^>]*>?/gm, '');
        setReplyBody(cleanBody);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Inbox className="w-6 h-6 text-indigo-400" /> Unified Email Inbox
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            All prospect replies arrive here, automatically matched to CRM leads.
          </p>
        </div>
      </div>

      {/* 3-Pane Layout */}
      <div className="flex-1 glass-panel rounded-2xl overflow-hidden grid grid-cols-12 border border-slate-800/80">
        {/* Left Sub-Nav (Filter Folders) - 2 Cols */}
        <div className="col-span-12 md:col-span-3 lg:col-span-2 border-r border-slate-800/80 bg-slate-900/40 p-3 space-y-1">
          <div className="mb-3 px-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mailbox Views</span>
          </div>

          <button
            onClick={() => setActiveFilter('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeFilter === 'all' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4" /> All Threads
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{counts.total}</span>
          </button>

          <button
            onClick={() => setActiveFilter('unread')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeFilter === 'unread' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-amber-400" /> Unread Replies
            </span>
            {counts.unread > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500 text-white">
                {counts.unread}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('replies')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeFilter === 'replies' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-emerald-400" /> Inbound Responses
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('archived')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeFilter === 'archived' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-slate-500" /> Archived
            </span>
          </button>
        </div>

        {/* Center Pane: Threads List - 4 Cols */}
        <div className="col-span-12 md:col-span-4 lg:col-span-4 border-r border-slate-800/80 flex flex-col bg-slate-900/20">
          {/* Search */}
          <div className="p-3 border-b border-slate-800/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Threads Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
            {loadingThreads ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading threads...</div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No conversations in this view.</div>
            ) : (
              threads.map((thread) => {
                const lead = thread.leadId || {};
                const isSelected = selectedThreadId === thread._id;

                return (
                  <div
                    key={thread._id}
                    onClick={() => setSelectedThreadId(thread._id)}
                    className={`p-3.5 cursor-pointer transition relative ${
                      isSelected
                        ? 'bg-indigo-600/15 border-l-4 border-indigo-500'
                        : 'hover:bg-slate-800/40 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {thread.unread && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>}
                        <span className={`text-xs truncate ${thread.unread ? 'font-black text-white' : 'font-medium text-slate-300'}`}>
                          {lead.fullName || lead.email || thread.participants?.[1]?.name || 'Prospect'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {new Date(thread.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <p className={`text-xs truncate ${thread.unread ? 'font-bold text-slate-200' : 'text-slate-400'}`}>
                      {thread.subject}
                    </p>

                    <p className="text-[11px] text-slate-500 truncate mt-1">{thread.snippet || '...'}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Conversation & Reply Editor - 6 Cols */}
        <div className="col-span-12 md:col-span-5 lg:col-span-6 flex flex-col bg-[#090d16]/80 overflow-hidden">
          {loadingDetail ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Loading conversation...
            </div>
          ) : !threadDetail ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-500">
              Select a conversation to view and reply.
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Thread Header */}
              <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white truncate">{threadDetail.thread.subject}</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>
                      With:{' '}
                      <strong
                        onClick={() => setSelectedLeadId(threadDetail.thread.leadId?._id)}
                        className="text-indigo-400 hover:underline cursor-pointer"
                      >
                        {threadDetail.thread.leadId?.fullName || threadDetail.thread.leadId?.email}
                      </strong>
                    </span>
                    {threadDetail.thread.leadId?.company && <span>&bull; {threadDetail.thread.leadId.company}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedLeadId(threadDetail.thread.leadId?._id)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    View Lead Profile &rarr;
                  </button>
                </div>
              </div>

              {/* Messages Bubble Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {threadDetail.messages.map((msg) => {
                  const isInbound = msg.direction === 'inbound';

                  return (
                    <div key={msg._id} className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1 px-1">
                        <span>{isInbound ? msg.from?.name || msg.from?.email : 'You'}</span>
                        <span>&bull;</span>
                        <span>{new Date(msg.sentAt || msg.receivedAt || msg.createdAt).toLocaleString()}</span>
                      </div>

                      <div
                        className={`p-4 rounded-2xl max-w-xl text-xs leading-relaxed ${
                          isInbound
                            ? 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-sm'
                            : 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/15 rounded-tr-sm'
                        }`}
                      >
                        {msg.bodyHtml ? (
                          <div
                            className="prose prose-invert prose-xs max-w-none"
                            dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.bodyText}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <form onSubmit={handleSendReply} className="p-3.5 border-t border-slate-800/80 bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400">Write a Reply</span>
                  <button
                    type="button"
                    onClick={handleGenerateAIReply}
                    disabled={isGeneratingAI}
                    className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingAI ? 'Drafting with AI...' : 'Draft with AI'}
                  </button>
                </div>

                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={3}
                  placeholder="Type your response to the prospect..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                ></textarea>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    disabled={sendingReply || !replyBody.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25"
                  >
                    <Send className="w-3.5 h-3.5" /> {sendingReply ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Lead Drawer on click */}
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
