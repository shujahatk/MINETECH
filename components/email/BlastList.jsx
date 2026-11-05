'use client';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Send,
  Zap,
  X,
  Plus,
  MessageSquareReply,
  Edit,
  Trash2,
  Copy,
  Archive,
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Clock,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MetricCard from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalFrame } from '@/components/ui/modal-frame';
import { Progress } from '@/components/ui/progress';
import StatusBadge from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';
import { useVisibleInterval } from '@/lib/hooks/useVisibleInterval';

const BlastWizard = dynamic(() => import('@/components/email/BlastWizard'), { ssr: false });

export default function BlastList() {
  const [loadError, setLoadError] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Search, Filter, Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('created_at_desc');

  // Delete Confirmation Modal State
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // AI preview modal state
  const [selectedPreviewCampaign, setSelectedPreviewCampaign] = useState(null);
  const [aiPreviewData, setAiPreviewData] = useState(null);
  const [aiPreviewLoading, setAiPreviewLoading] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/email/campaigns');
      if (!res.ok) throw new Error('Request failed');
      setLoadError('');
      const json = await res.json();
      setCampaigns(json.data || []);
    } catch (err) {
      setLoadError('Could not load campaigns. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const hasActiveCampaign = campaigns.some((c) =>
    ['running', 'queued', 'sending', 'processing'].includes(String(c.status || '').toLowerCase())
  );
  useVisibleInterval(fetchCampaigns, 10000, hasActiveCampaign);

  const handleCampaignAction = async (id, action) => {
    setActionLoading(`${id}-${action}`);
    try {
      const res = await fetch(`/api/email/campaigns/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Campaign ${action} completed successfully`);
        fetchCampaigns();
      } else {
        toast.error(json.message || `Could not ${action} this campaign`);
      }
    } catch (e) {
      toast.error(`Could not ${action} this campaign: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (id) => {
    setActionLoading(`${id}-duplicate`);
    try {
      const res = await fetch(`/api/email/campaigns/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Campaign duplicated as Draft');
        fetchCampaigns();
      } else {
        toast.error(json.message || 'Could not duplicate campaign');
      }
    } catch (e) {
      toast.error('Error duplicating campaign: ' + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = async () => {
    if (!campaignToDelete) return;
    const campId = campaignToDelete.id || campaignToDelete._id;
    setDeleting(true);

    // Optimistically remove campaign immediately from state
    setCampaigns((prev) => prev.filter((c) => (c.id || c._id) !== campId));

    try {
      const res = await fetch(`/api/email/campaigns/${campId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Campaign deleted from database');
        setCampaignToDelete(null);
        await fetchCampaigns();
      } else {
        toast.error(json.message || 'Failed to delete campaign');
        await fetchCampaigns();
      }
    } catch (e) {
      toast.error('Error deleting campaign: ' + e.message);
      await fetchCampaigns();
    } finally {
      setDeleting(false);
    }
  };

  const openAiPreviewModal = async (campaign) => {
    const campId = campaign.id || campaign._id;
    setSelectedPreviewCampaign(campaign);
    setAiPreviewLoading(true);
    try {
      const res = await fetch(`/api/email/campaigns/${campId}/ai-preview`);
      if (res.ok) {
        const json = await res.json();
        setAiPreviewData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiPreviewLoading(false);
    }
  };

  // Filtered and Sorted Campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((camp) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (camp.name || '').toLowerCase().includes(q);
        const matchesSubject = (camp.subject || '').toLowerCase().includes(q);
        if (!matchesName && !matchesSubject) return false;
      }

      // Status
      if (statusFilter !== 'ALL') {
        const campStatus = String(camp.status || '').toUpperCase();
        if (statusFilter === 'RUNNING') {
          if (!['RUNNING', 'SENDING', 'PROCESSING', 'QUEUED'].includes(campStatus)) return false;
        } else if (statusFilter === 'COMPLETED') {
          if (!['COMPLETED', 'SENT'].includes(campStatus)) return false;
        } else if (campStatus !== statusFilter) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'created_at_desc') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === 'created_at_asc') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'sent_desc') {
        return (b.stats?.sent || 0) - (a.stats?.sent || 0);
      }
      return 0;
    });
  }, [campaigns, searchQuery, statusFilter, sortBy]);

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.sent += c.stats?.sent || 0;
      acc.delivered += c.stats?.delivered || 0;
      acc.replied += c.stats?.replied || 0;
      const status = String(c.status || '').toLowerCase();
      if (['running', 'sending', 'processing'].includes(status)) acc.running += 1;
      return acc;
    },
    { sent: 0, delivered: 0, replied: 0, running: 0 }
  );

  const nextActionFor = (camp, percent) => {
    const status = String(camp.status || '').toLowerCase();
    if (status === 'draft') return 'Ready to launch';
    if (status === 'running' || status === 'sending' || status === 'queued' || status === 'processing')
      return percent >= 100 ? 'Finishing up' : 'Sending in progress';
    if (status === 'paused') return 'Paused. Resume to continue sending';
    if ((camp.stats?.failed || 0) > 0) return `${camp.stats.failed} failed. Review and retry`;
    if (status === 'completed' || status === 'sent') return 'Completed. Check replies in inbox';
    if (status === 'archived') return 'Archived';
    return null;
  };

  return (
    <div className="space-y-4">
      {loadError && <ErrorState message={loadError} onRetry={() => fetchCampaigns()} />}

      <PageHeader
        icon={Zap}
        title="Campaigns"
        meta={!loading ? String(campaigns.length) : undefined}
        description="Plan outbound email sequences, review Claude AI personalization, and monitor live deliverability."
        className="mb-0"
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingCampaign(null);
              setIsWizardOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New campaign
          </Button>
        }
      />

      {!loading && campaigns.length > 0 && (
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            title="Total Campaigns"
            value={campaigns.length}
            icon={<Zap className="h-3.5 w-3.5" />}
            tone="brand"
            subtext="In this workspace"
          />
          <MetricCard
            title="Running Now"
            value={totals.running}
            icon={<Play className="h-3.5 w-3.5" />}
            tone={totals.running > 0 ? 'success' : 'neutral'}
            subtext="Actively sending"
          />
          <MetricCard
            title="Emails Dispatched"
            value={totals.sent}
            icon={<Send className="h-3.5 w-3.5" />}
            tone="info"
            subtext="Across campaigns"
          />
          <MetricCard
            title="Prospect Replies"
            value={totals.replied}
            icon={<MessageSquareReply className="h-3.5 w-3.5" />}
            tone="warning"
            subtext="Inbound responses"
          />
        </div>
      )}

      {/* Search, Filter Tabs, and Sorting Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 p-2.5 rounded-xl border border-border">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search campaigns by name or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-3 text-xs bg-background border-border focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'DRAFT', label: 'Draft' },
            { id: 'RUNNING', label: 'Running' },
            { id: 'PAUSED', label: 'Paused' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'ARCHIVED', label: 'Archived' },
          ].map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  active
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-8 rounded-lg bg-background border border-border px-2 text-xs text-foreground focus:outline-none focus:border-primary"
          >
            <option value="created_at_desc">Newest First</option>
            <option value="created_at_asc">Oldest First</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="sent_desc">Most Sent</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState cards rows={4} label="Loading campaigns" />
      ) : filteredCampaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title={campaigns.length === 0 ? 'No campaigns yet' : 'No matching campaigns'}
            description={
              campaigns.length === 0
                ? 'Create your first targeted outreach campaign with recipient auditing and live deliverability tracking.'
                : 'No campaigns match your current search and status filter criteria.'
            }
            action={
              campaigns.length === 0 ? (
                <Button
                  onClick={() => {
                    setEditingCampaign(null);
                    setIsWizardOpen(true);
                  }}
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Create first campaign
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                  }}
                  size="sm"
                >
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="stagger grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filteredCampaigns.map((camp) => {
            const campId = camp.id || camp._id;
            const sent = camp.stats?.sent || 0;
            const total = camp.stats?.totalRecipients || camp.stats?.total || 0;
            const percent = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
            const isAiPersonalized = camp.campaignType === 'ai_personalized' || camp.campaign_type === 'ai_personalized';
            const nextAction = nextActionFor(camp, percent);
            const failed = camp.stats?.failed || 0;
            const statusUpper = String(camp.status || 'DRAFT').toUpperCase();
            const hasStartedSending = sent > 0 || statusUpper === 'RUNNING' || statusUpper === 'SENDING';

            const stats = [
              { label: 'Sent', value: sent },
              { label: 'Delivered', value: camp.stats?.delivered != null ? camp.stats.delivered : sent },
              { label: 'Opened', value: camp.stats?.opened || 0 },
              { label: 'Replied', value: camp.stats?.replied || 0, tone: 'text-primary' },
              { label: 'Failed', value: failed, tone: failed > 0 ? 'text-danger' : 'text-muted-foreground' },
            ];

            return (
              <Card key={campId} className="panel-interactive overflow-hidden p-0">
                <div className="space-y-3 p-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {camp.name}
                        </span>
                        {isAiPersonalized && (
                          <span className="tone-brand inline-flex h-[18px] shrink-0 items-center gap-1 rounded border px-1.5 text-[10px] font-medium">
                            <Sparkles className="h-2.5 w-2.5" /> AI
                          </span>
                        )}
                      </div>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        Subject: &ldquo;{camp.subject}&rdquo;
                      </span>
                    </div>
                    <StatusBadge status={camp.status} />
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        <span className="font-semibold tabular-nums text-foreground">{sent}</span> of{' '}
                        <span className="tabular-nums">{total}</span> recipients sent
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">{percent}%</span>
                    </div>
                    <Progress value={percent} className="h-1.5 bg-chart-track" />
                  </div>

                  {/* Stats Grid */}
                  <dl
                    className="grid divide-x divide-border rounded-lg border border-border bg-muted/30"
                    style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
                  >
                    {stats.map((s) => (
                      <div key={s.label} className="px-2 py-2 text-center">
                        <dd className={`text-[13px] font-semibold tabular-nums ${s.tone || 'text-foreground'}`}>
                          {s.value}
                        </dd>
                        <dt className="text-[10px] font-medium text-muted-foreground">{s.label}</dt>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Card Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-2.5">
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {nextAction ? (
                      <>
                        <span className="font-medium text-foreground">Next:</span> {nextAction}
                      </>
                    ) : null}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Edit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCampaign(camp);
                        setIsWizardOpen(true);
                      }}
                      className="h-7 gap-1 px-2 text-xs"
                      title="Edit Campaign"
                    >
                      <Edit className="h-3 w-3" /> Edit
                    </Button>

                    {/* Duplicate Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading === `${campId}-duplicate`}
                      onClick={() => handleDuplicate(campId)}
                      className="h-7 gap-1 px-2 text-xs"
                      title="Duplicate Campaign"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>

                    {/* AI Drafts Modal Button */}
                    {isAiPersonalized && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAiPreviewModal(camp)}
                        className="h-7 gap-1 px-2 text-primary text-xs"
                        title="AI Drafts"
                      >
                        <Sparkles className="h-3 w-3" /> AI
                      </Button>
                    )}

                    {/* Launch Button (Draft only) */}
                    {statusUpper === 'DRAFT' && (
                      <Button
                        size="sm"
                        onClick={() => handleCampaignAction(campId, 'launch')}
                        disabled={actionLoading === `${campId}-launch`}
                        className="h-7 gap-1 px-2.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      >
                        <Play className="h-3 w-3" /> Launch
                      </Button>
                    )}

                    {/* Pause Button (Running) */}
                    {statusUpper === 'RUNNING' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCampaignAction(campId, 'pause')}
                        disabled={actionLoading === `${campId}-pause`}
                        className="tone-warning h-7 gap-1 border px-2.5 text-xs hover:opacity-90"
                      >
                        <Pause className="h-3 w-3" /> Pause
                      </Button>
                    )}

                    {/* Resume Button (Paused) */}
                    {statusUpper === 'PAUSED' && (
                      <Button
                        size="sm"
                        onClick={() => handleCampaignAction(campId, 'resume')}
                        disabled={actionLoading === `${campId}-resume`}
                        className="h-7 gap-1 px-2.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      >
                        <Play className="h-3 w-3" /> Resume
                      </Button>
                    )}

                    {/* Retry Failed */}
                    {failed > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCampaignAction(campId, 'retry')}
                        disabled={actionLoading === `${campId}-retry`}
                        className="h-7 gap-1 px-2 text-xs text-danger hover:bg-danger/10"
                      >
                        <RotateCcw className="h-3 w-3" /> Retry ({failed})
                      </Button>
                    )}

                    {/* Archive Button */}
                    {['COMPLETED', 'SENT', 'PAUSED', 'CANCELLED'].includes(statusUpper) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCampaignAction(campId, 'archive')}
                        disabled={actionLoading === `${campId}-archive`}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Archive Campaign"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCampaignToDelete(camp)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-danger hover:bg-danger/10 transition"
                      title="Delete Campaign"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {campaignToDelete && (
        <ModalFrame
          title="Delete Campaign"
          onClose={() => setCampaignToDelete(null)}
        >
          <div className="p-5 space-y-4 max-w-md bg-card border border-border rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Confirm Deletion of &ldquo;{campaignToDelete.name}&rdquo;
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to permanently delete this campaign? This will remove the campaign record and its queued/sent recipient dispatch entries from Supabase.
                </p>
                {(campaignToDelete.stats?.sent || 0) > 0 ? (
                  <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger mt-2 space-y-1">
                    <p className="font-semibold">⚠️ Previously Dispatched Campaign ({campaignToDelete.stats.sent} sent):</p>
                    <p className="text-[11px] leading-relaxed">
                      This campaign has already sent emails. Deleting it will permanently remove the campaign and its recipient logs. All CRM leads and contact records will remain 100% intact.
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
                variant="outline"
                size="sm"
                onClick={() => setCampaignToDelete(null)}
                className="h-8 text-xs"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={confirmDelete}
                className="bg-danger hover:bg-danger/90 text-danger-foreground h-8 text-xs gap-1.5 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Deleting...' : 'Delete Campaign'}
              </Button>
            </div>
          </div>
        </ModalFrame>
      )}

      {/* AI drafts preview modal */}
      {selectedPreviewCampaign && (
        <ModalFrame
          title="AI Personalization Drafts"
          onClose={() => {
            setSelectedPreviewCampaign(null);
            setAiPreviewData(null);
          }}
        >
          <div className="p-5 space-y-4 max-w-2xl bg-card border border-border rounded-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {selectedPreviewCampaign.name}
                </h3>
                <span className="text-xs text-muted-foreground">
                  AI-personalized generation status and prospect samples
                </span>
              </div>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                Claude Sonnet 5.5 / Opus 5.5
              </Badge>
            </div>

            {aiPreviewLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Loading personalization drafts...
              </div>
            ) : aiPreviewData?.samples?.length > 0 ? (
              <div className="space-y-3">
                {aiPreviewData.samples.map((s, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-muted/20 border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        {s.lead?.name} — <span className="text-primary">{s.lead?.jobTitle} @ {s.lead?.company}</span>
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {s.generationStatus}
                      </Badge>
                    </div>
                    <div className="text-xs font-semibold text-foreground">
                      Subject: {s.subject}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-pre-line bg-muted/30 p-2.5 rounded-lg border border-border/50">
                      {s.body}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No generated preview samples found. Staged recipients will be synthesized upon campaign launch.
              </div>
            )}
          </div>
        </ModalFrame>
      )}

      {/* Campaign Wizard / Editor Modal */}
      {isWizardOpen && (
        <BlastWizard
          campaign={editingCampaign}
          onClose={() => {
            setIsWizardOpen(false);
            setEditingCampaign(null);
          }}
          onCreated={() => {
            fetchCampaigns();
            setIsWizardOpen(false);
          }}
          onUpdated={() => {
            fetchCampaigns();
            setIsWizardOpen(false);
            setEditingCampaign(null);
          }}
        />
      )}
    </div>
  );
}
