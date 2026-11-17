'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Users,
  FileText,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Upload,
  ArrowRight,
  Filter,
  Search,
  Eye,
  SlidersHorizontal,
  Mail,
  Building,
  Tag,
  ShieldAlert,
  ChevronRight,
  Play,
  Layers,
  Inbox,
  Clock,
  Check,
  X,
  UserCheck,
  UserX
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function IntelligentCampaignHub() {
  const [activeTab, setActiveTab] = useState('matching'); // overview | contacts | templates | matching | campaigns | sequences
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Core data states
  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [matchingData, setMatchingData] = useState(null);
  const [segments, setSegments] = useState([]);
  const [preparedCampaigns, setPreparedCampaigns] = useState([]);
  const [contactTargeting, setContactTargeting] = useState({}); // { [leadId]: { targetingMode, selectedEmails } }

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('ALL'); // ALL | high | medium | low | unmatched
  const [roleFilter, setRoleFilter] = useState('ALL'); // ALL | Buyer | Seller | Both | Unclassified

  // Upload & Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [testEmailAddress, setTestEmailAddress] = useState('rauf@mine-tech.be');
  const [selectedCampaignForTest, setSelectedCampaignForTest] = useState(null);
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const [inspectLead, setInspectLead] = useState(null);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadsRes, tplRes, segRes] = await Promise.all([
        fetch('/api/leads?limit=150'),
        fetch('/api/campaigns/intelligent/templates'),
        fetch('/api/campaigns/intelligent/segments')
      ]);

      if (leadsRes.ok) {
        const j = await leadsRes.json();
        setLeads(j.leads || j.data || []);
      }
      if (tplRes.ok) {
        const j = await tplRes.json();
        setTemplates(j.data || []);
      }
      if (segRes.ok) {
        const j = await segRes.json();
        setSegments(j.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Run or refresh matching
  const runMatching = async (autoApprove = false) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/campaigns/intelligent/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoApproveHighConfidence: autoApprove,
          runAiClassification: true,
          contactTargeting
        })
      });

      const json = await res.json();
      if (json.success) {
        setMatchingData(json.data);
        toast.success(`Matching complete: ${json.data.highConfidenceCount} high-confidence matches found`);
      } else {
        toast.error(json.error || 'Matching failed');
      }
    } catch (err) {
      toast.error('Network error running matching');
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Click Automatically Prepare Campaigns
  const handleAutoPrepareCampaigns = async () => {
    if (!matchingData?.proposedCampaigns || matchingData.proposedCampaigns.length === 0) {
      toast.error('No proposed campaigns available. Run matching first.');
      return;
    }

    setActionLoading(true);
    try {
      // Synchronize campaigns with current contact selections
      const syncedCampaigns = (matchingData.proposedCampaigns || []).map((camp) => {
        const campMatches = (matchingData.matches || []).filter(
          (m) => (m.template_id === camp.templateId || m.matched_template?.id === camp.templateId) && m.status !== 'unmatched'
        );
        const dynamicRecipients = [];
        for (const m of campMatches) {
          const selected = (m.company_contacts || []).filter((c) => c.selected);
          if (selected.length > 0) {
            for (const c of selected) {
              dynamicRecipients.push({
                leadId: m.lead_id,
                contactId: c.id,
                email: c.email,
                name: c.name,
                jobTitle: c.job_title,
                isPrimary: c.isPrimary
              });
            }
          } else if (m.email) {
            dynamicRecipients.push({
              leadId: m.lead_id,
              contactId: m.lead_id,
              email: m.email,
              name: m.contact_name || m.company_name,
              isPrimary: true
            });
          }
        }

        return {
          ...camp,
          recipientCount: dynamicRecipients.length > 0 ? dynamicRecipients.length : camp.recipientCount,
          targetRecipients: dynamicRecipients.length > 0 ? dynamicRecipients : camp.targetRecipients
        };
      });

      const res = await fetch('/api/campaigns/intelligent/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedCampaigns: syncedCampaigns,
          senderEmail: 'rauf@mine-tech.be',
          senderName: 'Abdullah Rauf - MineTech Resources'
        })
      });

      const json = await res.json();
      if (json.success) {
        setPreparedCampaigns(json.data || []);
        toast.success(json.message);
        setActiveTab('campaigns');
      } else {
        toast.error(json.error || 'Failed to prepare campaigns');
      }
    } catch (err) {
      toast.error('Network error preparing campaigns');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle contact targeting for a company
  const handleToggleContactEmail = (leadId, email) => {
    setMatchingData((prev) => {
      if (!prev?.matches) return prev;
      const updatedMatches = prev.matches.map((m) => {
        if (m.lead_id !== leadId) return m;

        const updatedContacts = (m.company_contacts || []).map((c) => {
          if (c.email.toLowerCase() === email.toLowerCase()) {
            return { ...c, selected: !c.selected };
          }
          return c;
        });

        const selectedEmails = updatedContacts.filter((c) => c.selected).map((c) => c.email);
        const targetingMode = selectedEmails.length === updatedContacts.length ? 'all_contacts' : 'custom_selected';

        // Update local preferences map
        setContactTargeting((pref) => ({
          ...pref,
          [leadId]: { targetingMode, selectedEmails }
        }));

        const updatedMatch = {
          ...m,
          company_contacts: updatedContacts,
          selected_emails: selectedEmails,
          targeting_mode: targetingMode
        };

        if (inspectLead && inspectLead.lead_id === leadId) {
          setInspectLead(updatedMatch);
        }

        return updatedMatch;
      });

      return { ...prev, matches: updatedMatches };
    });
  };

  // Set company targeting mode (primary_only vs all_contacts)
  const handleSetTargetingMode = (leadId, mode) => {
    setMatchingData((prev) => {
      if (!prev?.matches) return prev;
      const updatedMatches = prev.matches.map((m) => {
        if (m.lead_id !== leadId) return m;

        const updatedContacts = (m.company_contacts || []).map((c) => {
          if (mode === 'all_contacts') return { ...c, selected: true };
          if (mode === 'primary_only') return { ...c, selected: Boolean(c.isPrimary) };
          return c;
        });

        const selectedEmails = updatedContacts.filter((c) => c.selected).map((c) => c.email);

        setContactTargeting((pref) => ({
          ...pref,
          [leadId]: { targetingMode: mode, selectedEmails }
        }));

        const updatedMatch = {
          ...m,
          company_contacts: updatedContacts,
          selected_emails: selectedEmails,
          targeting_mode: mode
        };

        if (inspectLead && inspectLead.lead_id === leadId) {
          setInspectLead(updatedMatch);
        }

        return updatedMatch;
      });

      return { ...prev, matches: updatedMatches };
    });
  };

  // Reassign template for a specific lead
  const handleReassignTemplate = async (leadId, newTemplateId) => {
    const selectedTpl = templates.find((t) => t.id === newTemplateId);
    if (!selectedTpl) return;

    setMatchingData((prev) => {
      if (!prev?.matches) return prev;
      const updatedMatches = prev.matches.map((m) => {
        if (m.lead_id !== leadId) return m;
        return {
          ...m,
          matched_template: selectedTpl,
          template_id: selectedTpl.id,
          template_name: selectedTpl.name,
          subject: selectedTpl.subject,
          product_category: selectedTpl.product_category || selectedTpl.category || m.product_category,
          recipient_type: selectedTpl.recipient_type || m.recipient_type,
          reason: `Manually reassigned to "${selectedTpl.name}" by user`,
          match_confidence: 'high',
          status: 'approved'
        };
      });
      return { ...prev, matches: updatedMatches };
    });

    if (inspectLead && inspectLead.lead_id === leadId) {
      setInspectLead((prev) => ({
        ...prev,
        matched_template: selectedTpl,
        template_id: selectedTpl.id,
        template_name: selectedTpl.name,
        subject: selectedTpl.subject
      }));
    }

    try {
      await fetch('/api/campaigns/intelligent/match', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          templateId: newTemplateId,
          recipientType: selectedTpl.recipient_type,
          productCategory: selectedTpl.product_category || selectedTpl.category
        })
      });
      toast.success(`Template updated to "${selectedTpl.name}"`);
    } catch {
      toast.error('Failed to save reassignment preference');
    }
  };

  // Handle template file/text upload
  const handleUploadTemplates = async (e) => {
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
        body: formData
      });

      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(json.message);
        setIsUploadModalOpen(false);
        setUploadText('');
        setSelectedFile(null);
        // Refresh templates
        const tplRes = await fetch('/api/campaigns/intelligent/templates');
        if (tplRes.ok) {
          const tplJson = await tplRes.json();
          setTemplates(tplJson.data || []);
        }
      } else {
        toast.error(json?.error || json?.message || `Template upload failed (HTTP ${res.status})`);
      }
    } catch (err) {
      toast.error(err?.message || 'Error uploading templates');
    } finally {
      setActionLoading(false);
    }
  };

  // Send Test Email
  const handleSendTestEmail = async () => {
    if (!selectedCampaignForTest || !testEmailAddress) {
      toast.error('Select a campaign and enter a recipient email');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/campaigns/intelligent/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaignForTest.campaignId || selectedCampaignForTest.id,
          testEmail: testEmailAddress,
          senderEmail: 'rauf@mine-tech.be',
          senderName: 'Abdullah Rauf - Head of Sales'
        })
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Test email sent to ${testEmailAddress}`);
        setIsTestEmailModalOpen(false);
      } else {
        toast.error(json.error || 'Failed to send test email');
      }
    } catch (err) {
      toast.error('Error sending test email');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered matches for Tab 4
  const filteredMatches = useMemo(() => {
    if (!matchingData?.matches) return [];
    return matchingData.matches.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || m.company_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.template_name?.toLowerCase().includes(q);
      const matchConf = confidenceFilter === 'ALL' || (confidenceFilter === 'unmatched' ? m.status === 'unmatched' : m.match_confidence === confidenceFilter);
      const matchRole = roleFilter === 'ALL' || m.recipient_type?.toLowerCase().includes(roleFilter.toLowerCase());
      return matchSearch && matchConf && matchRole;
    });
  }, [matchingData, searchQuery, confidenceFilter, roleFilter]);

  // Compute overview numbers
  const buyerCount = leads.filter((l) => l.classification === 'Buyer' || l.custom_fields?.company_intelligence?.buyer_seller_status === 'Buyer').length;
  const sellerCount = leads.filter((l) => l.classification === 'Seller' || l.custom_fields?.company_intelligence?.buyer_seller_status === 'Seller').length;
  const unclassifiedCount = leads.length - (buyerCount + sellerCount);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Intelligent Campaign Orchestrator
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-medium">
                  MineTech AI (Sonnet 5.5 / Opus 5.5)
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                MineTech Resources — Multi-contact company targeting, prewritten template classification & bulk campaign matching
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setIsUploadModalOpen(true)}
            className="border-slate-700 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
          >
            <Upload className="w-4 h-4 text-amber-400" />
            Upload Templates
          </Button>

          <Button
            onClick={() => runMatching(false)}
            disabled={actionLoading}
            className="bg-amber-600 hover:bg-amber-500 text-white font-medium flex items-center gap-2 shadow-lg shadow-amber-900/20"
          >
            <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
            Run Intelligent Matcher
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Intelligence', icon: Layers },
          { id: 'matching', label: 'AI Matcher Cockpit', icon: Sparkles, badge: matchingData?.matches?.length },
          { id: 'templates', label: 'Template Library', icon: FileText, badge: templates.length },
          { id: 'campaigns', label: 'Campaign Execution', icon: Send, badge: preparedCampaigns.length },
          { id: 'contacts', label: 'Contact Database', icon: Users, badge: leads.length }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.badge !== undefined && (
                <span className={`text-xs px-2 py-0.2 rounded-full ${isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & INTELLIGENCE */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-900/60 border-slate-800 p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>TOTAL CONTACTS</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{leads.length}</div>
              <div className="text-xs text-slate-500 mt-1 flex gap-2">
                <span className="text-emerald-400 font-medium">{buyerCount} Buyers</span>
                <span>•</span>
                <span className="text-amber-400 font-medium">{sellerCount} Suppliers</span>
              </div>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>PREWRITTEN TEMPLATES</span>
                <FileText className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{templates.length}</div>
              <div className="text-xs text-slate-500 mt-1">
                Classified across 5 industrial mineral categories
              </div>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>AI MATCHES READY</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {matchingData ? matchingData.highConfidenceCount : 0}
              </div>
              <div className="text-xs text-emerald-400 mt-1">
                High-confidence commercial alignments
              </div>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>NEEDS REVIEW / UNMATCHED</span>
                <AlertCircle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {matchingData ? matchingData.reviewNeededCount + matchingData.unmatchedCount : unclassifiedCount}
              </div>
              <div className="text-xs text-rose-400/80 mt-1">
                Requires role or template check
              </div>
            </Card>
          </div>

          {/* Dynamic Segments Grid */}
          <Card className="bg-slate-900/60 border-slate-800 p-6">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-amber-400" />
              Dynamic Industrial Mineral Segments
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-200">{seg.name}</div>
                    <div className="text-xs text-slate-500">{seg.role} • {seg.product}</div>
                  </div>
                  <span className="text-sm font-bold px-2.5 py-1 rounded bg-slate-800 text-amber-400">
                    {seg.count}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: AI MATCHER COCKPIT */}
      {activeTab === 'matching' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  placeholder="Search company, email, template..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-700 text-sm h-9"
                />
              </div>

              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-300"
              >
                <option value="ALL">All Confidences</option>
                <option value="high">High Confidence Only</option>
                <option value="medium">Medium Confidence</option>
                <option value="low">Low Confidence / Review</option>
                <option value="unmatched">Unmatched Only</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-300"
              >
                <option value="ALL">All Roles</option>
                <option value="Buyer">Buyers Only</option>
                <option value="Seller">Suppliers Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runMatching(true)}
                disabled={actionLoading}
                className="border-slate-700 text-xs hover:bg-slate-800"
              >
                Auto-Approve High Conf
              </Button>

              <Button
                size="sm"
                onClick={handleAutoPrepareCampaigns}
                disabled={actionLoading || !matchingData?.proposedCampaigns?.length}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Prepare {matchingData?.proposedCampaigns?.length || 0} Campaigns
              </Button>
            </div>
          </div>

          {/* Matches Table */}
          {!matchingData ? (
            <Card className="bg-slate-900/40 border-slate-800 p-12 text-center">
              <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-3 opacity-60" />
              <h3 className="text-lg font-semibold text-white">No Matching Run Yet</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-4">
                Click &quot;Run Intelligent Matcher&quot; to analyze your uploaded contacts against prewritten templates using MineTech AI.
              </p>
              <Button onClick={() => runMatching(false)} className="bg-amber-600 hover:bg-amber-500 text-white">
                Start Intelligent Matching
              </Button>
            </Card>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Company & Recipient</th>
                    <th className="py-3 px-4">Target Contact(s)</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Product Category</th>
                    <th className="py-3 px-4">Assigned Template</th>
                    <th className="py-3 px-4">Confidence & Reason</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No matches match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMatches.map((m, idx) => {
                      const totalContacts = m.company_contacts?.length || 1;
                      const selectedCount = m.selected_emails?.length || 1;
                      return (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200">{m.company_name || 'Unknown Company'}</div>
                            <div className="text-slate-400 font-mono text-[11px]">{m.email}</div>
                          </td>

                          {/* Multi-Contact Selector Indicator */}
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => setInspectLead(m)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-[11px] font-medium text-slate-200 transition-colors"
                            >
                              <Users className="w-3.5 h-3.5 text-amber-400" />
                              <span>
                                {totalContacts > 1
                                  ? `${totalContacts} Contacts (${selectedCount} selected)`
                                  : '1 Contact'}
                              </span>
                            </button>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {m.targeting_mode === 'all_contacts'
                                ? 'Targeting: All'
                                : (totalContacts > 1 && selectedCount === 1 ? 'Targeting: Primary' : `Sending to ${selectedCount}`)}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${m.recipient_type?.includes('buyer')
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : (m.recipient_type?.includes('supplier')
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-slate-800 text-slate-400')
                              }`}>
                              {m.recipient_type || 'Uncertain'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-300 font-medium">
                            {m.product_category}
                          </td>

                          <td className="py-3 px-4">
                            {m.matched_template ? (
                              <div>
                                <div className="font-medium text-slate-200">{m.template_name}</div>
                                <div className="text-[10px] text-slate-500 truncate max-w-xs">{m.subject}</div>
                              </div>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {m.unmatched_reason || 'No suitable template'}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${m.match_confidence === 'high' ? 'bg-emerald-900/40 text-emerald-300' :
                                  m.match_confidence === 'medium' ? 'bg-amber-900/40 text-amber-300' :
                                    'bg-rose-900/40 text-rose-300'
                                }`}>
                                {m.match_confidence}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{m.reason}</p>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectLead(m)}
                              className="text-slate-400 hover:text-white text-xs h-7 px-2"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Inspect & Select
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TEMPLATE LIBRARY */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Prewritten Email Library ({templates.length})</h3>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Templates (TXT/DOCX/PDF/CSV)
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="bg-slate-900/70 border-slate-800 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                      {tpl.product_category || tpl.category || 'Industrial Minerals'}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${tpl.recipient_type === 'potential_supplier'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                      {tpl.recipient_type === 'potential_supplier' ? 'Supplier' : 'Buyer'}
                    </span>
                  </div>
                  <h4 className="font-semibold text-white text-sm">{tpl.name}</h4>
                  <p className="text-xs text-slate-400 font-mono mt-1 mb-3 truncate">Subject: {tpl.subject}</p>
                  <p className="text-xs text-slate-400 line-clamp-4 leading-relaxed bg-slate-950 p-2.5 rounded border border-slate-800/80">
                    {tpl.body_plain || tpl.body}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>Sequence: {tpl.sequence_stage || 'Intro'}</span>
                  <span className="text-emerald-400 font-medium">Canonical Copy</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CAMPAIGN EXECUTION */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Prepared Campaigns Plan</h3>
              <p className="text-xs text-slate-400">Review recipient assignments, send test emails, and launch bulk outreach</p>
            </div>
          </div>

          {preparedCampaigns.length === 0 ? (
            <Card className="bg-slate-900/40 border-slate-800 p-12 text-center">
              <Send className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h4 className="text-base font-semibold text-white">No Campaigns Prepared Yet</h4>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-4">
                Run the AI Matcher and click &quot;Prepare Campaigns&quot; to build your recipient queues.
              </p>
              <Button onClick={() => setActiveTab('matching')} className="bg-amber-600 hover:bg-amber-500 text-white text-xs">
                Go to AI Matcher
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {preparedCampaigns.map((camp, idx) => (
                <Card key={idx} className="bg-slate-900/80 border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-white text-base">{camp.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
                        {camp.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2 font-mono">Subject: {camp.subject}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Product: <strong className="text-slate-200">{camp.product}</strong></span>
                      <span>Target: <strong className="text-slate-200">{camp.recipientType}</strong></span>
                      <span>Eligible Recipients: <strong className="text-emerald-400">{camp.eligibleRecipients}</strong></span>
                      {camp.excludedRecipients > 0 && (
                        <span>Excluded: <strong className="text-rose-400">{camp.excludedRecipients}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaignForTest(camp);
                        setIsTestEmailModalOpen(true);
                      }}
                      className="border-slate-700 text-xs hover:bg-slate-800 text-slate-300"
                    >
                      <Mail className="w-3.5 h-3.5 mr-1 text-amber-400" />
                      Test Email
                    </Button>

                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetch(`/api/email/campaigns/${camp.campaignId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'SENDING' })
                          });
                          toast.success(`Campaign "${camp.name}" approved and launched!`);
                          camp.status = 'SENDING';
                        } catch {
                          toast.error('Failed to launch campaign');
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Approve & Launch Bulk
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CONTACTS */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Industry / Material</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leads.slice(0, 50).map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-200">{l.company || 'Unnamed'}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">{l.email}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase">
                        {l.classification || 'Unclassified'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">{l.industry || l.niche || 'Industrial'}</td>
                    <td className="py-2.5 px-4 text-slate-400">{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT LEAD & MULTI-CONTACT TARGETING SELECTION */}
      {inspectLead && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <Building className="w-5 h-5 text-amber-400" />
                  {inspectLead.company_name}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{inspectLead.email}</p>
              </div>
              <button onClick={() => setInspectLead(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Assignment Section */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Assigned Email Template
                </label>
                <span className="text-[11px] text-amber-400 font-medium">
                  {inspectLead.product_category}
                </span>
              </div>

              <select
                value={inspectLead.template_id || ''}
                onChange={(e) => handleReassignTemplate(inspectLead.lead_id, e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-200"
              >
                <option value="">Select a template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.product_category || t.category || 'General'}) — [{t.recipient_type?.includes('supplier') ? 'Supplier' : 'Buyer'}]
                  </option>
                ))}
              </select>

              <div className="text-xs text-slate-400 font-mono">
                Subject: <span className="text-slate-200">{inspectLead.subject || 'No subject'}</span>
              </div>
            </div>

            {/* Multiple Contacts & Email Targeting Selection */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    Target Contacts ({inspectLead.company_contacts?.length || 1} available)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Choose which specific contacts/emails will receive this campaign.
                  </p>
                </div>

                {/* Targeting Mode Buttons */}
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSetTargetingMode(inspectLead.lead_id, 'primary_only')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${inspectLead.targeting_mode === 'primary_only' || (!inspectLead.targeting_mode && inspectLead.selected_emails?.length === 1)
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Primary Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetTargetingMode(inspectLead.lead_id, 'all_contacts')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${inspectLead.targeting_mode === 'all_contacts'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    All Contacts
                  </button>
                </div>
              </div>

              {/* List of Contacts */}
              <div className="space-y-2 pt-1">
                {(inspectLead.company_contacts || [{
                  id: inspectLead.lead_id,
                  name: 'Primary Contact',
                  email: inspectLead.email,
                  job_title: 'Commercial Contact',
                  isPrimary: true,
                  selected: true
                }]).map((c, cIdx) => (
                  <div
                    key={cIdx}
                    onClick={() => handleToggleContactEmail(inspectLead.lead_id, c.email)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${c.selected
                        ? 'bg-slate-900/90 border-emerald-500/40 text-slate-100 shadow-sm'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-500 opacity-60'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(c.selected)}
                        onChange={() => { }} // handled by parent onClick
                        className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div className="font-semibold text-xs text-white flex items-center gap-2">
                          {c.name}
                          {c.isPrimary && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">{c.email}</div>
                        {c.job_title && (
                          <div className="text-[10px] text-slate-500">{c.job_title}</div>
                        )}
                      </div>
                    </div>

                    <div>
                      {c.selected ? (
                        <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <Check className="w-3 h-3" /> Will Receive
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded">
                          Excluded
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                <span>
                  Sending to <strong className="text-white">{inspectLead.selected_emails?.length || 1}</strong> of{' '}
                  <strong className="text-white">{inspectLead.company_contacts?.length || 1}</strong> company emails.
                </span>
                <span className="text-emerald-400 text-[10px] font-medium">Deduplicated at send-time</span>
              </div>
            </div>

            {/* Why It Matched Section */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Matching Rationale</div>
              <p className="text-xs text-slate-300 leading-relaxed">{inspectLead.reason}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button onClick={() => setInspectLead(null)} className="bg-amber-600 hover:bg-amber-500 text-white text-xs">
                Done & Apply Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD TEMPLATES */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                Upload Prewritten Email Templates
              </h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadTemplates} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Upload File (TXT, DOCX, PDF, CSV, XLSX)
                </label>
                <Input
                  type="file"
                  accept=".txt,.docx,.pdf,.csv,.xlsx,.xls"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="bg-slate-950 border-slate-700 text-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Multi-template files will be automatically parsed and split into individual emails.
                </p>
              </div>

              <div className="text-center text-xs text-slate-500 font-medium">— OR PASTE EMAIL TEXT DIRECTLY —</div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Paste Prewritten Copy (Subject & Body)
                </label>
                <Textarea
                  rows={6}
                  placeholder={`Subject: High-Activity Bleaching Clay Supply Capabilities\n\nDear {{company_name}},\n\nWe are reaching out from MineTech Resources regarding our supply capabilities for activated bleaching clay...`}
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="text-slate-400 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium"
                >
                  {actionLoading ? 'Analyzing & Uploading...' : 'Classify & Add to Library'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TEST EMAIL */}
      {isTestEmailModalOpen && selectedCampaignForTest && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                Send Test Campaign Email
              </h3>
              <button onClick={() => setIsTestEmailModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-300 mb-2">
                Campaign: <strong className="text-white">{selectedCampaignForTest.name}</strong>
              </p>
              <label className="text-xs text-slate-400 block mb-1">Recipient Test Address:</label>
              <Input
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="your-email@example.com"
                className="bg-slate-950 border-slate-700 text-xs"
              />
              <p className="text-[11px] text-slate-500 mt-2">
                Will include sample personalization fields and the official MineTech signature:
                <br />
                <span className="font-mono text-slate-400 text-[10px]">
                  Abdullah Rauf - Head of Sales | Mo. +32 486 287 751 | rauf@mine-tech.be
                </span>
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setIsTestEmailModalOpen(false)}
                className="text-slate-400 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendTestEmail}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              >
                {actionLoading ? 'Dispatching...' : 'Dispatch Test Email'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
