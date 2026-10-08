'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrainCircuit, Sparkles, ThumbsUp, ThumbsDown, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ACTION_LABELS } from '@/components/ai/LeadAiBrain';

const CLASS_LABELS = {
  INTERESTED: 'Interested',
  MEETING_REQUEST: 'Meeting request',
  QUESTION: 'Question',
  OBJECTION: 'Objection',
  NOT_NOW: 'Not now',
  NOT_INTERESTED: 'Not interested',
  WRONG_PERSON: 'Wrong person',
  OUT_OF_OFFICE: 'Out of office',
  UNSUBSCRIBE: 'Unsubscribe',
  BOUNCE_OR_INVALID: 'Bounce / invalid',
  OTHER: 'Other',
};

const CLASS_VARIANT = {
  INTERESTED: 'success',
  MEETING_REQUEST: 'success',
  QUESTION: 'info',
  OBJECTION: 'warning',
  NOT_NOW: 'warning',
  NOT_INTERESTED: 'destructive',
  WRONG_PERSON: 'warning',
  OUT_OF_OFFICE: 'muted',
  UNSUBSCRIBE: 'destructive',
  BOUNCE_OR_INVALID: 'destructive',
  OTHER: 'muted',
};

/**
 * Inbox strip: stored classification of the latest inbound reply, the recommended next action
 * and an optional AI reply DRAFT. Drafts are only ever placed in the reply box for a human to
 * edit and send - this component cannot send anything.
 */
export default function ReplyAiBrain({ leadId, messageId, threadId, onUseDraft, variant = 'strip' }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null); // { reply, decisionId, warnings, recommendedNextStep }
  const [feedback, setFeedback] = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!leadId || !messageId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/brain/replies?leadId=${leadId}&messageId=${messageId}`);
      const json = await res.json().catch(() => ({}));
      if (aliveRef.current) setResult(res.ok && json.success ? json.data : null);
    } catch {
      if (aliveRef.current) setResult(null);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [leadId, messageId]);

  useEffect(() => {
    setResult(null);
    setDraft(null);
    setFeedback(null);
    load();
  }, [load]);

  const post = async (action, extra = {}) => {
    const res = await fetch('/api/ai/brain/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, messageId, threadId, action, ...extra }),
    });
    const json = await res.json().catch(() => ({}));
    return json.data || { status: 'FAILED', error: json.message || 'Request failed' };
  };

  const classify = async (force = false) => {
    setBusy(true);
    try {
      const data = await post('classify', { force });
      if (!aliveRef.current) return;
      if (data.status === 'READY') setResult(data);
      else toast.error(data.error || data.reason || 'Could not analyze this reply');
      if (data.suppression?.applied) toast.message('Lead unsubscribed — contact suppressed automatically');
    } catch {
      toast.error('Could not reach the AI service');
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  const suggestReply = async () => {
    setBusy(true);
    try {
      const data = await post('draft');
      if (!aliveRef.current) return;
      if (data.status === 'READY') {
        if (data.classification) setResult((prev) => ({ ...(prev || {}), ...data, recommendation: prev?.recommendation }));
        setDraft({
          reply: data.draft.reply,
          decisionId: data.decisionId,
          warnings: data.warnings || [],
          recommendedNextStep: data.draft.recommendedNextStep,
          confidence: data.draft.confidence,
        });
        setFeedback(null);
      } else if (data.status === 'NOT_APPLICABLE' || data.status === 'BLOCKED') {
        toast.message(data.reason || 'No reply is recommended for this message');
      } else {
        toast.error(data.error || 'Could not draft a reply');
      }
    } catch {
      toast.error('Could not reach the AI service');
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  const sendFeedback = async (action, decisionId, extra = {}) => {
    if (!decisionId) return;
    try {
      await fetch('/api/ai/brain/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId, action, ...extra }),
      });
    } catch {
      /* feedback is best effort */
    }
  };

  const c = result?.classification;
  const rec = result?.recommendation;
  const flagged = result?.securityFlags?.length > 0;
  const canSuggest = c?.draftReplyNeeded || (rec?.action === 'ANSWER_REPLY' && !flagged);

  if (loading && !result) {
    return <div className={`skeleton h-8 rounded-lg bg-muted ${variant === 'panel' ? '' : 'mx-3.5 my-2'}`} aria-hidden="true" />;
  }

  return (
    <div
      className={
        variant === 'panel'
          ? 'rounded-xl border border-border bg-card p-3 shadow-card'
          : 'shrink-0 border-t border-border bg-card/60 px-3.5 py-2'
      }
      aria-label="AI reply analysis"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
          <BrainCircuit className="h-3 w-3" />
        </div>

        {c ? (
          <>
            <Badge variant={CLASS_VARIANT[c.classification] || 'muted'}>{CLASS_LABELS[c.classification] || c.classification}</Badge>
            {rec && <Badge variant="outline">Next: {ACTION_LABELS[rec.action] || rec.action}</Badge>}
            {flagged && (
              <Badge variant="warning" title="The message contains text that tries to instruct the AI">
                <ShieldAlert className="h-3 w-3" /> Review manually
              </Badge>
            )}
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={c.summary}>
              {c.summary}
            </span>
          </>
        ) : (
          <span className="flex-1 text-xs text-muted-foreground">AI has not analyzed the latest reply.</span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {!c ? (
            <Button type="button" size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]" disabled={busy} onClick={() => classify(false)}>
              <Sparkles className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Analyzing' : 'Analyze reply'}
            </Button>
          ) : (
            <>
              {canSuggest && !draft && (
                <Button type="button" size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]" disabled={busy} onClick={suggestReply}>
                  <Sparkles className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} />
                  {busy ? 'Drafting' : 'Suggest reply'}
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" disabled={busy} onClick={() => classify(true)}>
                Re-analyze
              </Button>
            </>
          )}
        </div>
      </div>

      {rec && c && (
        <p className="mt-1 pl-7 text-[11px] leading-snug text-muted-foreground">
          {rec.reason}
          {result?.suppression?.applied ? ' The lead was suppressed automatically.' : ''}
          {rec.requiresApproval ? ' You review and send.' : ''}
        </p>
      )}

      {draft && (
        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Suggested reply</span>
            <span className="text-[11px] text-muted-foreground">{Math.round((draft.confidence || 0) * 100)}% confidence</span>
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{draft.reply}</p>
          {draft.recommendedNextStep && <p className="mt-1 text-[11px] text-muted-foreground">After sending: {draft.recommendedNextStep}</p>}
          {draft.warnings.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-[11px] text-warning">
              {draft.warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>{w.message}{w.excerpt ? ` (“${w.excerpt}”)` : ''}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => {
                onUseDraft?.({ text: draft.reply, decisionId: draft.decisionId });
                sendFeedback('APPROVE', draft.decisionId);
                setDraft(null);
              }}
            >
              Use in reply box
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={() => {
                sendFeedback('REJECT', draft.decisionId);
                setDraft(null);
              }}
            >
              <X className="h-3 w-3" /> Dismiss
            </Button>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Mark suggestion useful"
                className={`rounded p-1 hover:bg-muted ${feedback === 'up' ? 'text-success' : 'text-muted-foreground'}`}
                onClick={() => {
                  setFeedback('up');
                  sendFeedback('USEFUL', draft.decisionId);
                }}
              >
                <ThumbsUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="Mark suggestion not useful"
                className={`rounded p-1 hover:bg-muted ${feedback === 'down' ? 'text-danger' : 'text-muted-foreground'}`}
                onClick={() => {
                  setFeedback('down');
                  sendFeedback('NOT_USEFUL', draft.decisionId);
                }}
              >
                <ThumbsDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
