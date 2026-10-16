'use client';

import React, { useState } from 'react';
import {
  Shield,
  Activity,
  Database,
  Mail,
  Zap,
  Key,
  Users,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Save,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/cards/SectionCard';
import { Button } from '../../components/buttons/Button';
import { Input } from '../../components/forms/Input';
import { StatusBadge } from '../../components/feedback/StatusBadge';
import { Badge } from '../../components/feedback/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/tables/Table';
import { mockSystemTelemetry } from '../../utils/mockData';

export function AdminPanel({ className = '' }) {
  const [dailyLimit, setDailyLimit] = useState(2500);
  const [senderEmail, setSenderEmail] = useState('outreach@minetechresources.com');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const users = [
    { id: 'usr-1', name: 'Sarah Jenkins', email: 's.jenkins@minetech.com', role: 'Sales Lead', status: 'active', lastActive: '10 mins ago' },
    { id: 'usr-2', name: 'David Zhao', email: 'd.zhao@minetech.com', role: 'Account Executive', status: 'active', lastActive: '1 hour ago' },
    { id: 'usr-3', name: 'Marcus Miller', email: 'm.miller@minetech.com', role: 'SDR Outbound', status: 'standby', lastActive: 'Yesterday' },
    { id: 'usr-4', name: 'System Automation', email: 'ai-bot@minetech.internal', role: 'Service Account', status: 'active', lastActive: 'Continuous' },
  ];

  const handleSave = (e) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const s = mockSystemTelemetry;

  return (
    <div className={`space-y-5 ${className}`}>
      <PageHeader
        icon={Shield}
        title="Admin & System Governance"
        description="Platform safeguards, cloud infrastructure telemetry, and team account administration."
        meta="Environment: Production Ready"
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Health Check</span>
          </Button>
        }
      />

      {/* Cloud Infrastructure Telemetry Row */}
      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* PostgreSQL Database */}
        <SectionCard className="panel-interactive" bodyClassName="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="tone-brand flex h-9 w-9 items-center justify-center rounded-lg border">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">Database Cluster</h3>
                <span className="text-xs text-muted-foreground">{s.database.provider}</span>
              </div>
            </div>
            <StatusBadge status="operational" />
          </div>
          <dl className="space-y-1.5 border-t border-border pt-3 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <dt>Query Latency</dt>
              <dd className="font-mono font-medium text-foreground">{s.database.latencyMs} ms</dd>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <dt>Active Connections</dt>
              <dd className="font-mono font-medium text-foreground">{s.database.activeConnections} / {s.database.poolSize}</dd>
            </div>
          </dl>
        </SectionCard>

        {/* Email Gateway */}
        <SectionCard className="panel-interactive" bodyClassName="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="tone-brand flex h-9 w-9 items-center justify-center rounded-lg border">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">Email Gateway</h3>
                <span className="text-xs text-muted-foreground">{s.emailGateway.provider}</span>
              </div>
            </div>
            <StatusBadge status="operational" />
          </div>
          <dl className="space-y-1.5 border-t border-border pt-3 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <dt>Reputation Score</dt>
              <dd className="font-mono font-medium text-foreground">{s.emailGateway.reputationScore}</dd>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <dt>Daily Dispatched</dt>
              <dd className="font-mono font-medium text-foreground">{s.emailGateway.dailyDispatched.toLocaleString()} / {s.emailGateway.dailyQuota.toLocaleString()}</dd>
            </div>
          </dl>
        </SectionCard>

        {/* MINE-TECH AI Engine */}
        <SectionCard className="panel-interactive" bodyClassName="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="tone-brand flex h-9 w-9 items-center justify-center rounded-lg border">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">AI Intelligence</h3>
                <span className="text-xs text-muted-foreground">{s.aiEngine.provider}</span>
              </div>
            </div>
            <StatusBadge status="operational" />
          </div>
          <dl className="space-y-1.5 border-t border-border pt-3 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <dt>Inference Latency</dt>
              <dd className="font-mono font-medium text-foreground">{s.aiEngine.avgResponseMs} ms</dd>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <dt>Cache Hit Ratio</dt>
              <dd className="font-mono font-medium text-foreground">{s.aiEngine.cacheHitRatio}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      {/* Middle Row: User Management Table */}
      <SectionCard
        title="Team Members & Role Access"
        description="Authorized users with access to the outbound workstation"
        icon={Users}
        flush
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <span className="font-semibold text-foreground block">{u.name}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{u.role}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={u.status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{u.lastActive}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    Configure
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {/* Lower Row: Platform Configuration Form */}
      <SectionCard
        title="Workstation Sending Configuration"
        description="Adjust daily outbound throttling, default reply-to, and sender addresses"
        icon={Settings}
      >
        <form onSubmit={handleSave} className="space-y-4 max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="field-label">Central Sending Address</label>
              <Input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="field-label">Max Daily Email Cap</label>
              <Input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" className="gap-2 cursor-pointer">
              <Save className="h-4 w-4" />
              <span>Save Configuration</span>
            </Button>
            {savedSuccess && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 anim-fade-in">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Configuration persisted successfully</span>
              </span>
            )}
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

export default AdminPanel;
