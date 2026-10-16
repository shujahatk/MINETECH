'use client';

import React from 'react';
import {
  CreditCard,
  TrendingUp,
  Users,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  Download,
  Plus,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { MetricCard } from '../../components/cards/MetricCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DonutChart } from '../../components/charts/DonutChart';
import { BarList } from '../../components/charts/BarList';
import { Progress } from '../../components/common/Progress';
import { StatusBadge } from '../../components/feedback/StatusBadge';
import { Badge } from '../../components/feedback/Badge';
import { Button } from '../../components/buttons/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/tables/Table';

export function SaaSDashboard({ className = '' }) {
  const subscriptions = [
    { id: 'sub-1', customer: 'Global Mining Logistics', plan: 'Enterprise Plus', seats: 24, mrr: '$3,800', status: 'active', renewal: 'Nov 12, 2026' },
    { id: 'sub-2', customer: 'Apex Raw Commodities', plan: 'Growth Tier', seats: 12, mrr: '$1,900', status: 'active', renewal: 'Dec 01, 2026' },
    { id: 'sub-3', customer: 'Nordic Smelting Group', plan: 'Enterprise Plus', seats: 40, mrr: '$6,200', status: 'active', renewal: 'Oct 29, 2026' },
    { id: 'sub-4', customer: 'Vance Industrial Supply', plan: 'Starter', seats: 5, mrr: '$650', status: 'trial_order', renewal: 'In 3 days' },
  ];

  const planBreakdown = [
    { key: 'ent', label: 'Enterprise Plus ($3k+)', value: 48, color: 'hsl(var(--chart-1))' },
    { key: 'growth', label: 'Growth Tier ($1.5k)', value: 86, color: 'hsl(var(--chart-2))' },
    { key: 'starter', label: 'Starter ($650)', value: 142, color: 'hsl(var(--chart-3))' },
    { key: 'trial', label: '14-Day Free Trials', value: 34, color: 'hsl(var(--chart-4))' },
  ];

  return (
    <div className={`space-y-5 ${className}`}>
      <PageHeader
        icon={CreditCard}
        title="SaaS Platform Overview"
        description="Subscription lifecycle, recurring ARR/MRR metrics, and tenant API consumption."
        meta="Active Tenants: 310"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span>Invoices</span>
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span>Create Tenant</span>
            </Button>
          </div>
        }
      />

      {/* Top 4 SaaS Financial KPIs */}
      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Monthly Recurring Revenue"
          value="$148,200"
          delta="+12.4% MoM"
          subtext="Net ARR: $1.78M"
          tone="brand"
          sparklineData={[110, 118, 126, 134, 142, 148.2]}
        />
        <MetricCard
          title="Paying Organizations"
          value={310}
          delta="+18 new"
          subtext="Avg. MRR per tenant: $478"
          tone="info"
          sparklineData={[240, 255, 270, 288, 302, 310]}
        />
        <MetricCard
          title="Net Revenue Retention"
          value="118.2%"
          delta="Top quartile"
          subtext="Expansion revenue exceeding churn"
          tone="success"
          sparklineData={[112, 114, 115, 116.5, 118.2]}
        />
        <MetricCard
          title="Monthly Churn Rate"
          value="0.84%"
          delta="-0.2%"
          deltaType="positive"
          subtext="Industry benchmark: 2.1%"
          tone="warning"
          sparklineData={[1.4, 1.2, 1.1, 0.95, 0.84]}
        />
      </div>

      {/* Middle Row: Plan Distribution & API Usage Quota */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionCard
            title="Subscription Tier Breakdown"
            description="Active recurring customer count by package"
            icon={Layers}
            className="h-full"
          >
            <DonutChart
              data={planBreakdown}
              centerLabel="Active Customers"
              centerValue="310"
            />
          </SectionCard>
        </div>

        <div className="lg:col-span-7">
          <SectionCard
            title="Platform Resource & API Quota Usage"
            description="Tenant aggregate bandwidth, token consumption, and webhook limits"
            icon={Zap}
            className="h-full space-y-4"
          >
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">MINE-TECH AI Tokens</span>
                <span className="text-muted-foreground tabular-nums">4.2M / 10.0M tokens (42%)</span>
              </div>
              <Progress value={42} />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Outbound Email Quota</span>
                <span className="text-muted-foreground tabular-nums">38,400 / 50,000 sent (76.8%)</span>
              </div>
              <Progress value={76.8} indicatorClassName="bg-amber-500" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Database Storage & Replicas</span>
                <span className="text-muted-foreground tabular-nums">14.8 GB / 50.0 GB (29.6%)</span>
              </div>
              <Progress value={29.6} />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Concurrent Voice Lines (Twilio)</span>
                <span className="text-muted-foreground tabular-nums">8 / 20 active channels (40%)</span>
              </div>
              <Progress value={40} />
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Lower Row: Subscriptions Table */}
      <SectionCard
        title="Active Subscription Accounts"
        description="Enterprise and growth contracts renewed this cycle"
        icon={Users}
        flush
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Organization</TableHead>
              <TableHead>Plan Tier</TableHead>
              <TableHead className="text-center">Licensed Seats</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Next Renewal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell className="font-semibold text-foreground">
                  {sub.customer}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{sub.plan}</Badge>
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {sub.seats} seats
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-foreground tabular-nums">
                  {sub.mrr}
                </TableCell>
                <TableCell>
                  <StatusBadge status={sub.status} />
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {sub.renewal}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}

export default SaaSDashboard;
