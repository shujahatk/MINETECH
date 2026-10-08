'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Sparkles,
  Tag,
  Copy,
  Check,
  Zap,
  Building,
  User,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const MERGE_TAGS = [
  { tag: '{{firstName}}', label: 'First Name' },
  { tag: '{{company}}', label: 'Company' },
  { tag: '{{jobTitle}}', label: 'Job Title' },
  { tag: '{{industry}}', label: 'Industry' },
  { tag: '{{location}}', label: 'Location' },
];

export default function TemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('cold-outreach');
  const [copiedTag, setCopiedTag] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [previewLead, setPreviewLead] = useState({
    firstName: 'Sarah',
    company: 'Nexus AI',
    jobTitle: 'VP of Engineering',
    industry: 'Software Enterprise',
    location: 'San Francisco, CA',
  });

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/email/templates');
      if (res.ok) {
        const j = await res.json();
        setTemplates(j.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleInsertTag = (tag) => {
    setBody((prev) => prev + ` ${tag} `);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(''), 2000);
  };

  const handleGenerateAIHook = async () => {
    setIsGeneratingAI(true);
    try {
      const res = await fetch('/api/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate a high-converting cold email template for ${category} targeting B2B executives with {{firstName}} and {{company}} variables.`,
          tone: 'Direct & Value-First',
          goal: 'Schedule 15-min Call',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data?.subject) setSubject(json.data.subject);
        if (json.data?.body) setBody(json.data.body);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          bodyHtml: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
          bodyPlain: body,
          category,
        }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setName('');
        setSubject('');
        setBody('');
        fetchTemplates();
      }
    } catch (err) {
      toast.error('Could not save the template');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this template from database memory?')) return;
    try {
      await fetch(`/api/email/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (e) {}
  };

  const renderSimulatedPreview = (text) => {
    if (!text) return '';
    return text
      .replace(/{{firstName}}/g, previewLead.firstName)
      .replace(/{{company}}/g, previewLead.company)
      .replace(/{{jobTitle}}/g, previewLead.jobTitle)
      .replace(/{{industry}}/g, previewLead.industry)
      .replace(/{{location}}/g, previewLead.location);
  };

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-sm transition-colors focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

  const categoryLabel = (c) =>
    ({ 'cold-outreach': 'Cold outreach', 'follow-up': 'Follow-up', booking: 'Call booking', 're-engagement': 'Re-engagement' }[c] || c || 'Cold outreach');

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileText}
        title="Templates"
        meta={!loading ? String(templates.length) : undefined}
        description="Reusable email copy with merge tags and Claude-assisted hooks."
        className="mb-0"
        actions={
          <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5" disabled={isModalOpen}>
            <Plus className="h-3.5 w-3.5" /> New template
          </Button>
        }
      />

      {isModalOpen && (
        <Card className="anim-fade-up space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Template studio</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Write the copy and watch the merge tags resolve in the preview.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleGenerateAIHook} disabled={isGeneratingAI} className="h-8 gap-1.5 text-primary">
              <Sparkles className={`h-3.5 w-3.5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
              <span>{isGeneratingAI ? 'Generating...' : 'Generate with Claude'}</span>
            </Button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="tpl-name" className="field-label mb-1.5 block">Template name</label>
                <Input id="tpl-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cold touch #1" />
              </div>
              <div>
                <label htmlFor="tpl-category" className="field-label mb-1.5 block">Category</label>
                <select id="tpl-category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                  <option value="cold-outreach">Cold outreach</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="booking">Call booking</option>
                  <option value="re-engagement">Re-engagement</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="tpl-subject" className="field-label mb-1.5 block">Subject line</label>
              <Input id="tpl-subject" type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. A quick question for {{company}}" className="font-medium" />
            </div>

            <div className="space-y-1.5">
              <span className="field-label block">Insert merge variable</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {MERGE_TAGS.map((t) => (
                  <button
                    type="button"
                    key={t.tag}
                    onClick={() => handleInsertTag(t.tag)}
                    className="tone-brand inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs font-medium transition-opacity hover:opacity-80"
                  >
                    <span>{t.tag}</span>
                    {copiedTag === t.tag ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 opacity-60" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2">
              <div>
                <label htmlFor="tpl-body" className="field-label mb-1.5 block">Email body</label>
                <Textarea
                  id="tpl-body"
                  required
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={`Hi {{firstName}},\n\nSaw what your team is building at {{company}} in the {{industry}} space...\n\nWould you be open to a 15-min call this Thursday?`}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>

              <div>
                <span className="field-label mb-1.5 flex items-center gap-1.5 text-primary">
                  <Eye className="h-3.5 w-3.5" /> Live preview
                  <span className="font-normal normal-case text-muted-foreground">
                    · sample prospect {previewLead.firstName}, {previewLead.company}
                  </span>
                </span>
                <div className="h-[184px] space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3.5 text-xs leading-relaxed text-foreground">
                  <div className="border-b border-border pb-1.5 font-semibold text-foreground">
                    {renderSimulatedPreview(subject) || '(No subject)'}
                  </div>
                  <div className="whitespace-pre-wrap text-muted-foreground">
                    {renderSimulatedPreview(body) || 'Start typing to see merge tags replaced with sample data...'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="px-4">
                Save template
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-4" aria-hidden="true">
              <div className="skeleton h-4 w-2/3 rounded bg-muted" />
              <div className="skeleton h-3 w-1/2 rounded bg-muted" />
              <div className="skeleton h-16 w-full rounded-lg bg-muted" />
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="Create reusable email copy with merge tags, then use it in campaigns and sequences."
            action={
              !isModalOpen && (
                <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Create first template
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t._id || t.id} className="panel-interactive group flex flex-col p-0">
              <div className="flex-1 space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="tone-brand inline-flex h-[18px] items-center rounded border px-1.5 text-[10px] font-medium">
                    {categoryLabel(t.category)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(t._id || t.id)}
                    title="Delete template"
                    aria-label={`Delete template ${t.name}`}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">{t.name}</h3>
                <p className="truncate text-xs font-medium text-muted-foreground">
                  <span className="text-foreground/70">Subject:</span> {t.subject}
                </p>
                <div
                  className="email-html line-clamp-3 text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: t.bodyHtml || t.body_html }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
