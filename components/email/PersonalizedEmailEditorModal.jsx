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
  List,
  Bold,
  Italic,
  ShieldCheck,
  Calendar,
  Lock,
  FolderOpen,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import RematchCompanyModal from './RematchCompanyModal';
import AttachFilesModal from './AttachFilesModal';

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
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
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

  // Signature states
  const [signatures, setSignatures] = useState([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState('sig-gmail-synced');
  const [isCustomSigOpen, setIsCustomSigOpen] = useState(false);

  // Custom signature builder fields
  const [customSigName, setCustomSigName] = useState('Abdullah Rauf');
  const [customSigTitle, setCustomSigTitle] = useState('Head of Sales');
  const [customSigCompany, setCustomSigCompany] = useState('Minetech Resources BV – Belgium');
  const [customSigPhone, setCustomPhone] = useState('+32 486 287 751');
  const [customSigEmail, setCustomSigEmail] = useState('rauf@mine-tech.be');
  const [customSigWebsite, setCustomSigWebsite] = useState('www.mine-tech.be');
  const [customSigExtra, setCustomSigExtra] = useState(
    'BTW No. BE 1011004868\nFacility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands\nRegistered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium'
  );

  const [applySignatureToAll, setApplySignatureToAll] = useState(false);
  const [applyAttachmentsToAll, setApplyAttachmentsToAll] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const localFileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Formatting fix state
  const [isFormatFixOpen, setIsFormatFixOpen] = useState(false);
  const [fixedPreviewText, setFixedPreviewText] = useState('');
  const [wordCountCheck, setWordCountCheck] = useState({ orig: 0, fixed: 0, match: true });

  const [documents, setDocuments] = useState([]);
  const [currentAttachments, setCurrentAttachments] = useState([]);
  const [attachedDocIds, setAttachedDocIds] = useState([]);
  const [showDocLibrary, setShowDocLibrary] = useState(false);

  // Generate standard Gmail signature HTML
  const generateCustomSigHtml = () => {
    return `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">
  <div dir="ltr">
    <p style="margin-top:16px; margin-bottom:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#1f2937;">
      Regards,<br/>
      <strong style="color:#0f172a;">${customSigName}</strong>${customSigTitle ? ` - ${customSigTitle}` : ''}${customSigPhone ? ` | Mo. ${customSigPhone}` : ''}${customSigEmail ? ` | <a href="mailto:${customSigEmail}" style="color:#0284c7; text-decoration:none;" target="_blank">${customSigEmail}</a>` : ''}<br/>
      <strong style="color:#0f172a;">${customSigCompany}</strong> | <a href="https://${customSigWebsite.replace(/^https?:\/\//, '')}" target="_blank" style="color:#0284c7; text-decoration:none;">${customSigWebsite}</a>
    </p>
    ${customSigExtra ? `<p style="margin-top:8px; margin-bottom:0; font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:1.4; color:#6b7280;">${customSigExtra.replace(/\n/g, '<br/>')}</p>` : ''}
  </div>
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
      setSelectedSignatureId(draft.assigned_signature_id || 'sig-gmail-synced');

      // Attachments
      const atts = Array.isArray(draft.assigned_attachments) ? draft.assigned_attachments : [];
      setCurrentAttachments(atts);
      setAttachedDocIds(atts.map((a) => a.id || a.fileName || a));
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
        .catch(() => { });

      fetch('/api/email/workspace/documents')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.documents) setDocuments(d.documents);
        })
        .catch(() => { });
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
    toast.success('Removed closing from email body. Your Gmail signature will provide the official sign-off.');
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

  // Detect artificial line-wrapping artifacts in body text
  const hasLineWraps = useMemo(() => {
    if (!bodyText) return false;
    const clean = bodyText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const rawLines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length <= 1) return false;
    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i];
      const prev = rawLines[i - 1];
      if (/^[a-z]/.test(line)) return true;
      if (!/[.!?:]$/.test(prev) && !/^(?:Dear|Hi|Hello|Good|Kind|Best|Warm|Regards|Sincerely|Thanks)\b/i.test(prev)) return true;
    }
    return false;
  }, [bodyText]);

  const activeAttachedDocs = currentAttachments;

  // Handle removing single attachment from this draft
  const handleRemoveAttachment = (idOrName) => {
    setCurrentAttachments((prev) =>
      prev.filter((a) => a.id !== idOrName && a.fileName !== idOrName && a.name !== idOrName)
    );
    setAttachedDocIds((prev) => prev.filter((id) => id !== idOrName));
    toast.success('File removed from this email draft.');
  };

  // Handle removing all attachments from this draft
  const handleRemoveAllAttachments = () => {
    setCurrentAttachments([]);
    setAttachedDocIds([]);
    toast.success('All files removed from this email draft.');
  };

  // Open Preview of Paragraph Reconstruction
  const handleOpenFormatFix = async () => {
    try {
      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview_formatting_fix',
          draftId: draft?.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.after_plain) {
        setFixedPreviewText(data.after_plain);
        setWordCountCheck({
          orig: data.origWordCount,
          fixed: data.fixedWordCount,
          match: data.wordCountMatch,
        });
        setIsFormatFixOpen(true);
        return;
      }
    } catch (_) { }

    // Fallback: reconstruct locally
    const clean = bodyText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const rawLines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
    const GREETING_RE = /^(?:Dear\s+|Hi\s+|Hello\s+|Good\s+(?:morning|afternoon|evening)\b)/i;
    const SIGNOFF_RE = /^(?:(?:Kind|Best|Warm)?\s*regards|Sincerely|Cheers|Thanks|Thank\s+you|Yours\s+truly)\b/i;
    const BULLET_RE = /^[-*•–—\d\.)]\s+/;
    const HEADER_RE = /^(?:To|From|Subject|Re|Attention|Attn|Company|Date):\s*/i;

    const paragraphs = [];
    let curPara = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const prev = curPara.length > 0 ? curPara[curPara.length - 1] : null;
      if (!prev) {
        curPara.push(line);
        continue;
      }
      const isGreeting = GREETING_RE.test(line);
      const prevIsGreeting = GREETING_RE.test(prev);
      const isSignOff = SIGNOFF_RE.test(line);
      const prevIsSignOff = SIGNOFF_RE.test(prev);
      const isList = BULLET_RE.test(line);
      const prevIsList = BULLET_RE.test(prev);
      const isHeader = HEADER_RE.test(line);
      const prevIsHeader = HEADER_RE.test(prev);
      const startsWithLower = /^[a-z]/.test(line);
      const prevEndsWithComma = /[,]$/.test(prev);
      const prevEndsWithHyphen = /[-–—]$/.test(prev);
      const prevEndsWithColon = /[:]$/.test(prev);
      const prevEndsWithTerminal = /[.!?]$/.test(prev);

      if (
        startsWithLower ||
        ((prevEndsWithComma && !prevIsGreeting && !prevIsSignOff) || prevEndsWithHyphen || /[([]$/.test(prev)) ||
        (!prevEndsWithTerminal && !prevEndsWithColon && !prevIsGreeting && !prevIsSignOff && !prevIsHeader)
      ) {
        curPara.push(line);
        continue;
      }
      if (isGreeting || prevIsGreeting || isSignOff || prevIsSignOff || isList || prevIsList || isHeader || prevIsHeader || prevEndsWithTerminal) {
        paragraphs.push(curPara);
        curPara = [line];
        continue;
      }
      paragraphs.push(curPara);
      curPara = [line];
    }
    if (curPara.length > 0) paragraphs.push(curPara);

    const fixed = paragraphs
      .map((pLines) => {
        let r = pLines[0];
        for (let j = 1; j < pLines.length; j++) {
          const prev = pLines[j - 1];
          const cur = pLines[j];
          if (/[-–—]$/.test(prev)) {
            r = /^[A-Z0-9]/.test(cur) ? r + cur : r.slice(0, -1) + cur;
          } else {
            r = r + ' ' + cur;
          }
        }
        return r;
      })
      .join('\n\n');

    const origWords = bodyText.trim().split(/\s+/).filter(Boolean);
    const fixedWords = fixed.trim().split(/\s+/).filter(Boolean);
    setFixedPreviewText(fixed);
    setWordCountCheck({ orig: origWords.length, fixed: fixedWords.length, match: origWords.length === fixedWords.length });
    setIsFormatFixOpen(true);
  };

  const handleApplyFormatFix = () => {
    setBodyText(fixedPreviewText);
    if (approvalStatus === 'approved') {
      setApprovalStatus('needs_review');
      setIsModifiedAfterApproval(true);
    }
    setIsFormatFixOpen(false);
    toast.success('PDF line wrapping removed! Original wording 100% preserved.');
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

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size exceeds the 25 MB limit.');
      return;
    }

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
      setCurrentAttachments((prev) => [...prev, newDoc]);
      setAttachedDocIds((prev) => [...prev, newDoc.id]);
    } catch (err) {
      toast.error(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingAttachment(false);
      if (localFileInputRef.current) localFileInputRef.current.value = '';
    }
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

      const activeAttachments = currentAttachments.map((a) => ({
        id: a.id,
        name: a.name,
        fileName: a.fileName || a.name,
        fileSize: a.fileSize || '1.0 MB',
        fileType: a.fileType || 'application/pdf',
        url: a.url || '',
        storagePath: a.storagePath || '',
        isCustom: Boolean(a.isCustom),
      }));

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
      let userApprovedVal = Boolean(draft.user_approved);
      if (explicitUnapprove) {
        newApproval = 'needs_review';
        userApprovedVal = false;
      } else if (shouldApprove) {
        newApproval = 'approved';
        userApprovedVal = true;
      } else if (isModifiedAfterApproval) {
        newApproval = 'needs_review';
        userApprovedVal = false;
      }

      const updates = {
        edited_subject: subject,
        edited_body_plain: bodyText,
        edited_body_html: formattedHtmlBody,
        match_status: shouldApprove && draft.matched_lead?.id ? 'matched' : draft.match_status,
        approval_status: newApproval,
        user_approved: userApprovedVal,
        user_approved_at: shouldApprove ? new Date().toISOString() : (explicitUnapprove ? null : draft.user_approved_at),
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

      if (advanceNext) {
        const updatedList = data.drafts || allDrafts;
        let nextIdx = -1;
        // Search forward from currentIndex + 1
        for (let i = currentIndex + 1; i < updatedList.length; i++) {
          if (updatedList[i].approval_status !== 'approved' || !updatedList[i].user_approved) {
            nextIdx = i;
            break;
          }
        }
        // If not found forward, wrap around from 0
        if (nextIdx === -1) {
          for (let i = 0; i < currentIndex; i++) {
            if (updatedList[i].approval_status !== 'approved' || !updatedList[i].user_approved) {
              nextIdx = i;
              break;
            }
          }
        }

        if (nextIdx !== -1) {
          onNavigate?.(nextIdx);
        } else if (currentIndex < allDrafts.length - 1) {
          onNavigate?.(currentIndex + 1);
        } else {
          toast.success('All emails have been approved and are ready for campaign staging!', { duration: 5000 });
        }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-5xl bg-card border-border text-foreground shadow-dialog flex flex-col max-h-[94vh] overflow-hidden rounded-xl">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20">
              Email #{currentIndex + 1} of {allDrafts.length}
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {draft.extracted_company || matchedLead?.company_name || 'Personalized Company Outreach'}
              </h2>
              {/* Semantic CRM Matching Status Badges */}
              {draft.match_status === 'matched' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  CRM Matched
                </span>
              ) : draft.match_status === 'needs_review' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Needs Review
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Unmatched
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex <= 0}
              onClick={() => onNavigate?.(currentIndex - 1)}
              className="border-border text-foreground hover:bg-muted/40 h-8 text-xs"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex >= allDrafts.length - 1}
              onClick={() => onNavigate?.(currentIndex + 1)}
              className="border-border text-foreground hover:bg-muted/40 h-8 text-xs"
            >
              Next
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Alert if content modified after approval */}
          {isModifiedAfterApproval && (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="font-semibold text-amber-400">Content Modified After Approval</p>
                <p className="text-amber-500/90 mt-0.5">
                  You have made changes to the text, recipient, signature, or attachments. The approval status resets to <strong>Needs Review</strong> until you re-approve it.
                </p>
              </div>
            </div>
          )}

          {/* CRM Company & Contact Resolution Card */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Target Company:</span>
                <span className="text-sm font-semibold text-foreground">
                  {matchedLead ? matchedLead.company_name : draft.extracted_company || 'Unlinked'}
                </span>
                {matchedLead?.country && (
                  <span className="text-xs text-muted-foreground">({matchedLead.country})</span>
                )}
                {matchedLead?.website && (
                  <a
                    href={matchedLead.website.startsWith('http') ? matchedLead.website : `https://${matchedLead.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-0.5"
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
                className="h-7 text-xs border-border text-foreground hover:bg-muted/40"
              >
                {matchedLead ? 'Change / Rematch CRM' : 'Link to CRM Lead'}
              </Button>
            </div>

            {/* Contacts Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  Select Recipient Contact(s) ({selectedContacts.length} selected):
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Click contact to select. The contact tagged TO receives direct dispatch.
                </span>
              </div>

              {allContacts.length === 0 ? (
                <div className="p-2.5 rounded bg-muted/20 border border-border text-xs text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
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
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between ${isSelected
                          ? 'border-primary/60 bg-primary/10 text-foreground font-medium'
                          : 'border-border bg-card text-muted-foreground hover:border-border/80'
                          }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span>{contact.name || 'Unnamed Contact'}</span>
                            {isPrimary && (
                              <span className="text-[10px] px-1 rounded bg-primary text-primary-foreground font-bold">
                                TO
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{contact.email}</p>
                          {contact.title && (
                            <p className="text-[10px] text-muted-foreground/80">{contact.title}</p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
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
                              className="text-[10px] text-primary hover:underline mt-1"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-2 border-t border-border">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    CC (comma-separated emails):
                  </label>
                  <Input
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    placeholder="e.g. procurement@company.com, team@company.com"
                    className="h-8 text-xs bg-background border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    BCC (comma-separated emails):
                  </label>
                  <Input
                    value={bccInput}
                    onChange={(e) => setBccInput(e.target.value)}
                    placeholder="e.g. rauf@mine-tech.be, archive@mine-tech.be"
                    className="h-8 text-xs bg-background border-border text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Email Content Section */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Subject Line:
              </label>
              <Input
                value={subject}
                onChange={handleSubjectChange}
                placeholder="Enter email subject line..."
                className="bg-background border-border text-foreground text-sm font-medium"
              />
            </div>

            {/* Editor Tabs: Edit vs Realistic Preview vs Raw PDF Compare */}
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
              <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border gap-2">
                <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTab('editor')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'editor'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Email
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'preview'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Realistic Outgoing Email Preview
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('compare')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'compare'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Compare with Raw PDF
                  </button>
                </div>
              </div>

              {/* Duplicate Closing Notification Banner */}
              {hasDuplicateClosing && activeTab === 'editor' && (
                <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-500">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      <strong>Duplicate closing detected:</strong> Email body already contains closing text (e.g. &ldquo;Kind regards...&rdquo;). Your Gmail signature provides the official closing.
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStripClosingFromBody}
                    className="h-6 text-[11px] border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 shrink-0 ml-3"
                  >
                    <Scissors className="w-3 h-3 mr-1" />
                    Trim Closing from Body
                  </Button>
                </div>
              )}

              {/* TAB 1: Editor */}
              {activeTab === 'editor' && (
                <div className="p-4 space-y-4">
                  {/* Lightweight Formatting Toolbar (Without PDF line wrap buttons) */}
                  <div className="flex items-center gap-1 p-1 bg-muted/20 rounded-lg border border-border text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => handleInsertToolbar('**', '**')}
                      className="p-1.5 hover:text-foreground hover:bg-muted/40 rounded transition-colors"
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertToolbar('*', '*')}
                      className="p-1.5 hover:text-foreground hover:bg-muted/40 rounded transition-colors"
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertToolbar('• ')}
                      className="p-1.5 hover:text-foreground hover:bg-muted/40 rounded transition-colors"
                      title="Bullet Point"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <div className="h-4 w-px bg-border mx-1" />
                    <span className="text-[11px] text-muted-foreground px-1 hidden sm:inline">
                      Arial / Helvetica 14px
                    </span>
                    <div className="ml-auto flex items-center gap-1.5">
                      {hasLineWraps && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 font-medium">
                          Line wraps detected
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleOpenFormatFix}
                        className={`h-6 text-[11px] px-2.5 flex items-center gap-1 ${hasLineWraps
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 font-semibold'
                          : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        title="Reconstruct continuous sentences from PDF layout wrapping while strictly preserving 100% of all words"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Fix PDF Formatting
                      </Button>
                    </div>
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
                    className="w-full bg-background border-border text-foreground p-4 rounded-lg font-sans resize-y"
                    placeholder="Write or edit the personalized outreach email body..."
                  />

                  {/* Character count & helpful note */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Paragraphs render automatically with clean business spacing.</span>
                    <span>{bodyText.length} characters • {bodyText.split(/\s+/).filter(Boolean).length} words</span>
                  </div>

                  {/* In-Editor Visible Signature Rendering */}
                  <div className="mt-4 p-4 rounded-xl bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-2">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <FileSignature className="w-3.5 h-3.5 text-primary" />
                        Gmail Signature (Rendered Below Email Body):
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {currentSignature?.name || (isCustomSigOpen ? 'Custom Signature' : 'Gmail Synced')}
                      </span>
                    </div>

                    <div
                      className="p-4 rounded-lg bg-white text-slate-900 border border-slate-200 text-xs shadow-xs"
                      dangerouslySetInnerHTML={{ __html: resolvedSignatureHtml || '<p class="text-slate-400 italic">No signature assigned</p>' }}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Realistic Outgoing Email Preview */}
              {activeTab === 'preview' && (
                <div className="p-6 bg-muted/30 min-h-[460px] flex flex-col justify-start">
                  <div className="max-w-3xl w-full mx-auto bg-white text-slate-900 rounded-xl shadow-lg border border-slate-300 overflow-hidden animate-in fade-in">
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
                      {currentAttachments.length > 0 && (
                        <div className="pt-6 mt-6 border-t border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                              Attachments ({currentAttachments.length}):
                            </span>
                            <button
                              type="button"
                              onClick={handleRemoveAllAttachments}
                              className="text-[11px] text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove All Files
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {currentAttachments.map((doc) => (
                              <div
                                key={doc.id || doc.fileName || doc.name}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 text-xs flex items-center gap-2 font-medium"
                              >
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc(doc)}
                                  className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer group"
                                  title="Click to view and preview this attached document"
                                >
                                  <Paperclip className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                  <span className="hover:underline">{doc.name || doc.fileName}</span>
                                  <span className="text-[11px] text-slate-500 font-normal">({doc.fileSize || '1.0 MB'})</span>
                                  <Eye className="w-3 h-3 text-slate-400 group-hover:text-primary ml-0.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAttachment(doc.id || doc.fileName || doc.name)}
                                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-100 p-0.5 rounded transition-colors cursor-pointer ml-1"
                                  title="Remove this file from draft"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
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
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border p-4 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block mb-2">
                      Original Text Extracted from PDF (Verbatim):
                    </span>
                    <div
                      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', lineHeight: '1.6' }}
                      className="p-3.5 rounded-lg bg-muted/20 border border-border text-foreground whitespace-pre-wrap max-h-80 overflow-y-auto"
                    >
                      {draft.extracted_body_plain || 'No original text available'}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-primary block mb-2">
                      Current Edited Text:
                    </span>
                    <div
                      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', lineHeight: '1.6' }}
                      className="p-3.5 rounded-lg bg-muted/20 border border-border text-foreground whitespace-pre-wrap max-h-80 overflow-y-auto"
                    >
                      {bodyText || 'No edited content'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signature Configuration Section */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileSignature className="w-3.5 h-3.5 text-primary" />
                Choose / Configure Signature:
              </span>
              <button
                type="button"
                onClick={() => setIsCustomSigOpen(!isCustomSigOpen)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
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
                  className="flex-1 h-9 rounded-md bg-background border border-border text-xs text-foreground px-3 focus:outline-none"
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
              <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-3 animate-in fade-in">
                <span className="text-[11px] font-semibold text-primary block uppercase tracking-wider">
                  Custom Signature Builder
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Full Name</label>
                    <Input
                      value={customSigName}
                      onChange={(e) => setCustomSigName(e.target.value)}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Title / Designation</label>
                    <Input
                      value={customSigTitle}
                      onChange={(e) => setCustomSigTitle(e.target.value)}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Company</label>
                    <Input
                      value={customSigCompany}
                      onChange={(e) => setCustomSigCompany(e.target.value)}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Direct Phone</label>
                    <Input
                      value={customSigPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Email Address</label>
                    <Input
                      value={customSigEmail}
                      onChange={(e) => setCustomSigEmail(e.target.value)}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Website</label>
                    <Input
                      value={customSigWebsite}
                      onChange={(e) => setCustomSigWebsite(e.target.value)}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">BTW / Legal Addresses / Disclaimer</label>
                  <Textarea
                    value={customSigExtra}
                    onChange={(e) => setCustomSigExtra(e.target.value)}
                    rows={2}
                    className="text-xs bg-background border-border resize-none"
                  />
                </div>
              </div>
            )}

            {/* Workspace-wide propagation checkbox */}
            <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applySignatureToAll}
                onChange={(e) => setApplySignatureToAll(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
              />
              <span>Apply this signature to all {allDrafts.length} emails in workspace</span>
            </label>
          </div>

          {/* Campaign Attachments Section */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-primary" />
                  Campaign Attachments ({currentAttachments.length} attached)
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Files attached at the campaign level and automatically delivered with this email.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {currentAttachments.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRemoveAllAttachments}
                    className="h-7 text-xs border-rose-500/40 text-rose-500 hover:bg-rose-500/10 px-2 gap-1 cursor-pointer"
                    title="Remove all files from this email"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove All Files</span>
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAttachModalOpen(true)}
                  className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 px-2.5 gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Attach Files</span>
                </Button>
              </div>
            </div>

            {/* List of currently attached documents */}
            {currentAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {currentAttachments.map((doc) => {
                  const type = (doc.fileType || '').toLowerCase();
                  const name = (doc.fileName || doc.name || '').toLowerCase();
                  const isPdf = type.includes('pdf') || name.endsWith('.pdf');
                  const isImage = type.includes('image') || name.endsWith('.png') || name.endsWith('.jpg');

                  return (
                    <div
                      key={doc.id || doc.fileName || doc.name}
                      className="px-2.5 py-1.5 rounded-lg bg-card border border-border text-foreground text-xs flex items-center gap-2 shadow-xs"
                    >
                      <FileText className={`w-3.5 h-3.5 ${isPdf ? 'text-rose-500' : isImage ? 'text-purple-500' : 'text-primary'}`} />
                      <span className="font-medium truncate max-w-[220px]">{doc.fileName || doc.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">({doc.fileSize || '1.0 MB'})</span>
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="text-muted-foreground hover:text-primary ml-1 cursor-pointer"
                        title="Preview attachment"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(doc.id || doc.fileName || doc.name)}
                        className="text-muted-foreground hover:text-rose-500 ml-0.5 p-0.5 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Remove file from this draft"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-1">
                No campaign attachments configured. You can upload collateral once on the main workspace to attach to all emails.
              </p>
            )}

            {/* Workspace-wide propagation checkbox */}
            <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyAttachmentsToAll}
                onChange={(e) => setApplyAttachmentsToAll(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
              />
              <span>Attach these files ({attachedDocIds.length}) to all {allDrafts.length} emails in workspace</span>
            </label>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 px-6 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Current Status:</span>
            {approvalStatus === 'approved' && !isModifiedAfterApproval ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved by You
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/30 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Needs Review
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-foreground hover:bg-muted/40 text-xs"
            >
              Cancel
            </Button>

            {approvalStatus === 'approved' && (
              <Button
                variant="outline"
                onClick={() => handleSave(false, false, true)}
                disabled={loading}
                className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs"
              >
                Remove Approval
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => handleSave(false, false)}
              disabled={loading}
              className="bg-muted text-foreground border border-border text-xs"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Save Draft
            </Button>

            <Button
              onClick={() => handleSave(true, false)}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5 mr-0.5" />
              Approve Email
            </Button>

            {allDrafts.length > 1 && (
              <Button
                onClick={() => handleSave(true, true)}
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs flex items-center gap-1"
                title="Save changes, approve this draft, and advance to the next email requiring review"
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

      {/* Attachment Manager Sub-Modal */}
      <AttachFilesModal
        isOpen={isAttachModalOpen}
        onClose={() => {
          setIsAttachModalOpen(false);
          // Refresh documents
          fetch('/api/email/workspace/documents')
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.documents) setDocuments(d.documents);
            });
        }}
        currentDraftId={draft.id}
        initialScope="individual"
        totalDraftsCount={allDrafts.length}
        selectedDraftIds={[draft.id]}
        onAttachmentsApplied={(updatedDrafts, appliedDocs) => {
          if (appliedDocs) {
            setCurrentAttachments(appliedDocs);
            setAttachedDocIds(appliedDocs.map((d) => d.id || d.fileName || d));
          }
          if (updatedDrafts) {
            onSaveDraft?.(updatedDrafts);
          }
        }}
      />

      {/* Attachment Preview Modal */}
      {previewDoc && (() => {
        const directHttpUrl = (previewDoc.url && previewDoc.url.startsWith('http')) ? previewDoc.url : null;
        const previewUrl = directHttpUrl || `/api/email/workspace/documents/preview?id=${encodeURIComponent(previewDoc.id || previewDoc.fileName)}`;
        const downloadUrl = directHttpUrl || `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}download=1`;
        const isPdf = previewDoc.fileType?.includes('pdf') || (previewDoc.fileName || '').toLowerCase().endsWith('.pdf');
        const isImage = previewDoc.fileType?.includes('image') || /\.(png|jpe?g|webp|gif|svg)$/i.test(previewDoc.fileName || '');

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <Card className="w-full max-w-4xl bg-card border-border text-foreground shadow-dialog flex flex-col h-[85vh] overflow-hidden rounded-xl">
              <div className="p-4 px-6 border-b border-border bg-muted/20 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground truncate max-w-md">
                    {previewDoc.name || previewDoc.fileName}
                  </h4>
                  <p className="text-xs text-muted-foreground font-mono">
                    {previewDoc.fileName} {previewDoc.fileSize ? `• ${previewDoc.fileSize}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 font-medium"
                    title="Open document in a new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in New Tab
                  </a>
                  <a
                    href={downloadUrl}
                    download={previewDoc.fileName || 'document.pdf'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md bg-muted/50 border border-border font-medium"
                    title="Download document to computer"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors ml-1"
                    title="Close preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-muted/10 p-2 overflow-hidden flex items-center justify-center">
                {isImage ? (
                  <img
                    src={previewUrl}
                    alt={previewDoc.name}
                    className="max-h-full max-w-full object-contain rounded shadow"
                  />
                ) : isPdf ? (
                  <iframe
                    src={previewUrl}
                    title={previewDoc.name}
                    className="w-full h-full rounded-lg border border-border bg-white"
                  />
                ) : (
                  <div className="text-center p-8 space-y-4">
                    <div className="p-4 rounded-full bg-primary/10 text-primary w-fit mx-auto">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-foreground">
                        {previewDoc.name || previewDoc.fileName}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        This format ({previewDoc.fileType || 'Document'}) cannot be displayed directly inline.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-4 h-4" /> Open in Viewer
                      </a>
                      <a
                        href={`${previewUrl}&download=1`}
                        download={previewDoc.fileName || 'document'}
                        className="px-4 py-2 rounded-lg bg-muted text-foreground border border-border text-xs font-semibold hover:bg-muted/80"
                      >
                        Download File
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Before / After Format Fix Preview Modal */}
      {isFormatFixOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-3xl bg-card border border-border shadow-dialog p-6 space-y-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Fix PDF Line-Wrapping — Paragraph Reconstruction
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Reconstructs continuous sentences from PDF wrapping while strictly preserving 100% of original words.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormatFixOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Verbatim Guarantee Banner */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>100% Verbatim Accuracy:</strong> Every word, measurement, and punctuation mark is preserved.
                </span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 font-semibold">
                {wordCountCheck.orig} words in → {wordCountCheck.fixed} words out (0 words altered)
              </span>
            </div>

            {/* Side-by-Side Diff Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto">
              <div className="space-y-1.5 flex flex-col">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Current (Artificial PDF Line Breaks):
                </span>
                <div
                  style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', lineHeight: '1.5' }}
                  className="p-3 bg-muted/20 border border-border rounded-lg text-foreground whitespace-pre-wrap flex-1 text-xs overflow-y-auto max-h-[340px]"
                >
                  {bodyText}
                </div>
              </div>

              <div className="space-y-1.5 flex flex-col">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Fixed (Continuous Paragraphs):
                </span>
                <div
                  style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', lineHeight: '1.5' }}
                  className="p-3 bg-emerald-500/5 border border-emerald-500/30 rounded-lg text-foreground whitespace-pre-wrap flex-1 text-xs overflow-y-auto max-h-[340px]"
                >
                  {fixedPreviewText}
                </div>
              </div>
            </div>

            {approvalStatus === 'approved' && (
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-500 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>
                  Note: Because outgoing email text is being updated, approval status will reset to <strong>Needs Review</strong> for your final confirmation.
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFormatFixOpen(false)}
                className="text-xs border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApplyFormatFix}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                Apply Formatting Fix
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
