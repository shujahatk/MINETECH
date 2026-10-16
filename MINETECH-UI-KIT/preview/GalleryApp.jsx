'use client';

import React, { useState } from 'react';
import {
  Palette,
  Layers,
  MousePointer,
  CreditCard,
  BarChart3,
  Table as TableIcon,
  CheckSquare,
  MessageSquare,
  Sparkles,
  PhoneCall,
  Layout,
  Smartphone,
  Tablet,
  Monitor,
  Moon,
  Sun,
  Copy,
  Check,
  Code,
  ExternalLink,
  ChevronRight,
  Shield,
  Users,
} from 'lucide-react';
import { useTheme } from '../themes/ThemeProvider';
import { ThemeToggle } from '../themes/ThemeToggle';
import { brandColors, chartPalette, motion } from '../themes/theme-tokens';

// Components imports
import { Button } from '../components/buttons/Button';
import { ActionButton } from '../components/buttons/ActionButton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/cards/Card';
import { MetricCard } from '../components/cards/MetricCard';
import { SectionCard } from '../components/cards/SectionCard';
import { AmbientCard } from '../components/cards/AmbientCard';
import { DonutChart } from '../components/charts/DonutChart';
import { BarList } from '../components/charts/BarList';
import { ConversionFunnel } from '../components/charts/ConversionFunnel';
import { DataTable } from '../components/tables/DataTable';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/tables/Table';
import { Input } from '../components/forms/Input';
import { GlowInput } from '../components/forms/GlowInput';
import { Textarea } from '../components/forms/Textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/forms/Select';
import { Checkbox } from '../components/forms/Checkbox';
import { ModalFrame } from '../components/modals/ModalFrame';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/modals/Dialog';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '../components/modals/AlertDialog';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/modals/Sheet';
import { StatusBadge } from '../components/feedback/StatusBadge';
import { TemperatureBadge } from '../components/feedback/TemperatureBadge';
import { Badge } from '../components/feedback/Badge';
import { LoadingState, LinesSkeleton } from '../components/feedback/LoadingState';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { DialerPad } from '../components/dialer/DialerPad';
import { CallControls } from '../components/dialer/CallControls';
import { AiInsightCard } from '../components/ai/AiInsightCard';
import { AiDraftBar } from '../components/ai/AiDraftBar';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { PageHeader } from '../components/common/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/Tabs';
import { Progress } from '../components/common/Progress';
import { Separator } from '../components/common/Separator';
import { SegmentedControl } from '../components/navigation/SegmentedControl';
import { Breadcrumb } from '../components/navigation/Breadcrumb';

// Templates imports
import { CRMDashboard } from '../templates/CRM-Dashboard/CRMDashboard';
import { AnalyticsDashboard } from '../templates/Analytics-Dashboard/AnalyticsDashboard';
import { AIDialerDashboard } from '../templates/AI-Dialer-Dashboard/AIDialerDashboard';
import { AdminPanel } from '../templates/Admin-Panel/AdminPanel';
import { SaaSDashboard } from '../templates/SaaS-Dashboard/SaaSDashboard';

// Layout imports
import { AuthLayout } from '../layouts/AuthLayout';
import { mockLeads, mockKpis, mockDonutDistribution, mockPipelineStages } from '../utils/mockData';

const CATEGORIES = [
  { id: 'tokens', label: 'Design Tokens & Theme', icon: Palette },
  { id: 'buttons', label: 'Buttons & Controls', icon: MousePointer },
  { id: 'cards', label: 'Cards & KPI Tiles', icon: CreditCard },
  { id: 'charts', label: 'Charts & Funnels', icon: BarChart3 },
  { id: 'tables', label: 'Tables & DataGrids', icon: TableIcon },
  { id: 'forms', label: 'Forms & Inputs', icon: CheckSquare },
  { id: 'modals', label: 'Modals & Drawers', icon: Layout },
  { id: 'feedback', label: 'Badges, Status & Feedback', icon: Sparkles },
  { id: 'kanban', label: 'Kanban Deal Pipeline', icon: Layers },
  { id: 'dialer', label: 'AI Voice & Dialer', icon: PhoneCall },
  { id: 'ai', label: 'AI Intelligence Components', icon: Sparkles },
  {
    id: 'templates-group',
    label: '--- TEMPLATES ---',
    isHeader: true,
  },
  { id: 'tmpl-crm', label: 'CRM Dashboard', icon: Users },
  { id: 'tmpl-analytics', label: 'Analytics Dashboard', icon: BarChart3 },
  { id: 'tmpl-dialer', label: 'AI Dialer Dashboard', icon: PhoneCall },
  { id: 'tmpl-admin', label: 'Admin & Health Panel', icon: Shield },
  { id: 'tmpl-saas', label: 'SaaS Platform Overview', icon: CreditCard },
  {
    id: 'layouts-group',
    label: '--- LAYOUTS ---',
    isHeader: true,
  },
  { id: 'layout-auth', label: 'Auth Screen Layout', icon: Layout },
];

export function GalleryApp() {
  const { resolvedTheme } = useTheme();
  const [activeCategory, setActiveCategory] = useState('tokens');
  const [viewport, setViewport] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [copiedCode, setCopiedCode] = useState(false);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleDrawerOpen, setSampleDrawerOpen] = useState(false);

  const copySnippet = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getViewportWidth = () => {
    switch (viewport) {
      case 'mobile':
        return 'max-w-[390px]';
      case 'tablet':
        return 'max-w-[768px]';
      default:
        return 'w-full';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar Gallery Navigation */}
      <aside className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col h-full z-20 select-none">
        {/* Brand Header */}
        <div className="h-14 shrink-0 border-b border-sidebar-border px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm shadow-subtle">
              M
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-foreground block">MineTech UI Kit</span>
              <span className="text-[10px] font-medium text-muted-foreground block">Design System Gallery</span>
            </div>
          </div>
          <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
            v1.0
          </span>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {CATEGORIES.map((cat) => {
            if (cat.isHeader) {
              return (
                <div key={cat.id} className="pt-3 pb-1 px-2.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                  {cat.label}
                </div>
              );
            }
            const Icon = cat.icon;
            const isSelected = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-subtle'
                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="truncate">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Gallery Footer */}
        <div className="p-3 border-t border-sidebar-border text-[11px] text-muted-foreground flex items-center justify-between">
          <span>MineTech Outbound</span>
          <span className="font-mono text-[10px] text-primary font-semibold">Ready for RM Dialer</span>
        </div>
      </aside>

      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Controls Bar */}
        <header className="h-14 shrink-0 border-b border-border bg-card/90 backdrop-blur px-5 flex items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-muted-foreground">Gallery</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="text-foreground font-semibold">
              {CATEGORIES.find((c) => c.id === activeCategory)?.label || 'Components'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewport Width Switcher */}
            <div className="hidden sm:inline-flex items-center p-0.5 rounded-lg border border-border bg-muted/40">
              <button
                type="button"
                onClick={() => setViewport('desktop')}
                title="Desktop View (100%)"
                className={`p-1.5 rounded-md transition-colors ${
                  viewport === 'desktop' ? 'bg-card text-foreground shadow-subtle ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewport('tablet')}
                title="Tablet View (768px)"
                className={`p-1.5 rounded-md transition-colors ${
                  viewport === 'tablet' ? 'bg-card text-foreground shadow-subtle ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Tablet className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewport('mobile')}
                title="Mobile View (390px)"
                className={`p-1.5 rounded-md transition-colors ${
                  viewport === 'mobile' ? 'bg-card text-foreground shadow-subtle ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>

            <div className="h-5 w-px bg-border hidden sm:block" />

            {/* Dark / Light Mode Switch */}
            <ThemeToggle showLabel />
          </div>
        </header>

        {/* Canvas Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          <div className={`mx-auto transition-all duration-300 ${getViewportWidth()}`}>
            {/* RENDER CATEGORY CONTENT */}

            {/* 1. TOKENS & PALETTE */}
            {activeCategory === 'tokens' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">MineTech Design Tokens</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Curated color palette, surface ladders, and typography built around terracotta clay and warm stone porcelain.
                  </p>
                </div>

                <SectionCard title="Brand Colors (MineTech Signature)">
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {Object.entries(brandColors).map(([name, hex]) => (
                      <div key={name} className="space-y-1.5">
                        <div
                          className="h-16 rounded-lg border border-border shadow-subtle"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="text-xs font-semibold text-foreground block capitalize">{name}</span>
                        <span className="text-[11px] font-mono text-muted-foreground block">{hex}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Data Visualization Palette (Chart 1 - 6)">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {chartPalette.map((token, i) => (
                      <div key={i} className="space-y-1.5">
                        <div
                          className="h-12 rounded-lg border border-border shadow-subtle"
                          style={{ backgroundColor: token }}
                        />
                        <span className="text-xs font-semibold text-foreground block">Chart {i + 1}</span>
                        <span className="text-[10px] font-mono text-muted-foreground block">{token}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Elevation & Shadows">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="panel p-4 shadow-subtle">
                      <span className="font-semibold text-xs text-foreground block">--shadow-subtle</span>
                      <span className="text-xs text-muted-foreground">Controls, badges, minimal lift</span>
                    </div>
                    <div className="panel p-4 shadow-card">
                      <span className="font-semibold text-xs text-foreground block">--shadow-card</span>
                      <span className="text-xs text-muted-foreground">Cards, panels, widgets</span>
                    </div>
                    <div className="panel p-4 shadow-hover">
                      <span className="font-semibold text-xs text-foreground block">--shadow-hover</span>
                      <span className="text-xs text-muted-foreground">Interactive hover lift</span>
                    </div>
                  </div>
                </SectionCard>
              </div>
            )}

            {/* 2. BUTTONS & CONTROLS */}
            {activeCategory === 'buttons' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">Buttons & Action Controls</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Button variants, sizes, icon combinations, and press micro-animations.
                  </p>
                </div>

                <SectionCard title="Button Variants">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="default">Primary Clay</Button>
                    <Button variant="secondary">Secondary Surface</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost Button</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="link">Underlined Link</Button>
                    <Button disabled>Disabled Button</Button>
                  </div>
                </SectionCard>

                <SectionCard title="Button Sizes">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm">Small (h-8)</Button>
                    <Button size="default">Default (h-9)</Button>
                    <Button size="lg">Large (h-10)</Button>
                    <Button size="icon" aria-label="Icon">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </SectionCard>

                <SectionCard title="Action Buttons with Chips">
                  <div className="flex flex-wrap gap-2.5">
                    <ActionButton icon={Sparkles} label="AI Personalized Draft" />
                    <ActionButton icon={PhoneCall} label="Quick Dial" active />
                    <ActionButton icon={Check} label="Mark Contacted" />
                  </div>
                </SectionCard>
              </div>
            )}

            {/* 3. CARDS & KPI TILES */}
            {activeCategory === 'cards' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">Cards & KPI Metric Tiles</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Live KPI tiles with SVG sparklines, AnimatedNumber counts, trend chips, and enterprise section containers.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

                <SectionCard
                  title="SectionCard Container"
                  description="Standard container for all modules, panels, and forms"
                  icon={CreditCard}
                  action={<Button size="sm">Action Trigger</Button>}
                >
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    This is the standard enterprise card container used throughout MineTech for dashboard widgets,
                    analytics blocks, and forms. It aligns headers, subtitles, action controls, and borders.
                  </p>
                </SectionCard>

                <AmbientCard glow="primary">
                  <h3 className="text-base font-bold text-foreground">Ambient Glow Atmospheric Card</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    Designed for high-impact spotlights, upgrade banners, or featured AI intelligence insights.
                  </p>
                </AmbientCard>
              </div>
            )}

            {/* 4. CHARTS & FUNNELS */}
            {activeCategory === 'charts' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">Charts & Data Visualizations</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dependency-free SVG Donut Chart, ranked horizontal BarList, and Outbound Funnel.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SectionCard title="Interactive Donut Chart">
                    <DonutChart
                      data={mockDonutDistribution}
                      centerLabel="Total Leads"
                      centerValue="1,248"
                      onSegmentClick={(seg) => alert(`Segment clicked: ${seg.label}`)}
                    />
                  </SectionCard>

                  <SectionCard title="Ranked Progress BarList">
                    <BarList
                      items={mockPipelineStages.map((s) => ({
                        key: s.key,
                        label: s.label,
                        value: s.value,
                        color: s.color,
                      }))}
                      showPercentOfMax
                      onItemClick={(item) => alert(`Stage clicked: ${item.label}`)}
                    />
                  </SectionCard>
                </div>

                <SectionCard title="Conversion Funnel">
                  <ConversionFunnel
                    stages={[
                      { label: '1. Total Target Accounts', value: 1248, color: 'hsl(var(--chart-6))' },
                      { label: '2. Cold Sequence Touch', value: 836, color: 'hsl(var(--chart-3))' },
                      { label: '3. Technical Assay In Review', value: 240, color: 'hsl(var(--chart-2))' },
                      { label: '4. Commercial Discussions', value: 94, color: 'hsl(var(--chart-1))' },
                      { label: '5. Contracted Supplier', value: 47, color: 'hsl(var(--chart-4))' },
                    ]}
                  />
                </SectionCard>
              </div>
            )}

            {/* 5. TABLES */}
            {activeCategory === 'tables' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">Enterprise Data Table</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Full enterprise table with multi-select checkboxes, column sorting, search, filter chips, and pagination.
                  </p>
                </div>

                <DataTable
                  columns={[
                    {
                      key: 'company',
                      label: 'Account & Contact',
                      render: (_, row) => (
                        <div>
                          <span className="font-semibold text-foreground block">{row.company}</span>
                          <span className="text-xs text-muted-foreground">{row.contactPerson}</span>
                        </div>
                      ),
                    },
                    { key: 'product', label: 'Product Focus' },
                    { key: 'temperature', label: 'Warmth' },
                    { key: 'status', label: 'Status' },
                    {
                      key: 'dealValue',
                      label: 'Value',
                      cellClassName: 'text-right font-semibold',
                      render: (v) => `$${Number(v).toLocaleString()}`,
                    },
                  ]}
                  data={mockLeads}
                  onRowClick={(row) => alert(`Row clicked: ${row.company}`)}
                />
              </div>
            )}

            {/* 6. FORMS & INPUTS */}
            {activeCategory === 'forms' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">Forms & Form Controls</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Clean inputs, GlowInput with icon slots, Textarea, custom Select, and Checkbox.
                  </p>
                </div>

                <SectionCard title="Form Controls Showcase" className="max-w-2xl">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="field-label">Standard Input</label>
                      <Input placeholder="Enter company name..." />
                    </div>

                    <div className="space-y-1.5">
                      <label className="field-label">Glow Input with Icon Slot</label>
                      <GlowInput icon={Users} placeholder="Search prospects or phone..." />
                    </div>

                    <div className="space-y-1.5">
                      <label className="field-label">Textarea Field</label>
                      <Textarea placeholder="Enter outbound call notes or meeting recap..." rows={3} />
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox id="demo-check" />
                      <label htmlFor="demo-check" className="text-xs font-medium text-foreground cursor-pointer">
                        Enable automatic AI follow-up sequence
                      </label>
                    </div>
                  </div>
                </SectionCard>
              </div>
            )}

            {/* 7. MODALS & DRAWERS */}
            {activeCategory === 'modals' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">Modals, Dialogs & Drawers</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Accessible modals, side-sheet drawers, and alert confirmation dialogs.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setSampleModalOpen(true)}>Open Modal Dialog</Button>
                  <Button variant="outline" onClick={() => setSampleDrawerOpen(true)}>Open Side Drawer</Button>
                </div>

                {sampleModalOpen && (
                  <ModalFrame title="Sample Modal Frame" onClose={() => setSampleModalOpen(false)}>
                    <div className="p-6 space-y-4">
                      <div className="border-b border-border pb-3">
                        <h3 className="text-base font-bold text-foreground">Enterprise Modal Dialog</h3>
                        <p className="text-xs text-muted-foreground">Built on accessible Radix primitives with MineTech styling.</p>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        This modal adapts to responsive screen sizes, locks scroll on background canvas, supports keyboard escape, and traps focus.
                      </p>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setSampleModalOpen(false)}>Cancel</Button>
                        <Button size="sm" onClick={() => setSampleModalOpen(false)}>Save Changes</Button>
                      </div>
                    </div>
                  </ModalFrame>
                )}

                {sampleDrawerOpen && (
                  <ModalFrame title="Sample Drawer" drawer onClose={() => setSampleDrawerOpen(false)}>
                    <div className="p-6 space-y-4">
                      <div className="border-b border-border pb-3">
                        <h3 className="text-base font-bold text-foreground">Slide-Out Prospect Drawer</h3>
                        <p className="text-xs text-muted-foreground">Used for detailed lead overview and activity timeline.</p>
                      </div>
                      <div className="space-y-3">
                        <StatusBadge status="approved_supplier" />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Drawers slide out from the right edge with a smooth 200ms ease curve and custom edge shadows.
                        </p>
                      </div>
                      <Button className="w-full mt-4" onClick={() => setSampleDrawerOpen(false)}>Close Drawer</Button>
                    </div>
                  </ModalFrame>
                )}
              </div>
            )}

            {/* 8. BADGES & FEEDBACK */}
            {activeCategory === 'feedback' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">Badges, Status & Feedback</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Status badges with pulsing ping dots, lead temperature badges, skeletons, and empty states.
                  </p>
                </div>

                <SectionCard title="Status Badges (Pulsing & Static)">
                  <div className="flex flex-wrap gap-2.5">
                    <StatusBadge status="active" />
                    <StatusBadge status="ringing" pulse />
                    <StatusBadge status="commercial_discussion" />
                    <StatusBadge status="approved_supplier" />
                    <StatusBadge status="trial_order" />
                    <StatusBadge status="on_hold" />
                    <StatusBadge status="lost" />
                  </div>
                </SectionCard>

                <SectionCard title="Lead Warmth Badges">
                  <div className="flex flex-wrap gap-2.5">
                    <TemperatureBadge temperature="HOT" score={98} showScore />
                    <TemperatureBadge temperature="WARM" score={74} showScore />
                    <TemperatureBadge temperature="COLD" score={42} showScore />
                  </div>
                </SectionCard>

                <SectionCard title="Loading Skeletons">
                  <LoadingState rows={3} />
                </SectionCard>

                <SectionCard title="Empty State Container">
                  <EmptyState
                    title="No Unread Inbound Messages"
                    description="You are all caught up! New responses from cold sequences will appear here."
                    action={<Button size="sm">Refresh Inbox</Button>}
                  />
                </SectionCard>
              </div>
            )}

            {/* 9. KANBAN */}
            {activeCategory === 'kanban' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">Kanban Deal Pipeline</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Drag and drop cards across pipeline stages with overdue notices and stage volume counters.
                  </p>
                </div>

                <div className="panel p-3">
                  <KanbanBoard items={mockLeads} />
                </div>
              </div>
            )}

            {/* 10. DIALER */}
            {activeCategory === 'dialer' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">AI Voice & Phone Dialer</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    DTMF keypad, call duration timer, disposition hotkeys, and note taking controls.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                  <DialerPad initialNumber="+1 (415) 890-2134" contactName="Marcus Vance" contactCompany="Apex Industrial Materials" />
                  <CallControls onSaveDisposition={(d) => alert(`Saved disposition: ${d.disposition}`)} />
                </div>
              </div>
            )}

            {/* 11. AI INTELLIGENCE */}
            {activeCategory === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">AI Intelligence Components</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Action recommendations, prompt feedback bars, fit scores, and objection handling tiles.
                  </p>
                </div>

                <div className="max-w-2xl space-y-4">
                  <AiInsightCard onApplyAction={() => alert('Action applied to composer!')} />
                  <AiDraftBar onInsert={() => alert('Inserted AI draft into composer!')} />
                </div>
              </div>
            )}

            {/* TEMPLATES */}
            {activeCategory === 'tmpl-crm' && <CRMDashboard />}
            {activeCategory === 'tmpl-analytics' && <AnalyticsDashboard />}
            {activeCategory === 'tmpl-dialer' && <AIDialerDashboard />}
            {activeCategory === 'tmpl-admin' && <AdminPanel />}
            {activeCategory === 'tmpl-saas' && <SaaSDashboard />}

            {/* LAYOUTS */}
            {activeCategory === 'layout-auth' && (
              <div className="border border-border rounded-2xl overflow-hidden">
                <AuthLayout>
                  <form onSubmit={(e) => { e.preventDefault(); alert('Demo login submitted'); }} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="field-label">Work Email</label>
                      <Input type="email" placeholder="you@company.com" required defaultValue="sarah@minetechresources.com" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="field-label">Password</label>
                      <Input type="password" placeholder="••••••••" required defaultValue="password123" />
                    </div>
                    <Button type="submit" className="w-full">Sign in to Workstation</Button>
                  </form>
                </AuthLayout>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default GalleryApp;
