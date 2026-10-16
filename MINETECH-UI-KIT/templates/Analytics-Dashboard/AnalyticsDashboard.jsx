'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  Calendar,
  Filter,
  TrendingUp,
  Mail,
  Send,
  CheckCircle2,
  PieChart,
  Download,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { MetricCard } from '../../components/cards/MetricCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DonutChart } from '../../components/charts/DonutChart';
import { BarList } from '../../components/charts/BarList';
import { ConversionFunnel } from '../../components/charts/ConversionFunnel';
import { Button } from '../../components/buttons/Button';
import { SegmentedControl } from '../../components/navigation/SegmentedControl';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/tables/Table';
import { mockDonutDistribution, mockPipelineStages } from '../../utils/mockData';

export function AnalyticsDashboard({ className = '' }) {
  const [timeRange, setTimeRange] = useState('30d');

  const funnelStages = [
    { label: '1. New Accounts Discovered', value: 1248, color: 'hsl(var(--chart-6))' },
    { label: '2. Contacted via Email Sequence', value: 836, color: 'hsl(var(--chart-3))' },
    { label: '3. Opened & Engaged', value: 524, color: 'hsl(var(--chart-2))' },
    { label: '4. Technical Spec Evaluation', value: 182, color: 'hsl(var(--chart-1))' },
    { label: '5. Commercial Proposal Delivered', value: 94, color: 'hsl(var(--chart-2))' },
    { label: '6. Trial Order Executed', value: 42, color: 'hsl(var(--chart-4))' },
    { label: '7. Contracted Recurring Customer', value: 19, color: 'hsl(var(--chart-4))' },
  ];

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Page Header with Time Range Switcher */}
      <PageHeader
        icon={BarChart3}
        title="Intelligence & Analytics"
        description="Deliverability, pipeline conversion velocity, and outbound funnel performance."
        meta="Updated 2 mins ago"
        actions={
          <div className="flex items-center gap-2">
            <SegmentedControl
              options={[
                { label: '7 Days', value: '7d' },
                { label: '30 Days', value: '30d' },
                { label: 'Quarter', value: '90d' },
                { label: 'Year', value: '1y' },
              ]}
              value={timeRange}
              onChange={setTimeRange}
            />
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span>Report</span>
            </Button>
          </div>
        }
      />

      {/* Top Deliverability & Conversion KPIs */}
      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Outbound Dispatched"
          value={14280}
          delta="+18.4%"
          subtext="Total cold & sequence touches"
          tone="brand"
          sparklineData={[12, 14, 18, 22, 28, 35, 42]}
        />
        <MetricCard
          title="Deliverability Health"
          value="99.4%"
          delta="Zero spam reports"
          subtext="Domain reputation score: 98/100"
          tone="success"
          sparklineData={[98, 98.2, 99, 99.1, 99.4]}
        />
        <MetricCard
          title="Open & Read Rate"
          value="46.8%"
          delta="+4.2% lift"
          subtext="MINE-TECH AI personalized intro"
          tone="info"
          sparklineData={[38, 40, 42, 44, 46.8]}
        />
        <MetricCard
          title="Opportunity Win Rate"
          value="22.6%"
          delta="+3.1%"
          subtext="Trial order to recurring conversion"
          tone="warning"
          sparklineData={[18, 19, 21, 21.5, 22.6]}
        />
      </div>

      {/* Middle Row: Funnel Visual + Donut Distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SectionCard
            title="End-to-End Outbound Funnel"
            description="Prospect dropoff and conversion rate between each sales phase"
            icon={TrendingUp}
          >
            <ConversionFunnel stages={funnelStages} />
          </SectionCard>
        </div>

        <div className="lg:col-span-5">
          <SectionCard
            title="Lead Warmth & Segment Distribution"
            description="Active prospects grouped by qualification bucket"
            icon={PieChart}
          >
            <DonutChart
              data={mockDonutDistribution}
              centerLabel="Active Accounts"
              centerValue="1,248"
            />
          </SectionCard>
        </div>
      </div>

      {/* Lower Section: Stage Performance Breakdown Table */}
      <SectionCard
        title="Stage Conversion Velocity"
        description="Detailed timing and success ratios per stage in the chosen timeframe"
        icon={BarChart3}
        flush
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage Name</TableHead>
              <TableHead className="text-right">Active Count</TableHead>
              <TableHead className="text-right">Avg. Days in Stage</TableHead>
              <TableHead className="text-right">Stage Pass Rate</TableHead>
              <TableHead className="text-right">Total Est. Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockPipelineStages.map((stage, idx) => (
              <TableRow key={stage.key}>
                <TableCell className="font-semibold flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span>{stage.label}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {stage.count}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {3 + idx * 2} days
                </TableCell>
                <TableCell className="text-right tabular-nums text-primary font-semibold">
                  {Math.round(85 - idx * 8)}%
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  ${((stage.count * 18500) / 1000).toFixed(0)}k
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}

export default AnalyticsDashboard;
