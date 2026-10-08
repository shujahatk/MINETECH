'use client';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Clock,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  Building,
  Briefcase,
  Lock,
  Check,
  RefreshCw,
  Zap,
  Search,
  ArrowRight,
  ExternalLink,
  Target,
  CornerDownLeft,
  User,
  HelpCircle,
  AlertTriangle,
  CalendarClock,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ModalFrame } from '@/components/ui/modal-frame';
import { SectionCard } from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/StatusBadge';
import LeadAiBrain from '@/components/ai/LeadAiBrain';

const ComposeModal = dynamic(() => import('@/components/email/ComposeModal'), { ssr: false });

export default function SalesCockpit() {
  const [loadError, setLoadError] = useState('');
  const [queue, setQueue] = useState([]);
  const [activeLead, setActiveLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingLead, setLoadingLead] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(300);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Action States
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [previewEmailModal, setPreviewEmailModal] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [scheduledCallback, setScheduledCallback] = useState('');
  const [isSubmittingOutcome, setIsSubmittingOutcome] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPersonalization, setAiPersonalization] = useState(null);

  // 6 outcome chips with keyboard hotkeys (email-first)
  const DISPOSITION_OPTIONS = [
    { key: '1', label: 'Replied / Interested', value: 'REPLIED_INTERESTED', hotkey: '1' },
    { key: '2', label: 'Meeting Booked', value: 'MEETING_BOOKED', hotkey: '2' },
    { key: '3', label: 'No Response Yet', value: 'NO_RESPONSE', hotkey: '3' },
    { key: '4', label: 'Follow-up Needed', value: 'FOLLOW_UP', hotkey: '4' },
    { key: '5', label: 'Not Interested', value: 'NOT_INTERESTED', hotkey: '5' },
    { key: '6', label: 'Do Not Contact', value: 'DO_NOT_CONTACT', hotkey: '6' },
  ];

  // Fetch Priority Queue
  const fetchQueue = async () => {
    try {
      setLoadingQueue(true);
      const res = await fetch('/api/leads/queue', { cache: 'no-store' });
      if (!res.ok) throw new Error('Request failed');
      if (res.ok) {
        setLoadError('');
        const json = await res.json();
        const leads = json.data || [];
        setQueue(leads);
        if (leads.length === 0) {
          setActiveLead(null);
          setTimeline([]);
        } else if (!activeLead || !leads.some((l) => (l._id || l.id) === (activeLead._id || activeLead.id))) {
          selectLead(leads[0]._id || leads[0].id);
        }
      }
    } catch (err) {
      setLoadError('Could not load the priority queue. Please try again.');
      console.error('Failed to load queue:', err);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Select and Lock Lead
  const selectLead = async (leadId) => {
    if (!leadId) return;
    try {
      setLoadingLead(true);
      setAiPersonalization(null);
      setSelectedOutcome('');
      setCallNotes('');

      // 1. Acquire Lock
      await fetch(`/api/leads/${leadId}/lock`, { method: 'POST' });

      // 2. Fetch Lead & Timeline concurrently
      const [leadRes, timeRes] = await Promise.all([
        fetch(`/api/leads/${leadId}`),
        fetch(`/api/leads/${leadId}/timeline`),
      ]);

      if (leadRes.ok) {
        const lJson = await leadRes.json();
        setActiveLead(lJson.data);
        setCallNotes(lJson.data.notes || '');
      }

      if (timeRes.ok) {
        const tJson = await timeRes.json();
        setTimeline(tJson.data || []);
      }

      setLockTimeRemaining(300);
    } catch (err) {
      console.error('Error selecting lead:', err);
    } finally {
      setLoadingLead(false);
    }
  };

  // Lock Countdown Timer
  useEffect(() => {
    if (!activeLead) return;
    const timer = setInterval(() => {
      setLockTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeLead]);

  // Handle Refresh Lock
  const refreshLock = async () => {
    if (!activeLead) return;
    try {
      const res = await fetch(`/api/leads/${activeLead._id || activeLead.id}/lock`, { method: 'POST' });
      if (res.ok) {
        setLockTimeRemaining(300);
      }
    } catch (err) {}
  };

  // Handle Log Outcome & Advance to Next Lead
  const handleLogOutcome = useCallback(async () => {
    if (!activeLead || !selectedOutcome) return;
    try {
      setIsSubmittingOutcome(true);
      const leadId = activeLead._id || activeLead.id;

      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedOutcome === 'DO_NOT_CONTACT' ? 'DO_NOT_CONTACT' : activeLead.status,
          notes: callNotes,
          nextFollowUpAt: scheduledCallback ? new Date(scheduledCallback).toISOString() : undefined,
          lastOutcome: selectedOutcome,
        }),
      });

      // Release Lock
      await fetch(`/api/leads/${leadId}/lock`, { method: 'DELETE' });

      // Advance to next lead in queue
      const currentIndex = queue.findIndex((l) => (l._id || l.id) === leadId);
      const nextLead = queue[currentIndex + 1] || queue[0];

      await fetchQueue();

      if (nextLead && (nextLead._id || nextLead.id) !== leadId) {
        selectLead(nextLead._id || nextLead.id);
      } else {
        setActiveLead(null);
      }
    } catch (err) {
      console.error('Error logging outcome:', err);
    } finally {
      setIsSubmittingOutcome(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLead, selectedOutcome, callNotes, scheduledCallback, queue]);

  // Handle AI Personalization
  const handleGenerateAiResearch = async () => {
    if (!activeLead) return;
    try {
      setAiGenerating(true);
      const leadId = activeLead._id || activeLead.id;
      const res = await fetch(`/api/leads/${leadId}/research`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setAiPersonalization(json.data);
      }
    } catch (err) {
      console.error('Failed to generate AI briefing:', err);
    } finally {
      setAiGenerating(false);
    }
  };

  // Keyboard Shortcuts Listener (1-6 for dispositions, Ctrl+Enter to save)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore when focused in text inputs
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleLogOutcome();
        }
        return;
      }

      if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        const found = DISPOSITION_OPTIONS.find((opt) => opt.hotkey === e.key);
        if (found) {
          e.preventDefault();
          setSelectedOutcome(found.value);
        }
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const currentIndex = queue.findIndex((l) => (l._id || l.id) === (activeLead?._id || activeLead?.id));
        const nextLead = queue[currentIndex + 1] || queue[0];
        if (nextLead) selectLead(nextLead._id || nextLead.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLead, queue, handleLogOutcome]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const filteredQueue = queue.filter((lead) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (lead.name || lead.fullName || '').toLowerCase();
    const company = (lead.company || '').toLowerCase();
    const email = (lead.email || '').toLowerCase();
    return name.includes(q) || company.includes(q) || email.includes(q);
  });

  // Extract outbound sent emails from lead timeline
  const sentEmails = (timeline || []).filter(
    (item) =>
      item.type === 'EMAIL_SENT' ||
      item.type === 'BLAST_EMAIL_SENT' ||
      item.type?.toLowerCase?.().includes('email') ||
      item.direction === 'outbound'
  );
  const lastSentEmail = sentEmails[0] || null;

  // ---- Presentation helpers (no behaviour) ----
  const [briefOpen, setBriefOpen] = useState(true);
  const activeLeadId = activeLead ? activeLead._id || activeLead.id : null;
  const nameOf = (l) =>
    (l && (l.name || l.fullName || [l.firstName, l.lastName].filter(Boolean).join(' '))) || 'Prospect';
  const initialsOf = (name) =>
    String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  const lockLow = lockTimeRemaining <= 60;
  const followUpAt = activeLead?.nextFollowUpAt || activeLead?.scheduledCallback;
  const dateOf = (item) => {
    const raw = item?.timestamp || item?.createdAt;
    const d = raw ? new Date(raw) : null;
    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
  };

  const goNext = () => {
    if (queue.length > 0) {
      const currentIndex = queue.findIndex((l) => (l._id || l.id) === (activeLead?._id || activeLead?.id));
      const nextLead = queue[currentIndex + 1] || queue[0];
      if (nextLead) selectLead(nextLead._id || nextLead.id);
    }
  };

  const leadStudy =
    activeLead?.enrich_data?.ai_intelligence ||
    activeLead?.custom_fields?.ai_intelligence ||
    activeLead?.ai_intelligence ||
    aiPersonalization;
  const conversationIntel =
    activeLead?.enrich_data?.conversation_intelligence || activeLead?.custom_fields?.conversation_intelligence;
  const resolvedList = conversationIntel?.resolvedQuestions || [];
  const activeQuestions = (leadStudy?.questionsToConfirm || []).filter((q) => {
    const qLower = q.toLowerCase();
    return !resolvedList.some((r) => qLower.includes(r.toLowerCase().split(' ')[0]));
  });

  const refreshBrief = async () => {
    if (!activeLead) return;
    setAiGenerating(true);
    try {
      const res = await fetch(`/api/leads/${activeLeadId}/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_refresh', force: true }),
      });
      if (res.ok) {
        const json = await res.json();
        setActiveLead((prev) => ({
          ...prev,
          enrich_data: { ...(prev.enrich_data || {}), ai_intelligence: json.data },
          custom_fields: { ...(prev.custom_fields || {}), ai_intelligence: json.data },
        }));
      }
    } catch (e) {
      console.error('Error refreshing brief:', e);
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {loadError && <ErrorState message={loadError} onRetry={() => fetchQueue()} />}

      <PageHeader
        icon={Target}
        title="Workstation"
        meta={`${queue.length} in queue`}
        description="Work your priority queue: review context, send email, log the outcome, move to the next lead."
        className="mb-0"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchQueue} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loadingQueue ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button size="sm" onClick={goNext} className="gap-1.5">
              <Play className="h-3 w-3 fill-current" />
              <span>Next lead</span>
              <kbd className="ml-1 hidden rounded bg-black/20 px-1 font-mono text-[10px] sm:inline-block">N</kbd>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[264px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)_340px]">
        {/* ============ LEFT: priority queue ============ */}
        <aside className="rounded-xl border border-border bg-card shadow-card lg:row-span-2 lg:sticky lg:top-[4.5rem] xl:row-span-1">
          <div className="space-y-2.5 border-b border-border/70 p-3">
            <div className="flex items-center justify-between">
              <h2 className="section-heading flex items-center gap-2">
                Priority queue
                <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {queue.length}
                </span>
              </h2>
              <span className="text-[11px] text-muted-foreground">Ranked by score</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="text"
                aria-label="Search the queue"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prospects..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="max-h-[calc(100vh-17rem)] min-h-[200px] overflow-y-auto p-1.5">
            {loadingQueue && queue.length === 0 ? (
              <LoadingState rows={5} label="Loading priority leads" />
            ) : filteredQueue.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={searchQuery ? 'No matching prospects' : 'Queue is clear'}
                description={searchQuery ? 'Try a different name, company or email.' : 'No leads are waiting for outreach right now.'}
              />
            ) : (
              <ul className="space-y-0.5">
                {filteredQueue.map((lead, idx) => {
                  const isSelected = activeLead && (activeLead._id === lead._id || activeLead.id === lead.id);
                  const name = nameOf(lead);
                  const subtitle = [lead.company, lead.jobTitle].filter(Boolean).join(' · ');
                  return (
                    <li key={lead._id || lead.id || idx}>
                      <button
                        type="button"
                        onClick={() => selectLead(lead._id || lead.id)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                          isSelected ? 'row-selected' : 'hover:bg-muted/50'
                        }`}
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[11px] font-semibold text-foreground">
                          {initialsOf(name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[13px] font-semibold transition-colors ${isSelected ? 'text-foreground' : 'text-foreground/90 group-hover:text-foreground'}`}>
                            {name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {subtitle || lead.email || 'No company on file'}
                          </span>
                          <span className="mt-1.5 block">
                            <StatusBadge size="sm" status={lead.status || 'NEW'} label={lead.status?.replaceAll('_', ' ') || 'New'} />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ============ CENTER: lead, email, outcome ============ */}
        <div className="min-w-0 space-y-4">
          {loadingLead ? (
            <div className="space-y-4" role="status" aria-busy="true" aria-label="Opening lead">
              <span className="sr-only">Acquiring lock and assembling the prospect dossier</span>
              <div className="panel space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
                </div>
              </div>
              <div className="panel space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ) : !activeLead ? (
            <div className="panel">
              <EmptyState
                icon={Target}
                title="No lead selected"
                description="Choose a prospect from the priority queue to review context and start outreach."
              />
            </div>
          ) : (
            <div key={activeLeadId} className="space-y-4 anim-fade-in">
              {/* Lead header */}
              <section className="rounded-xl border border-border bg-card shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2">
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
                      lockLow ? 'tone-warning' : 'tone-brand'
                    }`}
                  >
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    <span>Reserved for you</span>
                    <span className="opacity-50">·</span>
                    <span className="font-mono font-semibold tabular-nums">{formatTimer(lockTimeRemaining)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={refreshLock}
                    className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    <span>Renew (+5 min)</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-start justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-foreground">
                      {initialsOf(nameOf(activeLead))}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground">
                        {nameOf(activeLead)}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {activeLead.jobTitle && (
                          <span className="inline-flex items-center gap-1">
                            <Briefcase className="h-3 w-3" aria-hidden="true" />
                            {activeLead.jobTitle}
                          </span>
                        )}
                        {activeLead.company && (
                          <span className="inline-flex items-center gap-1 font-medium text-foreground/90">
                            <Building className="h-3 w-3" aria-hidden="true" />
                            {activeLead.company}
                          </span>
                        )}
                        {activeLead.industry && <span>{activeLead.industry}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" onClick={() => setIsComposeOpen(true)} className="gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      <span>Write email</span>
                    </Button>
                  </div>
                </div>

                <dl className="grid grid-cols-2 divide-x divide-y divide-border/70 border-t border-border/70 sm:grid-cols-4 sm:divide-y-0">
                  <div className="min-w-0 px-4 py-3">
                    <dt className="field-label">Email</dt>
                    <dd className="mt-1 truncate text-[13px] font-medium text-foreground">
                      {activeLead.email ? (
                        <a href={`mailto:${activeLead.email}`} className="hover:text-primary hover:underline">
                          {activeLead.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No email on file</span>
                      )}
                    </dd>
                  </div>
                  <div className="px-4 py-3">
                    <dt className="field-label">Status</dt>
                    <dd className="mt-1">
                      <StatusBadge size="sm" status={activeLead.status || 'NEW'} label={activeLead.status?.replaceAll('_', ' ') || 'New'} />
                    </dd>
                  </div>
                  <div className="px-4 py-3">
                    <dt className="field-label">Next follow-up</dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {followUpAt ? new Date(followUpAt).toLocaleDateString() : <span className="text-muted-foreground">None scheduled</span>}
                    </dd>
                  </div>
                  <div className="px-4 py-3">
                    <dt className="field-label">Emails sent</dt>
                    <dd className="mt-1 text-[13px] font-medium tabular-nums text-foreground">{sentEmails.length}</dd>
                  </div>
                </dl>
              </section>

              {/* Email activity */}
              <SectionCard
                title="Email activity"
                description={sentEmails.length ? `${sentEmails.length} sent to this prospect` : 'Nothing sent to this prospect yet'}
                icon={Mail}
                flush
                action={
                  <Button variant="outline" size="sm" onClick={() => setIsComposeOpen(true)} className="h-7 gap-1.5 px-2.5 text-xs">
                    <Send className="h-3 w-3" />
                    <span>{sentEmails.length ? 'Follow up' : 'Send first email'}</span>
                  </Button>
                }
              >
                {sentEmails.length === 0 ? (
                  <EmptyState
                    icon={Mail}
                    title="No emails sent yet"
                    description="Write the first message, or open AI Intelligence for a suggested approach."
                    action={
                      <Button size="sm" onClick={() => setIsComposeOpen(true)} className="gap-1.5">
                        <span>Write email</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border/70">
                    {sentEmails.slice(0, 3).map((mail, i) => {
                      const isBlast = mail.isBlast || mail.dispatchSource === 'blast';
                      return (
                        <li key={mail.id || mail._id || i} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                            {isBlast ? <Zap className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-foreground">
                              {mail.subject || mail.details?.subject || 'Outbound message'}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                              <span>{isBlast ? 'Campaign' : 'Direct'}</span>
                              {dateOf(mail) && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="tabular-nums">{dateOf(mail)}</span>
                                </>
                              )}
                            </p>
                          </div>
                          <StatusBadge size="sm" status={mail.status || 'DELIVERED'} label={mail.status || 'Delivered'} />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewEmailModal(mail)}
                            className="h-7 gap-1 px-2 text-xs"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>View</span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>

              {/* Outcome */}
              <SectionCard
                title="Log outcome"
                description="Record what happened, add notes and schedule the follow-up"
                icon={CheckCircle2}
                action={
                  <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:inline-flex">
                    <kbd className="kbd">1-6</kbd> choose
                    <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">Enter</kbd> save
                  </span>
                }
              >
                <div className="space-y-4">
                  <div role="group" aria-label="Outcome" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {DISPOSITION_OPTIONS.map((btn) => {
                      const isSelected = selectedOutcome === btn.value;
                      const isDanger = btn.value === 'DO_NOT_CONTACT' || btn.value === 'NOT_INTERESTED';
                      return (
                        <button
                          key={btn.value}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedOutcome(btn.value)}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                            isSelected
                              ? isDanger
                                ? 'border-danger/50 bg-danger/10 text-danger'
                                : 'border-primary bg-primary text-primary-foreground shadow-subtle'
                              : 'border-border bg-card text-foreground hover:border-muted-foreground/40 hover:bg-muted/50'
                          }`}
                        >
                          <span className="truncate">{btn.label}</span>
                          <kbd
                            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                              isSelected && !isDanger ? 'bg-black/20 text-primary-foreground' : 'border border-border bg-muted text-muted-foreground'
                            }`}
                          >
                            {btn.hotkey}
                          </kbd>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label htmlFor="ws-notes" className="field-label mb-1.5 block">Notes</label>
                    <Textarea
                      id="ws-notes"
                      rows={3}
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      placeholder="Add notes, objections or next steps..."
                      className="text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="sm:w-60">
                      <label htmlFor="ws-followup" className="field-label mb-1.5 block">Follow up on</label>
                      <Input
                        id="ws-followup"
                        type="datetime-local"
                        value={scheduledCallback}
                        onChange={(e) => setScheduledCallback(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <Button
                      onClick={handleLogOutcome}
                      disabled={!selectedOutcome || isSubmittingOutcome}
                      className="h-9 flex-1 gap-2"
                    >
                      <span>{isSubmittingOutcome ? 'Saving...' : 'Save result and next lead'}</span>
                      <CornerDownLeft className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}
        </div>

        {/* ============ RIGHT: intelligence ============ */}
        {activeLead && !loadingLead && (
          <div className="min-w-0 space-y-4 lg:col-start-2 xl:col-start-3">
            <LeadAiBrain
              key={activeLeadId}
              leadId={activeLeadId}
              lead={activeLead}
              legacySummary={leadStudy?.leadSummary ? { summary: leadStudy.leadSummary } : null}
              onSent={() => {
                fetchQueue();
                fetch(`/api/leads/${activeLeadId}/timeline`)
                  .then((r) => r.json())
                  .then((j) => setTimeline(j.data || []))
                  .catch(() => {});
              }}
            />

            <section className="rounded-xl border border-border bg-card shadow-card">
              <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setBriefOpen((v) => !v)}
                  aria-expanded={briefOpen}
                  className="flex min-w-0 items-center gap-2 text-left"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <h2 className="section-heading">Lead brief</h2>
                  {leadStudy?.relevance && (
                    <Badge variant={leadStudy.relevance === 'high' ? 'default' : 'warning'}>
                      {String(leadStudy.relevance).toUpperCase()} fit
                    </Badge>
                  )}
                  {leadStudy?.status === 'OUTDATED' && <Badge variant="warning">Outdated</Badge>}
                  {briefOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshBrief}
                  disabled={aiGenerating}
                  className="h-7 shrink-0 gap-1.5 px-2 text-xs text-primary hover:text-primary"
                >
                  <RotateCcw className={`h-3 w-3 ${aiGenerating ? 'animate-spin' : ''}`} />
                  <span>{aiGenerating ? 'Analyzing...' : leadStudy ? 'Refresh' : 'Generate'}</span>
                </Button>
              </header>

              {briefOpen && (
                <div className="space-y-3 p-4 text-xs">
                  {conversationIntel?.confirmedFacts?.length > 0 && (
                    <div className="rounded-lg border border-success/25 bg-success/5 p-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
                          <Check className="h-3 w-3" /> Confirmed in conversation
                        </span>
                        {conversationIntel.recommendedNextAction && (
                          <span className="truncate text-[11px] text-muted-foreground">
                            Next: {conversationIntel.recommendedNextAction}
                          </span>
                        )}
                      </div>
                      <ul className="space-y-1 text-foreground">
                        {conversationIntel.confirmedFacts.map((fact, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                            <span>{fact}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {leadStudy?.leadSummary ? (
                    <>
                      <div className="space-y-1">
                        <span className="field-label block">What they do and why we are reaching out</span>
                        <p className="leading-relaxed text-foreground">{leadStudy.leadSummary}</p>
                        {leadStudy.fitReason && <p className="font-medium text-primary">{leadStudy.fitReason}</p>}
                      </div>

                      {(conversationIntel?.recommendedNextAction || leadStudy.recommendedAngle || leadStudy.personalizationPoints?.length > 0) && (
                        <div className="space-y-1.5">
                          <span className="field-label block">Talking points</span>
                          <ul className="space-y-1 text-foreground/90">
                            {conversationIntel?.recommendedNextAction && (
                              <li className="flex items-start gap-1.5 font-medium text-primary">
                                <Target className="mt-0.5 h-3 w-3 shrink-0" />
                                <span>Goal: {conversationIntel.recommendedNextAction}</span>
                              </li>
                            )}
                            {leadStudy.recommendedAngle && (
                              <li className="flex items-start gap-1.5 font-medium text-foreground">
                                <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                                <span>{leadStudy.recommendedAngle}</span>
                              </li>
                            )}
                            {(leadStudy.personalizationPoints || []).map((pt, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <span className="field-label block">Still to confirm</span>
                        {activeQuestions.length ? (
                          <ul className="space-y-1 text-foreground/90">
                            {activeQuestions.map((q, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                                <span>{q}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="font-medium text-success">All core questions verified. Ready for a quote.</p>
                        )}
                      </div>

                      {leadStudy.risksOrUnknowns?.length > 0 && (
                        <div className="rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-warning">
                          <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold">
                            <AlertTriangle className="h-3 w-3" /> Not confirmed - do not treat as fact
                          </span>
                          <ul className="space-y-0.5">
                            {leadStudy.risksOrUnknowns.map((r, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span aria-hidden="true">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
                      <Sparkles className="mx-auto h-4 w-4 text-muted-foreground" />
                      <p className="mt-1.5 font-medium text-foreground">No stored lead brief yet</p>
                      <p className="mt-0.5 text-muted-foreground">Use Generate to create one.</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Compose */}
      {isComposeOpen && activeLead && (
        <ComposeModal
          lead={activeLead}
          onClose={() => setIsComposeOpen(false)}
          onSent={() => {
            fetchQueue();
            if (activeLead?._id || activeLead?.id) {
              fetch(`/api/leads/${activeLead._id || activeLead.id}/timeline`)
                .then((r) => r.json())
                .then((j) => setTimeline(j.data || []));
            }
          }}
        />
      )}

      {/* Sent-email preview */}
      {previewEmailModal && (
        <ModalFrame title="Sent email" onClose={() => setPreviewEmailModal(null)} className="max-w-xl">
          <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-dialog">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 p-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    Sent email
                    <StatusBadge size="sm" status={previewEmailModal.status || 'DELIVERED'} label={previewEmailModal.status || 'Delivered'} />
                  </h3>
                  <p className="truncate text-[11px] text-muted-foreground">
                    To {previewEmailModal.recipient || activeLead?.email}
                    {dateOf(previewEmailModal) ? ` · ${dateOf(previewEmailModal)}` : ''}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreviewEmailModal(null)} className="h-8">
                Close
              </Button>
            </div>

            <div className="space-y-4 overflow-y-auto p-5">
              <div>
                <span className="field-label mb-1 block">Subject</span>
                <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs font-semibold text-foreground">
                  {previewEmailModal.subject || previewEmailModal.details?.subject || 'Outbound message'}
                </div>
              </div>
              <div>
                <span className="field-label mb-1 block">Message</span>
                <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3.5 text-xs leading-relaxed text-foreground">
                  {previewEmailModal.bodyText || previewEmailModal.details?.snippet || 'No message content.'}
                </div>
              </div>
            </div>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}
