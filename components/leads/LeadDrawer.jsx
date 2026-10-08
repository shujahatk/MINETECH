'use client';
import { ModalFrame } from '@/components/ui/modal-frame';

import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Tag,
  Plus,
  Mail,
  Building,
  Clock,
  Send,
  Check,
  Copy,
  ExternalLink,
  User,
  Zap,
  ChevronRight,
  ShieldAlert,
  Calendar,
  Beaker,
  PackageCheck,
  Layers,
  MapPin,
  Flame,
  Star,
  DollarSign,
  Truck,
  FileText,
  UserPlus,
  Trash2,
  Edit3,
  AlertCircle,
  Sparkles,
  BrainCircuit,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  HelpCircle,
  Lightbulb,
  FileCheck,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import TemperatureBadge from '@/components/leads/TemperatureBadge';
import { deriveTemperature } from '@/lib/leads/temperature';
import { dayDiff, formatDateTime, formatShortDate, initials, localDateString, statusLabel, timeAgo } from '@/lib/leads/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_INDUSTRIES,
  INCOTERMS_OPTIONS,
  PACKAGING_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  KNOWN_TRADE_SHOWS,
  OPPORTUNITY_STATUS_OPTIONS,
  SAMPLE_TECHNICAL_STATUSES,
  TRIAL_STATUSES,
  NEXT_ACTION_PRESETS,
  OPPORTUNITY_PRIORITIES,
  CONTACT_DEPARTMENTS,
  DECISION_MAKER_ROLES,
} from '@/lib/services/catalogService';

import LeadAiBrain from '@/components/ai/LeadAiBrain';

// The compose modal is only needed when the user clicks Email — keep it out of the drawer's initial bundle.
const ComposeModal = dynamic(() => import('@/components/email/ComposeModal'), { ssr: false });

const MINETECH_STAGES = [
  { id: 'NEW', label: '1. New Lead — Identified, not contacted' },
  { id: 'CONTACTED', label: '2. Contacted — Outreach sent / call made' },
  { id: 'ENGAGED', label: '3. Engaged — Replied / meeting booked' },
  { id: 'TECHNICAL_EVALUATION', label: '4. Technical Evaluation — Specs, samples & testing' },
  { id: 'COMMERCIAL_DISCUSSION', label: '5. Commercial Discussion — Price, volume, Incoterms' },
  { id: 'TRIAL_ORDER', label: '6. Trial Order — Paid trial load / commercial test' },
  { id: 'APPROVED_SUPPLIER', label: '7. Approved Supplier — Technically & commercially approved' },
  { id: 'RECURRING_CUSTOMER', label: '8. Recurring Customer — Regular orders & loads' },
];

function OverviewField({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

/** Titled card used for every drawer section so spacing, headings and actions stay consistent. */
function Section({ title, icon: Icon, action = null, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-border bg-card shadow-subtle ${className}`}>
      <header className="flex min-h-[36px] items-center justify-between gap-2 border-b border-border/70 px-4 py-1.5">
        <h3 className="field-label flex items-center gap-1.5">
          {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
          {title}
        </h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SectionLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}

function InlineSkeleton({ className = 'w-20' }) {
  return <span className={`skeleton inline-block h-4 rounded align-middle ${className}`} aria-hidden="true" />;
}

/**
 * Read-first summary of the lead: identity, pipeline position, ownership, campaigns, follow-up, tags,
 * email history and recent activity. Everything here comes from data already loaded for the drawer.
 */
function OverviewTab({
  lead,
  summary,
  timeline,
  loadingTimeline,
  tags,
  tagInput,
  onTagInput,
  onAddTag,
  onRemoveTag,
  stage,
  priority,
  companyName,
  country,
  city,
  website,
  assignedRep,
  nextAction,
  nextActionDate,
  noteText,
  copiedEmail,
  onCopyEmail,
  onOpenTab,
}) {
  const today = localDateString();
  const diff = dayDiff(nextActionDate, today);
  const temperature = deriveTemperature({ priority, score: lead.score });
  const emails = timeline.filter((t) => t.type === 'email').slice(0, 5);
  const activity = timeline.filter((t) => t.type === 'activity').slice(0, 4);
  const followTone =
    diff !== null && diff < 0
      ? 'text-rose-600 dark:text-rose-400 font-medium'
      : diff === 0
        ? 'text-amber-700 dark:text-amber-400 font-medium'
        : 'text-muted-foreground';

  return (
    <div className="space-y-3">
      <Section title="Contact" icon={User}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
          <OverviewField label="Contact">
            <div className="truncate font-medium">{lead.fullName || lead.name || '—'}</div>
            {lead.jobTitle && <div className="truncate text-xs text-muted-foreground">{lead.jobTitle}</div>}
          </OverviewField>
          <OverviewField label="Company">
            <div className="truncate font-medium">{companyName || '—'}</div>
            {(city || country) && (
              <div className="truncate text-xs text-muted-foreground">{[city, country].filter(Boolean).join(', ')}</div>
            )}
          </OverviewField>
          <OverviewField label="Email">
            {lead.email ? (
              <div className="flex items-center gap-1">
                <span className="truncate">{lead.email}</span>
                <button
                  type="button"
                  onClick={onCopyEmail}
                  aria-label="Copy email address"
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {copiedEmail ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            ) : (
              '—'
            )}
          </OverviewField>
          <OverviewField label="Website">
            {website ? (
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"
              >
                <span className="truncate">{website.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </OverviewField>
        </dl>
      </Section>

      <Section title="Pipeline" icon={Layers}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
          <OverviewField label="Status">
            <StatusBadge status={stage} label={statusLabel(stage)} size="sm" />
          </OverviewField>
          <OverviewField label="Priority">
            <TemperatureBadge temperature={temperature} score={lead.score} showScore />
          </OverviewField>
          <OverviewField label="Owner">{summary?.ownerName || assignedRep || <span className="text-muted-foreground">Unassigned</span>}</OverviewField>
          <OverviewField label="Last contacted">
            {summary === null ? (
              <InlineSkeleton className="w-24" />
            ) : summary.lastContactedAt ? (
              <span title={formatDateTime(summary.lastContactedAt)}>
                {timeAgo(summary.lastContactedAt)}
                <span className="ml-1.5 text-xs text-muted-foreground">{formatDateTime(summary.lastContactedAt)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Never</span>
            )}
          </OverviewField>
          <OverviewField label="Next follow-up">
            {nextAction || nextActionDate ? (
              <div>
                {nextAction && <div className="truncate">{nextAction}</div>}
                {nextActionDate && (
                  <div className={`text-xs ${followTone}`}>
                    {diff !== null && diff < 0 ? 'Overdue · ' : diff === 0 ? 'Today · ' : ''}
                    {formatShortDate(nextActionDate)}
                  </div>
                )}
              </div>
            ) : (
              <SectionLink onClick={() => onOpenTab('notes')}>Schedule a follow-up</SectionLink>
            )}
          </OverviewField>
          <OverviewField label="Campaigns">
            {summary === null ? (
              <InlineSkeleton className="w-28" />
            ) : summary.campaigns.length === 0 ? (
              <span className="text-muted-foreground">Not in a campaign</span>
            ) : (
              <ul className="space-y-1">
                {summary.campaigns.slice(0, 4).map((c, i) => (
                  <li key={`${c.id}-${i}`} className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="truncate font-medium text-foreground">{c.name}</span>
                    <StatusBadge status={c.recipientStatus || 'pending'} label={String(c.recipientStatus || 'pending').toLowerCase()} size="sm" />
                  </li>
                ))}
                {summary.campaigns.length > 4 && (
                  <li className="text-[11px] text-muted-foreground">+{summary.campaigns.length - 4} more</li>
                )}
              </ul>
            )}
          </OverviewField>
        </dl>
      </Section>

      <Section title="Tags" icon={Tag}>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted/50 pl-2 pr-1 text-xs text-foreground">
              {t}
              <button
                type="button"
                onClick={() => onRemoveTag(t)}
                aria-label={`Remove tag ${t}`}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAddTag();
            }}
            className="inline-flex items-center gap-1"
          >
            <Input
              value={tagInput}
              onChange={(e) => onTagInput(e.target.value)}
              placeholder="Add tag"
              aria-label="Add tag"
              maxLength={40}
              className="h-6 w-24 px-2 text-xs"
            />
            <Button type="submit" size="sm" variant="outline" className="h-6 w-6 p-0" aria-label="Add tag" disabled={!tagInput.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
          </form>
        </div>
      </Section>

      <LeadAiBrain
        leadId={lead.id || lead._id}
        lead={lead}
        legacySummary={summary?.ai || null}
        onOpenStudy={() => onOpenTab('intelligence')}
      />


      {noteText && (
        <Section title="Notes" icon={FileText} action={<SectionLink onClick={() => onOpenTab('notes')}>Edit</SectionLink>}>
          <p className="line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{noteText}</p>
        </Section>
      )}

      <Section
        title="Email history"
        icon={Mail}
        action={<SectionLink onClick={() => onOpenTab('timeline')}>Full timeline ({timeline.length})</SectionLink>}
      >
        {loadingTimeline ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-9 rounded-md bg-muted" />
            ))}
          </div>
        ) : emails.length === 0 ? (
          <p className="text-xs text-muted-foreground">No emails yet. Use Email above to start the conversation.</p>
        ) : (
          <ul className="-my-2 divide-y divide-border/60">
            {emails.map((m, i) => (
              <li key={m.id || i} className="flex items-start gap-2.5 py-2">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground">{m.subject || m.summary || 'Email'}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {m.direction === 'inbound' ? 'Received' : m.isBlast ? 'Campaign' : 'Sent'}
                    {m.status ? ` · ${String(m.status).toLowerCase()}` : ''}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground" title={formatDateTime(m.timestamp || m.createdAt)}>
                  {timeAgo(m.timestamp || m.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {activity.length > 0 && (
        <Section title="Recent activity" icon={Clock}>
          <ul className="space-y-1.5">
            {activity.map((a, i) => (
              <li key={a.id || i} className="flex items-start justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-foreground">{a.summary || a.action}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(a.timestamp || a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-1 pt-1 text-xs text-muted-foreground sm:grid-cols-4">
        <div>
          <dt>Added</dt>
          <dd className="text-foreground">{lead.createdAt ? formatDateTime(lead.createdAt) : '—'}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd className="text-foreground">{lead.updated_at ? timeAgo(lead.updated_at) : '—'}</dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd className="tabular-nums text-foreground">{lead.score !== undefined && lead.score !== null ? Math.round(lead.score) : '—'}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd className="truncate text-foreground">{lead.leadSource || '—'}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function LeadDrawer({ leadId, initialLead = null, onClose, onUpdated }) {
  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [summary, setSummary] = useState(null); // { lastContactedAt, campaigns[], ai, ownerName } — small, fetched on open
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'opportunity' | 'intelligence' | 'conversation_intel' | 'company' | 'contacts' | 'timeline' | 'notes'
  const loadedTabsRef = React.useRef({ intelligence: false, conversation_intel: false });
  
  // Editable Opportunity State
  const [stage, setStage] = useState('NEW');
  const [opportunityStatus, setOpportunityStatus] = useState('ACTIVE');
  const [productCategory, setProductCategory] = useState('Kaolin');
  const [productGrade, setProductGrade] = useState('');
  const [industry, setIndustry] = useState('Ceramics');
  const [application, setApplication] = useState('Sanitaryware');
  const [sampleStatus, setSampleStatus] = useState('Requirements Not Yet Received');
  const [trialStatus, setTrialStatus] = useState('Trial Discussed');
  const [priority, setPriority] = useState('WARM');
  const [monthlyTonnage, setMonthlyTonnage] = useState('');
  const [annualTonnage, setAnnualTonnage] = useState('');
  const [packaging, setPackaging] = useState('1,000 kg Big Bags (Jumbo with PE liner)');
  const [incoterm, setIncoterm] = useState('CIF');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currentSupplier, setCurrentSupplier] = useState('');
  const [currentProductGrade, setCurrentProductGrade] = useState('');
  const [specs, setSpecs] = useState('');
  const [technicalNotes, setTechnicalNotes] = useState('');
  const [commercialNotes, setCommercialNotes] = useState('');
  const [expectedDecisionDate, setExpectedDecisionDate] = useState('');

  // Editable Company State
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('Germany');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [companyType, setCompanyType] = useState('Manufacturer');
  const [estimatedSize, setEstimatedSize] = useState('');
  const [leadSource, setLeadSource] = useState('Cold Outreach');
  const [tradeShowEvent, setTradeShowEvent] = useState('');
  const [assignedRep, setAssignedRep] = useState('MineTech Sales');

  // Next Action State
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [noteText, setNoteText] = useState('');

  // Contacts List State
  const [contacts, setContacts] = useState([]);
  const [newContact, setNewContact] = useState({
    name: '',
    jobTitle: '',
    department: 'Purchasing / Procurement',
    role: 'Decision Maker',
    email: '',
    phone: '',
    linkedIn: '',
  });
  const [showAddContact, setShowAddContact] = useState(false);

  // Modals & helpers
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [selectedEmailForPreview, setSelectedEmailForPreview] = useState(null);

  // AI Lead Intelligence State
  const [intelligence, setIntelligence] = useState(null);
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  const [analyzingIntelligence, setAnalyzingIntelligence] = useState(false);
  const [humanGuidanceText, setHumanGuidanceText] = useState('');
  const [savingGuidance, setSavingGuidance] = useState(false);
  const [guidanceSavedMsg, setGuidanceSavedMsg] = useState('');

  // Conversation Intelligence State
  const [conversationIntel, setConversationIntel] = useState(null);
  const [loadingConvIntel, setLoadingConvIntel] = useState(false);
  const [convOverrideText, setConvOverrideText] = useState('');
  const [savingConvOverride, setSavingConvOverride] = useState(false);
  const [convOverrideSavedMsg, setConvOverrideSavedMsg] = useState('');

  const fetchIntelligence = async () => {
    if (!leadId) return;
    setLoadingIntelligence(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/intelligence`);
      if (res.ok) {
        const json = await res.json();
        setIntelligence(json.data || null);
        if (json.data?.humanOverrideContext) {
          setHumanGuidanceText(json.data.humanOverrideContext);
        }
      }
    } catch (e) {
      console.error('Error fetching lead intelligence:', e);
    } finally {
      setLoadingIntelligence(false);
    }
  };

  const fetchConversationIntel = async () => {
    if (!leadId) return;
    setLoadingConvIntel(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/conversation-intelligence`);
      if (res.ok) {
        const json = await res.json();
        setConversationIntel(json.data || null);
        if (json.data?.humanOverrideContext) {
          setConvOverrideText(json.data.humanOverrideContext);
        }
      }
    } catch (e) {
      console.error('Error fetching conversation intel:', e);
    } finally {
      setLoadingConvIntel(false);
    }
  };

  const handleSaveConvOverride = async () => {
    if (!leadId) return;
    setSavingConvOverride(true);
    setConvOverrideSavedMsg('');
    try {
      const res = await fetch(`/api/leads/${leadId}/conversation-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_override',
          humanContext: convOverrideText,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setConversationIntel(json.data);
        setConvOverrideSavedMsg('Saved!');
        setTimeout(() => setConvOverrideSavedMsg(''), 2500);
      }
    } catch (e) {
      console.error('Error saving conv override:', e);
    } finally {
      setSavingConvOverride(false);
    }
  };

  const handleAnalyzeLead = async (force = true) => {
    if (!leadId) return;
    setAnalyzingIntelligence(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: force ? 'force_refresh' : 'refresh',
          force,
          humanContext: humanGuidanceText,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setIntelligence(json.data);
      }
    } catch (e) {
      console.error('Error analyzing lead:', e);
    } finally {
      setAnalyzingIntelligence(false);
    }
  };

  const handleKeepExisting = async () => {
    if (!leadId) return;
    setAnalyzingIntelligence(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'keep_existing' }),
      });
      if (res.ok) {
        const json = await res.json();
        setIntelligence((prev) => ({ ...prev, status: 'CURRENT', ...json.data }));
      }
    } catch (e) {
      console.error('Error keeping existing intelligence:', e);
    } finally {
      setAnalyzingIntelligence(false);
    }
  };

  const handleSaveGuidance = async () => {
    if (!leadId) return;
    setSavingGuidance(true);
    setGuidanceSavedMsg('');
    try {
      const res = await fetch(`/api/leads/${leadId}/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_override',
          humanContext: humanGuidanceText,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setIntelligence(json.data);
        setGuidanceSavedMsg('Saved!');
        setTimeout(() => setGuidanceSavedMsg(''), 2500);
      }
    } catch (e) {
      console.error('Error saving guidance:', e);
    } finally {
      setSavingGuidance(false);
    }
  };

  const fetchLeadData = async () => {
    setLoadError('');
    try {
      const leadRes = await fetch(`/api/leads/${leadId}`);
      if (!leadRes.ok) throw new Error(leadRes.status === 404 ? 'This lead no longer exists.' : 'Could not load this lead.');

      {
        const leadJson = await leadRes.json();
        const d = leadJson.data;
        setLead(d);
        setTags(d.tags || []);
        const cf = d.custom_fields || d.customFields || {};

        setStage(d.status || 'NEW');
        setOpportunityStatus(d.opportunityStatus || cf.opportunity_status || 'ACTIVE');
        setProductCategory(d.productCategory || cf.product_category || 'Kaolin');
        setProductGrade(d.productGrade || cf.product_grade || '');
        setIndustry(d.industry || cf.industry || 'Ceramics');
        setApplication(d.application || cf.application || 'Sanitaryware');
        setSampleStatus(d.sampleStatus || cf.sample_status || 'Requirements Not Yet Received');
        setTrialStatus(d.trialStatus || cf.trial_status || 'Trial Discussed');
        setPriority(d.priority || cf.priority || 'WARM');
        setMonthlyTonnage(d.estimatedMonthlyTonnage || cf.estimated_monthly_tonnage || '');
        setAnnualTonnage(d.estimatedAnnualTonnage || cf.estimated_annual_tonnage || '');
        setPackaging(d.packagingRequirement || cf.packaging_requirement || '1,000 kg Big Bags (Jumbo with PE liner)');
        setIncoterm(d.incoterm || cf.incoterm || 'CIF');
        setDeliveryLocation(d.deliveryLocation || cf.delivery_location || '');
        setTargetPrice(d.targetPrice || cf.target_price || '');
        setCurrentPrice(d.currentPrice || cf.current_price || '');
        setCurrentSupplier(d.currentSupplier || cf.current_supplier || '');
        setCurrentProductGrade(d.currentProductGrade || cf.current_product_grade || '');
        setSpecs(d.requiredSpecifications || cf.required_specifications || '');
        setTechnicalNotes(d.technicalNotes || cf.technical_notes || '');
        setCommercialNotes(d.commercialNotes || cf.commercial_notes || '');
        setExpectedDecisionDate(d.expectedDecisionDate || cf.expected_decision_date || '');

        setCompanyName(d.company || '');
        setCountry(d.country || cf.country || 'Germany');
        setCity(d.city || cf.city || '');
        setAddress(d.address || cf.address || '');
        setWebsite(d.website || '');
        setCompanyType(d.companyType || cf.company_type || 'Manufacturer');
        setEstimatedSize(d.estimatedSize || cf.estimated_size || '');
        setLeadSource(d.leadSource || cf.lead_source || 'Cold Outreach');
        setTradeShowEvent(d.tradeShowEvent || cf.trade_show_event || '');
        setAssignedRep(d.assignedSalesperson || cf.assigned_salesperson || 'MineTech Sales');

        setNextAction(d.nextAction || cf.next_action || '');
        if (d.nextActionDate || cf.next_action_date || d.nextFollowUpAt) {
          const actDate = d.nextActionDate || cf.next_action_date || d.nextFollowUpAt;
          setNextActionDate(new Date(actDate).toISOString().split('T')[0]);
        }
        setNoteText(d.notes || '');

        const existingContacts = d.contacts || cf.contacts || [];
        if (existingContacts.length === 0 && d.fullName) {
          setContacts([
            {
              id: 'primary',
              name: d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim(),
              jobTitle: d.jobTitle || 'Key Contact',
              department: d.department || cf.department || 'Purchasing / Procurement',
              role: d.decisionMakerRole || cf.decision_maker_role || 'Decision Maker',
              email: d.email || '',
              phone: d.phone || '',
              linkedIn: '',
            },
          ]);
        } else {
          setContacts(existingContacts);
        }

        // Set intelligence if returned in lead payload
        if (d.enrich_data?.ai_intelligence || cf.ai_intelligence) {
          const initialIntel = d.enrich_data?.ai_intelligence || cf.ai_intelligence;
          setIntelligence(initialIntel);
          if (initialIntel.humanOverrideContext) {
            setHumanGuidanceText(initialIntel.humanOverrideContext);
          }
        }
      }

    } catch (err) {
      console.error('Error fetching lead details:', err);
      setLoadError(err.message || 'Could not load this lead.');
    } finally {
      setLoading(false);
    }
  };

  // Heavy history is fetched only now that the drawer is open, and independently of the lead record,
  // so the form appears as soon as the lead itself arrives.
  const fetchTimeline = async () => {
    setLoadingTimeline(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/timeline`);
      if (res.ok) {
        const json = await res.json();
        setTimeline(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching lead timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/summary`);
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data || null);
      }
    } catch (err) {
      console.error('Error fetching lead summary:', err);
    }
  };

  useEffect(() => {
    if (!leadId) return;
    loadedTabsRef.current = { intelligence: false, conversation_intel: false };
    fetchLeadData();
    fetchTimeline();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // AI study + conversation intel are only fetched the first time their tab is opened.
  useEffect(() => {
    if (!leadId) return;
    if (activeTab === 'intelligence' && !loadedTabsRef.current.intelligence) {
      loadedTabsRef.current.intelligence = true;
      fetchIntelligence();
    }
    if (activeTab === 'conversation_intel' && !loadedTabsRef.current.conversation_intel) {
      loadedTabsRef.current.conversation_intel = true;
      fetchConversationIntel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, leadId]);

  const saveOpportunityChanges = async (overridePayload = {}) => {
    setIsSaving(true);
    setSaveSuccessMsg('');
    try {
      const payload = {
        status: stage,
        opportunityStatus,
        productCategory,
        productGrade,
        industry,
        application,
        sampleStatus,
        trialStatus,
        priority,
        estimatedMonthlyTonnage: monthlyTonnage,
        estimatedAnnualTonnage: annualTonnage,
        packagingRequirement: packaging,
        incoterm,
        deliveryLocation,
        targetPrice,
        currentPrice,
        currentSupplier,
        currentProductGrade,
        requiredSpecifications: specs,
        technicalNotes,
        commercialNotes,
        expectedDecisionDate,
        company: companyName,
        country,
        city,
        address,
        website,
        companyType,
        estimatedSize,
        leadSource,
        tradeShowEvent,
        assignedSalesperson: assignedRep,
        nextAction,
        nextActionDate: nextActionDate ? new Date(nextActionDate).toISOString() : null,
        notes: noteText,
        contacts,
        ...overridePayload,
      };

      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Save failed');
      const json = await res.json().catch(() => ({}));
      setSaveSuccessMsg('Saved successfully');
      setTimeout(() => setSaveSuccessMsg(''), 2500);
      // The PUT already returns the updated lead — no refetch of the lead or its timeline.
      if (json?.data) {
        setLead(json.data);
        if (onUpdated) onUpdated(json.data);
      } else if (onUpdated) {
        onUpdated();
      }
    } catch (err) {
      console.error('Failed to save opportunity changes:', err);
      toast.error('Could not save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStageDirectChange = (newStage) => {
    setStage(newStage);
    saveOpportunityChanges({ status: newStage });
  };

  const handleOpportunityStatusChange = (newOppStatus) => {
    setOpportunityStatus(newOppStatus);
    saveOpportunityChanges({ opportunityStatus: newOppStatus });
  };

  const handleAddContact = () => {
    if (!newContact.name) return;
    const updated = [
      ...contacts,
      { ...newContact, id: `ct_${Date.now()}` },
    ];
    setContacts(updated);
    setNewContact({
      name: '',
      jobTitle: '',
      department: 'Purchasing / Procurement',
      role: 'Decision Maker',
      email: '',
      phone: '',
      linkedIn: '',
    });
    setShowAddContact(false);
    saveOpportunityChanges({ contacts: updated });
  };

  const handleRemoveContact = (cId) => {
    const updated = contacts.filter((c) => c.id !== cId);
    setContacts(updated);
    saveOpportunityChanges({ contacts: updated });
  };

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  // Find available grades for the selected category
  const activeCategoryObj = DEFAULT_PRODUCT_CATEGORIES.find((c) => c.name === productCategory);
  const availableGrades = activeCategoryObj?.grades || [];

  // Find available applications for the selected industry
  const activeIndustryObj = DEFAULT_INDUSTRIES.find((i) => i.name === industry);
  const availableApps = activeIndustryObj?.applications || [];

  const saveTags = async (nextTags) => {
    const previous = tags;
    setTags(nextTags);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (!res.ok) throw new Error('Save failed');
      const json = await res.json().catch(() => ({}));
      if (json?.data && onUpdated) onUpdated(json.data);
    } catch (err) {
      setTags(previous);
      toast.error('Could not update tags.');
    }
  };

  const addTag = () => {
    const t = tagInput.trim().slice(0, 40);
    setTagInput('');
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    saveTags([...tags, t]);
  };

  // Instant shell: the list row we already have renders the header immediately while the full record loads.
  if (!lead && loading) {
    const row = initialLead || {};
    const heading = row.company || row.name || '';
    const subline = [row.company ? row.name : '', row.jobTitle].filter(Boolean).join(' \u00b7 ');
    return (
      <ModalFrame drawer title="Lead details" onClose={onClose}>
        <div className="flex min-h-full flex-col bg-card text-foreground" aria-busy="true">
          <div className="border-b border-border bg-card">
            <div className="space-y-3 px-5 pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-[13px] font-semibold text-foreground"
                  >
                    {heading ? heading.substring(0, 2).toUpperCase() : <span className="skeleton block h-4 w-5 rounded bg-muted" />}
                  </div>
                  <div className="min-w-0">
                    {heading ? (
                      <h2 className="truncate text-[15px] font-semibold leading-tight tracking-tight">{heading}</h2>
                    ) : (
                      <div className="skeleton h-4 w-40 rounded bg-muted" />
                    )}
                    {subline ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{subline}</p>
                    ) : (
                      <div className="skeleton mt-1.5 h-3 w-28 rounded bg-muted" />
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close lead details"
                  className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {row.status ? (
                  <StatusBadge status={row.status} label={statusLabel(row.status)} size="sm" />
                ) : (
                  <div className="skeleton h-5 w-20 rounded-md bg-muted" />
                )}
                {row.temperature ? (
                  <TemperatureBadge temperature={row.temperature} score={row.score} showScore />
                ) : (
                  <div className="skeleton h-5 w-14 rounded-md bg-muted" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="skeleton h-8 w-20 rounded-lg bg-muted" />
                <div className="skeleton h-8 w-44 rounded-lg bg-muted" />
              </div>
            </div>
            <div className="flex items-center gap-4 px-5 pb-2.5 pt-1">
              {[48, 64, 52, 72, 56].map((w, i) => (
                <div key={i} className="skeleton h-3 rounded bg-muted" style={{ width: w }} />
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-3 bg-muted/20 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-subtle">
                <div className="skeleton h-3 w-20 rounded bg-muted" />
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="skeleton h-8 rounded bg-muted" />
                  <div className="skeleton h-8 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ModalFrame>
    );
  }
  if (!lead) {
    return (
      <ModalFrame drawer title="Lead details" onClose={onClose}>
        <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-card p-10 text-center">
          <AlertCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-foreground">{loadError || 'Could not load this lead.'}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLoading(true);
                fetchLeadData();
              }}
            >
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame drawer title="Opportunity & Company Dossier" onClose={onClose}>
      <div className="flex min-h-full flex-col bg-card text-foreground">
        
        {/* 1 + 2. Sticky header: identity, state, primary actions, tabs */}
        <div className="sticky top-0 z-20 border-b border-border bg-card">
          <div className="space-y-3 px-5 pb-3 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-[13px] font-semibold text-foreground"
                >
                  {companyName ? companyName.substring(0, 2).toUpperCase() : 'MT'}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
                    {companyName || lead.fullName || 'MineTech Opportunity'}
                  </h2>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {lead.fullName && companyName && <span className="truncate">{lead.fullName}</span>}
                    {lead.fullName && companyName && country && <span aria-hidden="true">·</span>}
                    {country && (
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden="true" /> {country}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close lead details"
                title="Close (Esc)"
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* State chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={stage} label={statusLabel(stage)} size="sm" />
              <TemperatureBadge temperature={deriveTemperature({ priority, score: lead.score })} score={lead.score} showScore />
              {priority === 'STRATEGIC' && (
                <span className="inline-flex h-5 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 text-[11px] font-medium leading-none text-primary">
                  <Star className="h-3 w-3" aria-hidden="true" /> Strategic
                </span>
              )}
              {productCategory && (
                <span className="inline-flex h-5 items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 text-[11px] font-medium leading-none text-foreground">
                  {productCategory}
                  {productGrade && <span className="font-normal text-muted-foreground">· {productGrade}</span>}
                </span>
              )}
            </div>

            {/* Primary actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setIsComposeOpen(true)} className="h-8 gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span>Email</span>
              </Button>

              <label className="relative inline-flex">
                <span className="sr-only">Pipeline stage</span>
                <select
                  value={stage}
                  onChange={(e) => handleStageDirectChange(e.target.value)}
                  className="h-8 max-w-[210px] cursor-pointer appearance-none truncate rounded-lg border border-border bg-card pl-2.5 pr-7 text-xs font-medium text-foreground shadow-subtle outline-none transition-colors hover:border-muted-foreground/40 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15"
                >
                  {MINETECH_STAGES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <ChevronRight
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 rotate-90 text-muted-foreground"
                />
              </label>

              {website && (
                <a
                  href={website.startsWith('http') ? website : `https://${website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-subtle transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  title="Visit website"
                  aria-label="Visit website"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => saveOpportunityChanges()}
                disabled={isSaving}
                className="ml-auto h-8 gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Saving…' : saveSuccessMsg || 'Save changes'}</span>
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div role="tablist" aria-label="Lead sections" className="scrollbar-none flex items-center gap-0.5 overflow-x-auto px-3 text-xs font-medium">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'opportunity', label: 'Opportunity' },
              {
                id: 'intelligence',
                label: 'AI study',
                icon: Sparkles,
                dot: (intelligence?.status || summary?.ai?.status) === 'OUTDATED'
                  ? { cls: 'bg-amber-500', title: 'Outdated analysis' }
                  : (intelligence?.status || summary?.ai?.status) === 'CURRENT'
                    ? { cls: 'bg-primary', title: 'Current analysis' }
                    : null,
              },
              {
                id: 'conversation_intel',
                label: 'Conversation',
                icon: FileCheck,
                count: conversationIntel?.confirmedFacts?.length || 0,
                hideZero: true,
              },
              { id: 'company', label: 'Company' },
              { id: 'contacts', label: 'Contacts', count: contacts.length },
              { id: 'timeline', label: 'Timeline', count: timeline.length },
              { id: 'notes', label: 'Notes' },
            ].map((tab) => {
              const on = activeTab === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md px-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 ${
                    on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {TabIcon && <TabIcon className={`h-3.5 w-3.5 ${on ? 'text-primary' : ''}`} aria-hidden="true" />}
                  <span>{tab.label}</span>
                  {tab.dot && <span className={`h-1.5 w-1.5 rounded-full ${tab.dot.cls}`} title={tab.dot.title} />}
                  {tab.count !== undefined && !(tab.hideZero && tab.count === 0) && (
                    <span className="rounded bg-muted px-1 text-[10px] font-semibold leading-4 tabular-nums text-muted-foreground">
                      {tab.count}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-transparent'}`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Drawer Body */}
        <div className="flex-1 space-y-3 bg-muted/20 p-4">
          
          {/* TAB 0: OVERVIEW (default) */}
          {activeTab === 'overview' && (
            <OverviewTab
              lead={lead}
              summary={summary}
              timeline={timeline}
              loadingTimeline={loadingTimeline}
              tags={tags}
              tagInput={tagInput}
              onTagInput={setTagInput}
              onAddTag={addTag}
              onRemoveTag={(t) => saveTags(tags.filter((x) => x !== t))}
              stage={stage}
              priority={priority}
              companyName={companyName}
              country={country}
              city={city}
              website={website}
              assignedRep={assignedRep}
              nextAction={nextAction}
              nextActionDate={nextActionDate}
              noteText={noteText}
              copiedEmail={copiedEmail}
              onCopyEmail={() => copyToClipboard(lead.email, 'email')}
              onOpenTab={setActiveTab}
            />
          )}

          {/* TAB 1: OPPORTUNITY & MINERAL SPECS */}
          {activeTab === 'opportunity' && (
            <div className="space-y-4">
              
              {/* Opportunity Status & Pipeline Stage Overview */}
              <Card className="p-4 space-y-3.5 bg-card border-border shadow-subtle">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <span className="field-label block">
                    Sales Pipeline Position
                  </span>
                  <StatusBadge status={stage} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label block mb-1">
                      Current Stage
                    </label>
                    <select
                      value={stage}
                      onChange={(e) => setStage(e.target.value)}
                      className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      {MINETECH_STAGES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Opportunity Status
                    </label>
                    <select
                      value={opportunityStatus}
                      onChange={(e) => setOpportunityStatus(e.target.value)}
                      className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      {OPPORTUNITY_STATUS_OPTIONS.map((st) => (
                        <option key={st.id} value={st.id}>{st.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>

              {/* 2 & 3 & 5. PRODUCT CLASSIFICATION, GRADES & APPLICATION */}
              <Card className="p-4 space-y-3.5 bg-card border-border shadow-subtle">
                <span className="field-label block border-b border-border pb-2">
                  Mineral Classification & Technical Application
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Product Category */}
                  <div>
                    <label className="field-label block mb-1">
                      Product Category
                    </label>
                    <select
                      value={productCategory}
                      onChange={(e) => {
                        setProductCategory(e.target.value);
                        setProductGrade('');
                      }}
                      className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      {DEFAULT_PRODUCT_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Specific Product Grade */}
                  <div>
                    <label className="field-label block mb-1">
                      Specific Product Grade
                    </label>
                    {availableGrades.length > 0 ? (
                      <select
                        value={productGrade}
                        onChange={(e) => setProductGrade(e.target.value)}
                        className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                      >
                        <option value="">Select or Type Grade...</option>
                        {availableGrades.map((g, idx) => (
                          <option key={idx} value={g}>{g}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={productGrade}
                        onChange={(e) => setProductGrade(e.target.value)}
                        placeholder="e.g. Perfometa / BC-80 / PB1000"
                        className="h-8 text-[13px]"
                      />
                    )}
                  </div>

                  {/* Industry */}
                  <div>
                    <label className="field-label block mb-1">
                      Industry Vertical
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => {
                        setIndustry(e.target.value);
                        setApplication('');
                      }}
                      className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      {DEFAULT_INDUSTRIES.map((ind) => (
                        <option key={ind.id} value={ind.name}>{ind.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Application */}
                  <div>
                    <label className="field-label block mb-1">
                      Application / Use-Case
                    </label>
                    {availableApps.length > 0 ? (
                      <select
                        value={application}
                        onChange={(e) => setApplication(e.target.value)}
                        className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                      >
                        <option value="">Select Application...</option>
                        {availableApps.map((a, idx) => (
                          <option key={idx} value={a}>{a}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={application}
                        onChange={(e) => setApplication(e.target.value)}
                        placeholder="e.g. Sanitaryware, Palm Oil Bleaching"
                        className="h-8 text-[13px]"
                      />
                    )}
                  </div>
                </div>

                {/* Technical Specifications */}
                <div>
                  <label className="field-label block mb-1">
                    Required Specifications / Technical Notes
                  </label>
                  <Textarea
                    value={specs}
                    onChange={(e) => setSpecs(e.target.value)}
                    rows={2}
                    placeholder="Al2O3 content, particle size (D50/D98), moisture, whiteness/brightness, viscosity, activity index..."
                    className="text-[13px]"
                  />
                </div>
              </Card>

              {/* 6 & 7. TECHNICAL EVALUATION & TRIAL SUB-STATUSES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* 6. Sample / Technical Status */}
                <Card className={`p-4 space-y-2 border transition-all ${stage === 'TECHNICAL_EVALUATION' ? 'bg-primary/5 border-primary/40' : 'bg-card border-border'}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Beaker className="h-3.5 w-3.5 text-primary" />
                      <span>Sample / Technical Status</span>
                    </label>
                    {stage === 'TECHNICAL_EVALUATION' && (
                      <span className="text-[9px] font-semibold text-primary uppercase tracking-wider bg-primary/15 px-1.5 py-0.5 rounded">Active Stage</span>
                    )}
                  </div>
                  <select
                    value={sampleStatus}
                    onChange={(e) => setSampleStatus(e.target.value)}
                    className="w-full h-8 text-xs rounded-lg border border-border bg-background text-foreground px-2.5 font-medium focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {SAMPLE_TECHNICAL_STATUSES.map((st, idx) => (
                      <option key={idx} value={st}>{st}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-muted-foreground block">
                    TDS exchange, lab assay testing & mineral qualification
                  </span>
                </Card>

                {/* 7. Trial Order Status */}
                <Card className={`p-4 space-y-2 border transition-all ${stage === 'TRIAL_ORDER' ? 'bg-primary/5 border-primary/40' : 'bg-card border-border'}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <PackageCheck className="h-3.5 w-3.5 text-primary" />
                      <span>Trial Order Status</span>
                    </label>
                    {stage === 'TRIAL_ORDER' && (
                      <span className="text-[9px] font-semibold text-primary uppercase tracking-wider bg-primary/15 px-1.5 py-0.5 rounded">Active Stage</span>
                    )}
                  </div>
                  <select
                    value={trialStatus}
                    onChange={(e) => setTrialStatus(e.target.value)}
                    className="w-full h-8 text-xs rounded-lg border border-border bg-background text-foreground px-2.5 font-medium focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {TRIAL_STATUSES.map((st, idx) => (
                      <option key={idx} value={st}>{st}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-muted-foreground block">
                    Paid trial load production run & factory testing
                  </span>
                </Card>
              </div>

              {/* 11. COMMERCIAL, TONNAGE & LOGISTICS DETAILS */}
              <Card className="p-4 space-y-3.5 bg-card border-border shadow-subtle">
                <span className="field-label block border-b border-border pb-2">
                  Commercial Conditions & Logistics Parameters
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="field-label block mb-1">
                      Monthly Tonnage (MT)
                    </label>
                    <Input
                      type="text"
                      value={monthlyTonnage}
                      onChange={(e) => setMonthlyTonnage(e.target.value)}
                      placeholder="e.g. 150 MT"
                      className="h-8 text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Annual Tonnage (MT)
                    </label>
                    <Input
                      type="text"
                      value={annualTonnage}
                      onChange={(e) => setAnnualTonnage(e.target.value)}
                      placeholder="e.g. 1,800 MT"
                      className="h-8 text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Incoterm
                    </label>
                    <select
                      value={incoterm}
                      onChange={(e) => setIncoterm(e.target.value)}
                      className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      {INCOTERMS_OPTIONS.map((inc) => (
                        <option key={inc} value={inc}>{inc}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Delivery Port / Location
                    </label>
                    <Input
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="e.g. CIF Hamburg / FOB Antwerp"
                      className="h-8 text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Target Price (€ / MT)
                    </label>
                    <Input
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      placeholder="e.g. €285 / MT"
                      className="h-8 text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Current Price (€ / MT)
                    </label>
                    <Input
                      value={currentPrice}
                      onChange={(e) => setCurrentPrice(e.target.value)}
                      placeholder="e.g. €310 / MT"
                      className="h-8 text-[13px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label block mb-1">
                      Packaging Requirement
                    </label>
                    <select
                      value={packaging}
                      onChange={(e) => setPackaging(e.target.value)}
                      className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      {PACKAGING_OPTIONS.map((pkg, idx) => (
                        <option key={idx} value={pkg}>{pkg}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Current Supplier / Competitor
                    </label>
                    <Input
                      value={currentSupplier}
                      onChange={(e) => setCurrentSupplier(e.target.value)}
                      placeholder="e.g. Imerys / Clariant / Taiko"
                      className="h-8 text-[13px]"
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB: AI INTELLIGENCE */}
          {activeTab === 'intelligence' && (
            <div className="space-y-4 font-sans">
              {/* Header & Status Card */}
              <Card className="p-4 bg-card border-border shadow-subtle space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                        <span>AI Lead Study & Intelligence</span>
                        {intelligence?.status === 'CURRENT' && (
                          <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 text-[10px] font-semibold">
                            ● Analysis Current
                          </span>
                        )}
                        {intelligence?.status === 'OUTDATED' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" /> Outdated (Data Modified)
                          </span>
                        )}
                        {(!intelligence || intelligence.status === 'NOT_ANALYZED') && (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-semibold">
                            Not Analyzed
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Canonical Claude intelligence asset reused across email, dialing, SMS & campaigns.
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {intelligence?.status === 'OUTDATED' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleKeepExisting}
                        disabled={analyzingIntelligence}
                        className="h-7 px-2.5 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                        title="Accept current study without spending Claude tokens"
                      >
                        Keep Existing
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAnalyzeLead(true)}
                      disabled={analyzingIntelligence}
                      className="h-7 px-3 gap-1.5"
                    >
                      {analyzingIntelligence ? (
                        <>
                          <RotateCcw className="h-3 w-3 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          <span>{intelligence?.leadSummary ? 'Refresh Analysis' : 'Analyze Lead'}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Fit, Confidence & Metadata Bar */}
                {intelligence?.leadSummary ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border">
                      <span className="field-label block">Relevance / Fit</span>
                      <span className="text-xs font-semibold text-foreground capitalize mt-0.5 block flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${intelligence.relevance === 'high' ? 'bg-primary' : 'bg-amber-500'}`} />
                        {intelligence.relevance || 'High'} Fit
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border">
                      <span className="field-label block">Analytical Confidence</span>
                      <span className="text-xs font-semibold text-foreground capitalize mt-0.5 block">
                        {intelligence.confidence || 'High'} Confidence
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border">
                      <span className="field-label block">AI Model</span>
                      <span className="text-[11px] font-mono text-muted-foreground mt-0.5 block truncate" title={intelligence.model}>
                        {intelligence.model ? intelligence.model.replace('claude-', '').replace('-20241022', '') : 'Claude 3.5'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border">
                      <span className="field-label block">Last Analyzed</span>
                      <span className="text-[11px] font-mono text-muted-foreground mt-0.5 block">
                        {intelligence.updatedAt ? new Date(intelligence.updatedAt).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                  </div>
                ) : null}
              </Card>

              {/* Main Intelligence Details */}
              {intelligence?.leadSummary ? (
                <>
                  {/* Summary & Why Contact */}
                  <Card className="p-4 space-y-3 bg-card border-border shadow-subtle">
                    <div>
                      <span className="field-label block mb-1">
                        Executive Summary
                      </span>
                      <p className="text-xs text-foreground leading-relaxed">
                        {intelligence.leadSummary}
                      </p>
                    </div>

                    {intelligence.fitReason && (
                      <div className="pt-2.5 border-t border-border">
                        <span className="field-label block mb-1 flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5 text-primary" />
                          Why MineTech Should Contact Them
                        </span>
                        <p className="text-xs text-foreground leading-relaxed bg-primary/5 p-2.5 rounded-lg border border-primary/20">
                          {intelligence.fitReason}
                        </p>
                      </div>
                    )}
                  </Card>

                  {/* Target Products & Evidence */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Relevant Products */}
                    <Card className="p-4 space-y-2.5 bg-card border-border shadow-subtle">
                      <span className="field-label flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        Relevant Products & Minerals
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(intelligence.productsOfInterest || []).map((p, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-semibold"
                          >
                            {p}
                          </span>
                        ))}
                        {(!intelligence.productsOfInterest || intelligence.productsOfInterest.length === 0) && (
                          <span className="text-xs text-muted-foreground italic">No specific minerals specified</span>
                        )}
                      </div>
                    </Card>

                    {/* Key Known Evidence */}
                    <Card className="p-4 space-y-2.5 bg-card border-border shadow-subtle">
                      <span className="field-label flex items-center gap-1.5">
                        <FileCheck className="h-3.5 w-3.5 text-primary" />
                        Key Evidence (Known Facts)
                      </span>
                      <div className="space-y-1.5 pt-1">
                        {(intelligence.evidence || []).map((ev, idx) => (
                          <div key={idx} className="text-xs text-foreground flex items-start gap-1.5">
                            <span className="text-primary font-semibold">•</span>
                            <div className="flex-1">
                              <span>{typeof ev === 'object' ? ev.claim : ev}</span>
                              {typeof ev === 'object' && ev.source && (
                                <span className="text-[10px] text-muted-foreground ml-1 font-mono">
                                  [{ev.source}]
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* Strategy & Personalization Points */}
                  <Card className="p-4 space-y-3 bg-card border-border shadow-subtle">
                    {intelligence.recommendedAngle && (
                      <div>
                        <span className="field-label block mb-1 flex items-center gap-1.5">
                          <Lightbulb className="h-3.5 w-3.5 text-primary" />
                          Recommended Outreach Angle
                        </span>
                        <p className="text-xs text-foreground leading-relaxed bg-muted/20 p-2.5 rounded-lg border border-border font-medium">
                          {intelligence.recommendedAngle}
                        </p>
                      </div>
                    )}

                    {intelligence.personalizationPoints && intelligence.personalizationPoints.length > 0 && (
                      <div className="pt-2.5 border-t border-border">
                        <span className="field-label block mb-1.5">
                          Conversation Personalization Points
                        </span>
                        <ul className="space-y-1 text-xs text-foreground">
                          {intelligence.personalizationPoints.map((pt, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-primary font-semibold">✓</span>
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>

                  {/* Unknowns & Need to Confirm */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Need to Confirm */}
                    <Card className="p-4 space-y-2 bg-card border-border shadow-subtle">
                      <span className="field-label flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-primary" />
                        Need to Confirm
                      </span>
                      <ul className="space-y-1.5 text-xs text-foreground pt-1">
                        {(intelligence.questionsToConfirm || []).map((q, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-muted-foreground font-semibold">?</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>

                    {/* Risks & Limitations */}
                    <Card className="p-4 space-y-2 bg-card border-border shadow-subtle">
                      <span className="field-label flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        Risks / Unknowns (Never Treat as Fact)
                      </span>
                      <ul className="space-y-1.5 text-xs text-muted-foreground pt-1">
                        {(intelligence.risksOrUnknowns || []).map((r, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-500 font-semibold">⚠</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>

                  {/* Human Guidance & Manual Context Override */}
                  <Card className="p-4 space-y-2.5 bg-card border-border shadow-subtle">
                    <div className="flex items-center justify-between">
                      <span className="field-label flex items-center gap-1.5 !text-foreground">
                        <User className="h-3.5 w-3.5 text-primary" />
                        Salesperson Guidance & Manual AI Context
                      </span>
                      {guidanceSavedMsg && (
                        <span className="text-[11px] font-semibold text-primary animate-in fade-in">
                          {guidanceSavedMsg}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Add internal directives or sales overrides (e.g. &quot;Do not ask about bentonite; prospect only sources bleaching earth&quot;). This context is automatically injected into all future email and follow-up prompts.
                    </p>
                    <Textarea
                      rows={2}
                      value={humanGuidanceText}
                      onChange={(e) => setHumanGuidanceText(e.target.value)}
                      placeholder="e.g. Focus on CIF Antwerp pricing; technical director requested 50kg trial batch..."
                      className="text-[13px]"
                    />
                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSaveGuidance}
                        disabled={savingGuidance}
                        className="h-7 px-3 border-border"
                      >
                        {savingGuidance ? 'Saving...' : 'Save AI Guidance'}
                      </Button>
                    </div>
                  </Card>

                  {/* Action Shortcuts */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex-wrap gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Deploy this intelligence across channels:
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsComposeOpen(true)}
                        className="h-7 px-3 gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        <span>Generate Email</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          window.location.href = `/workstation?leadId=${leadId}`;
                        }}
                        className="h-7 px-3 border-border"
                      >
                        <Phone className="h-3 w-3 text-primary" />
                        <span>Open in Workstation</span>
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center bg-card border border-border rounded-xl space-y-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-semibold text-foreground">No AI Lead Study Generated Yet</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Generate a canonical AI Lead Study to analyze mineral compatibility, extract talking points, and unlock automated email briefs.
                  </p>
                  <Button
                    type="button"
                    onClick={() => handleAnalyzeLead(true)}
                    disabled={analyzingIntelligence}
                    className="h-8 px-4 gap-1.5"
                  >
                    {analyzingIntelligence ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                        <span>Analyzing with Claude...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Analyze Lead with Claude</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB: CONVERSATION LEARNING & CONFIRMED FACTS */}
          {activeTab === 'conversation_intel' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Top Header Card */}
              <Card className="p-4 bg-card border-border shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <FileCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-foreground">Conversation Intelligence</h3>
                      {conversationIntel?.isOptOut ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                          Opt-Out / DNC
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          conversationIntel?.supplierIntent === 'positive'
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : conversationIntel?.supplierIntent === 'negative'
                            ? 'bg-destructive/10 text-destructive border-destructive/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          Intent: {conversationIntel?.supplierIntent ? conversationIntel.supplierIntent.toUpperCase() : 'NEUTRAL'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Verified facts extracted directly from supplier email and SMS responses. Supersedes older study unknowns.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsComposeOpen(true)}
                    disabled={conversationIntel?.isOptOut}
                    className="h-8 gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Draft Contextual Reply</span>
                  </Button>
                </div>
              </Card>

              {/* Conflict Alert Banner if any */}
              {conversationIntel?.conflicts && conversationIntel.conflicts.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>CONFLICT DETECTED ACROSS MESSAGES</span>
                  </div>
                  {conversationIntel.conflicts.map((c, i) => (
                    <div key={i} className="text-[11px] bg-background/60 p-2 rounded-lg border border-amber-500/20">
                      <span className="font-semibold capitalize text-foreground">{c.dimension}: </span>
                      <span className="line-through text-muted-foreground mr-2">Earlier: &quot;{c.priorStatement}&quot;</span>
                      <span className="text-primary font-medium">Latest: &quot;{c.latestStatement}&quot;</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Next Best Action Card */}
              <Card className="p-4 bg-muted/20 border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Recommended Next Action
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                    {conversationIntel?.recommendedNextAction || 'Request Quotation & MOQ'}
                  </span>
                </div>
                {conversationIntel?.messageSummary && (
                  <p className="text-xs text-foreground mt-2 font-medium leading-relaxed bg-card p-2.5 rounded-lg border border-border">
                    &quot;{conversationIntel.messageSummary}&quot;
                  </p>
                )}
              </Card>

              {/* Confirmed Facts Section */}
              <Card className="p-4 space-y-3 bg-card border-border shadow-subtle">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="field-label flex items-center gap-1.5 !text-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                    Confirmed from Conversations ({conversationIntel?.confirmedFacts?.length || 0})
                  </span>
                  <span className="text-[10px] text-muted-foreground">Authoritative CRM Truth</span>
                </div>

                {conversationIntel?.confirmedFacts && conversationIntel.confirmedFacts.length > 0 ? (
                  <div className="space-y-1.5">
                    {conversationIntel.confirmedFacts.map((fact, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-foreground p-2 rounded-lg bg-primary/5 border border-primary/15">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="font-medium">{fact}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No supplier replies received yet. Awaiting initial prospect response.
                  </p>
                )}
              </Card>

              {/* Resolved vs Remaining Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Resolved Questions */}
                <Card className="p-4 space-y-2.5 bg-card border-border">
                  <span className="field-label block border-b border-border pb-1.5">
                    Resolved Questions (Do Not Re-Ask)
                  </span>
                  {conversationIntel?.resolvedQuestions && conversationIntel.resolvedQuestions.length > 0 ? (
                    <div className="space-y-1">
                      {conversationIntel.resolvedQuestions.map((q, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground line-through">
                          <Check className="h-3 w-3 text-primary shrink-0" />
                          <span>{q}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No study unknowns resolved yet.</p>
                  )}
                </Card>

                {/* Remaining Unknowns */}
                <Card className="p-4 space-y-2.5 bg-card border-border">
                  <span className="field-label block border-b border-border pb-1.5">
                    Still Unknown / Pending Confirmation
                  </span>
                  {conversationIntel?.remainingUnknowns && conversationIntel.remainingUnknowns.length > 0 ? (
                    <div className="space-y-1">
                      {conversationIntel.remainingUnknowns.map((u, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                          <HelpCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                          <span>{u}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">All critical parameters confirmed or none recorded.</p>
                  )}
                </Card>
              </div>

              {/* Commercial & Technical Signals */}
              {(conversationIntel?.commercialSignals?.length > 0 || conversationIntel?.technicalSignals?.length > 0) && (
                <Card className="p-4 space-y-3 bg-card border-border">
                  <span className="field-label block border-b border-border pb-1.5">
                    Extracted Commercial & Technical Signals
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(conversationIntel.commercialSignals || []).map((s, i) => (
                      <div key={`c-${i}`} className="p-2 rounded-lg bg-muted/30 border border-border text-xs text-foreground font-mono">
                        💼 {s}
                      </div>
                    ))}
                    {(conversationIntel.technicalSignals || []).map((s, i) => (
                      <div key={`t-${i}`} className="p-2 rounded-lg bg-muted/30 border border-border text-xs text-foreground font-mono">
                        ⚗️ {s}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Salesperson Human Override Guidance */}
              <Card className="p-4 space-y-2.5 bg-card border-border shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="field-label flex items-center gap-1.5 !text-foreground">
                    <User className="h-3.5 w-3.5 text-primary" />
                    Human Salesperson Guidance (Highest Priority)
                  </span>
                  {convOverrideSavedMsg && (
                    <span className="text-[10px] font-semibold text-primary font-mono">{convOverrideSavedMsg}</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Provide custom instructions or correct AI interpretations (e.g. &quot;Supplier confirmed EU export, but UK delivery requires separate quote&quot;).
                </p>
                <Textarea
                  value={convOverrideText}
                  onChange={(e) => setConvOverrideText(e.target.value)}
                  placeholder="e.g. Focus on their grade MT-80. Do not ask about bentonite MOQ."
                  className="text-xs min-h-[65px] bg-muted/20 border-border text-foreground rounded-lg"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSaveConvOverride}
                    disabled={savingConvOverride}
                    className="h-7 px-3 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {savingConvOverride ? 'Saving...' : 'Save Conversation Guidance'}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: COMPANY PROFILE */}
          {activeTab === 'company' && (
            <div className="space-y-4">
              <Card className="p-4 space-y-3.5 bg-card border-border shadow-subtle">
                <span className="field-label block border-b border-border pb-2">
                  Company Intelligence
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label block mb-1">
                      Company Name
                    </label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="h-8 text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Company Type
                    </label>
                    <select
                      value={companyType}
                      onChange={(e) => setCompanyType(e.target.value)}
                      className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      {COMPANY_TYPE_OPTIONS.map((ct) => (
                        <option key={ct} value={ct}>{ct}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Country
                    </label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="h-8 text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      City / Region
                    </label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-8 text-[13px]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="field-label block mb-1">
                      Full Address
                    </label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street, Postal Code, Plant location..."
                      className="h-8 text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Website URL
                    </label>
                    <Input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="e.g. www.abcceramics.de"
                      className="h-8 text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Lead Source
                    </label>
                    <select
                      value={leadSource}
                      onChange={(e) => setLeadSource(e.target.value)}
                      className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      {LEAD_SOURCE_OPTIONS.map((ls) => (
                        <option key={ls} value={ls}>{ls}</option>
                      ))}
                    </select>
                  </div>

                  {leadSource === 'Trade Show' && (
                    <div className="sm:col-span-2">
                      <label className="field-label block mb-1">
                        Trade Show Event
                      </label>
                      <select
                        value={tradeShowEvent}
                        onChange={(e) => setTradeShowEvent(e.target.value)}
                        className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                      >
                        <option value="">Select Event...</option>
                        {KNOWN_TRADE_SHOWS.map((ts, idx) => (
                          <option key={idx} value={ts}>{ts}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="field-label block mb-1">
                      Assigned Sales Representative
                    </label>
                    <Input
                      value={assignedRep}
                      onChange={(e) => setAssignedRep(e.target.value)}
                      className="h-8 text-[13px]"
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 3: CONTACTS ROSTER */}
          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Contacts & Decision Makers ({contacts.length})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddContact(!showAddContact)}
                  className="h-7 gap-1"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>Add Contact</span>
                </Button>
              </div>

              {/* Add Contact Card */}
              {showAddContact && (
                <Card className="p-4 space-y-3 bg-muted/30 border-primary/30 shadow-subtle">
                  <span className="text-xs font-semibold text-primary block">
                    New Contact
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Input
                      placeholder="Full Name *"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      className="h-8 text-xs bg-background"
                    />
                    <Input
                      placeholder="Job Title"
                      value={newContact.jobTitle}
                      onChange={(e) => setNewContact({ ...newContact, jobTitle: e.target.value })}
                      className="h-8 text-xs bg-background"
                    />
                    <select
                      value={newContact.department}
                      onChange={(e) => setNewContact({ ...newContact, department: e.target.value })}
                      className="h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                    >
                      {CONTACT_DEPARTMENTS.map((d, i) => (
                        <option key={i} value={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      value={newContact.role}
                      onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                      className="h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                    >
                      {DECISION_MAKER_ROLES.map((r, i) => (
                        <option key={i} value={r}>{r}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Email Address"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      className="h-8 text-xs bg-background"
                    />
                    <Input
                      placeholder="Phone / Direct Line"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowAddContact(false)}
                      className="h-7"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddContact}
                      className="h-7"
                    >
                      Save Contact
                    </Button>
                  </div>
                </Card>
              )}

              {/* Contacts List */}
              <div className="space-y-2.5">
                {contacts.map((c, idx) => (
                  <Card key={idx} className="p-3.5 bg-card border-border shadow-subtle flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-semibold text-xs shrink-0 mt-0.5">
                        {c.name ? c.name[0].toUpperCase() : 'C'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-foreground truncate">{c.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold border border-primary/20">
                            {c.role || 'Decision Maker'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{c.department}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.jobTitle}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-1 flex-wrap">
                          {c.email && (
                            <span className="flex items-center gap-1 text-foreground">
                              <Mail className="h-3 w-3 text-primary" /> {c.email}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1 text-foreground">
                              <Phone className="h-3 w-3 text-primary" /> {c.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveContact(c.id)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition"
                      title="Remove Contact"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-muted-foreground block">
                Chronological Touchpoint History ({timeline.length})
              </span>
              {loadingTimeline && timeline.length === 0 ? (
                <div className="space-y-2" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-14 skeleton rounded-xl border border-border bg-card" />
                  ))}
                </div>
              ) : timeline.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-card">
                  No activity recorded yet for this opportunity.
                </div>
              ) : (
                timeline.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-card border border-border text-xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px]">
                      <span className="font-semibold text-primary uppercase">{item.action || item.type || 'Activity'}</span>
                      <span>{new Date(item.timestamp || item.created_at || item.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-foreground font-medium">{item.summary || item.details?.subject || item.notes || 'Activity recorded'}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: NOTES & NEXT ACTION */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              
              {/* 12. Next Action System */}
              <Card className="p-4 space-y-3 bg-card border-border shadow-subtle">
                <span className="field-label block">
                  Next Action Scheduling
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label block mb-1">
                      Action Required
                    </label>
                    <select
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value)}
                      className="h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2 text-[13px] text-foreground shadow-subtle transition-colors hover:border-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      <option value="">No next action</option>
                      {NEXT_ACTION_PRESETS.map((na, idx) => (
                        <option key={idx} value={na}>{na}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label block mb-1">
                      Target Due Date
                    </label>
                    <Input
                      type="date"
                      value={nextActionDate}
                      onChange={(e) => setNextActionDate(e.target.value)}
                      className="h-8 text-[13px]"
                    />
                  </div>
                </div>
              </Card>

              {/* General Working Notes */}
              <Card className="p-4 space-y-3 bg-card border-border shadow-subtle">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Opportunity Working Notes
                </span>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={6}
                  placeholder="Record call discussion details, customer requirements, commercial counter-proposals..."
                  className="text-[13px]"
                />
              </Card>
            </div>
          )}

        </div>

        {/* Modals for Direct Communication */}
        {isComposeOpen && lead && (
          <ComposeModal
            lead={lead}
            leadId={leadId || lead?._id || lead?.id}
            recipientEmail={lead?.email}
            isOpen={isComposeOpen}
            onClose={() => setIsComposeOpen(false)}
            onSent={() => {
              // A send adds email history and changes "last contacted": refresh just those two small pieces.
              fetchTimeline();
              fetchSummary();
              if (onUpdated) onUpdated();
            }}
          />
        )}
      </div>
    </ModalFrame>
  );
}
