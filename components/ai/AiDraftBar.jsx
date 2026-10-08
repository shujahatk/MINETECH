'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, RefreshCw, Check, Pencil, X, AlertTriangle, Info, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/**
 * Short-command AI drafting bar.
 *
 * The user types 2-4 words ("short follow up", "make it warmer") or taps a chip. The component
 * only sends { leadId, instruction } (plus the text currently on screen for edit commands such as
 * "make shorter"). The server loads all research, campaign, thread and playbook context itself.
 *
 * Claude only drafts. "Use draft" puts the text into the editor of the host screen; the human still
 * reviews, edits and presses that screen's own Send button. Nothing here sends email.
 *
 * It renders no <form>: hosts place it inside their own send form, so Enter is handled explicitly.
 */

export const DRAFT_CHIPS = [
  { id: 'initial', label: 'Initial Email', command: 'draft intro email', surfaces: ['compose'] },
  { id: 'follow', label: 'Follow Up', command: 'short follow up', surfaces: ['compose'] },
  { id: 'reply', label: 'Reply', command: 'reply', surfaces: ['compose', 'reply'] },
  { id: 'meeting', label: 'Meeting', command: 'meeting follow up', surfaces: ['compose', 'reply'] },
  { id: 'shorter', label: 'Shorter', command: 'make shorter', surfaces: ['compose', 'reply'] },
  { id: 'warmer', label: 'Warmer', command: 'make warmer', surfaces: ['compose', 'reply'] },
  { id: 'direct', label: 'More Direct', command: 'more direct', surfaces: ['compose', 'reply'] },
];

const INTENT_LABELS = {
  INTRO_EMAIL: 'Intro email',
  FOLLOW_UP: 'Follow-up',
  FINAL_FOLLOW_UP: 'Final follow-up',
  MEETING_FOLLOW_UP: 'Meeting follow-up',
  MEETING_REPLY: 'Meeting reply',
  REPLY: 'Reply',
  REPLY_OBJECTION: 'Reply to objection',
  REPLY_QUESTION: 'Answer to question',
  REPLY_POSITIVE: 'Positive reply',
};

const MESSAGE_STYLES = {
  info: 'border-border bg-card text-foreground',
    warn: 'tone-warning',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export default function AiDraftBar({
  leadId,
  surface = 'compose', // 'compose' | 'reply'
  threadId = null,
  campaignId = null,
  // Text currently in the host editor (signature removed). Only used for edit commands.
  currentDraft = null,
  disabled = false,
  onAccept, // ({ subject, body, decisionId, warnings, intent }) => void
  className = '',
}) {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pending, setPending] = useState(null); // READY result awaiting accept
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [message, setMessage] = useState(null); // { tone, text, suggestion?, retry? }
  const lastRun = useRef(null); // { command, base }
  const requestId = useRef(0);

  // A different lead or conversation invalidates any draft that is waiting.
  useEffect(() => {
    requestId.current += 1;
    setPending(null);
    setEditing(false);
    setMessage(null);
    setLoading(false);
  }, [leadId, threadId]);

  const chips = DRAFT_CHIPS.filter((c) => c.surfaces.includes(surface));

  const run = async (command, base) => {
    if (!leadId || loading || disabled) return;
    const text = String(command || '').trim();

    const baseDraft = base !== undefined ? base : pending ? { subject: editing ? editSubject : pending.draft.subject, body: editing ? editBody : pending.draft.body } : currentDraft;
    lastRun.current = { command: text, base: baseDraft || null };

    const myRequest = ++requestId.current;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          instruction: text,
          surface,
          ...(threadId ? { threadId } : {}),
          ...(campaignId ? { campaignId } : {}),
          ...(baseDraft?.body ? { currentDraft: { subject: baseDraft.subject || '', body: baseDraft.body } } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (myRequest !== requestId.current) return; // superseded or lead changed

      const data = json.data;
      if (data?.status === 'READY') {
        setPending(data);
        setEditing(false);
        setEditSubject(data.draft.subject);
        setEditBody(data.draft.body);
        setInstruction('');
        return;
      }

      setPending(null);
      if (data?.status === 'NOT_APPLICABLE') {
        setMessage({ tone: 'info', text: data.error, suggestion: data.suggestion || null });
      } else if (data?.status === 'BLOCKED') {
        setMessage({ tone: 'error', text: data.error });
      } else {
        setMessage({ tone: 'error', text: data?.error || json.message || 'Could not write a draft. Please try again.', retry: text });
      }
    } catch {
      if (myRequest !== requestId.current) return;
      setMessage({ tone: 'error', text: 'Network error. Check your connection and try again.', retry: text });
    } finally {
      if (myRequest === requestId.current) setLoading(false);
    }
  };

  const submit = () => run(instruction);

  const regenerate = () => {
    if (!lastRun.current) return;
    run(lastRun.current.command, lastRun.current.base);
  };

  const accept = () => {
    if (!pending) return;
    const subject = (editing ? editSubject : pending.draft.subject).trim();
    const body = (editing ? editBody : pending.draft.body).trim();
    if (!body) return;
    onAccept?.({
      subject,
      body,
      decisionId: pending.decisionId || null,
      warnings: pending.warnings || [],
      intent: pending.plan?.intent || null,
    });
    setPending(null);
    setEditing(false);
    toast.success('Draft added. Review it before sending.');
  };

  const analyzeThenRedraft = async () => {
    if (!leadId || analyzing) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/ai/brain/leads/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.data?.status === 'FAILED') {
        toast.error(json?.data?.error || json?.message || 'Lead analysis failed.');
        return;
      }
      toast.success('Lead analysed. Redrafting…');
      if (lastRun.current) await run(lastRun.current.command, lastRun.current.base);
    } catch {
      toast.error('Lead analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.nativeEvent?.isComposing) return;
    // Keep Enter inside the bar: hosts submit/send on Enter or Ctrl+Enter.
    e.preventDefault();
    e.stopPropagation();
    submit();
  };

  const confidencePct = pending ? Math.round((pending.draft.confidence || 0) * 100) : 0;
  const busy = loading || analyzing;

  return (
    <div className={`rounded-xl border border-border bg-muted/30 ${className}`} aria-busy={busy}>
      {/* Command input */}
      <div className="flex items-center gap-2 p-2">
        <div className="relative min-w-0 flex-1">
          <Sparkles className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy || disabled || !leadId}
            maxLength={300}
            aria-label="Tell Claude what to write"
            placeholder={leadId ? 'Tell Claude what to write...' : 'Select a lead to use the AI assistant'}
            className="h-9 rounded-lg border-border bg-card pl-8 text-[13px]"
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={busy || disabled || !leadId}
          className="h-9 shrink-0 gap-1.5 px-3"
          aria-label="Generate draft"
        >
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{loading ? 'Writing…' : 'Generate'}</span>
        </Button>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={busy || disabled || !leadId}
            onClick={() => run(chip.command)}
            title={`"${chip.command}"`}
            className="h-6 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Generating state */}
      {loading && (
        <div className="border-t border-border px-3 py-3" role="status" aria-live="polite">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 animate-pulse text-primary" /> Claude is reading the lead&apos;s research and thread…
          </p>
          <div className="space-y-1.5">
            <div className="h-2.5 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-full animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-11/12 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-3/5 animate-pulse rounded bg-muted" />
          </div>
        </div>
      )}

      {/* Messages (not applicable / blocked / failed) */}
      {!loading && message && (
        <div className={`mx-2 mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${MESSAGE_STYLES[message.tone]}`} role="status">
          {message.tone === 'error' ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <div className="min-w-0 flex-1 space-y-1.5">
            <p>{message.text}</p>
            {message.suggestion && (
              <button type="button" onClick={() => run(message.suggestion)} className="font-semibold underline underline-offset-2">
                Try &ldquo;{message.suggestion}&rdquo;
              </button>
            )}
            {message.retry !== undefined && (
              <button type="button" onClick={() => run(message.retry)} className="font-semibold underline underline-offset-2">
                Try again
              </button>
            )}
          </div>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message" className="shrink-0 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Draft preview */}
      {!loading && pending && (
        <div className="anim-fade-in border-t border-border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
            <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-primary">
              {INTENT_LABELS[pending.plan?.intent] || 'Draft'}
            </span>
            {pending.draft.tone && <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-muted-foreground">{pending.draft.tone}</span>}
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-muted-foreground" title="Claude's confidence in this draft">
              {confidencePct}% confidence
            </span>
          </div>

          {editing ? (
            <div className="space-y-2">
              {surface !== 'reply' && (
                <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} aria-label="Draft subject" className="h-8 text-xs font-medium" />
              )}
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={6} aria-label="Draft body" className="text-xs leading-relaxed" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {surface !== 'reply' && <p className="text-xs font-semibold text-foreground">{pending.draft.subject}</p>}
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{pending.draft.body}</p>
            </div>
          )}

          {pending.warnings?.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-warning">
              {pending.warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>
                  {w.message}
                  {w.excerpt ? ` (“${w.excerpt}”)` : ''}
                </li>
              ))}
            </ul>
          )}

          {pending.notices?.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              {pending.notices.map((n, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}

          {pending.research?.recommendAnalysis && (
            <button
              type="button"
              onClick={analyzeThenRedraft}
              disabled={analyzing}
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary underline underline-offset-2 disabled:opacity-60"
            >
              {analyzing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {analyzing ? 'Analysing lead…' : 'Analyse lead first, then redraft'}
            </button>
          )}

          {pending.usedContext?.length > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">Used: {pending.usedContext.join(' · ')}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={accept} className="h-8 gap-1.5 px-3">
              <Check className="h-3.5 w-3.5" /> Use draft
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing((v) => !v)} className="h-8 gap-1.5 border-border px-3">
              <Pencil className="h-3.5 w-3.5" /> {editing ? 'Done editing' : 'Edit'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={regenerate} disabled={busy} className="h-8 gap-1.5 px-3 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setPending(null); setEditing(false); }} className="ml-auto h-8 px-2 text-muted-foreground" aria-label="Discard draft">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Nothing is sent until you press Send.</p>
        </div>
      )}
    </div>
  );
}
