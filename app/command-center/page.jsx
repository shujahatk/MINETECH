'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionCard } from '@/components/ui/section-card';
import { useVisibleInterval } from '@/lib/hooks/useVisibleInterval';

function ServiceCard({ icon: Icon, title, subtitle, badge, rows }) {
  return (
    <SectionCard
      className="panel-interactive"
      bodyClassName="space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="tone-brand flex h-9 w-9 items-center justify-center rounded-lg border">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          </div>
        </div>
        {badge}
      </div>
      <dl className="space-y-1.5 border-t border-border pt-3 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

export default function CommandCenterPage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/system/health');
      if (res.ok) {
        const json = await res.json();
        setHealthData(json);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // Refresh only while the tab is visible (was an unconditional 10s poll).
  useVisibleInterval(fetchHealth, 30000);

  const getStatusBadge = (status, connected) => {
    if (connected || status === 'operational') {
      return (
        <span className="tone-success inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
          <CheckCircle2 className="h-3 w-3" /> Operational
        </span>
      );
    }
    if (status === 'standby' || status === 'standby_fallback') {
      return (
        <span className="tone-warning inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
          <AlertTriangle className="h-3 w-3" /> Standby
        </span>
      );
    }
    return (
      <span className="tone-neutral inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
        <XCircle className="h-3 w-3" /> Inactive
      </span>
    );
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <PageHeader icon={Activity} title="Command center" description="Infrastructure health, provider connectivity and platform safeguards." className="mb-0" />
        <LoadingState cards rows={3} label="Loading telemetry" />
      </div>
    );
  }

  const s = healthData?.services || {};

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        icon={Activity}
        title="Command center"
        description="Infrastructure health, provider connectivity and platform safeguards."
        className="mb-0"
        actions={
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          icon={Database}
          title="Database"
          subtitle="PostgreSQL / Supabase"
          badge={getStatusBadge(s.database?.status, s.database?.connected)}
          rows={[
            ['Database', s.database?.database || 'Postgres (Supabase)'],
            ['Latency', s.database?.latencyMs != null ? `${s.database.latencyMs} ms` : '—'],
          ]}
        />

        <ServiceCard
          icon={Mail}
          title="Email gateway"
          subtitle="Outbound and sequences"
          badge={getStatusBadge(s.resend?.status, s.resend?.connected)}
          rows={[['Provider', s.resend?.name || 'Resend']]}
        />

        <ServiceCard
          icon={Zap}
          title="AI engine"
          subtitle="Claude"
          badge={getStatusBadge(s.claude?.status, s.claude?.connected)}
          rows={[['Model', s.claude?.model || '—']]}
        />
      </div>

      <SectionCard
        title="Platform safeguards"
        description="Built-in protections, shown here for reference. These are configuration facts, not live readings."
        icon={ShieldCheck}
        flush
      >
        <div className="grid grid-cols-1 divide-y divide-border/70 md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            [ShieldCheck, 'Login rate limiting', '5 attempts per 15 minutes'],
            [Activity, 'Lead locking', 'Locks auto-release after 5 minutes'],
            [Database, 'Phone numbers', 'Normalized to E.164 for de-duplication'],
          ].map(([Icon, label, detail]) => (
            <div key={label} className="flex items-start gap-3 px-4 py-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-[13px] font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
