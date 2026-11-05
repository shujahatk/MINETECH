'use client';
import { ModalFrame } from '@/components/ui/modal-frame';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Users,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Flame,
  FileText,
  Mail,
  Sliders,
  Radio,
  Bot,
  RefreshCw,
  Zap,
  Globe,
  Clock,
  Lock,
  X,
  Smartphone,
  Monitor,
  Copy,
  Info,
  Trash2,
  Brain,
  Compass,
  TrendingUp,
  MessageSquare,
  Check,
  Lightbulb,
  Layers,
  Wand2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const CAMPAIGN_TEMPLATES = [
  {
    id: 'initial_outreach',
    name: 'Initial Outreach',
    description: 'Direct, value-first introduction to MineTech mineral supply and processing capabilities.',
    defaultPrompt: 'Introduce MineTech high-grade industrial mineral solutions (kaolin, calcined chamotte, bentonite) with guaranteed assay consistency and European warehousing in Lamswaarde.',
    defaultGoal: 'Book a 15-min Discovery Call',
    defaultTone: 'Direct',
  },
  {
    id: 'follow_up',
    name: 'Follow-Up Email',
    description: 'Polite, value-additive follow-up referencing prior outreach without pressure or guilt.',
    defaultPrompt: 'Follow up on our previous note regarding industrial mineral supply specifications, technical assays, and laboratory sample testing.',
    defaultGoal: 'Gauge interest (Soft CTA)',
    defaultTone: 'Professional',
  },
  {
    id: 'personalized_b2b',
    name: 'Personalized B2B Outreach',
    description: 'Deeply tailored message connecting prospect operational focus with specific mineral grades.',
    defaultPrompt: 'Tailor specifically to their manufacturing and refractory requirements with emphasis on certified technical data sheets (TDS) and supply security.',
    defaultGoal: 'Book a 15-min Discovery Call',
    defaultTone: 'Professional',
  },
  {
    id: 'professional_intro',
    name: 'Professional Introduction',
    description: 'Executive-level corporate introduction highlighting Lamswaarde warehouse footprint.',
    defaultPrompt: 'Executive introduction presenting MineTech Resources BV industrial distribution platform and strategic European supply reliability.',
    defaultGoal: 'Book a 15-min Discovery Call',
    defaultTone: 'Professional',
  },
  {
    id: 'meeting_request',
    name: 'Meeting Request',
    description: 'Specific, low-friction invitation to a brief 10-minute technical review call.',
    defaultPrompt: 'Request a brief 10-minute call to compare current mineral grade benchmarks against MineTech certified assay specifications.',
    defaultGoal: 'Book a 15-min Discovery Call',
    defaultTone: 'Direct',
  },
  {
    id: 're_engagement',
    name: 'Re-Engagement Campaign',
    description: 'Gentle re-activation for dormant leads or uncompleted procurement conversations.',
    defaultPrompt: 'Re-open dialogue for upcoming quarterly industrial mineral procurement and contract review.',
    defaultGoal: 'Gauge interest (Soft CTA)',
    defaultTone: 'Friendly',
  },
];

const SAMPLE_LEADS = [
  {
    firstName: 'Abdullah',
    lastName: 'Rauf',
    fullName: 'Abdullah Rauf',
    company: 'MineTech Resources BV',
    jobTitle: 'Commercial Director',
    industry: 'Industrial Minerals & Ceramics',
    website: 'https://www.mine-tech.be',
  },
  {
    firstName: 'Sarah',
    lastName: 'Connor',
    fullName: 'Sarah Connor',
    company: 'Cyberdyne Systems',
    jobTitle: 'VP of Engineering',
    industry: 'Robotics & Automation',
    website: 'https://www.cyberdyne.io',
  },
  {
    firstName: 'Marcus',
    lastName: 'Vance',
    fullName: 'Marcus Vance',
    company: 'Vanguard Dynamics',
    jobTitle: 'Head of Procurement',
    industry: 'Refractory & Metallurgy',
    website: 'https://www.vanguard-dynamics.com',
  },
];

export default function BlastWizard({ onClose, onCreated, onUpdated, campaign = null }) {
  const isEditing = Boolean(campaign && (campaign.id || campaign._id));
  const campaignId = campaign ? (campaign.id || campaign._id) : null;

  // Tabs: 'recipients' | 'sender' | 'personalization' | 'content' | 'preview' | 'settings' | 'compliance' | 'review'
  const [activeTab, setActiveTab] = useState('recipients');

  // 1. Campaign Details
  const [name, setName] = useState(campaign?.name || '');
  const [description, setDescription] = useState(campaign?.description || campaign?.stats?.description || '');
  const [campaignType, setCampaignType] = useState(campaign?.campaignType || campaign?.campaign_type || 'standard');
  const [selectedTemplateType, setSelectedTemplateType] = useState('initial_outreach');

  // 2. Recipients
  const initialFilter = campaign?.filterCriteria || campaign?.stats?.filterCriteria || {
    status: ['NEW', 'CONTACTED'],
    tags: [],
    onlyUncontacted: false,
  };
  const [filterCriteria, setFilterCriteria] = useState(initialFilter);
  const [availableTags, setAvailableTags] = useState([]);
  const [audit, setAudit] = useState(null);
  const [auditing, setAuditing] = useState(false);

  // 3. Sender
  const initialSender = campaign?.sender || campaign?.stats?.sender || {};
  const [senderEmail, setSenderEmail] = useState(initialSender.email || 'rauf@mine-tech.be');
  const [senderName, setSenderName] = useState(initialSender.name || 'Rauf');
  const [replyTo, setReplyTo] = useState(initialSender.replyTo || 'rauf@mine-tech.be');

  // 4. Subject & Email Body
  const [subject, setSubject] = useState(campaign?.subject || '');
  const [body, setBody] = useState(
    campaign?.body_plain ||
    (campaign?.bodyHtml || campaign?.body_html ? (campaign.bodyHtml || campaign.body_html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p><p>/gi, '\n\n').replace(/<[^>]+>/g, '') : '')
  );

  // 5. Sending Settings
  const initialSettings = campaign?.sendingSettings || campaign?.stats?.sendingSettings || {};
  const [dailyLimit, setDailyLimit] = useState(initialSettings.dailyLimit || 50);
  const [delayInterval, setDelayInterval] = useState(initialSettings.delayInterval || 45);
  const [scheduleWindow, setScheduleWindow] = useState(initialSettings.scheduleWindow || '08:00 - 18:00 (Prospect Local Time)');
  const [warmupEnabled, setWarmupEnabled] = useState(initialSettings.warmupEnabled !== false);

  // 6. Tracking
  const initialTracking = campaign?.tracking || campaign?.stats?.tracking || {};
  const [trackOpens, setTrackOpens] = useState(initialTracking.trackOpens !== false);
  const [trackClicks, setTrackClicks] = useState(initialTracking.trackClicks !== false);
  const [unsubscribeHeader, setUnsubscribeHeader] = useState(initialTracking.unsubscribeHeader !== false);

  // 7. Compliance
  const initialCompliance = campaign?.compliance || campaign?.stats?.compliance || {};
  const [includePhysicalAddress, setIncludePhysicalAddress] = useState(initialCompliance.includePhysicalAddress !== false);
  const [includeOneClickOptOut, setIncludeOneClickOptOut] = useState(initialCompliance.includeOneClickOptOut !== false);
  const [dncSuppressionActive, setDncSuppressionActive] = useState(initialCompliance.dncSuppressionActive !== false);

  // 8. Personalization & Claude AI Campaign Brain
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-5-5');
  const [personalizationMode, setPersonalizationMode] = useState(
    campaign?.campaignType === 'ai_personalized' ? 'ai_personalized' : 'claude'
  );
  const [aiPrompt, setAiPrompt] = useState(
    campaign?.masterPrompt ||
    campaign?.master_prompt ||
    campaign?.stats?.master_prompt ||
    'Write a high-converting, professional cold email introducing MineTech mineral supply and Lamswaarde warehousing. Reference their company and role naturally. Keep it under 100 words.'
  );
  const [aiTone, setAiTone] = useState('Direct');
  const [aiGoal, setAiGoal] = useState('Book a 15-min Discovery Call');
  const [aiLoading, setAiLoading] = useState(false);

  // Campaign Brain Intelligence Hub States
  const [brainTool, setBrainTool] = useState('strategy'); // 'strategy' | 'audience' | 'messaging' | 'critique' | 'sequence' | 'performance' | 'chat'
  const [brainLoading, setBrainLoading] = useState(false);
  const [strategyResult, setStrategyResult] = useState(null);
  const [audienceResult, setAudienceResult] = useState(null);
  const [messagingResult, setMessagingResult] = useState(null);
  const [critiqueResult, setCritiqueResult] = useState(null);
  const [sequenceResult, setSequenceResult] = useState(null);
  const [performanceResult, setPerformanceResult] = useState(null);
  const [brainChatMessages, setBrainChatMessages] = useState([]);
  const [brainChatInput, setBrainChatInput] = useState('');
  const [fetchedLeads, setFetchedLeads] = useState([]);

  // Campaign Deletion Modal State for Edit/Details view
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState(false);

  // 9. Interactive Preview & Test Send
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop' | 'mobile'
  const [previewFormat, setPreviewFormat] = useState('html'); // 'html' | 'text'
  const [previewLeadIdx, setPreviewLeadIdx] = useState(0);
  const [testEmailAddress, setTestEmailAddress] = useState('rauf@mine-tech.be');
  const [testSending, setTestSending] = useState(false);
  const [testSendResult, setTestSendResult] = useState(null);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [confirmedSafety, setConfirmedSafety] = useState(false);

  // Fetch available tags and run initial audit
  useEffect(() => {
    fetch('/api/leads?limit=100')
      .then((r) => r.json())
      .then((j) => {
        const leadList = j.leads || [];
        setFetchedLeads(leadList);
        const tags = new Set();
        leadList.forEach((l) => (l.tags || []).forEach((t) => tags.add(t)));
        setAvailableTags(Array.from(tags));
      })
      .catch(() => {});

    runAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAudit = async () => {
    setAuditing(true);
    try {
      const res = await fetch('/api/email/campaigns/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filterCriteria),
      });
      if (res.ok) {
        const json = await res.json();
        setAudit(json.data);
      } else {
        setAudit({ eligible: 0, suppressed: 0, missingEmail: 0, total: 0 });
      }
    } catch (e) {
      setAudit({ eligible: 0, suppressed: 0, missingEmail: 0, total: 0 });
    } finally {
      setAuditing(false);
    }
  };

  // Switch prompt template
  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateType(templateId);
    const tmpl = CAMPAIGN_TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setAiPrompt(tmpl.defaultPrompt);
      setAiGoal(tmpl.defaultGoal);
      setAiTone(tmpl.defaultTone);
      toast.info(`Loaded "${tmpl.name}" prompt template`);
    }
  };

  // Generate Email with Claude AI
  const handleClaudeGenerate = async () => {
    setAiLoading(true);
    try {
      const sampleLead = SAMPLE_LEADS[previewLeadIdx] || SAMPLE_LEADS[0];
      const res = await fetch('/api/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          tone: aiTone,
          goal: aiGoal,
          templateType: selectedTemplateType,
          leadContext: sampleLead,
          model: selectedModel,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data?.subject) setSubject(json.data.subject);
        if (json.data?.body) setBody(json.data.body);
        toast.success(`Generated email draft with ${selectedModel === 'claude-opus-5-5' ? 'Claude Opus 5.5' : 'Claude Sonnet 5.5'}`);
        setActiveTab('content');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to generate email');
      }
    } catch (e) {
      toast.error('Network error during AI generation: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Campaign Brain Intelligence Runner
  const runBrainTool = async (action, customParams = {}) => {
    setBrainLoading(true);
    try {
      const payload = {
        action,
        model: selectedModel,
        name,
        objective: aiGoal || description || 'Industrial mineral outreach',
        tone: aiTone,
        angle: aiPrompt,
        campaignContext: {
          id: campaignId,
          name,
          objective: aiGoal,
          description,
          subject,
          body,
          stats: campaign?.stats || {},
          filterCriteria,
        },
        leadsContext: fetchedLeads.slice(0, 50),
        filterCriteria,
        currentSubject: subject,
        currentBody: body,
        stats: campaign?.stats || {},
        ...customParams,
      };

      const res = await fetch('/api/email/campaigns/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (action === 'develop_strategy') {
          setStrategyResult(json.data);
          toast.success(`Campaign strategy formulated by ${json.actualModel || selectedModel}`);
        } else if (action === 'analyze_audience') {
          setAudienceResult(json.data);
          toast.success(`Audience analysis complete with Buyer/Seller breakdown`);
        } else if (action === 'generate_messaging') {
          setMessagingResult(json.data);
          toast.success(`Subject lines & email messaging generated`);
        } else if (action === 'improve_messaging') {
          setCritiqueResult(json.data);
          toast.success(`Draft critique and improved copy ready`);
        } else if (action === 'recommend_sequences') {
          setSequenceResult(json.data);
          toast.success(`Multi-step follow-up sequence generated`);
        } else if (action === 'review_performance') {
          setPerformanceResult(json.data);
          toast.success(`Performance review complete`);
        }
      } else {
        toast.error(json.error || 'Campaign intelligence request failed');
      }
    } catch (e) {
      toast.error('Error running Campaign Brain: ' + e.message);
    } finally {
      setBrainLoading(false);
    }
  };

  // Conversational Chat with Campaign Brain
  const sendBrainChatMessage = async () => {
    if (!brainChatInput.trim() || brainLoading) return;
    const userMsg = { role: 'user', content: brainChatInput.trim() };
    const updated = [...brainChatMessages, userMsg];
    setBrainChatMessages(updated);
    setBrainChatInput('');
    setBrainLoading(true);

    try {
      const res = await fetch('/api/email/campaigns/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          model: selectedModel,
          messages: updated,
          campaignContext: {
            id: campaignId,
            name,
            objective: aiGoal,
            subject,
            body,
            stats: campaign?.stats || {},
          },
          leadsContext: fetchedLeads.slice(0, 30),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setBrainChatMessages([...updated, json.data]);
      } else {
        toast.error(json.error || 'Failed to get answer from Campaign Brain');
      }
    } catch (e) {
      toast.error('Chat error: ' + e.message);
    } finally {
      setBrainLoading(false);
    }
  };

  // Delete Campaign directly from Wizard (Edit / Details Mode)
  const handleDeleteFromWizard = async () => {
    if (!campaignId) return;
    setDeletingCampaign(true);
    try {
      const res = await fetch(`/api/email/campaigns/${campaignId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Campaign deleted from database');
        setShowDeleteConfirm(false);
        onClose?.();
        onUpdated?.();
        onCreated?.();
      } else {
        toast.error(json.message || 'Failed to delete campaign');
      }
    } catch (e) {
      toast.error('Error deleting campaign: ' + e.message);
    } finally {
      setDeletingCampaign(false);
    }
  };

  // Send a real test email through Resend
  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      toast.error('Please enter a valid test recipient email address');
      return;
    }
    setTestSending(true);
    setTestSendResult(null);
    try {
      const endpoint = isEditing ? `/api/email/campaigns/${campaignId}` : '/api/email/campaigns';
      const payload = {
        action: 'test_send',
        testEmail: testEmailAddress,
        subject: subject || 'MineTech Campaign Preview',
        bodyHtml: body ? `<p>${body.replace(/\n\s*\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '<p>Test email</p>',
        bodyText: body || 'Test email',
        sender: { email: senderEmail, name: senderName, replyTo },
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setTestSendResult({
          success: true,
          providerMessageId: json.data?.providerMessageId || 'accepted',
          recipient: testEmailAddress,
        });
        toast.success(`Test email sent to ${testEmailAddress}`);
      } else {
        setTestSendResult({
          success: false,
          error: json.message || json.error || 'Test send failed',
        });
        toast.error(json.message || json.error || 'Test send failed');
      }
    } catch (e) {
      setTestSendResult({ success: false, error: e.message });
      toast.error('Error sending test email: ' + e.message);
    } finally {
      setTestSending(false);
    }
  };

  // Save as Draft or Launch Campaign
  const handleSaveCampaign = async ({ autoLaunch = false }) => {
    if (!name.trim()) {
      toast.error('Please provide a campaign name');
      setActiveTab('recipients');
      return;
    }

    const isAiPersonalized = campaignType === 'ai_personalized';

    if (!isAiPersonalized && (!subject.trim() || !body.trim())) {
      toast.error('Please provide both an Email Subject and Body');
      setActiveTab('content');
      return;
    }

    if (autoLaunch && !confirmedSafety) {
      toast.error('Please confirm compliance verification before launching');
      setActiveTab('review');
      return;
    }

    setSubmitting(true);
    try {
      const bodyHtmlFormatted = body
        ? (body.startsWith('<p') || body.startsWith('<div') ? body : `<p>${body.replace(/\n\s*\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`)
        : '<p>MineTech Outbound Update</p>';

      const payload = {
        name: name.trim(),
        description: description.trim(),
        subject: subject.trim() || (isAiPersonalized ? 'AI Synthesized Subject' : 'Quick inquiry'),
        bodyHtml: bodyHtmlFormatted,
        bodyText: body.trim() || 'MineTech Outbound Update',
        campaignType: isAiPersonalized ? 'ai_personalized' : 'standard',
        masterPrompt: isAiPersonalized ? aiPrompt : undefined,
        sender: { email: senderEmail, name: senderName, replyTo },
        filterCriteria,
        sendingSettings: { dailyLimit, delayInterval, scheduleWindow, warmupEnabled },
        tracking: { trackOpens, trackClicks, unsubscribeHeader },
        compliance: { includePhysicalAddress, includeOneClickOptOut, dncSuppressionActive },
        status: autoLaunch ? 'RUNNING' : (isEditing ? campaign.status : 'DRAFT'),
        autoLaunch: autoLaunch && !isEditing,
      };

      let res;
      if (isEditing) {
        res = await fetch(`/api/email/campaigns/${campaignId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/email/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          isEditing
            ? 'Campaign updated successfully'
            : autoLaunch
            ? 'Campaign created and launched successfully!'
            : 'Campaign saved as Draft'
        );
        if (isEditing && onUpdated) onUpdated(json.data);
        if (!isEditing && onCreated) onCreated(json.data);
        onClose();
      } else {
        toast.error(json.message || json.error || 'Failed to save campaign');
      }
    } catch (e) {
      toast.error('Error saving campaign: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Variable validation
  const checkMergeVariables = () => {
    const combined = `${subject} ${body}`;
    const detectedTags = combined.match(/\{\{([^}]+)\}\}/g) || [];
    const validTags = ['{{firstName}}', '{{lastName}}', '{{fullName}}', '{{company}}', '{{jobTitle}}', '{{website}}', '{{industry}}'];
    const invalidTags = detectedTags.filter((t) => !validTags.includes(t));
    const leakedArtifacts = /undefined|null|\[object Object\]/i.test(combined);

    return {
      detectedCount: detectedTags.length,
      invalidTags,
      leakedArtifacts,
      isValid: invalidTags.length === 0 && !leakedArtifacts,
    };
  };

  const varCheck = checkMergeVariables();
  const currentSampleLead = SAMPLE_LEADS[previewLeadIdx] || SAMPLE_LEADS[0];

  // Interpolate for preview
  const previewSubject = subject
    ? subject
        .replace(/\{\{\s*firstName\s*\}\}/gi, currentSampleLead.firstName)
        .replace(/\{\{\s*company\s*\}\}/gi, currentSampleLead.company)
        .replace(/\{\{\s*jobTitle\s*\}\}/gi, currentSampleLead.jobTitle)
    : '(No subject entered)';

  const previewBody = body
    ? body
        .replace(/\{\{\s*firstName\s*\}\}/gi, currentSampleLead.firstName)
        .replace(/\{\{\s*company\s*\}\}/gi, currentSampleLead.company)
        .replace(/\{\{\s*jobTitle\s*\}\}/gi, currentSampleLead.jobTitle)
        .replace(/\{\{\s*industry\s*\}\}/gi, currentSampleLead.industry)
        .replace(/\{\{\s*website\s*\}\}/gi, currentSampleLead.website)
    : 'Your email content will appear here...';

  const tabs = [
    { id: 'recipients', label: '1. Audience', icon: Users },
    { id: 'sender', label: '2. Sender', icon: Mail },
    { id: 'personalization', label: '3. Campaign Brain (Claude)', icon: Brain },
    { id: 'content', label: '4. Subject & Body', icon: FileText },
    { id: 'preview', label: '5. Preview & Test', icon: Eye },
    { id: 'settings', label: '6. Settings', icon: Sliders },
    { id: 'compliance', label: '7. Compliance', icon: ShieldCheck },
    { id: 'review', label: '8. Review & Launch', icon: Send },
  ];

  return (
    <ModalFrame title={isEditing ? `Edit Campaign: ${name || 'Untitled'}` : 'Create New Campaign'} onClose={onClose}>
      <Card className="bg-card border-border rounded-xl w-full max-w-4xl overflow-hidden shadow-sm flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-semibold text-primary font-mono tracking-wider">
                  MineTech Campaign Engine
                </span>
                {isEditing && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/30 text-primary">
                    Edit Mode
                  </Badge>
                )}
              </div>
              <h2 className="text-base font-semibold text-foreground">
                {name || (isEditing ? 'Edit Campaign' : 'New Outbound Campaign')}
              </h2>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Step Navigation Bar */}
        <div className="flex border-b border-border bg-muted/20 overflow-x-auto text-xs font-semibold scrollbar-none">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 whitespace-nowrap transition text-xs ${
                  active
                    ? 'border-primary text-primary bg-primary/10 font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: AUDIENCE & RECIPIENTS */}
          {activeTab === 'recipients' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Campaign Name <span className="text-danger">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Q4 European Foundry & Refractory Outreach"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-muted/20 border-border focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Internal Description / Purpose (Optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Testing kaolin specs with German ceramic producers"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-muted/20 border-border focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">Target Lead Classification</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'ALL', label: 'All Leads' },
                    { id: 'Buyer', label: 'Buyers Only (Consumers)' },
                    { id: 'Seller', label: 'Sellers Only (Producers / Suppliers)' },
                  ].map((target) => {
                    const isSelected = (filterCriteria.classification || 'ALL') === target.id;
                    return (
                      <button
                        type="button"
                        key={target.id}
                        onClick={() => {
                          setFilterCriteria({ ...filterCriteria, classification: target.id });
                          runAudit();
                        }}
                        className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
                            : 'bg-muted/20 border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{target.label}</span>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[10px] ${isSelected ? 'bg-primary border-primary text-primary-foreground font-semibold' : 'border-border'}`}>
                          {isSelected && '✓'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">Target Audience Lead Status</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['NEW', 'CONTACTED', 'FOLLOW_UP', 'NO_RESPONSE'].map((st) => {
                    const isChecked = filterCriteria.status.includes(st);
                    return (
                      <button
                        type="button"
                        key={st}
                        onClick={() => {
                          const updated = isChecked
                            ? filterCriteria.status.filter((s) => s !== st)
                            : [...filterCriteria.status, st];
                          setFilterCriteria({ ...filterCriteria, status: updated });
                          runAudit();
                        }}
                        className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition ${
                          isChecked
                            ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
                            : 'bg-muted/20 border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{st}</span>
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${isChecked ? 'bg-primary border-primary text-primary-foreground font-semibold' : 'border-border'}`}>
                          {isChecked && '✓'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {availableTags.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-2">Filter by Tags (Optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const updated = filterCriteria.tags.includes(tag)
                            ? filterCriteria.tags.filter((t) => t !== tag)
                            : [...filterCriteria.tags, tag];
                          setFilterCriteria({ ...filterCriteria, tags: updated });
                          runAudit();
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          filterCriteria.tags.includes(tag)
                            ? 'bg-primary/20 border-primary/40 text-primary'
                            : 'bg-muted/20 border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Audience Audit Breakdown */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-semibold text-primary">Live Recipient Pre-Flight Audit</h4>
                  </div>
                  <span className="text-[11px] font-mono text-primary font-semibold">
                    {auditing ? 'Auditing CRM...' : `${audit?.eligible || 0} Eligible Recipients`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <div className="font-semibold text-foreground text-sm">{audit?.eligible || 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium">Eligible Leads</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <div className="font-semibold text-warning text-sm">{audit?.suppressed || 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium">DNC / Opt-Out</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <div className="font-semibold text-danger text-sm">{audit?.missingEmail || 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium">Missing Email</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <div className="font-semibold text-muted-foreground text-sm">{audit?.duplicates || 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium">Duplicates</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SENDER */}
          {activeTab === 'sender' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-muted/20 border border-border space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Verified MineTech Sender Identity</span>
                  </div>
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] font-mono">
                    mine-tech.be (Verified)
                  </Badge>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Sender Email Address</label>
                  <Input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="bg-muted/20 border-border focus:border-primary font-mono text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    Verified sender domain in Resend: <code className="text-primary font-mono">mine-tech.be</code>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">From Display Name</label>
                    <Input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="e.g. Rauf"
                      className="bg-muted/20 border-border focus:border-primary text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Reply-To Address</label>
                    <Input
                      type="email"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      className="bg-muted/20 border-border focus:border-primary text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLAUDE AI & PROMPT TEMPLATES */}
          {activeTab === 'personalization' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">Campaign Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCampaignType('standard');
                      setPersonalizationMode('claude');
                    }}
                    className={`p-4 rounded-xl border text-left transition ${
                      campaignType === 'standard'
                        ? 'bg-primary/10 border-primary/40 text-foreground shadow-sm'
                        : 'bg-muted/20 border-border text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs mb-1 text-primary">
                      <Radio className="w-4 h-4 text-primary" />
                      <span>Standard / AI-Assisted Blast</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Use Claude Sonnet 5.5 / Opus 5.5 to craft high-converting copy, then interpolate variables per lead at dispatch.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCampaignType('ai_personalized');
                      setPersonalizationMode('ai_personalized');
                    }}
                    className={`p-4 rounded-xl border text-left transition ${
                      campaignType === 'ai_personalized'
                        ? 'bg-primary/15 border-primary/50 text-foreground shadow-sm'
                        : 'bg-muted/20 border-border text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-primary mb-1">
                      <Flame className="w-4 h-4 text-primary" />
                      <span>Per-Prospect Bespoke AI Generation</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Claude synthesizes unique, 1-to-1 tailored copy per recipient via the background worker queue.
                    </p>
                  </button>
                </div>
              </div>

              {/* 6 Specialized Prompt Templates */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">
                  Select Prompt Template Architecture (6 Proven B2B Types)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {CAMPAIGN_TEMPLATES.map((tmpl) => {
                    const isSelected = selectedTemplateType === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => handleSelectTemplate(tmpl.id)}
                        className={`p-3 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
                            : 'bg-muted/20 border-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold">{tmpl.name}</span>
                          {isSelected && <span className="text-primary font-bold text-xs">✓</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2">
                          {tmpl.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Claude Campaign Brain Model Configuration */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-subtle space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Campaign Claude AI Model</h4>
                      <p className="text-[11px] text-muted-foreground">Select the official Anthropic intelligence engine for this campaign</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border">
                    <button
                      type="button"
                      onClick={() => setSelectedModel('claude-sonnet-5-5')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                        selectedModel === 'claude-sonnet-5-5'
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Sonnet 5.5 (Default)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedModel('claude-opus-5-5')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                        selectedModel === 'claude-opus-5-5'
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Opus 5.5 (Advanced Reasoning)
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/20 border border-border text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>
                    Active Engine:{' '}
                    <strong className="text-foreground">
                      {selectedModel === 'claude-opus-5-5' ? 'Claude Opus 5.5' : 'Claude Sonnet 5.5'}
                    </strong>{' '}
                    — {selectedModel === 'claude-opus-5-5' ? 'Deep reasoning for complex multi-channel strategy and sequence planning' : 'High-speed intelligence for audience analysis, copy creation & segmentation'}
                  </span>
                  <Badge variant="outline" className="border-primary/30 text-primary font-mono text-[9px]">
                    {selectedModel}
                  </Badge>
                </div>
              </div>

              {/* Claude Campaign Brain Intelligence Hub */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-subtle space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Claude Campaign Brain Intelligence</h4>
                      <p className="text-[11px] text-muted-foreground">Strategic audience analysis, Buyer/Seller segmentation, messaging critique & sequencing</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {[
                      { id: 'strategy', label: 'Strategy', icon: Compass },
                      { id: 'audience', label: 'Audience & Segments', icon: Users },
                      { id: 'messaging', label: 'Messaging & Subjects', icon: Wand2 },
                      { id: 'critique', label: 'Critique Draft', icon: ShieldCheck },
                      { id: 'sequence', label: 'Sequences', icon: Layers },
                      ...(campaign?.stats?.sent > 0 ? [{ id: 'performance', label: 'Performance', icon: TrendingUp }] : []),
                      { id: 'chat', label: 'Brain Chat', icon: MessageSquare },
                    ].map((tool) => {
                      const Icon = tool.icon;
                      const active = brainTool === tool.id;
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => setBrainTool(tool.id)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                            active
                              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                              : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{tool.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tool 1: Strategy Formulation */}
                {brainTool === 'strategy' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Formulate an end-to-end commercial outbound strategy based on your audience and MineTech mineral specs.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={brainLoading}
                        onClick={() => runBrainTool('develop_strategy')}
                        className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        {brainLoading ? 'Formulating...' : 'Develop Strategy with Claude'}
                      </Button>
                    </div>

                    {strategyResult && (
                      <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-3 animate-in fade-in">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-primary font-mono tracking-wider">Strategic Summary</span>
                          <p className="text-xs font-medium text-foreground mt-0.5 leading-relaxed">{strategyResult.strategySummary}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-2.5 rounded bg-card border border-border">
                            <span className="text-[10px] font-bold text-muted-foreground block mb-1">Recommended Angle</span>
                            <p className="text-foreground">{strategyResult.recommendedAngle}</p>
                          </div>
                          <div className="p-2.5 rounded bg-card border border-border">
                            <span className="text-[10px] font-bold text-muted-foreground block mb-1">Buyer / Seller Guidance</span>
                            <p className="text-foreground">{strategyResult.buyerSellerRecommendation}</p>
                          </div>
                        </div>

                        {strategyResult.messagingPillars?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground block mb-1">Messaging Pillars</span>
                            <div className="flex flex-wrap gap-1.5">
                              {strategyResult.messagingPillars.map((p, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-card border-border">
                                  ✓ {p}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-end pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (strategyResult.recommendedAngle) {
                                setAiPrompt(`${strategyResult.recommendedAngle}. Emphasize: ${strategyResult.messagingPillars?.join(', ')}.`);
                                toast.success('Strategy applied to Campaign Instructions');
                              }
                            }}
                            className="h-7 text-xs text-primary border-primary/30 hover:bg-primary/10 gap-1"
                          >
                            <Check className="w-3 h-3" /> Apply Strategy to Campaign Prompt
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tool 2: Audience Analysis (Buyer/Seller Breakdown) */}
                {brainTool === 'audience' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Inspect selected leads, Buyer/Seller distribution, and identify targeting risks.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={brainLoading}
                        onClick={() => runBrainTool('analyze_audience')}
                        className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        {brainLoading ? 'Analyzing...' : 'Analyze Audience with Claude'}
                      </Button>
                    </div>

                    {audienceResult && (
                      <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-3 animate-in fade-in">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                          <div className="p-2 rounded bg-card border border-border">
                            <span className="text-muted-foreground text-[10px] block">Total Sample</span>
                            <span className="text-base font-bold text-foreground">{audienceResult.total || 0}</span>
                          </div>
                          <div className="p-2 rounded bg-card border border-border">
                            <span className="text-primary text-[10px] block font-semibold">Buyers</span>
                            <span className="text-base font-bold text-primary">{audienceResult.buyerCount || 0}</span>
                          </div>
                          <div className="p-2 rounded bg-card border border-border">
                            <span className="text-warning text-[10px] block font-semibold">Sellers</span>
                            <span className="text-base font-bold text-warning">{audienceResult.sellerCount || 0}</span>
                          </div>
                          <div className="p-2 rounded bg-card border border-border">
                            <span className="text-muted-foreground text-[10px] block">Unclassified</span>
                            <span className="text-base font-bold text-muted-foreground">{audienceResult.unclassifiedCount || 0}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-foreground leading-relaxed">{audienceResult.executiveSummary}</p>
                        </div>

                        {audienceResult.potentialRisks?.length > 0 && (
                          <div className="p-2 rounded bg-warning/10 border border-warning/20 text-xs text-warning space-y-0.5">
                            <span className="font-semibold block text-[11px]">⚠️ Segmentation Advisory:</span>
                            {audienceResult.potentialRisks.map((r, i) => (
                              <p key={i} className="text-[11px]">{r}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tool 3: Messaging & Subject Lines */}
                {brainTool === 'messaging' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Generate 3 high-converting subject lines and a tailored cold email body with the official MineTech signature.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={brainLoading}
                        onClick={() => runBrainTool('generate_messaging')}
                        className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        {brainLoading ? 'Generating...' : 'Generate with Claude'}
                      </Button>
                    </div>

                    {messagingResult && (
                      <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-3 animate-in fade-in">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-primary font-mono tracking-wider">Subject Line Options</span>
                          <div className="space-y-1.5 mt-1.5">
                            {(messagingResult.subjectOptions || []).map((s, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded bg-card border border-border text-xs gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium text-foreground block truncate">&ldquo;{s.subject}&rdquo;</span>
                                  <span className="text-[10px] text-muted-foreground">{s.rationale} ({s.openRateAppeal} Appeal)</span>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSubject(s.subject);
                                    toast.success(`Applied subject: "${s.subject}"`);
                                  }}
                                  className="h-6 text-[11px] text-primary hover:bg-primary/10 shrink-0"
                                >
                                  Use Subject
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {messagingResult.emailBodyText && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">Generated Body Draft</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setBody(messagingResult.emailBodyText);
                                  toast.success('Applied generated copy to Email Body');
                                }}
                                className="h-6 text-[11px] text-primary border-primary/30 hover:bg-primary/10"
                              >
                                Use Email Body
                              </Button>
                            </div>
                            <div className="p-2.5 rounded bg-card border border-border text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto font-mono text-[11px]">
                              {messagingResult.emailBodyText}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tool 4: Critique & Upgrade Draft */}
                {brainTool === 'critique' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Have Claude evaluate your current Subject and Body for spam triggers, clarity, and conversion friction.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={brainLoading || (!subject && !body)}
                        onClick={() => runBrainTool('improve_messaging')}
                        className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {brainLoading ? 'Critiquing...' : 'Critique & Upgrade Draft'}
                      </Button>
                    </div>

                    {critiqueResult && (
                      <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            Copy Score:{' '}
                            <strong className="text-primary">{critiqueResult.critique?.overallScore || 85} / 100</strong>
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Spam Risk: <strong className="text-foreground">{critiqueResult.critique?.spamRisk || 'Low'}</strong>
                          </span>
                        </div>

                        {critiqueResult.critique?.weaknesses?.length > 0 && (
                          <div className="p-2 rounded bg-danger/10 border border-danger/20 text-xs text-danger space-y-0.5">
                            <span className="font-semibold block text-[11px]">Areas for Improvement:</span>
                            {critiqueResult.critique.weaknesses.map((w, i) => (
                              <p key={i} className="text-[11px]">✗ {w}</p>
                            ))}
                          </div>
                        )}

                        <div className="p-2.5 rounded bg-card border border-border text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-primary uppercase font-mono">Improved Subject & Body</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (critiqueResult.improvedSubject) setSubject(critiqueResult.improvedSubject);
                                if (critiqueResult.improvedBodyText) setBody(critiqueResult.improvedBodyText);
                                toast.success('Applied improved Subject and Email Body');
                              }}
                              className="h-6 text-[11px] text-primary border-primary/30 hover:bg-primary/10"
                            >
                              Apply Improvements
                            </Button>
                          </div>
                          <p className="font-semibold text-foreground">&ldquo;{critiqueResult.improvedSubject}&rdquo;</p>
                          <p className="text-muted-foreground whitespace-pre-wrap text-[11px] font-mono">{critiqueResult.improvedBodyText}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tool 5: Recommend Follow-Up Sequence */}
                {brainTool === 'sequence' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Generate a 3-touch consultative follow-up cadence with optimal day delays.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={brainLoading}
                        onClick={() => runBrainTool('recommend_sequences')}
                        className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        {brainLoading ? 'Generating...' : 'Recommend Sequence with Claude'}
                      </Button>
                    </div>

                    {sequenceResult && (
                      <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-2.5 animate-in fade-in">
                        <p className="text-xs font-semibold text-foreground">{sequenceResult.sequenceSummary}</p>
                        <div className="space-y-2">
                          {(sequenceResult.steps || []).map((st, i) => (
                            <div key={i} className="p-2.5 rounded bg-card border border-border text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-primary">
                                  Step {st.step} (Day {st.dayOffset}): {st.title}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {st.angle}
                                </Badge>
                              </div>
                              <p className="font-medium text-foreground">&ldquo;{st.subject}&rdquo;</p>
                              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{st.bodyText}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tool 6: Performance Review (if stats exist) */}
                {brainTool === 'performance' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Review delivery rates, opens, and replies against industrial B2B benchmarks.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={brainLoading}
                        onClick={() => runBrainTool('review_performance')}
                        className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        {brainLoading ? 'Analyzing...' : 'Audit Performance with Claude'}
                      </Button>
                    </div>

                    {performanceResult && (
                      <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            Status:{' '}
                            <strong className="text-primary">{performanceResult.performanceVerdict}</strong>
                          </span>
                          <span className="text-xs text-muted-foreground">{performanceResult.summary}</span>
                        </div>

                        {performanceResult.actionableOptimizations?.length > 0 && (
                          <div className="p-2.5 rounded bg-card border border-border space-y-1 text-xs">
                            <span className="font-bold text-foreground block text-[11px]">Recommended Optimizations:</span>
                            {performanceResult.actionableOptimizations.map((opt, i) => (
                              <p key={i} className="text-muted-foreground text-[11px]">✓ {opt}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tool 7: Interactive Brain Chat */}
                {brainTool === 'chat' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Chat collaboratively with Claude about this campaign. Claude remembers your instructions and campaign context.
                    </p>

                    <div className="h-56 overflow-y-auto rounded-lg bg-muted/20 border border-border p-3 space-y-2.5">
                      {brainChatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground space-y-1">
                          <MessageSquare className="w-6 h-6 text-primary/40" />
                          <p>Ask Claude anything about this campaign strategy, audience, or copy.</p>
                          <p className="text-[10px]">e.g. &ldquo;Make this email more technical for ceramic engineers&rdquo; or &ldquo;How should we segment buyers vs sellers?&rdquo;</p>
                        </div>
                      ) : (
                        brainChatMessages.map((m, idx) => (
                          <div
                            key={idx}
                            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                          >
                            <span className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5">
                              {m.role === 'user' ? 'You' : `Claude (${m.model || selectedModel})`}
                            </span>
                            <div
                              className={`p-2.5 rounded-xl max-w-[85%] text-xs leading-relaxed whitespace-pre-wrap ${
                                m.role === 'user'
                                  ? 'bg-primary text-primary-foreground font-medium'
                                  : 'bg-card border border-border text-foreground shadow-subtle'
                              }`}
                            >
                              {m.content}
                            </div>
                          </div>
                        ))
                      )}
                      {brainLoading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                          <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
                          <span>Claude is thinking...</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        value={brainChatInput}
                        onChange={(e) => setBrainChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendBrainChatMessage();
                          }
                        }}
                        placeholder="Type instructions or questions for Claude..."
                        className="h-8 text-xs bg-card border-border"
                        disabled={brainLoading}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={brainLoading || !brainChatInput.trim()}
                        onClick={sendBrainChatMessage}
                        className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1 px-3"
                      >
                        <Send className="w-3 h-3" /> Send
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Standard Prompt & Email Generation Section */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-primary" />
                    Custom Campaign Instructions & Objectives
                  </span>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px] font-mono">
                    {selectedModel === 'claude-opus-5-5' ? 'Claude Opus 5.5' : 'Claude Sonnet 5.5'}
                  </Badge>
                </div>

                <div>
                  <Textarea
                    rows={3}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Provide specific mineral specs, value proposition, or European warehousing highlights..."
                    className="bg-card border-border focus:border-primary text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground/90 block mb-1">Tone</label>
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      className="w-full h-8 rounded-md bg-background border border-border px-3 text-xs text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="Direct">Direct & Concise (High Converting)</option>
                      <option value="Professional">Professional & Consultative</option>
                      <option value="Technical">Technical & Specification-Oriented</option>
                      <option value="Friendly">Friendly & Approachable</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground/90 block mb-1">Call to Action (Goal)</label>
                    <select
                      value={aiGoal}
                      onChange={(e) => setAiGoal(e.target.value)}
                      className="w-full h-8 rounded-md bg-background border border-border px-3 text-xs text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="Book a 15-min Discovery Call">Book a 15-min Discovery Call</option>
                      <option value="Gauge interest (Soft CTA)">Gauge interest (Soft CTA)</option>
                      <option value="Share technical data sheet">Offer Technical Data Sheet (TDS)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Mandatory official MineTech signature automatically appended.</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={aiLoading}
                    onClick={handleClaudeGenerate}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{aiLoading ? 'Generating with Claude...' : `Generate Email with ${selectedModel === 'claude-opus-5-5' ? 'Opus 5.5' : 'Sonnet 5.5'}`}</span>
                  </Button>
                </div>
              </div>

              {/* Strict User Control Notice */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>
                  <strong className="text-foreground">User Approval Control:</strong> Claude acts as your Campaign Brain to recommend strategy and draft messaging. Emails are never dispatched automatically without your explicit review and launch.
                </span>
              </div>
            </div>
          )}

          {/* TAB 4: SUBJECT & EMAIL COMPOSER */}
          {activeTab === 'content' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Email Subject Line <span className="text-danger">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Kaolin & Chamotte supply specifications for {{company}}"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-muted/20 border-border focus:border-primary font-medium text-xs"
                />
              </div>

              {/* Personalization Variable Insertion Pills */}
              <div className="p-3 rounded-xl bg-muted/20 border border-border">
                <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Copy className="w-3 h-3 text-primary" />
                  <span>Insert Personalization Variable (Click to append):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: '{{firstName}}', label: 'First Name' },
                    { tag: '{{lastName}}', label: 'Last Name' },
                    { tag: '{{company}}', label: 'Company' },
                    { tag: '{{jobTitle}}', label: 'Job Title' },
                    { tag: '{{industry}}', label: 'Industry' },
                    { tag: '{{website}}', label: 'Website' },
                  ].map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => setBody((prev) => `${prev} ${v.tag}`)}
                      className="px-2 py-1 rounded bg-card hover:bg-primary/10 border border-border text-[11px] font-mono text-primary transition"
                    >
                      {v.tag} <span className="text-[9px] text-muted-foreground font-sans">({v.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Email Body Copy <span className="text-danger">*</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Plain-text with auto-paragraph formatting and mandatory MineTech signature
                  </span>
                </div>
                <Textarea
                  rows={9}
                  placeholder={`Hi {{firstName}},\n\nMineTech Resources BV supplies certified industrial minerals across Europe from our Lamswaarde warehouse...\n\nWould you be open to reviewing our technical data sheets this week?`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="bg-muted/20 border-border focus:border-primary text-xs leading-relaxed font-sans"
                />
              </div>

              {/* Real-time Variable Health Check */}
              {!varCheck.isValid && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-xs text-danger flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Variable Syntax Warning:</span>
                    {varCheck.invalidTags.length > 0 && (
                      <p>Unrecognized merge tags: {varCheck.invalidTags.join(', ')}</p>
                    )}
                    {varCheck.leakedArtifacts && (
                      <p>Draft contains raw &apos;undefined&apos; or &apos;null&apos; placeholder leaks.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: INTERACTIVE PREVIEW & TEST SEND */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Preview Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                {/* Sample Lead Switcher */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-muted-foreground">Preview with Prospect:</span>
                  <select
                    value={previewLeadIdx}
                    onChange={(e) => setPreviewLeadIdx(Number(e.target.value))}
                    className="h-8 rounded bg-background border border-border px-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    {SAMPLE_LEADS.map((l, i) => (
                      <option key={i} value={i}>
                        {l.fullName} — {l.jobTitle} @ {l.company}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Device & Format Controls */}
                <div className="flex items-center gap-2">
                  <div className="flex border border-border rounded-lg overflow-hidden bg-background">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1.5 transition ${previewDevice === 'desktop' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      title="Desktop Preview"
                    >
                      <Monitor className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1.5 transition ${previewDevice === 'mobile' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      title="Mobile Preview (375px)"
                    >
                      <Smartphone className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex border border-border rounded-lg overflow-hidden bg-background text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setPreviewFormat('html')}
                      className={`px-2.5 py-1 transition ${previewFormat === 'html' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFormat('text')}
                      className={`px-2.5 py-1 transition ${previewFormat === 'text' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Plain Text
                    </button>
                  </div>
                </div>
              </div>

              {/* Rendered Email Preview Container */}
              <div className="flex justify-center bg-muted/10 p-4 rounded-xl border border-border min-h-[300px]">
                <div
                  className={`bg-card border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-200 ${
                    previewDevice === 'mobile' ? 'w-[375px]' : 'w-full max-w-2xl'
                  }`}
                >
                  {/* Email Header Simulation */}
                  <div className="p-4 border-b border-border bg-muted/30 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span><strong>From:</strong> {senderName} &lt;{senderEmail}&gt;</span>
                      <span className="font-mono">Now</span>
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      <strong>To:</strong> {currentSampleLead.fullName} &lt;{currentSampleLead.firstName.toLowerCase()}@{currentSampleLead.company.toLowerCase().replace(/[^a-z]/g, '')}.com&gt;
                    </div>
                    <div className="text-foreground font-semibold text-sm pt-1">
                      {previewSubject}
                    </div>
                  </div>

                  {/* Email Body Simulation */}
                  <div className="p-5 text-xs text-foreground leading-relaxed whitespace-pre-line min-h-[160px]">
                    {previewFormat === 'html' ? (
                      <div>
                        {previewBody}
                        <div className="mt-5 pt-3 border-t border-border/60 text-muted-foreground text-[11px]">
                          <p className="font-semibold text-foreground">Abdullah Rauf</p>
                          <p>Head of Sales</p>
                          <p>MineTech Resources BV – Belgium</p>
                          <p className="text-primary font-mono mt-0.5">rauf@mine-tech.be | +32 486 287 751</p>
                        </div>
                      </div>
                    ) : (
                      <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                        {previewBody}
                        {'\n\n--\nAbdullah Rauf\nHead of Sales\nMineTech Resources BV\nrauf@mine-tech.be'}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Test Send Panel */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">Dispatch Live Test Email (Resend SMTP)</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Zero spam penalty • Controlled recipient
                  </span>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="Enter test recipient email address..."
                    className="bg-card border-border text-xs focus:border-primary flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={testSending}
                    onClick={handleSendTestEmail}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{testSending ? 'Sending...' : 'Send Test'}</span>
                  </Button>
                </div>

                {testSendResult && (
                  <div className={`p-2.5 rounded-lg text-xs ${testSendResult.success ? 'bg-success/10 text-success border border-success/30' : 'bg-danger/10 text-danger border border-danger/30'}`}>
                    {testSendResult.success ? (
                      <span>✓ Dispatched successfully via Resend. Message ID: <code>{testSendResult.providerMessageId}</code></span>
                    ) : (
                      <span>✗ Test send failed: {testSendResult.error}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS & PACING */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-muted/20 border border-border space-y-4">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Sending Settings & Pacing
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Daily Sending Limit</label>
                    <Input
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Number(e.target.value))}
                      className="bg-muted/20 border-border focus:border-primary text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground mt-1 block">Maximum emails dispatched per 24 hours.</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Delay Interval Between Emails (Seconds)</label>
                    <Input
                      type="number"
                      value={delayInterval}
                      onChange={(e) => setDelayInterval(Number(e.target.value))}
                      className="bg-muted/20 border-border focus:border-primary text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground mt-1 block">Randomized spacing (seconds) to preserve high sender reputation.</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="warmup"
                    checked={warmupEnabled}
                    onChange={(e) => setWarmupEnabled(e.target.checked)}
                    className="rounded bg-muted border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="warmup" className="text-xs font-medium text-foreground/90 cursor-pointer">
                    Enable gradual mailbox warmup pace (increases daily volume by +10% daily)
                  </label>
                </div>
              </div>

              {/* Engagement Tracking */}
              <div className="p-5 rounded-xl bg-muted/20 border border-border space-y-3">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Engagement Tracking Telemetry
                </h4>

                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-xs font-medium text-foreground/90 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trackOpens}
                      onChange={(e) => setTrackOpens(e.target.checked)}
                      className="rounded bg-muted border-border text-primary focus:ring-primary"
                    />
                    <span>Open Tracking (1x1 transparent telemetry pixel)</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-medium text-foreground/90 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trackClicks}
                      onChange={(e) => setTrackClicks(e.target.checked)}
                      className="rounded bg-muted border-border text-primary focus:ring-primary"
                    />
                    <span>Link Click Tracking (URL redirection telemetry)</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-medium text-foreground/90 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unsubscribeHeader}
                      onChange={(e) => setUnsubscribeHeader(e.target.checked)}
                      className="rounded bg-muted border-border text-primary focus:ring-primary"
                    />
                    <span>Include List-Unsubscribe Header (RFC 8058 compliant)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: COMPLIANCE & DELIVERABILITY */}
          {activeTab === 'compliance' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-muted/20 border border-border space-y-4">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  CAN-SPAM & GDPR Deliverability Safeguards
                </h4>

                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 text-xs font-medium text-foreground/90 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePhysicalAddress}
                      onChange={(e) => setIncludePhysicalAddress(e.target.checked)}
                      className="rounded bg-muted border-border text-primary focus:ring-primary"
                    />
                    <span>Include Physical Company Postal Address in footer (Lamswaarde, Netherlands)</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-medium text-foreground/90 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeOneClickOptOut}
                      onChange={(e) => setIncludeOneClickOptOut(e.target.checked)}
                      className="rounded bg-muted border-border text-primary focus:ring-primary"
                    />
                    <span>1-Click Unsubscribe Link appended to email footer</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-medium text-foreground/90 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dncSuppressionActive}
                      onChange={(e) => setDncSuppressionActive(e.target.checked)}
                      className="rounded bg-muted border-border text-primary focus:ring-primary"
                    />
                    <span>Enforce Global DNC (Do-Not-Contact) suppression list check</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: REVIEW & LAUNCH */}
          {activeTab === 'review' && (
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-muted/20 border border-border space-y-4">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Campaign Pre-Flight Summary Checklist
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Target Audience</span>
                    <span className="font-semibold text-foreground">{audit?.eligible || 0} Eligible Leads</span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Sender Mailbox</span>
                    <span className="font-semibold text-foreground">{senderEmail}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Mode</span>
                    <span className="font-semibold text-primary">
                      {campaignType === 'ai_personalized' ? 'Per-Prospect AI Generation' : 'Standard / AI Assisted'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Delivery Infrastructure</span>
                    <span className="font-semibold text-primary">Resend Live API (mine-tech.be)</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Subject Line</span>
                  <div className="text-xs font-semibold text-foreground">{subject || '(No subject provided)'}</div>
                </div>

                {/* Safety Confirmation Checkbox */}
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="safety"
                    checked={confirmedSafety}
                    onChange={(e) => setConfirmedSafety(e.target.checked)}
                    className="rounded bg-muted border-primary text-primary focus:ring-primary"
                  />
                  <label htmlFor="safety" className="text-xs font-medium text-foreground cursor-pointer">
                    I confirm that deliverability safeguards are enabled and approve this campaign for dispatch.
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeTab !== 'recipients' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const currIdx = tabs.findIndex((t) => t.id === activeTab);
                  if (currIdx > 0) setActiveTab(tabs[currIdx - 1].id);
                }}
                className="border-border text-foreground hover:bg-muted h-8 gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous
              </Button>
            )}

            {activeTab !== 'review' && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const currIdx = tabs.findIndex((t) => t.id === activeTab);
                  if (currIdx < tabs.length - 1) setActiveTab(tabs[currIdx + 1].id);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 px-4 gap-1.5"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Delete Campaign in Edit/Details Mode */}
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="border-danger/30 text-danger hover:bg-danger/10 hover:border-danger/60 h-8 px-3 text-xs gap-1.5"
                title="Delete Campaign"
                disabled={submitting}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Campaign
              </Button>
            )}

            {/* Always allow Save as Draft */}
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => handleSaveCampaign({ autoLaunch: false })}
              className="border-border text-foreground hover:bg-muted h-8 px-3.5 text-xs font-medium"
            >
              {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Save as Draft'}
            </Button>

            {/* Launch Campaign Button */}
            {(!isEditing || campaign?.status === 'DRAFT') && (
              <Button
                type="button"
                disabled={submitting}
                onClick={() => handleSaveCampaign({ autoLaunch: true })}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-4 gap-2 text-xs font-semibold shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Launching...' : '🚀 Launch Campaign'}</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Delete Campaign Confirmation Modal in Details/Edit Mode */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl p-5 max-w-md w-full shadow-lg space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Confirm Deletion of &ldquo;{name || 'Campaign'}&rdquo;
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to permanently delete this campaign? This will remove the campaign record and its queued/sent recipient dispatch entries from Supabase.
                </p>
                {(campaign?.stats?.sent || 0) > 0 ? (
                  <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger mt-2 space-y-1">
                    <p className="font-semibold">⚠️ Previously Dispatched Campaign ({campaign.stats.sent} sent):</p>
                    <p className="text-[11px] leading-relaxed">
                      This campaign has already sent emails. Deleting it will permanently erase the campaign and its recipient logs. All CRM leads and contact records will remain 100% intact.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic pt-1">
                    Associated leads and CRM records will remain completely intact.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="h-8 text-xs"
                disabled={deletingCampaign}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deletingCampaign}
                onClick={handleDeleteFromWizard}
                className="bg-danger hover:bg-danger/90 text-danger-foreground h-8 text-xs gap-1.5 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingCampaign ? 'Deleting...' : 'Delete Campaign'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ModalFrame>
  );
}
