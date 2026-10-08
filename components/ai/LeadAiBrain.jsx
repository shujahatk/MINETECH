'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { BrainCircuit, RotateCcw, Sparkles, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Only loaded when the user opens an AI draft.
const ComposeModal = dynamic(() => import('@/components/email/ComposeModal'), { ssr: false });

const PRIORITY_VARIANT = { HOT: 'destructive', WARM: 'warning', COLD: 'info' };
const FIT_VARIANT = { HIGH: 'success', MEDIUM: 'warning', LOW: 'muted', UNKNOWN: 'muted' };

export const ACTION_LABELS = {
  SEND_INITIAL_EMAIL: 'Send first email',
  SEND_FOLLOW_UP: 'Send follow-up',
  ANSWER_REPLY: 'Answer reply',
  WAIT: 'Wait',
  REQUEST_MEETING: 'Request meeting',
  RESEARCH_MORE: 'Research more',
  CHANGE_STRATEGY: 'Change strategy',
  STOP_OUTREACH: 'Stop outreach',
  MANUAL_REVIEW: 'Manual review',
};

const SEND_ACTIONS = ['SEND_INITIAL_EMAIL', 'SEND_FOLLOW_UP', 'ANSWER_REPLY', 'REQUEST_MEETING'];

function Line({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[13px] leading-snug text-foreground">{children}</dd>
    </div>
  );
}

/**
 * "AI Intelligence" section of the Lead Drawer.
 *
 * Opening the drawer only READS cached intelligence (no Claude call). Claude runs when the user
 * clicks Analyze / Regenerate, and never blocks the rest of the drawer.
 */
export default function LeadAiBrain({ leadId, legacySummary = null, lead = null, onOpenStudy = null, onSent = null }) {
  const [state, setState] = useState(null); // { status, intelligence, recommendation, error, ... }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/brain/leads/${leadId}`);
      const json = await res.json().catch(() => ({}));
      if (!aliveRef.current) return;
      setState(res.ok && json.success ? json.data : { status: 'NOT_ANALYZED', intelligence: null, loadError: true });
    } catch {
      if (aliveRef.current) setState({ status: 'NOT_ANALYZED', intelligence: null, loadError: true });
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    setState(null);
    setAiDraft(null);
    load();
  }, [load]);

  const analyze = async (force) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/ai/brain/leads/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', force }),
      });
      const json = await res.json().catch(() => ({}));
      if (!aliveRef.current) return;
      const data = json.data;
      if (data) {
        setState((prev) => ({ ...(prev || {}), ...data, intelligence: data.intelligence || prev?.intelligence || null }));
      }
      if (data?.status === 'FAILED') toast.error(data.error || 'Analysis failed');
      else if (data?.status === 'READY') toast.success(data.cached ? 'Analysis is up to date' : 'Lead analyzed');
    } catch {
      toast.error('Could not reach the AI service');
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  const draftEmail = async () => {
    const rec = state?.recommendation?.action;
    setDrafting(true);
    try {
      const res = await fetch(`/api/ai/brain/leads/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft_email',
          kind: rec === 'SEND_FOLLOW_UP' ? 'FOLLOW_UP' : 'INITIAL',
          objective: state?.intelligence?.salesAngles?.[0] || 'Open a conversation',
        }),
      });
      const json = await res.json().catch(() => ({}));
      const data = json.data;
      if (data?.status === 'READY') {
        setAiDraft({ subject: data.draft.subject, body: data.draft.body, decisionId: data.decisionId, warnings: data.warnings || [] });
        setComposeOpen(true);
      } else if (data?.status === 'BLOCKED') {
        toast.error(data.reason || 'This lead cannot be contacted');
      } else {
        toast.error(data?.error || 'Could not draft an email');
      }
    } catch {
      toast.error('Could not reach the AI service');
    } finally {
      if (aliveRef.current) setDrafting(false);
    }
  };

  const status = state?.status || 'NOT_ANALYZED';
  const intel = state?.intelligence;
  const rec = state?.recommendation;
  const hasStudy = Boolean(intel?.summary);
  const analyzing = busy || status === 'PENDING';
  const canDraft = rec && ['SEND_INITIAL_EMAIL', 'SEND_FOLLOW_UP'].includes(rec.action) && rec.policy?.allowed !== false;

  const statusChip = analyzing ? (
    <Badge variant="info">Analyzing…</Badge>
  ) : status === 'STALE' ? (
    <Badge variant="warning">Lead changed</Badge>
  ) : status === 'FAILED' ? (
    <Badge variant="destructive">Failed</Badge>
  ) : status === 'READY' ? (
    <Badge variant="success">Ready</Badge>
  ) : (
    <Badge variant="muted">Not analyzed</Badge>
  );

  return (
    <section className="rounded-xl border border-border bg-card shadow-subtle" aria-label="AI Intelligence">
      <header className="flex min-h-[36px] items-center justify-between gap-2 border-b border-border/70 px-4 py-1.5">
        <h3 className="field-label flex items-center gap-1.5">
          <BrainCircuit className="h-3 w-3" aria-hidden="true" />
          AI Intelligence
        </h3>
        <div className="flex items-center gap-2">
          {!loading && statusChip}
          {!loading && (
            <Button
              type="button"
              size="sm"
              variant={hasStudy ? 'ghost' : 'outline'}
              className="h-6 gap-1 px-2 text-xs"
              disabled={analyzing}
              onClick={() => analyze(hasStudy && status !== 'STALE' && status !== 'FAILED')}
            >
              {hasStudy ? <RotateCcw className={`h-3 w-3 ${analyzing ? 'animate-spin' : ''}`} /> : <Sparkles className={`h-3 w-3 ${analyzing ? 'animate-spin' : ''}`} />}
              {analyzing ? 'Analyzing' : hasStudy ? (status === 'STALE' ? 'Regenerate' : 'Refresh') : 'Analyze'}
            </Button>
          )}
        </div>
      </header>

      <div className="p-4">
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            <div className="skeleton h-4 w-full rounded bg-muted" />
            <div className="skeleton h-4 w-4/5 rounded bg-muted" />
            <div className="skeleton h-4 w-2/5 rounded bg-muted" />
          </div>
        ) : hasStudy ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {intel.priority && <Badge variant={PRIORITY_VARIANT[intel.priority] || 'muted'}>{intel.priority}</Badge>}
              {intel.companyFit?.rating && (
                <Badge variant={FIT_VARIANT[intel.companyFit.rating] || 'muted'}>
                  {intel.companyFit.rating.charAt(0) + intel.companyFit.rating.slice(1).toLowerCase()} fit
                </Badge>
              )}
              {typeof intel.confidence === 'number' && <Badge variant="muted">{Math.round(intel.confidence * 100)}% confidence</Badge>}
            </div>

            <p className="text-[13px] leading-relaxed text-foreground">{intel.summary}</p>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {intel.companyFit?.reason && <Line label="Why this fit">{intel.companyFit.reason}</Line>}
              {intel.needs?.length > 0 && <Line label="Opportunity">{intel.needs.slice(0, 2).join(' · ')}</Line>}
              {intel.salesAngles?.[0] && <Line label="Sales angle">{intel.salesAngles[0]}</Line>}
              {intel.personalizationHooks?.[0] && <Line label="Personalization hook">{intel.personalizationHooks[0]}</Line>}
            </dl>

            {status === 'STALE' && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                This lead changed since the analysis. Regenerate to refresh it.
              </p>
            )}
            {status === 'FAILED' && state?.error && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">Last refresh failed: {state.error}. Showing the previous analysis.</p>
            )}
          </div>
        ) : status === 'FAILED' ? (
          <p className="text-[13px] text-rose-600 dark:text-rose-400">{state?.error || 'The last analysis did not complete.'} Try again.</p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[13px] text-muted-foreground">
              {state?.loadError
                ? 'AI insights are unavailable right now.'
                : 'Analyze this lead to get its fit, priority, sales angle and a recommended next step. Nothing is sent automatically.'}
            </p>
            {legacySummary?.summary && (
              <p className="line-clamp-3 text-xs text-muted-foreground">
                Existing study: {legacySummary.summary}
                {onOpenStudy && (
                  <>
                    {' '}
                    <button type="button" onClick={onOpenStudy} className="font-medium text-primary hover:underline">
                      Open study
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {!loading && rec && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Next best action</span>
                <Badge variant={rec.action === 'STOP_OUTREACH' ? 'destructive' : SEND_ACTIONS.includes(rec.action) ? 'default' : 'muted'}>
                  {ACTION_LABELS[rec.action] || rec.action}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{Math.round((rec.confidence || 0) * 100)}%</span>
              </div>
              <p className="mt-0.5 text-xs leading-snug text-foreground">{rec.reason}</p>
              {rec.requiresApproval && <p className="mt-0.5 text-[11px] text-muted-foreground">You review and send; nothing goes out automatically.</p>}
              {rec.timing?.label && !SEND_ACTIONS.includes(rec.action) && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">Timing: {rec.timing.label}</p>
              )}
            </div>
            {canDraft && (
              <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 gap-1.5 text-xs" disabled={drafting} onClick={draftEmail}>
                <Mail className={`h-3 w-3 ${drafting ? 'animate-pulse' : ''}`} />
                {drafting ? 'Drafting…' : 'Draft email'}
              </Button>
            )}
          </div>
        )}
      </div>

      {composeOpen && aiDraft && (
        <ComposeModal
          lead={lead}
          leadId={leadId}
          recipientEmail={lead?.email}
          aiDraft={aiDraft}
          isOpen
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setAiDraft(null);
            load();
            if (onSent) onSent();
          }}
        />
      )}
    </section>
  );
}
