'use client';

import React, { useState } from 'react';
import {
  Users,
  Target,
  Plus,
  Download,
  Filter,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Briefcase,
  Layers,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { MetricCard } from '../../components/cards/MetricCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DonutChart } from '../../components/charts/DonutChart';
import { BarList } from '../../components/charts/BarList';
import { DataTable } from '../../components/tables/DataTable';
import { KanbanBoard } from '../../components/kanban/KanbanBoard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/common/Tabs';
import { Button } from '../../components/buttons/Button';
import { mockKpis, mockLeads, mockPipelineStages, mockDonutDistribution } from '../../utils/mockData';

export function CRMDashboard({ className = '' }) {
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'kanban'
  const [leads, setLeads] = useState(mockLeads);

  const columns = [
    {
      key: 'company',
      label: 'Company & Contact',
      render: (_, row) => (
        <div>
          <span className="font-semibold text-foreground block">{row.company}</span>
          <span className="text-xs text-muted-foreground">{row.contactPerson} · {row.title}</span>
        </div>
      ),
    },
    { key: 'product', label: 'Product' },
    { key: 'temperature', label: 'Warmth' },
    { key: 'status', label: 'Pipeline Stage' },
    {
      key: 'dealValue',
      label: 'Est. Value',
      className: 'text-right',
      cellClassName: 'text-right font-semibold tabular-nums',
      render: (v) => `$${Number(v).toLocaleString()}`,
    },
    { key: 'nextAction', label: 'Next Scheduled Action' },
  ];

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Page Header */}
      <PageHeader
        icon={Users}
        title="CRM & Pipeline"
        description="Outbound accounts, deal stages, and prospect interactions across the workspace."
        meta="1,248 Active Accounts"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span>Add New Lead</span>
            </Button>
          </div>
        }
      />

      {/* Top 4 KPI Metrics */}
      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mockKpis.map((kpi) => (
          <MetricCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            delta={kpi.delta}
            deltaType={kpi.deltaType}
            subtext={kpi.subtext}
            tone={kpi.tone}
            sparklineData={kpi.sparkline}
          />
        ))}
      </div>

      {/* Middle Row: Pipeline Donut & Conversion Bars */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionCard
            title="Deal Distribution"
            description="Prospect volume grouped across stages"
            icon={Layers}
            className="h-full"
          >
            <DonutChart
              data={mockDonutDistribution}
              centerLabel="Active Leads"
              centerValue="1,248"
            />
          </SectionCard>
        </div>

        <div className="lg:col-span-7">
          <SectionCard
            title="Pipeline Progression"
            description="Accounts progressing toward contracted commercial status"
            icon={Target}
            className="h-full"
          >
            <BarList
              items={mockPipelineStages.map((s) => ({
                key: s.key,
                label: s.label,
                value: s.value,
                color: s.color,
              }))}
              showPercentOfMax
            />
          </SectionCard>
        </div>
      </div>

      {/* Lower Section: Tabs between Data Table and Drag & Drop Kanban */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-heading text-base font-semibold">Workspace Pipeline View</h2>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="table">List & Table</TabsTrigger>
              <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {activeTab === 'table' ? (
          <DataTable
            columns={columns}
            data={leads}
            searchPlaceholder="Search leads by company, contact, or product..."
            onRowClick={(row) => alert(`Selected lead: ${row.company}`)}
          />
        ) : (
          <div className="panel p-3">
            <KanbanBoard
              items={leads}
              onItemClick={(item) => alert(`Deal clicked: ${item.company}`)}
              onStageChange={(id, newStage) => {
                setLeads((prev) =>
                  prev.map((l) => (l.id === id ? { ...l, status: newStage } : l))
                );
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default CRMDashboard;
