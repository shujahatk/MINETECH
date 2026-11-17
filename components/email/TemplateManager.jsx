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
  Upload,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const MERGE_TAGS = [
  { tag: '{{company_name}}', label: 'Company Name' },
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{product_name}}', label: 'Product Name' },
  { tag: '{{country}}', label: 'Country' },
  { tag: '{{sender_name}}', label: 'Sender Name' },
  { tag: '{{sender_company}}', label: 'Sender Company' },
];

export default function TemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Bleaching Clay');
  const [copiedTag, setCopiedTag] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [previewLead, setPreviewLead] = useState({
    firstName: 'Sarah',
    company: 'Global Edible Oils Ltd',
    jobTitle: 'Purchasing Director',
    industry: 'Edible Oil Processing',
    location: 'Antwerp, Belgium',
    product: 'Bleaching Clay'
  });

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/campaigns/intelligent/templates');
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
          prompt: `Generate a high-converting B2B cold email template for ${category} targeting commercial directors with {{company_name}} and {{product_name}} variables.`,
          tone: 'Direct & Value-First',
          goal: 'Commercial Sourcing Discussion',
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

  const openEditModal = (tpl) => {
    setEditingTemplateId(tpl._id || tpl.id);
    setName(tpl.name || '');
    setSubject(tpl.subject || '');
    setBody(tpl.body_plain || tpl.bodyPlain || tpl.body || '');
    setCategory(tpl.product_category || tpl.category || 'Bleaching Clay');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      const endpoint = editingTemplateId ? `/api/email/templates/${editingTemplateId}` : '/api/email/templates';
      const method = editingTemplateId ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          bodyHtml: `<p>${body.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
          bodyPlain: body,
          category,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success !== false) {
        setIsModalOpen(false);
        setEditingTemplateId(null);
        setName('');
        setSubject('');
        setBody('');
        fetchTemplates();
        toast.success(editingTemplateId ? 'Template updated!' : 'Template saved & classified with MineTech AI!');
      } else {
        toast.error(json?.error || json?.message || `Could not save the template (HTTP ${res.status})`);
      }
    } catch (err) {
      toast.error(err?.message || 'Could not save the template');
    }
  };

  const handleUploadFileOrText = async (e) => {
    e.preventDefault();
    if (!selectedFile && !uploadText.trim()) {
      toast.error('Please select a file or paste email drafts');
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      if (selectedFile) formData.append('file', selectedFile);
      if (uploadText.trim()) formData.append('pastedText', uploadText.trim());

      const res = await fetch('/api/campaigns/intelligent/templates', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(json.message);
        setIsUploadModalOpen(false);
        setUploadText('');
        setSelectedFile(null);
        fetchTemplates();
      } else {
        toast.error(json?.error || json?.message || `Failed to upload templates (HTTP ${res.status})`);
      }
    } catch (err) {
      toast.error(err?.message || 'Error uploading templates');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this template?')) return;
    try {
      const res = await fetch(`/api/email/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTemplates();
        toast.success('Template deleted');
      }
    } catch (e) {
      toast.error('Failed to delete template');
    }
  };

  const renderSimulatedPreview = (raw) => {
    if (!raw) return '';
    return raw
      .replace(/{{first_name}}|{{firstName}}/g, previewLead.firstName)
      .replace(/{{last_name}}|{{lastName}}/g, 'Vermeulen')
      .replace(/{{company_name}}|{{company}}/g, previewLead.company)
      .replace(/{{jobTitle}}|{{job_title}}/g, previewLead.jobTitle)
      .replace(/{{industry}}/g, previewLead.industry)
      .replace(/{{product_name}}|{{product}}/g, previewLead.product)
      .replace(/{{country}}|{{location}}/g, previewLead.location)
      .replace(/{{sender_name}}|{{senderName}}/g, 'Abdullah Rauf')
      .replace(/{{sender_company}}|{{senderCompany}}/g, 'MineTech Resources BV');
  };

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileText}
        title="Email Templates Library"
        meta={!loading ? String(templates.length) : undefined}
        description="Prewritten B2B email copy classified with MineTech AI for Buyer/Supplier outreach."
        className="mb-0"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/email/matching"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" /> AI Matcher Cockpit
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUploadModalOpen(true)}
              className="gap-1.5 border-border"
            >
              <Upload className="h-3.5 w-3.5 text-amber-400" /> Upload Batch (TXT/DOCX/PDF/CSV)
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingTemplateId(null);
                setName('');
                setSubject('');
                setBody('');
                setIsModalOpen(true);
              }}
              className="gap-1.5"
              disabled={isModalOpen}
            >
              <Plus className="h-3.5 w-3.5" /> New template
            </Button>
          </div>
        }
      />

      {/* MODAL: BATCH UPLOAD */}
      {isUploadModalOpen && (
        <Card className="anim-fade-up p-5 space-y-4 border-amber-500/30 bg-card">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Upload className="h-4 w-4 text-amber-500" />
                Upload Prewritten Email Templates
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload files (TXT, Word DOCX, PDF, CSV, Excel XLSX) or paste multi-draft copy. MineTech AI will separate and classify them.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
          </div>

          <form onSubmit={handleUploadFileOrText} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Upload Document / Spreadsheet File
              </label>
              <Input
                type="file"
                accept=".txt,.docx,.pdf,.csv,.xlsx,.xls"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="text-xs"
              />
            </div>

            <div className="text-center text-xs text-muted-foreground font-medium">— OR PASTE EMAIL TEXT DIRECTLY —</div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Paste Multiple Prewritten Drafts
              </label>
              <Textarea
                rows={6}
                placeholder={`Subject: Bleaching Clay Supply Capabilities\n\nDear {{company_name}},\n\nMineTech Resources supplies high-activity acid-activated bleaching earth...\n\n---\n\nSubject: Bentonite Sourcing Enquiry\n\nDear Commercial Desk,\n\nMineTech Resources is currently sourcing API 13A drilling bentonite...`}
                value={uploadText}
                onChange={(e) => setUploadText(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="bg-amber-600 hover:bg-amber-500 text-white font-medium">
                {actionLoading ? 'Analyzing with MineTech AI...' : 'Classify & Import to Library'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* CREATE / EDIT TEMPLATE MODAL */}
      {isModalOpen && (
        <Card className="anim-fade-up space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                {editingTemplateId ? 'Edit Template' : 'Template studio'}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Write prewritten copy and MineTech AI will classify target roles and products.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleGenerateAIHook} disabled={isGeneratingAI} className="h-8 gap-1.5 text-primary">
              <Sparkles className={`h-3.5 w-3.5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
              <span>{isGeneratingAI ? 'Generating...' : 'Assist with MineTech AI'}</span>
            </Button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="tpl-name" className="field-label mb-1.5 block">Template name</label>
                <Input id="tpl-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bleaching Clay — Buyer Intro" />
              </div>
              <div>
                <label htmlFor="tpl-category" className="field-label mb-1.5 block">Product Mineral</label>
                <select id="tpl-category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                  <option value="Bleaching Clay">Bleaching Clay</option>
                  <option value="Bentonite">Bentonite</option>
                  <option value="Kaolin">Kaolin</option>
                  <option value="Fire Clay">Fire Clay</option>
                  <option value="Ball Clay">Ball Clay</option>
                  <option value="Industrial Minerals">General Industrial Minerals</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="tpl-subject" className="field-label mb-1.5 block">Subject line</label>
              <Input id="tpl-subject" type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Supply of High-Activity Bleaching Clay to {{company_name}}" className="font-medium" />
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
                  placeholder={`Dear {{company_name}},\n\nWe are reaching out from MineTech Resources regarding our supply capabilities for high-activity bleaching clay...`}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>

              <div>
                <span className="field-label mb-1.5 flex items-center gap-1.5 text-primary">
                  <Eye className="h-3.5 w-3.5" /> Live preview
                  <span className="font-normal normal-case text-muted-foreground">
                    · sample prospect {previewLead.company}
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTemplateId(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="px-4">
                {editingTemplateId ? 'Update Template' : 'Save & Classify Template'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* PREVIEW TEMPLATE MODAL */}
      {selectedPreviewTemplate && (
        <Card className="anim-fade-up p-5 space-y-4 border-primary/30 bg-card">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{selectedPreviewTemplate.name}</h3>
                <span className="tone-brand inline-flex h-[18px] items-center rounded border px-1.5 text-[10px] font-semibold text-amber-500 border-amber-500/20 bg-amber-500/10">
                  {selectedPreviewTemplate.product_category || selectedPreviewTemplate.category || 'Minerals'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Subject: {renderSimulatedPreview(selectedPreviewTemplate.subject)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  openEditModal(selectedPreviewTemplate);
                  setSelectedPreviewTemplate(null);
                }}
                className="gap-1.5 text-xs"
              >
                <Edit2 className="h-3 w-3" /> Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPreviewTemplate(null)}>
                Close
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
            {renderSimulatedPreview(selectedPreviewTemplate.body_plain || selectedPreviewTemplate.bodyPlain || selectedPreviewTemplate.body)}
          </div>
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
            title="No prewritten templates yet"
            description="Upload prepared email drafts or create templates. MineTech AI will classify them for automatic campaign matching."
            action={
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setIsUploadModalOpen(true)} className="gap-1.5 bg-amber-600 hover:bg-amber-500 text-white">
                  <Upload className="h-3.5 w-3.5" /> Upload templates
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsModalOpen(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Create manually
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t._id || t.id} className="panel-interactive group flex flex-col p-0">
              <div className="flex-1 space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="tone-brand inline-flex h-[18px] items-center rounded border px-1.5 text-[10px] font-semibold text-amber-500 border-amber-500/20 bg-amber-500/10">
                      {t.product_category || t.category || 'Minerals'}
                    </span>
                    <span className={`inline-flex h-[18px] items-center rounded border px-1.5 text-[10px] font-semibold uppercase ${
                      t.recipient_type?.includes('supplier')
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {t.recipient_type?.includes('supplier') ? 'Supplier' : 'Buyer'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPreviewTemplate(t)}
                      title="Preview template"
                      aria-label={`Preview template ${t.name}`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(t)}
                      title="Edit template"
                      aria-label={`Edit template ${t.name}`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
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
                </div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">{t.name}</h3>
                <p className="truncate text-xs font-medium text-muted-foreground font-mono">
                  <span className="text-foreground/70">Subject:</span> {t.subject}
                </p>
                <div
                  className="email-html line-clamp-3 text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: t.bodyHtml || t.body_html || t.bodyPlain || t.body_plain }}
                />
                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Sequence: <strong className="text-foreground">{t.sequence_stage || 'Intro'}</strong></span>
                  <Link
                    href="/email/matching"
                    className="text-emerald-500 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    Use in Campaign <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
