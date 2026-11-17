'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Building,
  User,
  Mail,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  FileText,
  Eye,
  Edit3,
  Check,
  Send,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  FileSignature,
  Upload,
  Scissors,
  AlignLeft,
  List,
  Bold,
  Italic,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import RematchCompanyModal from './RematchCompanyModal';

// Client-side helper for unwrapping artificial PDF soft line breaks
function unwrapSoftLineBreaks(text = '') {
  if (!text) return '';
  const blocks = text.split(/\n{2,}/);

  const cleanedBlocks = blocks.map((block) => {
    const rawLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return '';

    const mergedLines = [];
    let currentLine = rawLines[0];

    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i];
      const prevLine = rawLines[i - 1];

      const isBulletOrNum = /^[-*•–—\d\.)]\s+/i.test(line);
      const prevEndsWithColon = /[:]$/.test(prevLine);
      const isGreeting = /^(?:Dear|Hi|Hello|Good\s+(?:morning|afternoon|evening))\b/i.test(line);
      const isSignOff = /^(?:Best\s+regards|Kind\s+regards|Warm\s+regards|Regards|Sincerely|Thanks|Thank\s+you|Cheers)\b/i.test(line);
      const prevIsGreeting = /^(?:Dear|Hi|Hello|Good\s+(?:morning|afternoon|evening))\b/i.test(prevLine);
      const prevIsSignOff = /^(?:Best\s+regards|Kind\s+regards|Warm\s+regards|Regards|Sincerely|Thanks|Thank\s+you|Cheers)\b/i.test(prevLine);

      if (isBulletOrNum || prevEndsWithColon || isGreeting || isSignOff || prevIsGreeting || prevIsSignOff) {
        mergedLines.push(currentLine);
        currentLine = line;
      } else {
        if (/[-–—]$/.test(currentLine)) {
          currentLine = currentLine.slice(0, -1) + line;
        } else {
          currentLine = currentLine + ' ' + line;
        }
      }
    }
    mergedLines.push(currentLine);
    return mergedLines.join('\n');
  });

  return cleanedBlocks.filter(Boolean).join('\n\n');
}

// Regex to detect duplicate sign-off / closing in email body
const CLOSING_PATTERN = /(?:\n|^)\s*(?:(?:Kind|Best|Warm)\s+regards|Regards|Sincerely|Thanks\s*(?:and\s*regards)?|Cheers|Yours\s+faithfully|Respectfully)[\s,]*\n+(?:(?:Abdullah\s+Rauf|Rauf|MineTech(?:\s+Resources)?|Sales\s+Team)[^\n]*\n*)*\s*$/i;

export default function PersonalizedEmailEditorModal({
  isOpen,
  onClose,
  draft,
  allDrafts = [],
  currentIndex = 0,
  onSaveDraft,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState('editor'); // editor | preview | compare
  const [isRematchOpen, setIsRematchOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [primaryContactEmail, setPrimaryContactEmail] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('needs_review');
  const [isModifiedAfterApproval, setIsModifiedAfterApproval] = useState(false);

  // Signature & Document states
  const [signatures, setSignatures] = useState([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState('');
  const [isCustomSigOpen, setIsCustomSigOpen] = useState(false);

  // Custom signature builder fields
  const [customSigName, setCustomSigName] = useState('Abdullah Rauf');
  const [customSigTitle, setCustomSigTitle] = useState('Head of Sales');
  const [customSigCompany, setCustomSigCompany] = useState('Minetech Resources BV – Belgium');
  const [customSigPhone, setCustomSigPhone] = useState('+32 486 287 751');
  const [customSigEmail, setCustomSigEmail] = useState('rauf@mine-tech.be');
  const [customSigWebsite, setCustomSigWebsite] = useState('www.mine-tech.be');
  const [customSigExtra, setCustomSigExtra] = useState(
    'BTW No. BE 1011004868\nFacility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands\nRegistered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium'
  );

  const [applySignatureToAll, setApplySignatureToAll] = useState(false);
  const [applyAttachmentsToAll, setApplyAttachmentsToAll] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const localFileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [attachedDocIds, setAttachedDocIds] = useState([]);
  const [showDocLibrary, setShowDocLibrary] = useState(false);

  // Generate custom HTML signature string
  const generateCustomSigHtml = () => {
    return `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #cbd5e1; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #475569;">
  <p style="margin: 0 0 4px 0; color: #0f172a; font-weight: bold; font-size: 14px;">
    ${customSigName}${customSigTitle ? ` <span style="font-weight: normal; color: #64748b;">— ${customSigTitle}</span>` : ''}
  </p>
  <p style="margin: 0 0 4px 0;">
    <strong style="color: #0f172a;">${customSigCompany}</strong>
    ${customSigPhone ? ` | Mo. <span style="color: #0f172a;">${customSigPhone}</span>` : ''}
    ${customSigEmail ? ` | <a href="mailto:${customSigEmail}" style="color: #d97706; text-decoration: none;">${customSigEmail}</a>` : ''}
    ${customSigWebsite ? ` | <a href="https://${customSigWebsite.replace(/^https?:\/\//, '')}" target="_blank" style="color: #d97706; text-decoration: none;">${customSigWebsite}</a>` : ''}
  </p>
  ${customSigExtra ? `<p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.5;">${customSigExtra.replace(/\n/g, '<br/>')}</p>` : ''}
</div>`;
  };

  // Initial load
  useEffect(() => {
    if (draft) {
      setSubject(draft.edited_subject || draft.extracted_subject || '');
      setBodyText(draft.edited_body_plain || draft.extracted_body_plain || '');
      setApprovalStatus(draft.approval_status || 'needs_review');
      setIsModifiedAfterApproval(Boolean(draft.content_modified_after_approval));

      // Contacts
      const contacts = Array.isArray(draft.selected_contacts) && draft.selected_contacts.length > 0
        ? draft.selected_contacts
        : (draft.all_company_contacts || []);
      setSelectedContacts(contacts);

      const primary = contacts.find((c) => c.is_primary) || contacts[0];
      setPrimaryContactEmail(primary?.email || '');

      setCcInput((draft.cc_emails || []).join(', '));
      setBccInput((draft.bcc_emails || []).join(', '));

      // Signatures
      setSelectedSignatureId(draft.assigned_signature_id || 'sig-minetech-head-of-sales');

      // Attachments
      const existingAttachmentIds = (draft.assigned_attachments || []).map((a) => a.id || a);
      setAttachedDocIds(existingAttachmentIds);
    }
  }, [draft]);

  // Load signatures & documents
  useEffect(() => {
    if (isOpen) {
      fetch('/api/email/workspace/signatures')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.signatures) setSignatures(d.signatures);
        })
        .catch(() => {});

      fetch('/api/email/workspace/documents')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.documents) setDocuments(d.documents);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Check if modified compared to previously saved/approved
  const handleBodyChange = (e) => {
    const val = e.target.value;
    setBodyText(val);
    if (approvalStatus === 'approved') {
      setIsModifiedAfterApproval(true);
    }
  };

  const handleSubjectChange = (e) => {
    const val = e.target.value;
    setSubject(val);
    if (approvalStatus === 'approved') {
      setIsModifiedAfterApproval(true);
    }
  };

  // Duplicate closing detection
  const hasDuplicateClosing = useMemo(() => {
    return CLOSING_PATTERN.test(bodyText);
  }, [bodyText]);

  const handleStripClosingFromBody = () => {
    const cleaned = bodyText.replace(CLOSING_PATTERN, '').trim();
    setBodyText(cleaned);
    if (approvalStatus === 'approved') {
      setIsModifiedAfterApproval(true);
    }
    toast.success('Removed duplicate closing from email body. Your selected signature will provide the official sign-off.');
  };

  const handleUnwrapLineBreaks = () => {
    const unwrapped = unwrapSoftLineBreaks(bodyText);
    setBodyText(unwrapped);
    if (approvalStatus === 'approved') {
      setIsModifiedAfterApproval(true);
    }
    toast.success('Cleaned up artificial PDF line breaks.');
  };

  const handleInsertToolbar = (prefix, suffix = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = bodyText.substring(start, end);
    const replacement = prefix + selected + suffix;
    const updated = bodyText.substring(0, start) + replacement + bodyText.substring(end);
    setBodyText(updated);
    if (approvalStatus === 'approved') setIsModifiedAfterApproval(true);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const toggleContactSelection = (contact) => {
    setSelectedContacts((prev) => {
      const exists = prev.some((c) => c.email.toLowerCase() === contact.email.toLowerCase());
      if (exists) {
        const next = prev.filter((c) => c.email.toLowerCase() !== contact.email.toLowerCase());
        if (primaryContactEmail === contact.email && next.length > 0) {
          setPrimaryContactEmail(next[0].email);
        }
        return next;
      } else {
        const next = [...prev, contact];
        if (!primaryContactEmail) {
          setPrimaryContactEmail(contact.email);
        }
        return next;
      }
    });
  };

  const toggleDocumentAttachment = (doc) => {
    setAttachedDocIds((prev) => {
      if (prev.includes(doc.id)) {
        return prev.filter((id) => id !== doc.id);
      } else {
        return [...prev, doc.id];
      }
    });
  };

  // Upload custom file directly from local computer
  const handleLocalFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('category', 'Custom Uploads');

      const res = await fetch('/api/email/workspace/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'File upload failed');
      }

      toast.success(`Attached "${file.name}" to email!`);
      const newDoc = data.document;
      setDocuments((prev) => [newDoc, ...prev]);
      setAttachedDocIds((prev) => [...prev, newDoc.id]);
    } catch (err) {
      toast.error(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingAttachment(false);
      if (localFileInputRef.current) localFileInputRef.current.value = '';
    }
  };

  const handleRevertToOriginal = () => {
    if (!draft) return;
    setSubject(draft.extracted_subject || '');
    setBodyText(draft.extracted_body_plain || '');
    setIsModifiedAfterApproval(false);
    toast.info('Restored original extracted email text.');
  };

  // Resolve current active signature HTML
  const resolvedSignatureHtml = useMemo(() => {
    if (selectedSignatureId === 'custom' || isCustomSigOpen) {
      return generateCustomSigHtml();
    }
    const found = signatures.find((s) => s.id === selectedSignatureId);
    return found?.bodyHtml || draft?.assigned_signature_html || '';
  }, [selectedSignatureId, isCustomSigOpen, signatures, draft, customSigName, customSigTitle, customSigCompany, customSigPhone, customSigEmail, customSigWebsite, customSigExtra]);

  // Formatted HTML body for realistic rendering
  const formattedHtmlBody = useMemo(() => {
    if (!bodyText) return '';
    const paragraphs = bodyText.split(/\n{2,}/);
    return paragraphs
      .map((p) => {
        const withBreaks = p.replace(/\n/g, '<br/>');
        return `<p style="margin: 0 0 16px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${withBreaks}</p>`;
      })
      .join('');
  }, [bodyText]);

  const handleSave = async (shouldApprove = false, advanceNext = false, explicitUnapprove = false) => {
    if (!draft) return;
    setLoading(true);

    try {
      let finalSigHtml = resolvedSignatureHtml;
      let finalSigId = selectedSignatureId;
      if (selectedSignatureId === 'custom' || isCustomSigOpen) {
        finalSigId = `sig-custom-${Date.now()}`;
      }

      const activeAttachments = documents.filter((d) => attachedDocIds.includes(d.id));

      const updatedContacts = selectedContacts.map((c) => ({
        ...c,
        is_primary: c.email.toLowerCase() === primaryContactEmail.toLowerCase(),
      }));

      const parsedCc = ccInput
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.includes('@'));

      const parsedBcc = bccInput
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.includes('@'));

      let newApproval = approvalStatus;
      if (explicitUnapprove) {
        newApproval = 'needs_review';
      } else if (shouldApprove) {
        newApproval = 'approved';
      } else if (isModifiedAfterApproval) {
        newApproval = 'needs_review';
      }

      const updates = {
        edited_subject: subject,
        edited_body_plain: bodyText,
        edited_body_html: formattedHtmlBody,
        approval_status: newApproval,
        content_modified_after_approval: shouldApprove ? false : (explicitUnapprove ? false : isModifiedAfterApproval),
        selected_contacts: updatedContacts,
        cc_emails: parsedCc,
        bcc_emails: parsedBcc,
        assigned_signature_id: finalSigId,
        assigned_signature_html: finalSigHtml || null,
        assigned_attachments: activeAttachments,
        applySignatureToAll,
        applyAttachmentsToAll,
      };

      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_draft',
          draftId: draft.id,
          updates,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save changes');
      }

      if (explicitUnapprove) {
        toast.info('Approval removed. Marked as Needs Review.');
        setApprovalStatus('needs_review');
        setIsModifiedAfterApproval(false);
      } else if (shouldApprove) {
        toast.success('Email approved and saved!');
        setApprovalStatus('approved');
        setIsModifiedAfterApproval(false);
      } else {
        toast.success('Draft updated successfully.');
      }

      onSaveDraft?.(data.drafts);

      if (advanceNext && currentIndex < allDrafts.length - 1) {
        onNavigate?.(currentIndex + 1);
      }
    } catch (err) {
      toast.error(err.message || 'Error saving email draft');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !draft) return null;

  const currentSignature = signatures.find((s) => s.id === selectedSignatureId);
  const matchedLead = draft.matched_lead;
  const allContacts = draft.all_company_contacts || [];
  const activeAttachedDocs = documents.filter((d) => attachedDocIds.includes(d.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-5xl bg-slate-900 border-slate-700 text-slate-100 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Email #{currentIndex + 1} of {allDrafts.length}
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">
                {draft.extracted_company || matchedLead?.company_name || 'Personalized Company Outreach'}
              </h2>
              {draft.match_status === 'matched' ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px]">
                  CRM Matched
                </Badge>
              ) : draft.match_status === 'needs_review' ? (
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px]">
                  Needs Review
                </Badge>
              ) : (
                <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px]">
                  Unmatched
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex <= 0}
              onClick={() => onNavigate?.(currentIndex - 1)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 text-xs"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex >= allDrafts.length - 1}
              onClick={() => onNavigate?.(currentIndex + 1)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 text-xs"
            >
              Next
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Alert if content modified after approval */}
          {isModifiedAfterApproval && (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-200">Content Modified After Approval</p>
                <p className="text-amber-300/90 mt-0.5">
                  You have made changes to the text, recipient, signature, or attachments. The approval status resets to <strong>Needs Review</strong> until you re-approve it.
                </p>
              </div>
            </div>
          )}

          {/* CRM Company & Contact Resolution Card */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-400" />
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Target Company:</span>
                <span className="text-sm font-semibold text-white">
                  {matchedLead ? matchedLead.company_name : draft.extracted_company || 'Unlinked'}
                </span>
                {matchedLead?.country && (
                  <span className="text-xs text-slate-400">({matchedLead.country})</span>
                )}
                {matchedLead?.website && (
                  <a
                    href={matchedLead.website.startsWith('http') ? matchedLead.website : `https://${matchedLead.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    {matchedLead.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRematchOpen(true)}
                className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                {matchedLead ? 'Change / Rematch CRM' : 'Link to CRM Lead'}
              </Button>
            </div>

            {/* Contacts Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  Select Recipient Contact(s) ({selectedContacts.length} selected):
                </span>
                <span className="text-[11px] text-slate-500">
                  Click contact to select. The contact tagged TO receives direct dispatch.
                </span>
              </div>

              {allContacts.length === 0 ? (
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  No contacts found in CRM for this company. Please add an email address or link to a valid lead.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {allContacts.map((contact, idx) => {
                    const isSelected = selectedContacts.some(
                      (c) => c.email.toLowerCase() === contact.email.toLowerCase()
                    );
                    const isPrimary = primaryContactEmail.toLowerCase() === contact.email.toLowerCase();

                    return (
                      <div
                        key={idx}
                        onClick={() => toggleContactSelection(contact)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between ${
                          isSelected
                            ? 'border-amber-500/60 bg-amber-500/10 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-medium text-slate-200">
                            <span>{contact.name || 'Unnamed Contact'}</span>
                            {isPrimary && (
                              <span className="text-[10px] px-1 rounded bg-amber-500 text-slate-950 font-bold">
                                TO
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">{contact.email}</p>
                          {contact.title && (
                            <p className="text-[10px] text-slate-500">{contact.title}</p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isSelected ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-600'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          {isSelected && !isPrimary && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrimaryContactEmail(contact.email);
                              }}
                              className="text-[10px] text-amber-400 hover:underline mt-1"
                            >
                              Set as TO
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CC & BCC Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-2 border-t border-slate-800/60">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    CC (comma-separated emails):
                  </label>
                  <Input
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    placeholder="e.g. procurement@company.com, team@company.com"
                    className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    BCC (comma-separated emails):
                  </label>
                  <Input
                    value={bccInput}
                    onChange={(e) => setBccInput(e.target.value)}
                    placeholder="e.g. rauf@mine-tech.be, archive@mine-tech.be"
                    className="h-8 text-xs bg-slate-900 border-slate-800 text-white focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Email Content Section */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Subject Line:
              </label>
              <Input
                value={subject}
                onChange={handleSubjectChange}
                placeholder="Enter email subject line..."
                className="bg-slate-950 border-slate-700 text-white text-sm font-medium focus:border-amber-500"
              />
            </div>

            {/* Editor Tabs: Edit vs Realistic Preview vs Raw PDF Compare */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 gap-2">
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('editor')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === 'editor'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Email
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === 'preview'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Realistic Outgoing Email Preview
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('compare')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === 'compare'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Compare with Raw PDF
                  </button>
                </div>

                {activeTab === 'editor' && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUnwrapLineBreaks}
                      title="Fix soft line wraps from PDF extraction"
                      className="h-7 text-[11px] text-amber-300 hover:bg-amber-500/10 border border-amber-500/30"
                    >
                      <AlignLeft className="w-3 h-3 mr-1" />
                      Fix PDF Line Wraps
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRevertToOriginal}
                      className="h-7 text-[11px] text-slate-400 hover:text-amber-300 hover:bg-slate-800"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Revert Text
                    </Button>
                  </div>
                )}
              </div>

              {/* Duplicate Closing Notification Banner */}
              {hasDuplicateClosing && activeTab === 'editor' && (
                <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Duplicate closing detected:</strong> Body contains closing sign-off text (e.g. &ldquo;Kind regards...&rdquo;). Your selected signature will append another sign-off.
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStripClosingFromBody}
                    className="h-6 text-[11px] border-amber-500/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 shrink-0 ml-3"
                  >
                    <Scissors className="w-3 h-3 mr-1" />
                    Trim Closing from Body
                  </Button>
                </div>
              )}

              {/* TAB 1: Editor */}
              {activeTab === 'editor' && (
                <div className="p-4 space-y-4">
                  {/* Lightweight Formatting Toolbar */}
                  <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-400">
                    <button
                      type="button"
                      onClick={() => handleInsertToolbar('**', '**')}
                      className="p-1.5 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertToolbar('*', '*')}
                      className="p-1.5 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertToolbar('• ')}
                      className="p-1.5 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Bullet Point"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <div className="h-4 w-px bg-slate-800 mx-1" />
                    <span className="text-[11px] text-slate-500 px-1">
                      Professional Business Typography: Arial / Helvetica 14px
                    </span>
                  </div>

                  {/* Body Textarea with Arial / sans-serif styling (NO font-mono) */}
                  <Textarea
                    ref={textareaRef}
                    value={bodyText}
                    onChange={handleBodyChange}
                    rows={12}
                    style={{
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      fontSize: '14px',
                      lineHeight: '1.6',
                    }}
                    className="w-full bg-slate-950 border-slate-800 text-slate-100 p-4 focus:border-amber-500 resize-y rounded-lg font-sans"
                    placeholder="Write or edit the personalized outreach email body..."
                  />

                  {/* Character count & helpful note */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Clean paragraphs render automatically with standard email spacing.</span>
                    <span>{bodyText.length} characters • {bodyText.split(/\s+/).filter(Boolean).length} words</span>
                  </div>

                  {/* In-Editor Visible Signature Rendering */}
                  <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <FileSignature className="w-3.5 h-3.5 text-amber-400" />
                        Signature Rendered at End of Email:
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {currentSignature?.name || (isCustomSigOpen ? 'Custom Signature' : 'Preset')}
                      </span>
                    </div>

                    <div
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-300"
                      dangerouslySetInnerHTML={{ __html: resolvedSignatureHtml || '<p class="text-slate-500 italic">No signature assigned</p>' }}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Realistic Outgoing Email Preview */}
              {activeTab === 'preview' && (
                <div className="p-6 bg-slate-950/80 min-h-[460px] flex flex-col justify-start">
                  <div className="max-w-3xl w-full mx-auto bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-300 overflow-hidden animate-in fade-in">
                    {/* Realistic Email Client Header */}
                    <div className="p-5 border-b border-slate-200 bg-slate-50 space-y-2 text-xs text-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">From:</span>
                          <span className="text-slate-800 font-medium">Rauf &lt;rauf@mine-tech.be&gt;</span>
                        </div>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          TLS Encrypted
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">To:</span>
                        <span className="text-slate-900 font-semibold">
                          {primaryContactEmail || 'No primary recipient selected'}
                        </span>
                        {selectedContacts.length > 1 && (
                          <span className="text-slate-500 text-[11px]">
                            (+{selectedContacts.length - 1} other{selectedContacts.length > 2 ? 's' : ''})
                          </span>
                        )}
                      </div>

                      {ccInput && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="font-bold text-slate-900">Cc:</span>
                          <span>{ccInput}</span>
                        </div>
                      )}

                      <div className="flex items-baseline gap-2 pt-1 border-t border-slate-200">
                        <span className="font-bold text-slate-900">Subject:</span>
                        <span className="text-sm font-bold text-slate-950">
                          {subject || '(No subject provided)'}
                        </span>
                      </div>
                    </div>

                    {/* Realistic Outgoing Email Body Paper */}
                    <div
                      className="p-8 space-y-4"
                      style={{
                        fontFamily: 'Arial, Helvetica, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: '#1e293b',
                      }}
                    >
                      {/* Body HTML */}
                      <div
                        dangerouslySetInnerHTML={{
                          __html: formattedHtmlBody || '<p style="color: #94a3b8; font-style: italic;">(Email body is empty)</p>',
                        }}
                      />

                      {/* Rendered Signature Seamlessly */}
                      {resolvedSignatureHtml && (
                        <div
                          className="pt-2"
                          dangerouslySetInnerHTML={{ __html: resolvedSignatureHtml }}
                        />
                      )}

                      {/* Attached Documents */}
                      {activeAttachedDocs.length > 0 && (
                        <div className="pt-6 mt-6 border-t border-slate-200">
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                            Attachments ({activeAttachedDocs.length}):
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {activeAttachedDocs.map((doc) => (
                              <div
                                key={doc.id}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 text-xs flex items-center gap-2 font-medium"
                              >
                                <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                                <span>{doc.name}</span>
                                <span className="text-[11px] text-slate-500 font-normal">({doc.fileSize})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Compare with Raw PDF Text */}
              {activeTab === 'compare' && (
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 p-4 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block mb-2">
                      Original Text Extracted from PDF (Verbatim):
                    </span>
                    <div
                      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', lineHeight: '1.6' }}
                      className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 whitespace-pre-wrap max-h-80 overflow-y-auto"
                    >
                      {draft.extracted_body_plain || 'No original text available'}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-amber-300 block mb-2">
                      Current Edited Text:
                    </span>
                    <div
                      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', lineHeight: '1.6' }}
                      className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 whitespace-pre-wrap max-h-80 overflow-y-auto"
                    >
                      {bodyText || 'No edited content'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signature Configuration Section */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileSignature className="w-3.5 h-3.5 text-amber-400" />
                Choose / Configure Signature:
              </span>
              <button
                type="button"
                onClick={() => setIsCustomSigOpen(!isCustomSigOpen)}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                {isCustomSigOpen ? 'Use Preset Signature' : 'Edit / Build Custom Signature'}
              </button>
            </div>

            {!isCustomSigOpen ? (
              <div className="flex gap-3">
                <select
                  value={selectedSignatureId}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomSigOpen(true);
                      setSelectedSignatureId('custom');
                    } else {
                      setSelectedSignatureId(e.target.value);
                    }
                  }}
                  className="flex-1 h-9 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-200 px-3 focus:border-amber-500 focus:outline-none"
                >
                  {signatures.map((sig) => (
                    <option key={sig.id} value={sig.id}>
                      {sig.name} {sig.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                  <option value="__custom__">✎ Create / Build Custom Signature...</option>
                </select>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-slate-900 border border-amber-500/30 space-y-3 animate-in fade-in">
                <span className="text-[11px] font-semibold text-amber-300 block uppercase tracking-wider">
                  Custom Signature Builder
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Full Name</label>
                    <Input
                      value={customSigName}
                      onChange={(e) => setCustomSigName(e.target.value)}
                      placeholder="e.g. Abdullah Rauf"
                      className="h-8 text-xs bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Title / Designation</label>
                    <Input
                      value={customSigTitle}
                      onChange={(e) => setCustomSigTitle(e.target.value)}
                      placeholder="e.g. Head of Sales"
                      className="h-8 text-xs bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Company</label>
                    <Input
                      value={customSigCompany}
                      onChange={(e) => setCustomSigCompany(e.target.value)}
                      placeholder="e.g. Minetech Resources BV – Belgium"
                      className="h-8 text-xs bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Direct Phone</label>
                    <Input
                      value={customSigPhone}
                      onChange={(e) => setCustomSigPhone(e.target.value)}
                      placeholder="e.g. +32 486 287 751"
                      className="h-8 text-xs bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Email Address</label>
                    <Input
                      value={customSigEmail}
                      onChange={(e) => setCustomSigEmail(e.target.value)}
                      placeholder="e.g. rauf@mine-tech.be"
                      className="h-8 text-xs bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Website</label>
                    <Input
                      value={customSigWebsite}
                      onChange={(e) => setCustomSigWebsite(e.target.value)}
                      placeholder="e.g. www.mine-tech.be"
                      className="h-8 text-xs bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">BTW / Legal Addresses / Disclaimer</label>
                  <Textarea
                    value={customSigExtra}
                    onChange={(e) => setCustomSigExtra(e.target.value)}
                    rows={2}
                    className="text-xs bg-slate-950 border-slate-700 text-white resize-none"
                    placeholder="BTW No., Registration, Warehouse address..."
                  />
                </div>
              </div>
            )}

            {/* Workspace-wide propagation checkbox */}
            <label className="flex items-center gap-2 pt-1 text-xs text-amber-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applySignatureToAll}
                onChange={(e) => setApplySignatureToAll(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
              />
              <span>Apply this signature to all {allDrafts.length} emails in workspace</span>
            </label>
          </div>

          {/* Document & Attachment Library Section */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-amber-400" />
                  Attached Documents ({attachedDocIds.length} attached)
                </span>
                <p className="text-[11px] text-slate-500">
                  Select brochures, technical data sheets, and certificates for this company.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => localFileInputRef.current?.click()}
                  disabled={uploadingAttachment}
                  className="h-7 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                >
                  {uploadingAttachment ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Upload className="w-3 h-3 mr-1 text-amber-400" />
                  )}
                  Upload File from Computer
                </Button>
                <input
                  type="file"
                  ref={localFileInputRef}
                  onChange={handleLocalFileUpload}
                  className="hidden"
                />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDocLibrary(!showDocLibrary)}
                  className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  {showDocLibrary ? 'Close Library' : 'Browse Library'}
                </Button>
              </div>
            </div>

            {/* List of currently attached documents */}
            {attachedDocIds.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {documents
                  .filter((d) => attachedDocIds.includes(d.id))
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>{doc.name}</span>
                      <span className="text-[10px] text-slate-500">({doc.fileSize})</span>
                      <button
                        type="button"
                        onClick={() => toggleDocumentAttachment(doc)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {/* Document Library Selection Drawer */}
            {showDocLibrary && (
              <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 max-h-56 overflow-y-auto">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Available MineTech Library Documents:
                </span>
                <div className="space-y-1.5">
                  {documents.map((doc) => {
                    const isAttached = attachedDocIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleDocumentAttachment(doc)}
                        className={`p-2 rounded border cursor-pointer text-xs flex items-center justify-between transition-colors ${
                          isAttached
                            ? 'border-amber-500/60 bg-amber-500/10 text-white'
                            : 'border-slate-800 hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <span className="font-medium text-slate-200">{doc.name}</span>
                            <span className="text-[10px] text-slate-500 ml-2">({doc.category} • {doc.fileSize})</span>
                          </div>
                        </div>

                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isAttached ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-600'
                          }`}
                        >
                          {isAttached && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Workspace-wide propagation checkbox */}
            <label className="flex items-center gap-2 pt-1 text-xs text-amber-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyAttachmentsToAll}
                onChange={(e) => setApplyAttachmentsToAll(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
              />
              <span>Attach these files ({attachedDocIds.length}) to all {allDrafts.length} emails in workspace</span>
            </label>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Current Status:</span>
            {approvalStatus === 'approved' && !isModifiedAfterApproval ? (
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved by You
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Needs Review
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancel
            </Button>

            {approvalStatus === 'approved' && (
              <Button
                variant="outline"
                onClick={() => handleSave(false, false, true)}
                disabled={loading}
                className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs"
              >
                Remove Approval
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => handleSave(false, false)}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Save Draft
            </Button>

            <Button
              onClick={() => handleSave(true, false)}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5 mr-0.5" />
              Approve Email
            </Button>

            {currentIndex < allDrafts.length - 1 && (
              <Button
                onClick={() => handleSave(true, true)}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow flex items-center gap-1"
              >
                Approve & Next
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Rematch Lead Sub-Modal */}
      <RematchCompanyModal
        isOpen={isRematchOpen}
        onClose={() => setIsRematchOpen(false)}
        draft={draft}
        onMatched={(updatedDrafts) => {
          onSaveDraft?.(updatedDrafts);
        }}
      />
    </div>
  );
}
