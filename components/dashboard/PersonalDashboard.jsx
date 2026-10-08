'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Target,
  Send,
  ArrowUpRight,
  Plus,
  Upload,
  Radio,
  Users,
  Activity,
  Inbox,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  PieChart,
  Mail,
  Layers,
} from 'lucide-react';
import { useVisibleInterval } from '@/lib/hooks/useVisibleInterval';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import MetricCard from '@/components/ui/MetricCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { SectionCard } from '@/components/ui/section-card';
import DonutChart from '@/components/charts/DonutChart';
import BarList from '@/components/charts/BarList';
import TemperatureBadge from '@/components/leads/TemperatureBadge';
import { deriveTemperature } from '@/lib/leads/temperature';

// Heavy modals/drawer are code-split and only load when opened.
const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer'), { ssr: false });
const LeadImportModal = dynamic(() => import('@/components/leads/LeadImportModal'), { ssr: false });
const BlastWizard = dynamic(() => import('@/components/email/BlastWizard'), { ssr: false });

// Pipeline statuses grouped into five readable buckets for the donut. Totals come straight from
// /api/analytics (the same per-status counts the Analytics screen uses); nothing is estimated.
const PIPELINE_GROUPS = [
  { key: 'new', label: 'New', statuses: ['NEW'], color: 'hsl(var(--chart-6))' },
  { key: 'contacted', label: 'Contacted', statuses: ['CONTACTED'], color: 'hsl(var(--chart-3))' },
  {
    key: 'engaged',
    label: 'Engaged & evaluating',
    statuses: ['ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION'],
    color: 'hsl(var(--chart-2))',
  },
  {
    key: 'won',
    label: 'Trial, approved & recurring',
    statuses: ['TRIAL_ORDER', 'APPROVED_SUPPLIER', 'RECURRING_CUSTOMER'],
    color: 'hsl(var(--chart-4))',
  },
  { key: 'closed', label: 'On hold, lost & DNC', statuses: ['ON_HOLD', 'LOST', 'DO_NOT_CONTACT'], color: 'hsl(var(--chart-5))' },
];

const greetingFor = (date) => {
  const hour = date.getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export default function PersonalDashboard() {
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [modal, setModal] = useState(null);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      // Pipeline/email breakdown is an existing endpoint with a short server cache; a failure there must
      // never take the rest of the dashboard down, so it is fetched alongside and tolerated.
      const [res, analyticsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/analytics').catch(() => null),
      ]);
      if (!res.ok) throw new Error('Dashboard unavailable');
      const json = await res.json();
      if (!json.data) throw new Error('Dashboard unavailable');
      setData(json.data);
      if (analyticsRes && analyticsRes.ok) {
        try {
          const aJson = await analyticsRes.json();
          if (aJson?.data) setAnalytics(aJson.data);
        } catch {
          /* keep previous analytics */
        }
      }
      setUpdatedAt(new Date());
      setError('');
    } catch {
      setError('We couldn’t refresh your dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Once a minute, only while the tab is visible.
  useVisibleInterval(fetchDashboard, 60000);

  const today = data?.today || {};
  const activeCampaigns = data?.activeCampaigns || [];
  const priorityLeads = data?.priorityLeads || [];
  const recentActivities = data?.recentActivities || [];

  const pipelineData = useMemo(() => {
    const pipeline = analytics?.pipeline;
    if (!pipeline) return null;
    const groups = PIPELINE_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      color: g.color,
      value: g.statuses.reduce((sum, s) => sum + (Number(pipeline[s]) || 0), 0),
    }));
    const legacyTotal = Object.values(analytics.legacyStatuses || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    if (legacyTotal > 0) {
      groups.push({ key: 'other', label: 'Other statuses', color: 'hsl(var(--chart-1))', value: legacyTotal });
    }
    return groups;
  }, [analytics]);

  const email = analytics?.email;
  const sent = email?.sent ?? today.emailsSent ?? 0;
  const delivered = email?.delivered ?? today.emailsDelivered ?? 0;
  const replied = email?.replied ?? today.repliesReceived ?? 0;
  const funnelItems = [
    { key: 'sent', label: 'Emails sent', value: sent, color: 'hsl(var(--chart-3))' },
    { key: 'delivered', label: 'Delivered', value: delivered, color: 'hsl(var(--chart-4))' },
    { key: 'replied', label: 'Replies', value: replied, color: 'hsl(var(--chart-1))' },
  ];
  const campaignsValue = activeCampaigns.length >= 5 ? '5+' : activeCampaigns.length;

  const now = useMemo(() => (updatedAt ? new Date(updatedAt) : null), [updatedAt]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 anim-fade-in">
        <div className="min-w-0">
          <p className="field-label flex items-center gap-1.5">
            {now ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Dashboard'}
          </p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
            {now ? greetingFor(now) : 'Dashboard'}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
            <span>Email outreach, pipeline and engagement at a glance.</span>
            {now && (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                Updated {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setModal('import')} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            <span>Import leads</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setModal('campaign')} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span>New campaign</span>
          </Button>
          <Link href="/workstation" className={`${buttonVariants({ size: 'sm' })} gap-1.5`}>
            <Target className="h-3.5 w-3.5" />
            <span>Open workstation</span>
          </Link>
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={fetchDashboard} />}

      {loading && !data ? (
        <div className="space-y-4">
          <LoadingState cards rows={4} label="Loading outreach totals" />
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="panel space-y-4">
              <Skeleton className="h-4 w-40" />
              <div className="flex items-center gap-6">
                <Skeleton className="h-40 w-40 shrink-0 rounded-full" />
                <div className="flex-1 space-y-3">
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-3 w-full" />)}
                </div>
              </div>
            </div>
            <div className="panel space-y-4">
              <Skeleton className="h-4 w-40" />
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          </div>
        </div>
      ) : data ? (
        <>
          {/* KPI row: all-time totals (the API calls them "today" but they are cumulative counts) */}
          <div className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              title="Total leads"
              value={today.totalLeads ?? 0}
              subtext="In your database"
              icon={<Users className="h-3.5 w-3.5" />}
              tone="brand"
              href="/leads"
            />
            <MetricCard
              title="Active campaigns"
              value={campaignsValue}
              subtext="Running, queued or paused"
              icon={<Radio className="h-3.5 w-3.5" />}
              tone="info"
              href="/email/blasts"
            />
            <MetricCard
              title="Replies"
              value={today.repliesReceived ?? 0}
              subtext={`${today.replyRate || '0.0%'} reply rate · ${(today.emailsSent ?? 0).toLocaleString()} sent`}
              icon={<Inbox className="h-3.5 w-3.5" />}
              tone="warning"
              href="/email/inbox"
            />
            <MetricCard
              title="Interested leads"
              value={today.interestedLeads ?? 0}
              subtext="Interested, engaged, qualified or customer"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              tone="success"
              href="/pipeline"
            />
          </div>

          {/* Insight row: pipeline distribution + email funnel */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <SectionCard
              title="Pipeline distribution"
              description="Where every lead sits right now"
              icon={PieChart}
              action={
                <Link href="/pipeline" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                  <span>Open pipeline</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              }
              className="anim-fade-up"
            >
              {pipelineData ? (
                <DonutChart
                  data={pipelineData}
                  centerLabel="Total leads"
                  ariaLabel="Lead pipeline distribution"
                  emptyMessage="No leads yet"
                  size={176}
                  thickness={18}
                />
              ) : (
                <div className="flex items-center gap-6" aria-busy="true">
                  <Skeleton className="h-44 w-44 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-3">
                    {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-3 w-full" />)}
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Email performance"
              description="Delivery and engagement across direct email and campaigns"
              icon={Mail}
              action={
                <Link href="/analytics" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                  <span>Analytics</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              }
              className="anim-fade-up"
            >
              {sent === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No emails sent yet"
                  description="Delivery and reply metrics appear here as soon as outreach goes out."
                />
              ) : (
                <div className="space-y-4">
                  <BarList items={funnelItems} max={sent} showPercentOfMax />
                  <dl className="grid grid-cols-3 divide-x divide-border/70 rounded-lg border border-border bg-muted/20 text-center">
                    <div className="px-3 py-2.5">
                      <dt className="field-label">Reply rate</dt>
                      <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{email?.replyRate || today.replyRate || '0.0%'}</dd>
                    </div>
                    <div className="px-3 py-2.5">
                      <dt className="field-label">Open rate</dt>
                      <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{email?.openRate || '—'}</dd>
                      {email?.openTrackedSent > 0 && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">of {email.openTrackedSent.toLocaleString()} tracked</p>
                      )}
                    </div>
                    <div className="px-3 py-2.5">
                      <dt className="field-label">Bounce rate</dt>
                      <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{email?.bounceRate || '—'}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Work row */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <SectionCard
                title="Priority prospects"
                description="Highest-scoring leads awaiting contact"
                icon={Users}
                flush
                action={
                  <Link href="/leads" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                    <span>View all leads</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                }
              >
                {priorityLeads.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No priority prospects queued"
                    description="Import fresh leads or adjust pipeline filters to build your queue."
                    action={
                      <Button variant="outline" size="sm" onClick={() => setModal('import')}>
                        Import leads
                      </Button>
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Lead</th>
                          <th className="hidden md:table-cell">Company</th>
                          <th>Temperature</th>
                          <th>Status</th>
                          <th className="w-10" aria-label="Open" />
                        </tr>
                      </thead>
                      <tbody>
                        {priorityLeads.slice(0, 6).map((lead) => {
                          const leadId = lead._id || lead.id;
                          const name =
                            lead.fullName ||
                            [lead.firstName, lead.lastName].filter(Boolean).join(' ') ||
                            'Prospect';
                          return (
                            <tr
                              key={leadId}
                              className="group cursor-pointer"
                              onClick={() => setSelectedLeadId(leadId)}
                            >
                              <td>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLeadId(leadId);
                                  }}
                                  className="block text-left"
                                >
                                  <span className="block text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">{name}</span>
                                  <span className="mt-0.5 block max-w-[240px] truncate text-xs text-muted-foreground">
                                    {lead.email || 'No email on file'}
                                  </span>
                                </button>
                              </td>
                              <td className="hidden text-foreground/80 md:table-cell">
                                {lead.company || <span className="text-muted-foreground">—</span>}
                              </td>
                              <td>
                                <TemperatureBadge temperature={deriveTemperature({ score: lead.score })} score={lead.score} showScore />
                              </td>
                              <td>
                                <StatusBadge size="sm" status={lead.status || 'NEW'} label={lead.status?.replaceAll('_', ' ') || 'New'} />
                              </td>
                              <td className="text-right">
                                <ArrowUpRight
                                  className="inline h-4 w-4 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Campaign progress"
                description="Active, queued and paused campaigns"
                icon={Radio}
                action={
                  <Link href="/email/blasts" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                    <span>Manage campaigns</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                }
              >
                {!activeCampaigns.length ? (
                  <EmptyState
                    icon={Radio}
                    title="No active campaigns"
                    description="Create a campaign to send personalised outreach to a targeted list."
                    action={
                      <Button variant="outline" size="sm" onClick={() => setModal('campaign')}>
                        Create campaign
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-2.5">
                    {activeCampaigns.map((camp) => {
                      const campSent = camp.stats?.sent || 0;
                      const count = camp.totalRecipients || camp.recipientCount || camp.stats?.total || 0;
                      const percent = count > 0 ? Math.min(100, Math.round((campSent / count) * 100)) : 0;
                      return (
                        <div
                          key={camp.id || camp._id}
                          className="rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-foreground">{camp.name}</span>
                            <StatusBadge size="sm" status={camp.status || 'DRAFT'} label={camp.status} />
                          </div>
                          <Progress value={percent} aria-label={`${camp.name} progress`} className="mt-2.5 h-1.5 bg-muted" />
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              <strong className="font-semibold tabular-nums text-foreground">{campSent.toLocaleString()}</strong>
                              {' '}sent{count > 0 ? ` of ${count.toLocaleString()}` : ''}
                            </span>
                            <span className="font-semibold tabular-nums text-foreground/90">
                              {count > 0 ? `${percent}%` : 'Pending'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Activity timeline */}
            <SectionCard
              title="Recent activity"
              description="Latest email and pipeline events"
              icon={Layers}
              className="self-start"
              action={
                recentActivities.length > 5 ? (
                  <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {showAllActivities ? `${recentActivities.length} total` : `5 of ${recentActivities.length}`}
                  </span>
                ) : null
              }
            >
              {!recentActivities.length ? (
                <EmptyState
                  icon={Inbox}
                  title="No recent events"
                  description="Email deliveries, replies and status changes will appear here."
                />
              ) : (
                <div>
                  <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-border">
                    {(showAllActivities ? recentActivities : recentActivities.slice(0, 5)).map((act, i) => {
                      const type = (act.type || act.title || '').toUpperCase();
                      const Icon = type.includes('EMAIL') ? Send : Activity;
                      const time = act.timestamp || act.time;
                      return (
                        <li key={act.id || i} className="relative flex gap-3 text-xs">
                          <div className="relative z-10 mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="break-words font-medium leading-snug text-foreground">
                              {act.description || act.title || 'Outbound action'}
                            </p>
                            {time && (
                              <time dateTime={time} className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                                {new Date(time).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </time>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>

                  {recentActivities.length > 5 && (
                    <div className="mt-4 border-t border-border pt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllActivities(!showAllActivities)}
                        className="h-8 w-full gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        {showAllActivities ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            <span>Show less</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            <span>Show {recentActivities.length - 5} more</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      ) : null}

      {/* Modals & Drawers */}
      {selectedLeadId && (
        <LeadDrawer leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} onUpdated={fetchDashboard} />
      )}
      {modal === 'import' && <LeadImportModal onClose={() => setModal(null)} onImported={fetchDashboard} />}
      {modal === 'campaign' && (
        <BlastWizard
          onClose={() => setModal(null)}
          onCreated={() => {
            setModal(null);
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
}
