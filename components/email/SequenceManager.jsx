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
  ArrowUp,
  Copy,
  Edit3,
  Loader2,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function SequenceManager() {
  const [sequences, setSequences] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);

  // Builder / Editor state
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([
    { stepNumber: 1, type: 'EMAIL', templateId: '', delayDays: 0, delayHours: 0, subject: '', body: '' },
    { stepNumber: 2, type: 'EMAIL', templateId: '', delayDays: 3, delayHours: 0, subject: '', body: '' },
    { stepNumber: 3, type: 'EMAIL', templateId: '', delayDays: 6, delayHours: 0, subject: '', body: '' },
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
      console.error('Failed to load sequences:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setSteps([
      { stepNumber: 1, type: 'EMAIL', templateId: '', delayDays: 0, delayHours: 0, subject: '', body: '' },
      { stepNumber: 2, type: 'EMAIL', templateId: '', delayDays: 3, delayHours: 0, subject: '', body: '' },
      { stepNumber: 3, type: 'EMAIL', templateId: '', delayDays: 6, delayHours: 0, subject: '', body: '' },
    ]);
    setIsCreating(true);
  };

  const openEditForm = (seq) => {
    setEditingId(seq.id || seq._id);
    setName(seq.name || '');
    setDescription(seq.description || '');
    setSteps(
      Array.isArray(seq.steps) && seq.steps.length > 0
        ? seq.steps.map((s, i) => ({
            stepNumber: i + 1,
            type: s.type || 'EMAIL',
            templateId: s.templateId || '',
            delayDays: Number(s.delayDays) || 0,
            delayHours: Number(s.delayHours) || 0,
            subject: s.subject || '',
            body: s.body || '',
          }))
        : [{ stepNumber: 1, type: 'EMAIL', templateId: '', delayDays: 0, delayHours: 0, subject: '', body: '' }]
    );
    setIsCreating(true);
  };

  const handleSaveSequence = async (e) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a sequence name.');
      return;
    }

    const validSteps = steps.filter((s) => s.type === 'CALL' || s.templateId || s.subject || s.body);
    if (validSteps.length === 0) {
      toast.error('Configure at least one step with a template or subject.');
      return;
    }

    setSubmitting(true);
    try {
      const isEditing = Boolean(editingId);
      const url = '/api/email/sequences';
      const method = isEditing ? 'PATCH' : 'POST';
      const payload = {
        name: name.trim(),
        description: description.trim(),
        steps: validSteps,
        ...(isEditing ? { id: editingId } : {}),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Failed to save sequence');
      }

      toast.success(isEditing ? 'Sequence updated successfully!' : 'Sequence created successfully!');
      setIsCreating(false);
      setEditingId(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Could not save the sequence');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSequence = async (seqId, seqName) => {
    if (!confirm(`Permanently delete sequence "${seqName}"? This action cannot be undone.`)) {
      return;
    }

    setActionId(seqId);
    try {
      const res = await fetch(`/api/email/sequences?id=${encodeURIComponent(seqId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete sequence');
      }
      toast.success('Sequence permanently deleted.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Could not delete sequence');
    } finally {
      setActionId(null);
    }
  };

  const handleDuplicateSequence = async (seqId) => {
    setActionId(seqId);
    try {
      const res = await fetch('/api/email/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id: seqId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to duplicate sequence');
      }
      toast.success('Sequence duplicated successfully!');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Could not duplicate sequence');
    } finally {
      setActionId(null);
    }
  };

  const handleToggleActive = async (seqId, currentActive) => {
    setActionId(seqId);
    try {
      const res = await fetch('/api/email/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active', id: seqId, is_active: !currentActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update sequence status');
      }
      toast.success(json.message || (!currentActive ? 'Sequence activated!' : 'Sequence paused.'));
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Could not update status');
    } finally {
      setActionId(null);
    }
  };

  const addStep = () => {
    setSteps([
      ...steps,
      { stepNumber: steps.length + 1, type: 'EMAIL', templateId: '', delayDays: 2, delayHours: 0, subject: '', body: '' },
    ]);
  };

  const removeStep = (idx) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const moveStep = (idx, direction) => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const updated = [...steps];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setSteps(updated);
  };

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-sm transition-colors focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

  return (
    <div className="space-y-4">
      <PageHeader
        icon={GitFork}
        title="Sequences"
        meta={!loading ? String(sequences.length) : undefined}
        description="Multi-touch follow-up tracks that automatically pause the moment a prospect replies."
        className="mb-0"
        actions={
          <Button size="sm" onClick={openCreateForm} className="gap-1.5" disabled={isCreating}>
            <Plus className="h-3.5 w-3.5" /> New sequence
          </Button>
        }
      />

      {/* Builder / Editor */}
      {isCreating && (
        <Card className="anim-fade-up space-y-5 p-5 border-primary/30 shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                {editingId ? 'Edit Follow-up Sequence' : 'Build a Follow-up Sequence'}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Configure touch points, delays, templates, and actions.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSaveSequence} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sequence-name" className="field-label mb-1.5 block text-xs font-semibold">
                  Sequence Name *
                </label>
                <Input
                  id="sequence-name"
                  type="text"
                  required
                  placeholder="e.g. 3-touch Kaolin procurement follow-up"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background text-foreground"
                />
              </div>

              <div>
                <label htmlFor="sequence-desc" className="field-label mb-1.5 block text-xs font-semibold">
                  Description / Objective (Optional)
                </label>
                <Input
                  id="sequence-desc"
                  type="text"
                  placeholder="e.g. Re-engage ceramic & paper producers after initial brochure delivery"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-background text-foreground"
                />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Zap className="h-3.5 w-3.5 text-primary" /> Steps &amp; Delays
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {steps.length} {steps.length === 1 ? 'Step' : 'Steps'}
                  </span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={addStep} className="h-7 gap-1 text-primary border-primary/30">
                  <Plus className="h-3 w-3" /> Add Step
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

                    <div className="group flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 transition-colors hover:border-primary/40">
                      {/* Step Type */}
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
                          <option value="EMAIL">Email Touch</option>
                          <option value="CALL">Call Task</option>
                        </select>
                      </div>

                      {/* Template Selector */}
                      {step.type === 'EMAIL' ? (
                        <div className="min-w-[200px] flex-1">
                          <select
                            aria-label={`Step ${idx + 1} template`}
                            value={step.templateId || ''}
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
                                {t.name} {t.subject ? `(${t.subject.slice(0, 35)}...)` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="min-w-[200px] flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          Scheduled call follow-up task
                        </div>
                      )}

                      {/* Delay Interval */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
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

                      {/* Reorder and Delete Controls */}
                      <div className="flex items-center gap-1 shrink-0 ml-auto">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveStep(idx, 'up')}
                          className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                          title="Move step up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === steps.length - 1}
                          onClick={() => moveStep(idx, 'down')}
                          className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                          title="Move step down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        {steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStep(idx)}
                            aria-label={`Remove step ${idx + 1}`}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                            title="Delete step"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="px-4 gap-1.5">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {editingId ? 'Save Changes' : 'Create Sequence'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Sequences Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="space-y-3 p-4" aria-hidden="true">
              <div className="skeleton h-4 w-1/2 rounded bg-muted animate-pulse" />
              <div className="skeleton h-3 w-2/3 rounded bg-muted animate-pulse" />
              <div className="skeleton h-12 w-full rounded-lg bg-muted animate-pulse" />
            </Card>
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <Card className="p-8 text-center bg-card border-border">
          <EmptyState
            icon={GitFork}
            title="No sequences yet"
            description="Build a multi-touch follow-up track. Sequences stop automatically when a prospect replies."
            action={
              !isCreating && (
                <Button size="sm" onClick={openCreateForm} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Create First Sequence
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sequences.map((seq) => {
            const seqId = seq.id || seq._id;
            const seqSteps = Array.isArray(seq.steps) ? seq.steps : [];
            const isActive = seq.is_active ?? seq.active ?? true;
            const isActing = actionId === seqId;

            return (
              <Card key={seqId} className="p-0 border-border bg-card shadow-card flex flex-col justify-between overflow-hidden">
                <div>
                  {/* Sequence Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
                          {seq.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 font-semibold ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {isActive ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {seq.description || `${seqSteps.length} step${seqSteps.length > 1 ? 's' : ''} configured`}
                        {seqSteps.length > 0 && ` • spans ${Math.max(...seqSteps.map((s) => Number(s.delayDays) || 0))} days`}
                      </p>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title={isActive ? 'Pause sequence' : 'Activate sequence'}
                        disabled={isActing}
                        onClick={() => handleToggleActive(seqId, isActive)}
                      >
                        {isActive ? <Pause className="h-3.5 w-3.5 text-amber-500" /> : <Play className="h-3.5 w-3.5 text-emerald-500" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Duplicate sequence"
                        disabled={isActing}
                        onClick={() => handleDuplicateSequence(seqId)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit sequence"
                        onClick={() => openEditForm(seq)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Delete sequence permanently"
                        disabled={isActing}
                        onClick={() => handleDeleteSequence(seqId, seq.name)}
                      >
                        {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Steps Timeline */}
                  <ol className="px-4 py-3.5 space-y-2.5">
                    {seqSteps.length === 0 ? (
                      <li className="py-2 text-xs text-muted-foreground text-center">No steps configured.</li>
                    ) : (
                      seqSteps.map((st, i) => {
                        const matchedTmpl = templates.find((t) => (t.id || t._id) === st.templateId);
                        const label = matchedTmpl ? matchedTmpl.name : st.subject || (st.type === 'CALL' ? 'Phone call task' : 'Email template');

                        return (
                          <li key={i} className="relative flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[10px] font-semibold tabular-nums text-primary">
                                {i + 1}
                              </span>
                              <span className="truncate font-medium text-foreground">
                                {label}
                              </span>
                            </div>
                            <span className="shrink-0 text-[11px] font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border">
                              +{st.delayDays}d {st.delayHours ? `${st.delayHours}h` : ''}
                            </span>
                          </li>
                        );
                      })
                    )}
                  </ol>
                </div>

                <div className="px-4 py-2 bg-muted/10 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Stops automatically on reply</span>
                  <span>ID: {seqId ? seqId.slice(0, 8) : '—'}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
