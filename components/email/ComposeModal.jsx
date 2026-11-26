'use client';
import { ModalFrame } from '@/components/ui/modal-frame';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Send,
  Sparkles,
  FileText,
  AlertCircle,
  RefreshCw,
  Zap,
  Eye,
  Edit3,
  Mail,
  Paperclip,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Clock,
  Calendar,
  Check,
  Trash2,
  FileSpreadsheet,
  FileArchive,
  File,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AiDraftBar from '@/components/ai/AiDraftBar';
import { ensureMineTechSignatureText, SIGNATURE_TEXT } from '@/lib/utils/signature';

const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'txt', 'rtf',
  'xls', 'xlsx', 'csv',
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'zip',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE_BYTES = 25 * 1024 * 1024; // 25MB total

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />;
  }
  if (['zip', 'rar', 'tar', 'gz'].includes(ext)) {
    return <FileArchive className="h-4 w-4 text-amber-500 shrink-0" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
  }
  return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
}

export default function ComposeModal({
  lead = null,
  leadId = null,
  leadContext = null,
  initialLead = null,
  recipientEmail = null,
  initialTo = null,
  initialDraft = null,
  isOpen = true,
  onClose,
  onSent,
  aiDraft = null,
}) {
  const targetLead = lead || leadContext || initialLead;
  const initialLeadId = targetLead?._id || targetLead?.id || leadId || '';

  const [leadsList, setLeadsList] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId);
  const [activeLead, setActiveLead] = useState(
    targetLead || (recipientEmail ? { email: recipientEmail, fullName: recipientEmail, _id: initialLeadId } : null)
  );
  
  // Custom To address if not selecting from lead dropdown
  const [customTo, setCustomTo] = useState(recipientEmail || initialTo || '');
  const [toSearch, setToSearch] = useState('');
  const [showToSuggestions, setShowToSuggestions] = useState(false);

  // Sender Identity & Campaign
  const [senderDisplayName, setSenderDisplayName] = useState(initialDraft?.sender_name || 'Rauf');
  const [senderEmail, setSenderEmail] = useState(initialDraft?.sender_email || 'rauf@mine-tech.be');
  const [replyTo, setReplyTo] = useState(initialDraft?.reply_to || 'rauf@mine-tech.be');
  const [campaignName, setCampaignName] = useState(initialDraft?.campaign_name || '');
  const [showSenderConfig, setShowSenderConfig] = useState(false);

  // Subject and Body
  const [subject, setSubject] = useState(initialDraft?.subject || aiDraft?.subject || '');
  const [body, setBody] = useState(
    initialDraft?.body_text
      ? ensureMineTechSignatureText(initialDraft.body_text)
      : initialDraft?.body
      ? ensureMineTechSignatureText(initialDraft.body)
      : aiDraft?.body
      ? ensureMineTechSignatureText(aiDraft.body)
      : `\n\n${SIGNATURE_TEXT}`
  );

  // CC and BCC as lists
  const [ccList, setCcList] = useState(initialDraft?.cc || []);
  const [bccList, setBccList] = useState(initialDraft?.bcc || []);
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(Boolean(initialDraft?.cc?.length || initialDraft?.bcc?.length));

  // Attachments
  const [attachments, setAttachments] = useState(initialDraft?.attachments || []);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Signatures
  const [availableSignatures, setAvailableSignatures] = useState([]);
  const [chosenSignatureId, setChosenSignatureId] = useState('sig-gmail-synced');

  // Scheduling
  const [isScheduling, setIsScheduling] = useState(Boolean(initialDraft?.scheduled_at));
  const [scheduledAt, setScheduledAt] = useState(initialDraft?.scheduled_at || '');

  // Draft persistence
  const [draftId, setDraftId] = useState(initialDraft?.id || null);
  const [draftStatus, setDraftStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Templates
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('write'); // 'write' | 'preview'
  const [aiDecision, setAiDecision] = useState(
    aiDraft?.decisionId ? { id: aiDraft.decisionId, leadId: initialLeadId, warnings: aiDraft.warnings || [] } : null
  );

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const bodyTextareaRef = useRef(null);
  const toDropdownRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const userEditedRecipientRef = useRef(false);

  // Fetch leads and templates
  useEffect(() => {
    const resolved = lead || leadContext || initialLead;
    const resolvedId = resolved?._id || resolved?.id || leadId;

    if (resolved) {
      setActiveLead(resolved);
      setSelectedLeadId(resolved._id || resolved.id || resolvedId || '');
      if (!userEditedRecipientRef.current) {
        setCustomTo(resolved.email || recipientEmail || initialTo || '');
      }
    } else if (resolvedId) {
      setSelectedLeadId(resolvedId);
      fetch(`/api/leads/${resolvedId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (json?.data || json?.lead) {
            const leadData = json.data || json.lead;
            setActiveLead(leadData);
            if (!userEditedRecipientRef.current) {
              setCustomTo(leadData.email || recipientEmail || initialTo || '');
            }
          }
        })
        .catch((e) => console.warn('Failed to load specific lead in ComposeModal:', e));
    } else if (recipientEmail || initialTo) {
      if (!userEditedRecipientRef.current) {
        setCustomTo(recipientEmail || initialTo || '');
      }
    }

    fetch('/api/leads?limit=150')
      .then((r) => r.json())
      .then((j) => {
        const fetched = j.leads || [];
        setLeadsList(fetched);
        // Do NOT auto-select fetched[0] when no lead is provided!
      })
      .catch((e) => console.warn('Failed to fetch leads list:', e));

    fetch('/api/email/templates')
      .then((r) => r.json())
      .then((j) => setTemplates(j.data || []))
      .catch((e) => console.warn('Failed to fetch email templates:', e));

    fetch('/api/email/workspace/signatures')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.signatures)) {
          setAvailableSignatures(j.signatures);
          const def = j.signatures.find((s) => s.isDefault) || j.signatures[0];
          if (def) setChosenSignatureId(def.id);
        }
      })
      .catch((e) => console.warn('Failed to fetch workspace signatures:', e));
  }, [lead, leadId, leadContext, initialLead, recipientEmail, initialTo]);

  // Click outside to close To suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toDropdownRef.current && !toDropdownRef.current.contains(e.target)) {
        setShowToSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  }, [subject, body, activeLead, customTo, attachments, scheduledAt, isScheduling]);

  // Ensure brand signature
  const ensureCompanySignature = (text) => {
    const selectedSig = availableSignatures.find((s) => s.id === chosenSignatureId);
    if (selectedSig && selectedSig.bodyText !== undefined) {
      if (!selectedSig.bodyText) return text; // No signature selected
      const stripped = stripSignature(text);
      return `${stripped}\n\n${selectedSig.bodyText}`;
    }
    return ensureMineTechSignatureText(text);
  };

  const stripSignature = (text) =>
    String(text || '')
      .replace(/\n*Regards,\s*\nAbdullah Rauf[\s\S]*$/i, '')
      .replace(/\n*Regards,\s*\nMineTech Outbound\s*$/i, '')
      .trim();

  // Auto-Save Draft
  const saveCurrentDraft = useCallback(
    async (isManual = false) => {
      if (!subject.trim() && !body.trim() && !customTo) return;
      if (draftStatus === 'saving') return;

      setDraftStatus('saving');
      try {
        const payload = {
          id: draftId,
          leadId: activeLead?._id || activeLead?.id || selectedLeadId || null,
          to: customTo || activeLead?.email || '',
          toList: [customTo || activeLead?.email].filter(Boolean),
          cc: ccList,
          bcc: bccList,
          subject,
          bodyText: body,
          bodyHtml: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            cid: a.cid || undefined,
            size: a.size,
          })),
          scheduledAt: isScheduling && scheduledAt ? scheduledAt : null,
        };

        const res = await fetch('/api/email/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.data?.id) {
            setDraftId(json.data.id);
          }
          setDraftStatus('saved');
          const d = new Date();
          setLastSavedTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } else {
          setDraftStatus('unsaved');
        }
      } catch (e) {
        setDraftStatus('unsaved');
      }
    },
    [draftId, activeLead, selectedLeadId, customTo, ccList, bccList, subject, body, attachments, isScheduling, scheduledAt, draftStatus]
  );

  // Trigger auto-save debounce on changes
  useEffect(() => {
    setDraftStatus('unsaved');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveCurrentDraft(false);
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [subject, body, customTo, ccList, bccList, attachments, scheduledAt]);

  const handleDiscardDraft = async () => {
    if (draftId) {
      if (!confirm('Are you sure you want to discard this draft?')) return;
      try {
        await fetch(`/api/email/drafts/${draftId}`, { method: 'DELETE' });
      } catch (e) {}
    }
    onClose();
  };

  // CC / BCC handlers
  const addRecipientChip = (type, email) => {
    const trimmed = (email || '').trim().replace(/,/g, '');
    if (!trimmed) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError(`"${trimmed}" is not a valid email address.`);
      return;
    }
    setError('');
    if (type === 'cc') {
      if (!ccList.includes(trimmed)) setCcList([...ccList, trimmed]);
      setCcInput('');
    } else {
      if (!bccList.includes(trimmed)) setBccList([...bccList, trimmed]);
      setBccInput('');
    }
  };

  const removeRecipientChip = (type, email) => {
    if (type === 'cc') {
      setCcList(ccList.filter((e) => e !== email));
    } else {
      setBccList(bccList.filter((e) => e !== email));
    }
  };

  // Text formatting helpers
  const applyFormatting = (format) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.substring(start, end);

    let replacement = '';
    let newCursorPos = start;

    switch (format) {
      case 'bold':
        replacement = selected ? `**${selected}**` : '**bold text**';
        break;
      case 'italic':
        replacement = selected ? `*${selected}*` : '*italic text*';
        break;
      case 'underline':
        replacement = selected ? `<u>${selected}</u>` : '<u>underlined text</u>';
        break;
      case 'bullet':
        replacement = selected
          ? selected.split('\n').map((l) => `• ${l}`).join('\n')
          : '\n• Bullet point\n';
        break;
      case 'number':
        replacement = selected
          ? selected.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n')
          : '\n1. Numbered item\n';
        break;
      case 'link':
        replacement = selected ? `[${selected}](https://)` : '[Link Title](https://example.com)';
        break;
      case 'clear':
        replacement = selected.replace(/[*_~`]/g, '').replace(/<\/?u>/g, '');
        break;
      default:
        return;
    }

    const nextBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(nextBody);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 0);
  };

  // File Upload Handlers
  const handleFilesChosen = (files) => {
    if (!files || files.length === 0) return;
    setError('');

    const newAttachments = [...attachments];
    let currentTotalSize = newAttachments.reduce((acc, a) => acc + (a.size || 0), 0);

    Array.from(files).forEach((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError(`File type ".${ext}" is not supported. Supported formats: ${ALLOWED_EXTENSIONS.join(', ')}.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`File "${file.name}" exceeds 10MB limit (${formatBytes(file.size)}).`);
        return;
      }

      if (currentTotalSize + file.size > MAX_TOTAL_SIZE_BYTES) {
        setError(`Total attachments exceed 25MB limit.`);
        return;
      }

      currentTotalSize += file.size;

      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result.split(',')[1];
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content: base64Data,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Inline Image with CID
  const handleInlineImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, GIF, WebP).');
      return;
    }

    const cid = `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result.split(',')[1];
      const inlineAtt = {
        filename: file.name,
        content: base64Data,
        contentType: file.type,
        cid: cid,
        size: file.size,
        isInline: true,
      };

      setAttachments((prev) => [...prev, inlineAtt]);

      // Insert image tag with cid in body
      const imageTag = `\n<img src="cid:${cid}" alt="${file.name}" style="max-width:100%; border-radius:6px; margin: 8px 0;" />\n`;
      setBody((prev) => prev + imageTag);
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
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

  const handleAiAccept = ({ subject: nextSubject, body: nextBody, decisionId, warnings }) => {
    const leadKey = activeLead?._id || activeLead?.id || selectedLeadId || null;
    if (nextSubject) setSubject(nextSubject);
    setBody(ensureCompanySignature(nextBody || ''));
    setAiDecision(decisionId ? { id: decisionId, leadId: leadKey, warnings: warnings || [] } : null);
    setActiveTab('write');
  };

  // Preview interpolation
  const getRenderedPreview = () => {
    const leadObj = activeLead || {};
    const firstName = leadObj.firstName || (leadObj.fullName ? leadObj.fullName.split(' ')[0] : 'Prospect');
    const company = leadObj.company || 'your team';
    const jobTitle = leadObj.jobTitle || leadObj.title || 'Leader';

    const renderedSubject = subject
      .replace(/{{firstName}}/gi, firstName)
      .replace(/{{company}}/gi, company)
      .replace(/{{jobTitle}}/gi, jobTitle);

    let renderedBody = body
      .replace(/{{firstName}}/gi, firstName)
      .replace(/{{company}}/gi, company)
      .replace(/{{jobTitle}}/gi, jobTitle);

    // Replace cid: references with inline data URLs for preview
    attachments.forEach((att) => {
      if (att.cid && att.content) {
        renderedBody = renderedBody.replace(
          new RegExp(`cid:${att.cid}`, 'g'),
          `data:${att.contentType || 'image/png'};base64,${att.content}`
        );
      }
    });

    return { renderedSubject, renderedBody };
  };

  // Send or Schedule handler
  const handleSend = async (e) => {
    if (e) e.preventDefault();

    const targetEmail = customTo || activeLead?.email;
    if (!targetEmail || !subject.trim() || !body.trim()) {
      setError('Please provide a valid recipient email, subject, and message body.');
      return;
    }

    if (isScheduling && !scheduledAt) {
      setError('Please select a scheduled delivery date and time.');
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
          leadId: activeLead?._id || activeLead?.id || selectedLeadId || 'direct-lead',
          to: targetEmail,
          senderDisplayName: senderDisplayName.trim() || 'Rauf',
          senderName: senderDisplayName.trim() || 'Rauf',
          senderEmail: senderEmail.trim() || 'rauf@mine-tech.be',
          replyTo: replyTo.trim() || senderEmail.trim() || 'rauf@mine-tech.be',
          campaignName: campaignName.trim() || undefined,
          subject,
          bodyHtml: `<p>${finalBody.replace(/\n/g, '<br/>')}</p>`,
          bodyText: finalBody,
          cc: ccList,
          bcc: bccList,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
            cid: a.cid || undefined,
          })),
          scheduled_at: isScheduling && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          draftId: draftId || undefined,
          ...(aiDecision?.id ? { aiDecisionId: aiDecision.id } : {}),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (onSent) onSent();
        onClose();
      } else {
        setError(json.message || json.error || 'Failed to dispatch email.');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const { renderedSubject, renderedBody } = getRenderedPreview();

  // Filter leads for To autocomplete
  const filteredLeads = leadsList.filter((l) => {
    if (!toSearch.trim()) return false;
    const term = toSearch.toLowerCase();
    const name = (l.fullName || l.name || `${l.firstName || ''} ${l.lastName || ''}`).toLowerCase();
    const email = (l.email || '').toLowerCase();
    const company = (l.company || '').toLowerCase();
    return name.includes(term) || email.includes(term) || company.includes(term);
  });

  return (
    <ModalFrame title="Compose email" onClose={onClose}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          handleFilesChosen(e.dataTransfer.files);
        }}
        className={`bg-card border border-border rounded-xl w-full max-w-3xl overflow-hidden shadow-dialog flex flex-col max-h-[92vh] text-foreground transition-colors ${
          isDraggingOver ? 'ring-2 ring-primary border-primary bg-primary/[0.02]' : ''
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm text-foreground tracking-tight">Compose Outbound Email</h2>
                {draftStatus === 'saving' && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Saving draft...
                  </span>
                )}
                {draftStatus === 'saved' && lastSavedTime && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                    <Check className="h-2.5 w-2.5" /> Draft saved ({lastSavedTime})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">1-to-1 outreach with rich attachments &amp; scheduling</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex items-center bg-muted p-0.5 rounded-xl border border-border text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('write')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors text-xs font-semibold ${
                  activeTab === 'write' ? 'bg-card text-foreground shadow-subtle' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Write</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors text-xs font-semibold ${
                  activeTab === 'preview' ? 'bg-card text-foreground shadow-subtle' : 'text-muted-foreground hover:text-foreground'
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

        {/* Main Form Body */}
        <form onSubmit={handleSend} className="p-5 space-y-3.5 overflow-y-auto flex-1 flex flex-col bg-card">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Identity & From Header Preview */}
          <div className="bg-muted/30 border border-border rounded-xl px-3.5 py-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">From:</span>
                <span className="text-xs font-semibold text-foreground">{senderDisplayName || 'Rauf'}</span>
                <span className="text-xs text-muted-foreground font-mono">&lt;{senderEmail || 'rauf@mine-tech.be'}&gt;</span>
                {campaignName && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                    Campaign: {campaignName}
                  </span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                  Verified mine-tech.be
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSenderConfig(!showSenderConfig)}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                {showSenderConfig ? 'Hide Sender Details' : 'Configure Sender & Campaign'}
              </button>
            </div>

            {showSenderConfig && (
              <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 anim-fade-in">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Sender Display Name</label>
                  <Input
                    type="text"
                    value={senderDisplayName}
                    onChange={(e) => setSenderDisplayName(e.target.value)}
                    placeholder="Rauf"
                    className="h-7 text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Sender Email</label>
                  <Input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="rauf@mine-tech.be"
                    className="h-7 text-xs bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Reply-To Address</label>
                  <Input
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="rauf@mine-tech.be"
                    className="h-7 text-xs bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Campaign Name</label>
                  <Input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Bentonite Suppliers"
                    className="h-7 text-xs bg-background"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Recipient Section */}
          <div className="space-y-2">
            <div className="relative bg-muted/40 border border-border rounded-xl px-3.5 py-2" ref={toDropdownRef}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider shrink-0 mr-1">To:</span>

                {activeLead ? (
                  <div className="flex items-center justify-between flex-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{activeLead.fullName || activeLead.name || activeLead.firstName}</span>
                      <span className="text-muted-foreground font-mono">({activeLead.email})</span>
                      {activeLead.classification && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                          {activeLead.classification}
                        </span>
                      )}
                      {activeLead.company && (
                        <span className="text-muted-foreground hidden sm:inline">• {activeLead.company}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const currentVal = customTo || activeLead?.email || '';
                          userEditedRecipientRef.current = true;
                          setActiveLead(null);
                          setCustomTo(currentVal);
                          setToSearch(currentVal);
                          setShowToSuggestions(true);
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCcBcc(!showCcBcc)}
                        className="text-[11px] font-medium text-primary hover:underline ml-1"
                      >
                        {showCcBcc ? 'Hide CC/BCC' : 'Cc / Bcc'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between flex-1 relative">
                    <input
                      type="text"
                      value={toSearch !== '' ? toSearch : customTo}
                      onChange={(e) => {
                        userEditedRecipientRef.current = true;
                        setToSearch(e.target.value);
                        setCustomTo(e.target.value);
                        setShowToSuggestions(true);
                      }}
                      onFocus={() => setShowToSuggestions(true)}
                      placeholder="Type name, company or enter email..."
                      className="w-full bg-transparent text-xs text-foreground focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCcBcc(!showCcBcc)}
                      className="text-[11px] font-medium text-primary hover:underline shrink-0 ml-2"
                    >
                      {showCcBcc ? 'Hide' : 'Cc/Bcc'}
                    </button>
                  </div>
                )}
              </div>

              {/* To Autocomplete Dropdown */}
              {!activeLead && showToSuggestions && filteredLeads.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-dialog z-50 max-h-48 overflow-y-auto">
                  {filteredLeads.map((l) => (
                    <div
                      key={l.id || l._id}
                      onClick={() => {
                        userEditedRecipientRef.current = true;
                        setActiveLead(l);
                        setSelectedLeadId(l.id || l._id);
                        setCustomTo(l.email);
                        setToSearch('');
                        setShowToSuggestions(false);
                      }}
                      className="px-3.5 py-2 hover:bg-muted/80 cursor-pointer flex items-center justify-between text-xs border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{l.fullName || l.name || l.firstName || l.email}</span>
                        <span className="text-muted-foreground font-mono">({l.email})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {l.classification && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {l.classification}
                          </span>
                        )}
                        <span className="text-muted-foreground text-[11px]">{l.company || ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CC and BCC Inputs with chips */}
            {showCcBcc && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in">
                {/* CC */}
                <div className="bg-muted/40 border border-border rounded-xl px-3 py-1.5 flex flex-wrap items-center gap-1.5 min-h-[38px]">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">Cc:</span>
                  {ccList.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 bg-card border border-border rounded-md px-2 py-0.5 text-[11px] font-mono text-foreground shadow-subtle"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeRecipientChip('cc', email)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="email"
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addRecipientChip('cc', ccInput);
                      }
                    }}
                    onBlur={() => addRecipientChip('cc', ccInput)}
                    placeholder={ccList.length === 0 ? 'recipient@example.com (press Enter)' : ''}
                    className="flex-1 min-w-[120px] bg-transparent text-xs text-foreground focus:outline-none font-mono"
                  />
                </div>

                {/* BCC */}
                <div className="bg-muted/40 border border-border rounded-xl px-3 py-1.5 flex flex-wrap items-center gap-1.5 min-h-[38px]">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">Bcc:</span>
                  {bccList.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 bg-card border border-border rounded-md px-2 py-0.5 text-[11px] font-mono text-foreground shadow-subtle"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeRecipientChip('bcc', email)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="email"
                    value={bccInput}
                    onChange={(e) => setBccInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addRecipientChip('bcc', bccInput);
                      }
                    }}
                    onBlur={() => addRecipientChip('bcc', bccInput)}
                    placeholder={bccList.length === 0 ? 'bcc@example.com (press Enter)' : ''}
                    className="flex-1 min-w-[120px] bg-transparent text-xs text-foreground focus:outline-none font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Subject Line & Templates */}
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
              placeholder="e.g. Quick question regarding your outbound workflow"
              className="bg-muted/40 border-border rounded-xl font-medium text-foreground text-xs"
            />
          </div>

          {/* Rich Text Toolbar */}
          {activeTab === 'write' && (
            <div className="flex items-center justify-between bg-muted/40 border border-border rounded-xl px-2 py-1 gap-1">
              <div className="flex items-center gap-0.5 flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Bold"
                  onClick={() => applyFormatting('bold')}
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Italic"
                  onClick={() => applyFormatting('italic')}
                >
                  <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Underline"
                  onClick={() => applyFormatting('underline')}
                >
                  <Underline className="h-3.5 w-3.5" />
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Bullet List"
                  onClick={() => applyFormatting('bullet')}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Numbered List"
                  onClick={() => applyFormatting('number')}
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Insert Link"
                  onClick={() => applyFormatting('link')}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                {/* Inline Image Upload */}
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleInlineImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Insert Inline Image with Content-ID (CID)"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[11px]">Inline Image</span>
                </Button>
              </div>

              {/* Attach File Button */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFilesChosen(e.target.files)}
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp,.zip"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2.5 text-xs border-border"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px]">Attach Files</span>
                </Button>
              </div>
            </div>
          )}

          {/* Email Body & Live Preview */}
          <div className="space-y-1.5 flex-1 flex flex-col min-h-[220px]">
            {activeTab === 'write' ? (
              <Textarea
                ref={bodyTextareaRef}
                required
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email here, or use the Writing Assistant below to generate a tailored pitch... You can drag & drop attachments directly onto this window."
                className="bg-muted/40 border-border rounded-xl flex-1 p-3.5 leading-relaxed resize-none text-xs text-foreground font-sans"
              />
            ) : (
              <div className="w-full flex-1 bg-muted/30 border border-border rounded-xl p-4 text-xs text-foreground space-y-3 overflow-y-auto leading-relaxed">
                <div className="pb-2 border-b border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Subject Preview</span>
                    <p className="font-semibold text-foreground text-xs">{renderedSubject}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-semibold">
                    Live Preview
                  </span>
                </div>
                <div
                  className="whitespace-pre-wrap text-foreground leading-relaxed font-sans"
                  dangerouslySetInnerHTML={{
                    __html: renderedBody.includes('<img') || renderedBody.includes('<u>')
                      ? renderedBody.replace(/\n/g, '<br/>')
                      : renderedBody,
                  }}
                />
              </div>
            )}
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="space-y-1.5 bg-muted/30 border border-border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="h-3 w-3 text-primary" /> Attachments ({attachments.length})
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Total: {formatBytes(attachments.reduce((acc, a) => acc + (a.size || 0), 0))} / 25 MB
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {attachments.map((att, i) => (
                  <div
                    key={`${att.filename}-${i}`}
                    className="flex items-center justify-between gap-2 bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs shadow-subtle"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(att.filename)}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground text-[11px]">{att.filename}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatBytes(att.size || 0)} {att.cid ? '• (Inline CID)' : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded"
                      title="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Drafting Assistant */}
          <AiDraftBar
            leadId={activeLead?._id || activeLead?.id || selectedLeadId || null}
            surface="compose"
            currentDraft={body.trim() ? { subject, body: stripSignature(body) } : null}
            onAccept={handleAiAccept}
          />

          {/* Scheduling Popover Section */}
          {isScheduling && (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Schedule Delivery:</span>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsScheduling(false);
                  setScheduledAt('');
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Send Immediately Instead
              </button>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>Resend Verified • <code>rauf@mine-tech.be</code></span>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduling(!isScheduling)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition ${
                  isScheduling
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{isScheduling ? 'Scheduled' : 'Schedule'}</span>
              </button>

              {availableSignatures.length > 0 && (
                <div className="flex items-center gap-1.5 border border-border rounded-lg px-2 py-0.5 bg-muted/30">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Sig:</span>
                  <select
                    value={chosenSignatureId}
                    onChange={(e) => setChosenSignatureId(e.target.value)}
                    className="bg-transparent text-[11px] text-foreground focus:outline-none cursor-pointer max-w-[140px] truncate"
                    title="Choose email signature"
                  >
                    {availableSignatures.map((sig) => (
                      <option key={sig.id} value={sig.id} className="bg-card text-foreground">
                        {sig.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDiscardDraft}
                className="text-muted-foreground hover:text-destructive text-xs"
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveCurrentDraft(true)}
                className="border-border text-foreground hover:bg-muted text-xs"
              >
                Save Draft
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="gap-2 h-9 px-4 text-xs font-semibold"
              >
                {loading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : isScheduling ? (
                  <Calendar className="h-3.5 w-3.5" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>
                  {loading
                    ? 'Dispatching...'
                    : isScheduling
                    ? scheduledAt
                      ? `Schedule Send`
                      : 'Pick Schedule Time'
                    : 'Send Email'}
                </span>
                <span className="text-[10px] opacity-70 ml-0.5 hidden sm:inline font-mono">↵</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </ModalFrame>
  );
}
