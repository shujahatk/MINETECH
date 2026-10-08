'use client';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState, LinesSkeleton } from '@/components/ui/loading-state';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  Users,
  ArrowUpRight,
  Filter,
  Flame,
  Mail,
  Send,
  PieChart,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import MetricCard from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/StatusBadge';
import DonutChart from '@/components/charts/DonutChart';
import BarList from '@/components/charts/BarList';

// Stage colours follow the same five buckets the dashboard donut uses, so both screens read alike.
const C_NEW = 'hsl(var(--chart-6))';
const C_CONTACTED = 'hsl(var(--chart-3))';
const C_ENGAGED = 'hsl(var(--chart-2))';
const C_WON = 'hsl(var(--chart-4))';
const C_CLOSED = 'hsl(var(--chart-5))';

const STAGE_CONFIG = {
  NEW: { label: 'New lead', color: C_NEW },
  CONTACTED: { label: 'Contacted', color: C_CONTACTED },
  ENGAGED: { label: 'Engaged', color: C_ENGAGED },
  TECHNICAL_EVALUATION: { label: 'Tech evaluation', color: C_ENGAGED },
  COMMERCIAL_DISCUSSION: { label: 'Commercial discussion', color: C_ENGAGED },
  TRIAL_ORDER: { label: 'Trial order', color: C_WON },
  APPROVED_SUPPLIER: { label: 'Approved supplier', color: C_WON },
  RECURRING_CUSTOMER: { label: 'Recurring customer', color: C_WON },
  ON_HOLD: { label: 'On hold', color: C_CLOSED },
  LOST: { label: 'Lost', color: C_CLOSED },
  DO_NOT_CONTACT: { label: 'Do not contact', color: C_CLOSED },
};

const FUNNEL_FLOW = [
  'NEW',
  'CONTACTED',
  'ENGAGED',
  'TECHNICAL_EVALUATION',
  'COMMERCIAL_DISCUSSION',
  'TRIAL_ORDER',
  'APPROVED_SUPPLIER',
  'RECURRING_CUSTOMER',
];
const OFF_FUNNEL = ['ON_HOLD', 'LOST', 'DO_NOT_CONTACT'];

const DONUT_GROUPS = [
  { key: 'new', label: 'New', statuses: ['NEW'], color: C_NEW },
  { key: 'contacted', label: 'Contacted', statuses: ['CONTACTED'], color: C_CONTACTED },
  { key: 'engaged', label: 'Engaged & evaluating', statuses: ['ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION'], color: C_ENGAGED },
  { key: 'won', label: 'Trial, approved & recurring', statuses: ['TRIAL_ORDER', 'APPROVED_SUPPLIER', 'RECURRING_CUSTOMER'], color: C_WON },
  { key: 'closed', label: 'On hold, lost & DNC', statuses: ['ON_HOLD', 'LOST', 'DO_NOT_CONTACT'], color: C_CLOSED },
];

export default function AnalyticsView() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(null);
  const [stageLeads, setStageLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json(); })
      .then((j) => setData(j.data))
      .catch(() => setLoadError('Could not load analytics. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const handleStageClick = async (stageKey) => {
    if (activeStage === stageKey) {
      setActiveStage(null);
      setStageLeads([]);
      return;
    }

    setActiveStage(stageKey);
    setLoadingLeads(true);
    try {
      const res = await fetch(`/api/leads?status=${stageKey}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        setStageLeads(json.leads || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLeads(false);
    }
  };

  const navigateToLeads = (stageKey) => {
    router.push(`/leads?status=${stageKey}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader icon={BarChart3} title="Analytics" description="Deliverability, funnel conversion and prospect distribution across the workspace." className="mb-0" />
        <LoadingState cards rows={4} label="Loading analytics" />
        <div className="panel p-0"><LoadingState rows={6} label="Loading funnel" /></div>
      </div>
    );
  }

  if (loadError) return <ErrorState message={loadError} onRetry={() => window.location.reload()} />;

  const email = data?.email || {};
  const pipeline = data?.pipeline || {};

  const pipelineTotal = Object.values(pipeline).reduce((a, b) => a + b, 0);
  const totalLeads = pipelineTotal || 1; // divisor only; never displayed
  const activePipelineLeads = (pipeline.NEW || 0) + (pipeline.CONTACTED || 0) + (pipeline.ENGAGED || 0) + (pipeline.TECHNICAL_EVALUATION || 0) + (pipeline.COMMERCIAL_DISCUSSION || 0) + (pipeline.TRIAL_ORDER || 0);
  const converted = (pipeline.APPROVED_SUPPLIER || 0) + (pipeline.RECURRING_CUSTOMER || 0);

  const donutData = DONUT_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    color: g.color,
    value: g.statuses.reduce((sum, s) => sum + (pipeline[s] || 0), 0),
  }));

  const emailFunnel = [
    { key: 'sent', label: 'Sent', value: email.sent || 0, color: 'hsl(var(--chart-3))' },
    { key: 'delivered', label: 'Delivered', value: email.delivered || 0, color: 'hsl(var(--chart-4))' },
    { key: 'opened', label: 'Opened', value: email.opened || 0, color: 'hsl(var(--chart-2))' },
    { key: 'replied', label: 'Replied', value: email.replied || 0, color: 'hsl(var(--chart-1))' },
    { key: 'bounced', label: 'Bounced', value: email.bounced || 0, color: 'hsl(var(--chart-5))' },
  ];
  const hasEmailData = (email.sent || 0) > 0;

  const renderTile = (stageKey) => {
    const conf = STAGE_CONFIG[stageKey];
    const count = pipeline[stageKey] || 0;
    const pct = Math.round((count / totalLeads) * 100);
    const selected = activeStage === stageKey;
    return (
      <button
        key={stageKey}
        type="button"
        onClick={() => handleStageClick(stageKey)}
        aria-pressed={selected}
        className={`flex flex-col justify-between rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
          selected ? 'row-selected border-primary/40' : 'border-border bg-card hover:border-muted-foreground/40 hover:bg-muted/30'
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="h-2 w-2 rounded-full" style={{ background: conf.color }} aria-hidden="true" />
          <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div>
          <span className="block text-xl font-semibold tabular-nums tracking-tight text-foreground">{count.toLocaleString()}</span>
          <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground">{conf.label}</span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-chart-track">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: count > 0 ? `${Math.max(6, pct)}%` : '0%', background: conf.color }}
          />
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="Deliverability, funnel conversion and prospect distribution across the workspace."
        className="mb-0"
        actions={
          <Button size="sm" onClick={() => router.push('/leads')} className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> View leads
          </Button>
        }
      />

      {/* KPI row: all values come from /api/analytics */}
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          title="Active outreach leads"
          value={activePipelineLeads}
          subtext="New through trial order"
          icon={<Users className="h-3.5 w-3.5" />}
          tone="brand"
          href="/leads"
        />
        <MetricCard
          title="Reply rate"
          value={email.replyRate || '0.0%'}
          subtext={`${(email.replied || 0).toLocaleString()} replies from ${(email.sent || 0).toLocaleString()} sent`}
          icon={<Mail className="h-3.5 w-3.5" />}
          tone="warning"
        />
        <MetricCard
          title="Open rate"
          value={email.openRate || '0.0%'}
          subtext={`${(email.opened || 0).toLocaleString()} of ${(email.openTrackedSent ?? email.sent ?? 0).toLocaleString()} tracked sends`}
          icon={<Send className="h-3.5 w-3.5" />}
          tone="info"
        />
        <MetricCard
          title="Approved & recurring"
          value={converted}
          subtext="Converted accounts"
          icon={<Flame className="h-3.5 w-3.5" />}
          tone="success"
        />
      </div>

      {/* Two real-data visuals */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Pipeline distribution" description="Where every lead sits right now" icon={PieChart}>
          <DonutChart
            data={donutData}
            centerLabel="Total leads"
            ariaLabel="Lead pipeline distribution"
            emptyMessage="No leads yet"
            size={176}
            thickness={18}
          />
        </SectionCard>

        <SectionCard
          title="Email performance"
          description="Delivery and engagement across all sends"
          icon={Mail}
          action={
            email.bounceRate ? (
              <span className="text-xs text-muted-foreground">
                Bounce rate <span className="font-semibold tabular-nums text-foreground">{email.bounceRate}</span>
              </span>
            ) : null
          }
        >
          {hasEmailData ? (
            <BarList items={emailFunnel} max={email.sent} showPercentOfMax emptyMessage="No emails sent yet" />
          ) : (
            <p className="py-10 text-center text-xs text-muted-foreground">No emails sent yet. Launch a campaign to see delivery and engagement.</p>
          )}
        </SectionCard>
      </div>

      {/* Conversion funnel + drill-down */}
      <SectionCard
        title="Conversion funnel"
        description="Select a stage to preview its prospects."
        icon={TrendingUp}
        action={
          <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
            Total leads <strong className="font-semibold tabular-nums text-foreground">{pipelineTotal.toLocaleString()}</strong>
          </span>
        }
        bodyClassName="space-y-4"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {FUNNEL_FLOW.map(renderTile)}
        </div>

        <div>
          <span className="field-label mb-2 block">Outside the funnel</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {OFF_FUNNEL.map(renderTile)}
          </div>
        </div>

        {activeStage && (
          <div className="anim-fade-up rounded-xl border border-primary/25 bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs">
                <Filter className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-foreground">
                  {STAGE_CONFIG[activeStage]?.label || activeStage}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {loadingLeads ? '' : `showing ${stageLeads.length}${(pipeline[activeStage] || 0) > stageLeads.length ? ` of ${pipeline[activeStage]}` : ''}`}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigateToLeads(activeStage)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  Open in leads <ArrowUpRight className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveStage(null); setStageLeads([]); }}
                  aria-label="Close stage preview"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {loadingLeads ? (
              <div className="p-4"><LinesSkeleton lines={4} /></div>
            ) : stageLeads.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No leads in this stage.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs font-semibold text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Email</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Company</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Title</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border bg-card">
                    {stageLeads.map((lead) => (
                      <TableRow
                        key={lead._id || lead.id}
                        onClick={() => router.push(`/workstation`)}
                        className="cursor-pointer border-border hover:bg-muted/40"
                      >
                        <TableCell className="py-2.5 text-xs font-semibold text-foreground">
                          {lead.firstName} {lead.lastName}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">{lead.email || '—'}</TableCell>
                        <TableCell className="py-2.5 text-xs font-medium text-foreground">{lead.company || '—'}</TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">{lead.title || lead.jobTitle || '—'}</TableCell>
                        <TableCell className="py-2.5">
                          <StatusBadge status={lead.status || 'NEW'} size="sm" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
