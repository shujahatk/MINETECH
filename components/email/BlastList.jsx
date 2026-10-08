'use client';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState, LinesSkeleton } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import MetricCard from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalFrame } from '@/components/ui/modal-frame';
import { Progress } from '@/components/ui/progress';
import StatusBadge from '@/components/ui/StatusBadge';
import dynamic from 'next/dynamic';
import { useVisibleInterval } from '@/lib/hooks/useVisibleInterval';

// The wizard is only needed once the user clicks "new campaign".
const BlastWizard = dynamic(() => import('@/components/email/BlastWizard'), { ssr: false });

export default function BlastList() {
  const [loadError, setLoadError] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/email/campaigns');
      if (!res.ok) throw new Error('Request failed');
      if (res.ok) {
        setLoadError('');
        const json = await res.json();
        setCampaigns(json.data || []);
      }
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

  // Live progress only matters while something is sending. Idle lists don't poll at all (was a
  // constant 8s poll), and polling pauses while the tab is hidden.
  const hasActiveCampaign = campaigns.some((c) =>
    ['running', 'queued', 'sending', 'processing'].includes(String(c.status || '').toLowerCase())
  );
  useVisibleInterval(fetchCampaigns, 10000, hasActiveCampaign);

  const handleCampaignAction = async (id, action) => {
    setActionLoading(`${id}-${action}`);
    try {
      await fetch(`/api/email/campaigns/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchCampaigns();
    } catch (e) {
      toast.error(`Could not ${action} this campaign`);
    } finally {
      setActionLoading(null);
    }
  };

  const [selectedPreviewCampaign, setSelectedPreviewCampaign] = useState(null);
  const [aiPreviewData, setAiPreviewData] = useState(null);
  const [aiPreviewLoading, setAiPreviewLoading] = useState(false);

  const openAiPreviewModal = async (campaign) => {
    setSelectedPreviewCampaign(campaign);
    setAiPreviewLoading(true);
    try {
      const res = await fetch(`/api/email/campaigns/${campaign._id}/ai-preview`);
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

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.sent += c.stats?.sent || 0;
      acc.replied += c.stats?.replied || 0;
      if (String(c.status || '').toLowerCase() === 'running') acc.running += 1;
      return acc;
    },
    { sent: 0, replied: 0, running: 0 }
  );

  // Plain-language hint about what the user can do next, derived only from real campaign state.
  const nextActionFor = (camp, percent) => {
    const status = String(camp.status || '').toLowerCase();
    if (status === 'draft') return 'Ready to launch';
    if (status === 'running' || status === 'sending' || status === 'queued' || status === 'processing')
      return percent >= 100 ? 'Finishing up' : 'Sending in progress';
    if (status === 'paused') return 'Paused. Resume to continue sending';
    if ((camp.stats?.failed || 0) > 0) return `${camp.stats.failed} failed. Review and retry`;
    if (status === 'completed' || status === 'sent') return 'Completed. Review replies in the inbox';
    return null;
  };

  return (
    <div className="space-y-4">
      {loadError && <ErrorState message={loadError} onRetry={() => fetchCampaigns()} />}

      <PageHeader
        icon={Zap}
        title="Campaigns"
        meta={!loading ? String(campaigns.length) : undefined}
        description="Plan outbound sequences, review AI personalization and track live deliverability."
        className="mb-0"
        actions={
          <Button size="sm" onClick={() => setIsWizardOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New campaign
          </Button>
        }
      />

      {!loading && campaigns.length > 0 && (
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard title="Campaigns" value={campaigns.length} icon={<Zap className="h-3.5 w-3.5" />} tone="brand" subtext="In this workspace" />
          <MetricCard title="Running now" value={totals.running} icon={<Play className="h-3.5 w-3.5" />} tone={totals.running > 0 ? 'success' : 'neutral'} subtext="Actively sending" />
          <MetricCard title="Emails sent" value={totals.sent} icon={<Send className="h-3.5 w-3.5" />} tone="info" subtext="Across listed campaigns" />
          <MetricCard title="Replies" value={totals.replied} icon={<MessageSquareReply className="h-3.5 w-3.5" />} tone="warning" subtext="Across listed campaigns" />
        </div>
      )}

      {loading ? (
        <LoadingState cards rows={4} label="Loading campaigns" />
      ) : campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="No campaigns yet"
            description="Create your first targeted outreach campaign with recipient auditing and live deliverability tracking."
            action={
              <Button onClick={() => setIsWizardOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Create first campaign
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="stagger grid grid-cols-1 gap-3 xl:grid-cols-2">
          {campaigns.map((camp) => {
            const sent = camp.stats?.sent || 0;
            const total = camp.stats?.totalRecipients || 0;
            const percent = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
            const isAiPersonalized = camp.campaignType === 'ai_personalized' || camp.personalization?.mode === 'ai_personalized';
            const nextAction = nextActionFor(camp, percent);
            const failed = camp.stats?.failed || 0;
            const stats = [
              { label: 'Sent', value: sent },
              ...(camp.stats?.delivered != null ? [{ label: 'Delivered', value: camp.stats.delivered }] : []),
              { label: 'Opened', value: camp.stats?.opened || 0 },
              { label: 'Replied', value: camp.stats?.replied || 0, tone: 'text-primary' },
              { label: 'Failed', value: failed, tone: failed > 0 ? 'text-danger' : 'text-muted-foreground' },
            ];

            return (
              <Card key={camp._id} className="panel-interactive overflow-hidden p-0">
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="block truncate text-sm font-semibold text-foreground">{camp.name}</span>
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

                  <dl className="grid divide-x divide-border rounded-lg border border-border bg-muted/30" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
                    {stats.map((s) => (
                      <div key={s.label} className="px-2 py-2 text-center">
                        <dd className={`text-[13px] font-semibold tabular-nums ${s.tone || 'text-foreground'}`}>{s.value}</dd>
                        <dt className="text-[10px] font-medium text-muted-foreground">{s.label}</dt>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-2.5">
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {nextAction ? (
                      <>
                        <span className="font-medium text-foreground">Next:</span> {nextAction}
                      </>
                    ) : null}
                  </span>

                  <div className="flex items-center gap-2">
                    {isAiPersonalized && (
                      <Button variant="outline" size="sm" onClick={() => openAiPreviewModal(camp)} className="h-7 gap-1.5 px-2.5 text-primary">
                        <Sparkles className="h-3.5 w-3.5" /> AI drafts
                      </Button>
                    )}

                    {camp.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => handleCampaignAction(camp._id, 'launch')}
                        disabled={actionLoading === `${camp._id}-launch`}
                        className="h-7 gap-1.5 px-3"
                      >
                        <Play className="h-3.5 w-3.5" /> Launch
                      </Button>
                    )}

                    {camp.status === 'running' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCampaignAction(camp._id, 'pause')}
                        disabled={actionLoading === `${camp._id}-pause`}
                        className="tone-warning h-7 gap-1.5 border px-3 hover:opacity-90"
                      >
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </Button>
                    )}

                    {camp.status === 'paused' && (
                      <Button
                        size="sm"
                        onClick={() => handleCampaignAction(camp._id, 'resume')}
                        disabled={actionLoading === `${camp._id}-resume`}
                        className="h-7 gap-1.5 px-3"
                      >
                        <Play className="h-3.5 w-3.5" /> Resume
                      </Button>
                    )}

                    {failed > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCampaignAction(camp._id, 'retry')}
                        disabled={actionLoading === `${camp._id}-retry`}
                        className="h-7 gap-1.5 px-3"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Retry failed ({failed})
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI drafts preview */}
      {selectedPreviewCampaign && (
        <ModalFrame
          title="AI personalization drafts"
          onClose={() => {
            setSelectedPreviewCampaign(null);
            setAiPreviewData(null);
          }}
          className="max-w-3xl p-0"
        >
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="tone-brand flex h-8 w-8 items-center justify-center rounded-lg border">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">AI personalization drafts</h3>
                  <p className="text-xs text-muted-foreground">{selectedPreviewCampaign.name}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => {
                  setSelectedPreviewCampaign(null);
                  setAiPreviewData(null);
                }}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-5">
              {aiPreviewLoading ? (
                <div className="p-5"><LinesSkeleton lines={5} /></div>
              ) : aiPreviewData?.samples?.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-border bg-card p-2.5">
                      <span className="block text-sm font-semibold tabular-nums text-foreground">{aiPreviewData.totalRecipients || 0}</span>
                      <span className="text-[11px] font-medium text-muted-foreground">Total leads</span>
                    </div>
                    <div className="tone-brand rounded-lg border p-2.5">
                      <span className="block text-sm font-semibold tabular-nums">{aiPreviewData.generationStats?.ready || 0}</span>
                      <span className="text-[11px] font-medium">AI ready</span>
                    </div>
                    <div className="tone-warning rounded-lg border p-2.5">
                      <span className="block text-sm font-semibold tabular-nums">
                        {(aiPreviewData.generationStats?.pending || 0) + (aiPreviewData.generationStats?.generating || 0)}
                      </span>
                      <span className="text-[11px] font-medium">Pending</span>
                    </div>
                  </div>

                  {aiPreviewData.samples.map((s, idx) => (
                    <div key={idx} className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-subtle">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate font-semibold text-foreground">
                          {s.lead?.name || s.email} · <span className="text-primary">{s.lead?.company || 'Prospect'}</span>
                        </span>
                        <StatusBadge status={s.generationStatus} size="sm" />
                      </div>
                      <div className="text-xs font-medium text-foreground">
                        <span className="font-normal text-muted-foreground">Subject:</span> {s.generatedSubject || s.subject}
                      </div>
                      <div className="whitespace-pre-line rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                        {s.generatedBody || s.bodyText || '(Draft pending generation)'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Sparkles} title="No drafts yet" description="No recipient sample drafts have been generated for this campaign." />
              )}
            </div>
          </div>
        </ModalFrame>
      )}

      {isWizardOpen && (
        <BlastWizard
          onClose={() => setIsWizardOpen(false)}
          onCreated={() => {
            setIsWizardOpen(false);
            fetchCampaigns();
          }}
        />
      )}
    </div>
  );
}
