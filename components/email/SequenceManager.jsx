'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Clock,
  FileText,
  CheckCircle2,
  ChevronRight,
  GitFork,
  Mail,
  Sparkles,
  Play,
  Pause,
  Trash2,
  Zap,
  ArrowDown,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SequenceManager() {
  const [sequences, setSequences] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState([
    { stepNumber: 1, type: 'EMAIL', templateId: '', delayDays: 0, delayHours: 0 },
    { stepNumber: 2, type: 'EMAIL', templateId: '', delayDays: 3, delayHours: 0 },
    { stepNumber: 3, type: 'EMAIL', templateId: '', delayDays: 6, delayHours: 0 },
  ]);

  const fetchData = async () => {
    try {
      const [seqRes, tmplRes] = await Promise.all([
        fetch('/api/email/sequences'),
        fetch('/api/email/templates'),
      ]);
      if (seqRes.ok) {
        const j = await seqRes.json();
        setSequences(j.data || []);
      }
      if (tmplRes.ok) {
        const j = await tmplRes.json();
        setTemplates(j.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSequence = async (e) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    const validSteps = steps.filter((s) => s.type === 'CALL' || s.templateId);
    if (validSteps.length === 0) {
      toast.error('Choose a template for at least one step.');
      return;
    }

    try {
      const res = await fetch('/api/email/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          steps: validSteps,
        }),
      });
      if (res.ok) {
        setIsCreating(false);
        setName('');
        fetchData();
      }
    } catch (err) {
      toast.error('Could not create the sequence');
    }
  };

  const addStep = () => {
    setSteps([
      ...steps,
      { stepNumber: steps.length + 1, type: 'EMAIL', templateId: '', delayDays: 2, delayHours: 0 },
    ]);
  };

  const removeStep = (idx) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-sm transition-colors focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

  return (
    <div className="space-y-4">
      <PageHeader
        icon={GitFork}
        title="Sequences"
        meta={!loading ? String(sequences.length) : undefined}
        description="Multi-touch follow-up tracks that pause the moment a prospect replies."
        className="mb-0"
        actions={
          <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5" disabled={isCreating}>
            <Plus className="h-3.5 w-3.5" /> New sequence
          </Button>
        }
      />

      {/* Builder */}
      {isCreating && (
        <Card className="anim-fade-up space-y-5 p-5">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Build a sequence</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Choose a template for each touch and set how long to wait before it.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreating(false)} className="text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
          </div>

          <form onSubmit={handleCreateSequence} className="space-y-5">
            <div className="max-w-xl">
              <label htmlFor="sequence-name" className="field-label mb-1.5 block">
                Sequence name
              </label>
              <Input
                id="sequence-name"
                type="text"
                required
                placeholder="e.g. 3-touch discovery follow-up"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Zap className="h-3.5 w-3.5 text-primary" /> Steps &amp; delays
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">{steps.length}</span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={addStep} className="h-7 gap-1 text-primary">
                  <Plus className="h-3 w-3" /> Add step
                </Button>
              </div>

              <ol className="relative space-y-3">
                {steps.map((step, idx) => (
                  <li key={idx} className="relative flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                        {idx + 1}
                      </span>
                      {idx < steps.length - 1 && <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
                    </div>

                    <div className="group flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 transition-colors hover:border-primary/30">
                      <div className="w-36">
                        <select
                          aria-label={`Step ${idx + 1} type`}
                          value={step.type || 'EMAIL'}
                          onChange={(e) => {
                            const updated = [...steps];
                            updated[idx].type = e.target.value;
                            setSteps(updated);
                          }}
                          className={selectClass}
                        >
                          <option value="EMAIL">Email touch</option>
                          {/* Legacy step types stay selectable only on steps that already use them */}
                          {step.type === 'CALL' && <option value="CALL">Call task (legacy)</option>}
                          {step.type === 'SMS' && <option value="SMS">SMS message (legacy)</option>}
                        </select>
                      </div>

                      {step.type !== 'CALL' ? (
                        <div className="min-w-[200px] flex-1">
                          <select
                            aria-label={`Step ${idx + 1} template`}
                            value={step.templateId}
                            onChange={(e) => {
                              const updated = [...steps];
                              updated[idx].templateId = e.target.value;
                              setSteps(updated);
                            }}
                            className={selectClass}
                          >
                            <option value="">Select email template...</option>
                            {templates.map((t) => (
                              <option key={t._id || t.id} value={t._id || t.id}>
                                {t.name} ({t.subject})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="min-w-[200px] flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          Legacy call step (retired). Switch this step to an email touch.
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Wait</span>
                        <Input
                          type="number"
                          min="0"
                          aria-label={`Step ${idx + 1} delay in days`}
                          value={step.delayDays}
                          onChange={(e) => {
                            const updated = [...steps];
                            updated[idx].delayDays = parseInt(e.target.value, 10) || 0;
                            setSteps(updated);
                          }}
                          className="h-8 w-16 text-center font-semibold tabular-nums"
                        />
                        <span>days</span>
                      </div>

                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          aria-label={`Remove step ${idx + 1}`}
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreating(false)} className="text-muted-foreground hover:text-foreground">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="px-4">
                Create sequence
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Existing sequences */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="space-y-3 p-4" aria-hidden="true">
              <div className="skeleton h-4 w-1/2 rounded bg-muted" />
              <div className="skeleton h-3 w-2/3 rounded bg-muted" />
              <div className="skeleton h-12 w-full rounded-lg bg-muted" />
            </Card>
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <Card>
          <EmptyState
            icon={GitFork}
            title="No sequences yet"
            description="Build a multi-touch follow-up track. Sequences stop automatically when a prospect replies."
            action={
              !isCreating && (
                <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Create first sequence
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-2">
          {sequences.map((seq) => {
            const seqSteps = seq.steps || [];
            return (
              <Card key={seq._id || seq.id} className="panel-interactive p-0">
                <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold tracking-tight text-foreground">{seq.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {seqSteps.length === 1 ? '1 step' : `${seqSteps.length} steps`}
                      {seqSteps.length > 0 && ` · runs over ${Math.max(...seqSteps.map((s) => Number(s.delayDays) || 0))} days`}
                    </span>
                  </div>
                  <span className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded border border-border bg-muted/70 px-1.5 text-[10px] font-medium text-muted-foreground">
                    <Mail className="h-2.5 w-2.5" /> Email
                  </span>
                </div>

                <ol className="px-4 py-3">
                  {seqSteps.length === 0 && <li className="py-2 text-xs text-muted-foreground">No steps configured.</li>}
                  {seqSteps.map((st, i) => (
                    <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[10px] font-semibold tabular-nums text-primary">
                          {i + 1}
                        </span>
                        {i < seqSteps.length - 1 && <span className="mt-0.5 w-px flex-1 bg-border" aria-hidden="true" />}
                      </div>
                      <div className="-mt-0.5 flex min-w-0 flex-1 items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-foreground">
                          {st.type === 'CALL' ? 'Phone outreach (legacy)' : st.templateId?.name || 'Email template'}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">Day {st.delayDays}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
