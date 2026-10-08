'use client';
import { ModalFrame } from '@/components/ui/modal-frame';

import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  FileText,
  AlertCircle,
  RefreshCw,
  Zap,
  Sliders,
  Eye,
  Edit3,
  Mail,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AiDraftBar from '@/components/ai/AiDraftBar';

export default function ComposeModal({
  lead = null,
  leadId = null,
  leadContext = null,
  initialLead = null,
  recipientEmail = null,
  initialTo = null,
  isOpen = true,
  onClose,
  onSent,
  // Optional AI Brain draft: { subject, body, decisionId, warnings[] }. Prefills the editor;
  // the human still reviews, edits and presses Send. Nothing is sent automatically.
  aiDraft = null,
}) {
  const targetLead = lead || leadContext || initialLead;
  const initialLeadId = targetLead?._id || targetLead?.id || leadId || '';

  const [leadsList, setLeadsList] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId);
  const [activeLead, setActiveLead] = useState(
    targetLead || (recipientEmail ? { email: recipientEmail, fullName: recipientEmail, _id: initialLeadId } : null)
  );
  const [subject, setSubject] = useState(aiDraft?.subject || '');
  const [body, setBody] = useState(aiDraft?.body || '');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // UI tabs
  const [activeTab, setActiveTab] = useState('write'); // 'write' | 'preview'
  const [copiedTag, setCopiedTag] = useState(null);
  // The AI draft currently in the editor (if any). Sent as aiDecisionId so the server can run the
  // send policy and record what the human actually sent. Bound to one lead.
  const [aiDecision, setAiDecision] = useState(
    aiDraft?.decisionId ? { id: aiDraft.decisionId, leadId: initialLeadId, warnings: aiDraft.warnings || [] } : null
  );

  useEffect(() => {
    const resolved = lead || leadContext || initialLead;
    const resolvedId = resolved?._id || resolved?.id || leadId;

    if (resolved) {
      setActiveLead(resolved);
      setSelectedLeadId(resolved._id || resolved.id || resolvedId || '');
    } else if (resolvedId) {
      setSelectedLeadId(resolvedId);
      // Fetch specific lead by ID directly
      fetch(`/api/leads/${resolvedId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (json?.data || json?.lead) {
            const leadData = json.data || json.lead;
            setActiveLead(leadData);
          }
        })
        .catch((e) => console.warn('Failed to load specific lead in ComposeModal:', e));
    } else if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramLeadId = params.get('leadId');
      if (paramLeadId) {
        setSelectedLeadId(paramLeadId);
        fetch(`/api/leads/${paramLeadId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((json) => {
            if (json?.data || json?.lead) {
              setActiveLead(json.data || json.lead);
            }
          })
          .catch((e) => console.warn('Failed to load URL param lead in ComposeModal:', e));
      }
    }

    // Always fetch full leads list for template dropdown & fallback selection
    fetch('/api/leads?limit=100')
      .then((r) => r.json())
      .then((j) => {
        const fetched = j.leads || [];
        setLeadsList(fetched);
        // If no lead was pre-selected, select the first from list
        if (!resolved && !resolvedId && fetched.length > 0) {
          setSelectedLeadId((prev) => {
            if (!prev) {
              setActiveLead((prevLead) => prevLead || fetched[0]);
              return fetched[0]._id || fetched[0].id;
            }
            return prev;
          });
        }
      })
      .catch((e) => console.warn('Failed to fetch leads list:', e));
    
    fetch('/api/email/templates')
      .then((r) => r.json())
      .then((j) => setTemplates(j.data || []))
      .catch((e) => console.warn('Failed to fetch email templates:', e));
  }, [lead, leadId, leadContext, initialLead, recipientEmail]);

  useEffect(() => {
    if (selectedLeadId && leadsList.length > 0) {
      const found = leadsList.find((l) => (l._id || l.id) === selectedLeadId);
      if (found) {
        setActiveLead(found);
      }
    }
  }, [selectedLeadId, leadsList]);

  // Keyboard shortcut listener: Ctrl/Cmd + Enter to send, Esc to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, body, activeLead, selectedLeadId]);

  const ensureCompanySignature = (text) => {
    const signature = 'Regards,\nMineTech Outbound';
    if (!text) return `\n\n${signature}`;
    if (!text.includes('MineTech Outbound')) {
      return `${text.trim()}\n\n${signature}`;
    }
    return text;
  };

  const stripSignature = (text) =>
    String(text || '')
      .replace(/\n*Regards,\s*\nMineTech Outbound\s*$/i, '')
      .trim();

  const handleAiAccept = ({ subject: nextSubject, body: nextBody, decisionId, warnings }) => {
    const leadKey = activeLead?._id || activeLead?.id || selectedLeadId || null;
    if (nextSubject) setSubject(nextSubject);
    setBody(ensureCompanySignature(nextBody || ''));
    setAiDecision(decisionId ? { id: decisionId, leadId: leadKey, warnings: warnings || [] } : null);
    setActiveTab('write');
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => (t._id || t.id) === templateId);
    if (tmpl) {
      setSubject(tmpl.subject || '');
      const rawBody = tmpl.bodyHtml ? tmpl.bodyHtml.replace(/<[^>]*>?/gm, '') : tmpl.bodyPlain || '';
      setBody(ensureCompanySignature(rawBody));
    }
  };

  const handleInsertTag = (tag) => {
    setBody((prev) => `${prev} {{${tag}}}`);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  // Interpolate merge tags for the preview tab
  const getRenderedPreview = () => {
    const leadObj = activeLead || {};
    const firstName = leadObj.firstName || (leadObj.fullName ? leadObj.fullName.split(' ')[0] : 'Prospect');
    const company = leadObj.company || 'your team';
    const jobTitle = leadObj.jobTitle || leadObj.title || 'Leader';

    const renderedSubject = subject
      .replace(/{{firstName}}/gi, firstName)
      .replace(/{{company}}/gi, company)
      .replace(/{{jobTitle}}/gi, jobTitle);

    const renderedBody = body
      .replace(/{{firstName}}/gi, firstName)
      .replace(/{{company}}/gi, company)
      .replace(/{{jobTitle}}/gi, jobTitle);

    return { renderedSubject, renderedBody };
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const targetId = activeLead?._id || activeLead?.id || selectedLeadId;
    if (!targetId || !subject.trim() || !body.trim()) {
      setError('Please select a recipient, subject, and message body.');
      return;
    }

    const finalBody = ensureCompanySignature(body);

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: targetId,
          subject,
          bodyHtml: `<p>${finalBody.replace(/\n/g, '<br/>')}</p>`,
          bodyText: finalBody,
          ...(aiDecision?.id && aiDecision.leadId === targetId ? { aiDecisionId: aiDecision.id } : {}),
        }),
      });

      const json = await res.json();
      if (res.ok) {
        if (onSent) onSent();
        onClose();
      } else {
        setError(json.message || json.error || 'Failed to send email.');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const { renderedSubject, renderedBody } = getRenderedPreview();

  return (
    <ModalFrame title="Compose email" onClose={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl overflow-hidden shadow-dialog flex flex-col max-h-[90vh] text-foreground">
        
        {/* 1. Header */}
        <div className="px-5 py-3.5 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground tracking-tight">Compose Outbound Email</h2>
              <p className="text-[11px] text-muted-foreground font-medium">1-to-1 personalized prospect message</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Mode Switcher */}
            <div className="flex items-center bg-muted p-0.5 rounded-xl border border-border text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('write')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors text-xs font-semibold ${
                  activeTab === 'write'
                    ? 'bg-card text-foreground shadow-subtle'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Write</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors text-xs font-semibold ${
                  activeTab === 'preview'
                    ? 'bg-card text-foreground shadow-subtle'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Preview</span>
              </button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 2. Main Form Body */}
        <form onSubmit={handleSend} className="p-5 space-y-4 overflow-y-auto flex-1 flex flex-col bg-card">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5 animate-in slide-in-from-top-1">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span>{error}</span>
            </div>
          )}

          {aiDraft?.decisionId && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs text-foreground">
              <span className="font-medium">AI draft</span>
              <span className="text-muted-foreground"> — review and edit before sending. Nothing is sent until you press Send.</span>
              {aiDraft.warnings?.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-amber-700 dark:text-amber-400">
                  {aiDraft.warnings.map((w, i) => (
                    <li key={`${w.code}-${i}`}>
                      {w.message}
                      {w.excerpt ? ` (“${w.excerpt}”)` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Recipient Selector / Pill */}
          <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-3.5 py-2.5">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider shrink-0 mr-1">To:</span>
            {activeLead ? (
              <div className="flex items-center justify-between flex-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{activeLead.fullName || activeLead.name || activeLead.firstName}</span>
                  <span className="text-muted-foreground font-mono">({activeLead.email})</span>
                  {activeLead.jobTitle && <span className="text-muted-foreground hidden sm:inline">• {activeLead.jobTitle}</span>}
                </div>
                <span className="px-2 py-0.5 rounded-md bg-card border border-border text-foreground text-[10px] font-medium shadow-subtle">
                  {activeLead.company || 'Direct Lead'}
                </span>
              </div>
            ) : (
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                required
                className="w-full bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-card text-foreground">Select recipient lead...</option>
                {leadsList.map((l) => (
                  <option key={l.id || l._id} value={l.id || l._id} className="bg-card text-foreground">
                    {l.fullName || l.name || l.firstName || l.email} — {l.company || 'No Company'} ({l.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Subject Line with Inline Template Action */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-foreground uppercase tracking-wider text-[11px]">Subject</label>
              {templates.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="bg-muted/40 border border-border text-[11px] text-foreground rounded-lg px-2 py-0.5 focus:outline-none focus:border-primary transition cursor-pointer"
                  >
                    <option value="" className="bg-card text-foreground">Choose Template...</option>
                    {templates.map((t) => (
                      <option key={t.id || t._id} value={t.id || t._id} className="bg-card text-foreground">
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <Input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Quick question regarding {{company}}'s outbound workflow"
              className="bg-muted/40 border-border rounded-xl font-medium text-foreground"
            />
          </div>

          {/* Email Body & Live Preview */}
          <div className="space-y-1.5 flex-1 flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-foreground uppercase tracking-wider text-[11px]">Message Body</label>
              
              {/* Clean Merge Tag Quick Chips */}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="text-[10px] hidden sm:inline">Insert:</span>
                {['firstName', 'company', 'jobTitle'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInsertTag(tag)}
                    className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border text-[10px] font-mono transition"
                  >
                    {copiedTag === tag ? '✓ Added' : `{{${tag}}}`}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'write' ? (
              <Textarea
                required
                rows={9}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email here, or use the Writing Assistant below to generate a tailored pitch..."
                className="bg-muted/40 border-border rounded-xl flex-1 p-3 leading-relaxed resize-none text-xs text-foreground"
              />
            ) : (
              <div className="w-full flex-1 bg-muted/30 border border-border rounded-xl p-4 text-xs text-foreground space-y-3 overflow-y-auto leading-relaxed">
                <div className="pb-2 border-b border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Subject Preview</span>
                    <p className="font-semibold text-foreground text-xs">{renderedSubject}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-semibold">
                    Interpolated Live
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-foreground leading-relaxed font-sans">
                  {renderedBody}
                </div>
              </div>
            )}
          </div>

          {/* 3. AI drafting: type 2-4 words, Claude drafts, you review and send */}
          <AiDraftBar
            leadId={activeLead?._id || activeLead?.id || selectedLeadId || null}
            surface="compose"
            currentDraft={body.trim() ? { subject, body: stripSignature(body) } : null}
            onAccept={handleAiAccept}
          />
          {/* 4. Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>Resend Pro • <code>minetechresources.com</code></span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="gap-2 h-9 px-4"
              >
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>{loading ? 'Sending...' : 'Send Email'}</span>
                <span className="text-[10px] opacity-70 ml-0.5 hidden sm:inline font-mono">↵</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </ModalFrame>
  );
}
