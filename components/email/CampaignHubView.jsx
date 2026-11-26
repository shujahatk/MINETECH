'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Send,
  Zap,
  X,
  Plus,
  Trash2,
  Copy,
  Archive,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Clock,
  ShieldCheck,
  Eye,
  Layers,
  Radio,
  FileText,
  Users,
  Inbox,
  ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import StatusBadge from '@/components/ui/StatusBadge';
import { ModalFrame } from '@/components/ui/modal-frame';
import { useVisibleInterval } from '@/lib/hooks/useVisibleInterval';

export default function CampaignHubView({ onOpenStudio, onOpenCreateModal }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Search, Filter, Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('created_at_desc');

  // Safe Deletion Modal State
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteOption, setDeleteOption] = useState('only_campaign'); // 'only_campaign' | 'campaign_and_leads'
  const [deletionImpact, setDeletionImpact] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);

  // AI Strategy Preview Modal
  const [selectedPreviewCampaign, setSelectedPreviewCampaign] = useState(null);
  const [aiPreviewData, setAiPreviewData] = useState(null);
  const [aiPreviewLoading, setAiPreviewLoading] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/email/campaigns');
      if (!res.ok) throw new Error('Failed to load campaigns');
      const json = await res.json();
      setCampaigns(json.data || []);
      setLoadError('');
    } catch (err) {
      console.error('[CampaignHubView] Error loading campaigns:', err);
      setLoadError('Could not load campaigns.');
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
  useVisibleInterval(fetchCampaigns, 8000, hasActiveCampaign);

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
        toast.success(`Campaign ${action} completed`);
        fetchCampaigns();
      } else {
        toast.error(json.message || `Could not ${action} campaign`);
      }
    } catch (e) {
      toast.error(`Action error: ${e.message}`);
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
      toast.error(`Error duplicating: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const openDeleteModal = async (camp) => {
    setCampaignToDelete(camp);
    setDeleteOption('only_campaign');
    setDeletionImpact(null);
    setImpactLoading(true);
    const campId = camp.id || camp._id;
    try {
      const res = await fetch(`/api/email/campaigns/${campId}?action=deletion_impact`);
      const json = await res.json();
      if (res.ok && json.success) {
        setDeletionImpact(json.data);
      } else {
        const totalFallback = camp.stats?.totalRecipients || camp.stats?.total || 0;
        setDeletionImpact({
          totalAssociated: totalFallback,
          exclusiveCount: totalFallback,
          sharedCount: 0,
          protectedCount: 0,
          eligibleForDeletionCount: totalFallback,
        });
      }
    } catch {
      const totalFallback = camp.stats?.totalRecipients || camp.stats?.total || 0;
      setDeletionImpact({
        totalAssociated: totalFallback,
        exclusiveCount: totalFallback,
        sharedCount: 0,
        protectedCount: 0,
        eligibleForDeletionCount: totalFallback,
      });
    } finally {
      setImpactLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!campaignToDelete) return;
    const campId = campaignToDelete.id || campaignToDelete._id;
    setDeleting(true);

    try {
      const res = await fetch(`/api/email/campaigns/${campId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleteAssociatedLeads: deleteOption === 'campaign_and_leads',
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Campaign successfully deleted');
        setCampaignToDelete(null);
        await fetchCampaigns();
      } else {
        toast.error(json.message || 'Failed to delete campaign');
        await fetchCampaigns();
      }
    } catch (e) {
      toast.error(`Error deleting: ${e.message}`);
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

  // Filter & Sort Calculations
  const filteredCampaigns = campaigns
    .filter((camp) => {
      if (statusFilter !== 'ALL') {
        const s = String(camp.status || '').toUpperCase();
        if (s !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (camp.name || '').toLowerCase();
        const subject = (camp.subject || '').toLowerCase();
        return name.includes(q) || subject.includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'created_at_desc') return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
      if (sortBy === 'created_at_asc') return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'recipients_desc') {
        const countA = a.totalRecipients || a.recipientCount || a.stats?.total || 0;
        const countB = b.totalRecipients || b.recipientCount || b.stats?.total || 0;
        return countB - countA;
      }
      return 0;
    });

  // Top Metric Cards Calculation
  const totalCampaigns = campaigns.length;
  const activeCount = campaigns.filter((c) =>
    ['RUNNING', 'SENDING', 'QUEUED', 'PROCESSING'].includes(String(c.status || '').toUpperCase())
  ).length;
  const totalDelivered = campaigns.reduce((acc, c) => acc + (c.stats?.delivered || 0), 0);
  const totalReplies = campaigns.reduce((acc, c) => acc + (c.stats?.replied || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-card/60 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Campaigns</span>
            <Radio className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{totalCampaigns}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Campaigns registered in CRM</p>
        </Card>

        <Card className="p-3.5 bg-card/60 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Broadcasts</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{activeCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Currently running or queued</p>
        </Card>

        <Card className="p-3.5 bg-card/60 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Delivered</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{totalDelivered.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Confirmed MIME deliveries</p>
        </Card>

        <Card className="p-3.5 bg-card/60 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Client Replies</span>
            <Inbox className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{totalReplies.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Inbound buyer & seller replies</p>
        </Card>
      </div>

      {/* Control Bar: Search, Filters, New Campaign CTA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 p-3 rounded-xl border border-border">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaigns..."
              className="pl-8 h-8 text-xs bg-muted/30 border-border"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg text-xs bg-muted/40 border border-border text-foreground font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="RUNNING">Running</option>
            <option value="QUEUED">Queued</option>
            <option value="COMPLETED">Completed</option>
            <option value="PAUSED">Paused</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-8 px-2.5 rounded-lg text-xs bg-muted/40 border border-border text-foreground font-medium"
          >
            <option value="created_at_desc">Newest First</option>
            <option value="created_at_asc">Oldest First</option>
            <option value="recipients_desc">Most Recipients</option>
            <option value="name_asc">Name (A-Z)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {onOpenStudio && (
            <Button
              size="sm"
              onClick={onOpenStudio}
              className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create in Studio</span>
            </Button>
          )}
        </div>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
          Loading campaigns...
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-border bg-card/40 space-y-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">No campaigns found</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search or status filter.'
                : 'Upload an outreach document or create your first personalized campaign.'}
            </p>
          </div>
          {onOpenStudio && (
            <Button
              size="sm"
              onClick={onOpenStudio}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 mx-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Open Email Studio
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredCampaigns.map((camp) => {
            const campId = camp.id || camp._id;
            const statusUpper = String(camp.status || 'DRAFT').toUpperCase();
            const totalRecipients = camp.totalRecipients || camp.recipientCount || camp.stats?.total || 0;
            const sent = camp.stats?.sent || 0;
            const delivered = camp.stats?.delivered || 0;
            const opened = camp.stats?.opened || 0;
            const replied = camp.stats?.replied || 0;
            const failed = camp.stats?.failed || camp.stats?.bounced || 0;
            const percent = totalRecipients > 0 ? Math.min(100, Math.round((sent / totalRecipients) * 100)) : 0;
            const isAiPersonalized = camp.ai_strategy?.enabled || camp.aiStrategy?.enabled || camp.stats?.is_personalized_workspace;

            return (
              <Card
                key={campId}
                className="p-4 bg-card/70 border-border hover:border-primary/30 transition-colors shadow-subtle space-y-3"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/email/blasts/${campId}`}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                      >
                        {camp.name || 'Untitled Campaign'}
                      </Link>
                      <StatusBadge status={statusUpper} />
                      {isAiPersonalized && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/25">
                          Personalized
                        </span>
                      )}
                    </div>
                    {camp.subject && (
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-medium text-foreground/80">Subject:</span> {camp.subject}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                    <Link href={`/email/blasts/${campId}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review & Manage</span>
                      </Button>
                    </Link>

                    {statusUpper === 'DRAFT' && (
                      <Button
                        size="sm"
                        disabled={actionLoading === `${campId}-launch`}
                        onClick={() => handleCampaignAction(campId, 'launch')}
                        className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      >
                        <Play className="w-3 h-3" />
                        <span>Launch</span>
                      </Button>
                    )}

                    {statusUpper === 'RUNNING' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === `${campId}-pause`}
                        onClick={() => handleCampaignAction(campId, 'pause')}
                        className="h-7 text-xs gap-1"
                      >
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </Button>
                    )}

                    {statusUpper === 'PAUSED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === `${campId}-resume`}
                        onClick={() => handleCampaignAction(campId, 'resume')}
                        className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                      >
                        <Play className="w-3 h-3" />
                        <span>Resume</span>
                      </Button>
                    )}

                    {failed > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === `${campId}-retry`}
                        onClick={() => handleCampaignAction(campId, 'retry')}
                        className="h-7 text-xs gap-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                        title="Retry Failed Recipients"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === `${campId}-duplicate`}
                      onClick={() => handleDuplicate(campId)}
                      className="h-7 px-2 text-xs"
                      title="Duplicate Campaign"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDeleteModal(camp)}
                      className="h-7 px-2 text-xs text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Progress & Live Delivery Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                  <div className="space-y-1.5 md:col-span-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Dispatch Progress</span>
                      <span className="font-mono font-semibold text-foreground">{percent}%</span>
                    </div>
                    <Progress value={percent} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {sent} of {totalRecipients} dispatched
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2 md:col-span-3 text-center bg-muted/20 border border-border/60 rounded-lg p-2">
                    <div>
                      <p className="text-xs font-bold text-foreground tabular-nums">{delivered}</p>
                      <p className="text-[10px] text-muted-foreground">Delivered</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary tabular-nums">{opened}</p>
                      <p className="text-[10px] text-muted-foreground">Opened</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-500 tabular-nums">{replied}</p>
                      <p className="text-[10px] text-muted-foreground">Replied</p>
                    </div>
                    <div>
                      <p className={`text-xs font-bold tabular-nums ${failed > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                        {failed}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Bounced</p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Safe Campaign Deletion Modal */}
      {campaignToDelete && (
        <ModalFrame
          isOpen={Boolean(campaignToDelete)}
          onClose={() => !deleting && setCampaignToDelete(null)}
          title="Delete Campaign & Lead Cleanup"
          description="Choose whether to delete only the campaign container or also clean up its exclusively associated leads."
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs pt-1">
            <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-1">
              <p className="font-semibold text-foreground">
                Target: {campaignToDelete.name || 'Untitled Campaign'}
              </p>
              {impactLoading ? (
                <p className="text-muted-foreground">Analyzing lead associations across CRM...</p>
              ) : deletionImpact ? (
                <p className="text-muted-foreground">
                  Contains <span className="font-semibold text-foreground">{deletionImpact.totalAssociated}</span> associated recipients in CRM.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                onClick={() => setDeleteOption('only_campaign')}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  deleteOption === 'only_campaign'
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-card/40 text-muted-foreground hover:bg-muted/30'
                }`}
              >
                <input
                  type="radio"
                  name="delOption"
                  checked={deleteOption === 'only_campaign'}
                  onChange={() => setDeleteOption('only_campaign')}
                  className="mt-0.5 text-primary"
                />
                <div>
                  <p className="font-semibold text-foreground">Option 1: Delete Campaign Only (Recommended)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Removes the campaign container from the Campaign Hub. All associated leads remain intact in the CRM and Leads pipeline.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setDeleteOption('campaign_and_leads')}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  deleteOption === 'campaign_and_leads'
                    ? 'border-rose-500 bg-rose-500/5 text-foreground'
                    : 'border-border bg-card/40 text-muted-foreground hover:bg-muted/30'
                }`}
              >
                <input
                  type="radio"
                  name="delOption"
                  checked={deleteOption === 'campaign_and_leads'}
                  onChange={() => setDeleteOption('campaign_and_leads')}
                  className="mt-0.5 text-rose-500"
                />
                <div>
                  <p className="font-semibold text-rose-500">Option 2: Delete Campaign and Associated Leads</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Deletes the campaign and permanently removes all leads imported exclusively for this campaign. Shared leads associated with other campaigns are automatically protected.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                disabled={deleting}
                onClick={() => setCampaignToDelete(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={deleting}
                onClick={confirmDelete}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                {deleting ? 'Deleting...' : 'Confirm Deletion'}
              </Button>
            </div>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}
