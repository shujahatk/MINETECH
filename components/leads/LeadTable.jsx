'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  GitFork,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  SearchX,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import LeadRow from '@/components/leads/LeadRow';
import { EMPTY_FILTERS, useLeadFilterOptions, useLeads } from '@/components/leads/useLeads';
import { localDateString, rowPatchFromDetail, STATUS_OPTIONS, statusLabel } from '@/lib/leads/format';

// Heavy, rarely-needed pieces are code-split so the table renders immediately.
const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer'), { ssr: false });
const LeadImportModal = dynamic(() => import('@/components/leads/LeadImportModal'), { ssr: false });
const LeadCreateModal = dynamic(() => import('@/components/leads/LeadCreateModal'), { ssr: false });
const PipelineKanban = dynamic(() => import('@/components/leads/PipelineKanban'), {
  ssr: false,
  loading: () => <BoardSkeleton />,
});

const PRODUCT_OPTIONS = [
  'Bentonite',
  'Bleaching Earth',
  'Kaolin',
  'Ball Clay',
  'Fire Clay',
  'Zeolite',
  'Bauxite',
  'Calcium Carbonate',
  'Other',
];

const TEMPERATURE_TABS = [
  { id: '', label: 'All', dot: null },
  { id: 'HOT', label: 'Hot', dot: 'bg-rose-500' },
  { id: 'WARM', label: 'Warm', dot: 'bg-amber-500' },
  { id: 'COLD', label: 'Cold', dot: 'bg-sky-500' },
];

const FOLLOW_UP_OPTIONS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Due today' },
  { id: 'week', label: 'Due this week' },
  { id: 'none', label: 'No next action date' },
];

const AI_OPTIONS = [
  { id: 'studied', label: 'AI studied' },
  { id: 'highfit', label: 'High fit' },
  { id: 'outdated', label: 'Outdated study' },
  { id: 'unstudied', label: 'Needs study' },
];

const PAGE_SIZES = [25, 50, 100];
const BOARD_LIMIT = 100;
const FILTER_KEYS = ['temperature', 'status', 'owner', 'campaign', 'followUp', 'product', 'ai'];

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                         */
/* ------------------------------------------------------------------ */

function FilterSelect({ label, value, onChange, children }) {
  const active = Boolean(value);
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 max-w-[11rem] cursor-pointer appearance-none rounded-lg border bg-card pl-2.5 pr-7 text-xs font-medium outline-none transition-colors hover:border-muted-foreground/40 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15 ${
          active
            ? 'border-primary/40 bg-primary/5 text-foreground'
            : 'border-border text-muted-foreground hover:text-foreground'
        }`}
      >
        {children}
      </select>
      <ChevronRight
        aria-hidden="true"
        className={`pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 rotate-90 ${active ? 'text-primary' : 'text-muted-foreground'}`}
      />
    </label>
  );
}

function SortHeader({ label, column, sort, onSort, className = '' }) {
  const active = sort.by === column;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`sticky top-0 z-10 h-9 border-b border-border bg-card px-3 text-left ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
          active ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-40'}`} aria-hidden="true" />
      </button>
    </th>
  );
}

function PlainHeader({ children, className = '' }) {
  return (
    <th
      scope="col"
      className={`sticky top-0 z-10 h-9 border-b border-border bg-card px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function SkeletonRows({ count = 10 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} className="border-b border-border/60" aria-hidden="true">
      <td className="w-10 px-3 py-2 text-center">
        <div className="mx-auto h-4 w-4 skeleton rounded bg-muted" />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2.5">
          <div className="skeleton h-7 w-7 rounded-full bg-muted" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 skeleton rounded bg-muted" />
            <div className="h-2.5 w-20 skeleton rounded bg-muted/70" />
          </div>
        </div>
      </td>
      <td className="px-3 py-2"><div className="h-3 w-28 skeleton rounded bg-muted" /></td>
      <td className="hidden px-3 py-2 md:table-cell"><div className="h-3 w-40 skeleton rounded bg-muted" /></td>
      <td className="px-3 py-2"><div className="h-5 w-20 skeleton rounded-md bg-muted" /></td>
      <td className="px-3 py-2"><div className="h-5 w-14 skeleton rounded-md bg-muted" /></td>
      <td className="hidden px-3 py-2 xl:table-cell"><div className="h-3 w-20 skeleton rounded bg-muted" /></td>
      <td className="hidden px-3 py-2 lg:table-cell"><div className="h-3 w-14 skeleton rounded bg-muted" /></td>
      <td className="hidden px-3 py-2 lg:table-cell"><div className="h-3 w-24 skeleton rounded bg-muted" /></td>
      <td className="w-8" />
    </tr>
  ));
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden pb-4 pt-1" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="min-w-[290px] flex-1 space-y-3 rounded-xl border border-border bg-muted/20 p-3">
          <div className="h-4 w-32 skeleton rounded bg-muted" />
          {Array.from({ length: 3 }).map((__, j) => (
            <div key={j} className="h-24 skeleton rounded-lg bg-muted/60" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export default function LeadTable({ initialView = 'table', sectionTitle = null, sectionDescription = null }) {
  const [ready, setReady] = useState(false); // URL params parsed -> safe to fetch (avoids a duplicate first request)
  const [viewMode, setViewMode] = useState(initialView);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState({ by: 'createdAt', dir: 'desc' });

  const [selected, setSelected] = useState(() => new Set());
  const [active, setActive] = useState(null); // { id, initial }
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(''); // '' | 'delete' | 'status' | 'analyze'

  const isBoard = viewMode === 'pipeline';
  const limit = isBoard ? BOARD_LIMIT : pageSize;
  const today = useMemo(() => localDateString(), []);

  const options = useLeadFilterOptions();

  /* ---- hydrate state from the URL once (client only) ---- */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get('view');
    if (v === 'table') setViewMode('table');
    else if (v === 'pipeline' || v === 'board') setViewMode('pipeline');

    const next = { ...EMPTY_FILTERS };
    FILTER_KEYS.forEach((k) => {
      const val = sp.get(k);
      if (val && val !== 'ALL') next[k] = val;
    });
    const q = sp.get('q') || sp.get('search') || '';
    next.search = q.trim();
    setFilters(next);
    setSearchInput(q.trim());
    const p = parseInt(sp.get('page') || '1', 10);
    if (p > 1) setPage(p);
    setReady(true);
  }, []);

  /* ---- keep the URL shareable without triggering navigation ---- */
  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams();
    if (viewMode !== initialView) p.set('view', viewMode);
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p.set(k === 'search' ? 'q' : k, v);
    });
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [ready, viewMode, initialView, filters, page]);

  /* ---- debounced search: one request ~300ms after typing stops ---- */
  useEffect(() => {
    if (!ready) return undefined;
    const term = searchInput.trim();
    if (term === filters.search) return undefined;
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: term }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, ready, filters.search]);

  const { leads, total, pagination, loading, refreshing, error, refetch, patchLead, removeLeads } = useLeads({
    enabled: ready,
    view: isBoard ? 'board' : 'table',
    filters,
    page,
    limit,
    sortBy: sort.by,
    sortDir: sort.dir,
  });

  // Server clamped an out-of-range page (e.g. after deleting the last row of a page)
  useEffect(() => {
    if (pagination?.page && pagination.page !== page && pagination.pageReset) setPage(pagination.page);
  }, [pagination, page]);

  // Selection belongs to the current result set
  useEffect(() => {
    setSelected(new Set());
  }, [filters, page, limit, viewMode, sort]);

  /* ---- handlers ---- */
  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSearchInput('');
    setPage(1);
  }, []);

  const toggleSort = useCallback((by) => {
    setSort((prev) =>
      prev.by === by
        ? { by, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { by, dir: by === 'score' || by === 'createdAt' ? 'desc' : 'asc' }
    );
    setPage(1);
  }, []);

  const toggleOne = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openLead = useCallback((lead) => setActive({ id: lead.id, initial: lead }), []);
  const openLeadById = useCallback(
    (id) => setActive({ id, initial: leads.find((l) => l.id === id || l._id === id) || null }),
    [leads]
  );

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));

  const activeFilterCount = FILTER_KEYS.filter((k) => filters[k]).length + (filters.search ? 1 : 0);
  const hasFilters = activeFilterCount > 0;

  const handleUpdated = useCallback(
    (updated) => {
      const id = updated?.id || updated?._id;
      if (!id) {
        refetch();
        return;
      }
      const patch = rowPatchFromDetail(updated);
      const row = leads.find((l) => l.id === id);
      if (row && !row.ownerId) patch.ownerName = (updated.customFields || {}).assigned_salesperson || row.ownerName || '';
      patchLead(id, patch);
    },
    [leads, patchLead, refetch]
  );

  const handleBulkDelete = async () => {
    const ids = [...selected];
    setBusy('delete');
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', leadIds: ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || 'Delete failed');
      removeLeads(ids);
      setSelected(new Set());
      toast.success(`Deleted ${json.affected ?? ids.length} lead${ids.length === 1 ? '' : 's'}`);
      if (leads.length === ids.length) {
        // The whole page is gone: step back a page, or reload page 1 (other pages may still have rows)
        if (page > 1) setPage(page - 1);
        else refetch();
      }
    } catch (err) {
      toast.error(err.message || 'Could not delete leads');
    } finally {
      setBusy('');
      setConfirmDelete(false);
    }
  };

  const handleBulkStatus = async (status) => {
    if (!status) return;
    const ids = [...selected];
    setBusy('status');
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', leadIds: ids, status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || 'Update failed');
      patchLead(ids, { status });
      setSelected(new Set());
      toast.success(`Moved ${json.affected ?? ids.length} lead${ids.length === 1 ? '' : 's'} to ${statusLabel(status)}`);
    } catch (err) {
      toast.error(err.message || 'Could not update leads');
    } finally {
      setBusy('');
    }
  };

  const handleBulkAnalyze = async () => {
    setBusy('analyze');
    try {
      const res = await fetch('/api/leads/analyze-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [...selected], priorityFilter: null, force: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || json.error || 'Analysis failed');
      toast.success(`Analyzed ${json.data?.analyzed || 0} leads (${json.data?.skipped || 0} cached)`);
      if (filters.ai) refetch();
    } catch (err) {
      toast.error(err.message || 'Could not analyze leads');
    } finally {
      setBusy('');
    }
  };

  /* ---- derived view data ---- */
  const totalPages = Math.max(1, pagination?.totalPages || 1);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, (page - 1) * limit + leads.length);
  const title = sectionTitle || (isBoard ? 'Pipeline' : 'Leads');
  const description =
    sectionDescription ||
    (isBoard ? 'Drag opportunities between stages.' : 'Search, filter and work every lead in one place.');
  const showSkeleton = loading && leads.length === 0;
  const showEmpty = !loading && !error && leads.length === 0;

  /* ---- shared pieces (plain JSX, no extra hooks) ---- */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 p-2.5">
      <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          inputMode="search"
          autoComplete="off"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setFilters((f) => ({ ...f, search: searchInput.trim() }));
              setPage(1);
            }
          }}
          placeholder="Search name, email or company"
          aria-label="Search leads"
          className="h-8 pl-8 pr-8 text-xs"
        />
        {searchInput && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setSearchInput('');
              setFilters((f) => ({ ...f, search: '' }));
              setPage(1);
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5" role="group" aria-label="Priority">
        {TEMPERATURE_TABS.map((t) => {
          const on = filters.temperature === t.id;
          return (
            <button
              key={t.id || 'all'}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter('temperature', t.id)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                on ? 'bg-card text-foreground shadow-subtle ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />}
              {t.label}
            </button>
          );
        })}
      </div>

      <span className="mx-0.5 hidden h-5 w-px bg-border lg:block" aria-hidden="true" />

      <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)}>
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect label="Owner" value={filters.owner} onChange={(v) => setFilter('owner', v)}>
        <option value="">All owners</option>
        {options.owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect label="Campaign" value={filters.campaign} onChange={(v) => setFilter('campaign', v)}>
        <option value="">All campaigns</option>
        {options.campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect label="Follow-up" value={filters.followUp} onChange={(v) => setFilter('followUp', v)}>
        <option value="">Any follow-up</option>
        {FOLLOW_UP_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect label="Product" value={filters.product} onChange={(v) => setFilter('product', v)}>
        <option value="">All products</option>
        {PRODUCT_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect label="AI study" value={filters.ai} onChange={(v) => setFilter('ai', v)}>
        <option value="">Any AI status</option>
        {AI_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </FilterSelect>

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          Clear
          <span className="rounded bg-primary/10 px-1 text-[10px] font-semibold tabular-nums text-primary">{activeFilterCount}</span>
        </button>
      )}
    </div>
  );

  const bulkBar =
    selected.size > 0 ? (
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 bg-primary/5 px-3 py-1.5"
        role="region"
        aria-label="Bulk actions"
      >
        <span className="text-xs font-medium tabular-nums text-foreground">
          {selected.size} selected
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Move to stage" value="" onChange={handleBulkStatus}>
            <option value="">Move to stage…</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </FilterSelect>
          <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={handleBulkAnalyze} className="h-8 gap-1.5">
            {busy === 'analyze' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Analyze with Claude
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(busy)}
            onClick={() => setConfirmDelete(true)}
            className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="h-8">
            Clear
          </Button>
        </div>
      </div>
    ) : null;

  const paginationBar = !showEmpty ? (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground ${
        isBoard ? '' : 'border-t border-border bg-muted/20 px-3 py-2'
      }`}
    >
      <span className="tabular-nums">
        {showSkeleton ? (
          <span className="skeleton inline-block h-3 w-40 rounded align-middle" aria-label="Loading" />
        ) : (
          <>
            Showing <span className="font-medium text-foreground">{from.toLocaleString()}–{to.toLocaleString()}</span> of{' '}
            <span className="font-medium text-foreground">{total.toLocaleString()}</span>
          </>
        )}
      </span>
      <div className="flex items-center gap-3">
        {!isBoard && (
          <label className="flex items-center gap-1.5">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-7 cursor-pointer rounded-md border border-border bg-card px-1.5 text-xs text-foreground outline-none transition-colors hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-primary/15"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[5.5rem] text-center tabular-nums">
            Page <span className="font-medium text-foreground">{page}</span> of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const emptyAction = hasFilters ? (
    <Button size="sm" variant="outline" onClick={clearFilters}>
      Clear filters
    </Button>
  ) : (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)}>
        Import CSV
      </Button>
      <Button size="sm" onClick={() => setIsCreateOpen(true)}>
        New lead
      </Button>
    </div>
  );

  return (
    <div className="space-y-3">
      <PageHeader
        icon={isBoard ? GitFork : Users}
        title={title}
        meta={ready && !showSkeleton ? total.toLocaleString() : '—'}
        description={description}
        className="mb-0"
        actions={
          <>
            <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5" role="group" aria-label="View">
              {[
                { id: 'table', label: 'Table', Icon: List },
                { id: 'pipeline', label: 'Board', Icon: LayoutGrid },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={viewMode === id}
                  onClick={() => {
                    setViewMode(id);
                    setPage(1);
                  }}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    viewMode === id ? 'bg-card text-foreground shadow-subtle ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="h-8 gap-1.5">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Import
            </Button>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New lead
            </Button>
          </>
        }
      />

      {error && leads.length === 0 && <ErrorState message={error} onRetry={refetch} />}
      {error && leads.length > 0 && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <span>Showing the last loaded results — the latest refresh failed.</span>
          <button type="button" onClick={refetch} className="font-semibold underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {isBoard ? (
        <>
          <div className="rounded-xl border border-border bg-card shadow-card">{toolbar}</div>
          {bulkBar}
          {showSkeleton ? (
            <BoardSkeleton />
          ) : showEmpty ? (
            <div className="rounded-xl border border-border bg-card">
              <EmptyState
                icon={hasFilters ? SearchX : Users}
                title={hasFilters ? 'No opportunities match your filters' : 'No opportunities yet'}
                description={hasFilters ? 'Try removing a filter or searching for something else.' : 'Import a CSV or add your first lead.'}
                action={hasFilters ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : null}
              />
            </div>
          ) : (
            <div className={refreshing ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
              <PipelineKanban
                leads={leads}
                onSelectLead={openLeadById}
                onUpdateStage={(id, newStage) => patchLead(id, { status: newStage })}
              />
            </div>
          )}
          {paginationBar}
        </>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {toolbar}
          {bulkBar}
          <div className={`w-full ${refreshing ? 'h-0.5 animate-pulse bg-primary/60' : 'h-px bg-border'}`} aria-hidden="true" />
          <div className="max-h-[calc(100vh-15.5rem)] min-h-[320px] overflow-auto">
            <table className="w-full border-separate border-spacing-0" aria-busy={loading || refreshing}>
              <thead>
                <tr>
                  <th scope="col" className="sticky top-0 z-10 h-9 w-10 border-b border-border bg-card px-3 text-center">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAll}
                      disabled={leads.length === 0}
                      aria-label="Select all leads on this page"
                    />
                  </th>
                  <SortHeader label="Lead" column="name" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Company" column="company" sort={sort} onSort={toggleSort} />
                  <PlainHeader className="hidden md:table-cell">Email</PlainHeader>
                  <SortHeader label="Status" column="status" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Priority" column="score" sort={sort} onSort={toggleSort} />
                  <PlainHeader className="hidden xl:table-cell">Owner</PlainHeader>
                  <PlainHeader className="hidden lg:table-cell">Last contact</PlainHeader>
                  <PlainHeader className="hidden lg:table-cell">Next action</PlainHeader>
                  <th scope="col" className="sticky top-0 z-10 h-9 w-8 border-b border-border bg-card" aria-hidden="true" />
                </tr>
              </thead>
              <tbody className={refreshing ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
                {showSkeleton ? (
                  <SkeletonRows count={Math.min(limit, 10)} />
                ) : (
                  leads.map((lead) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      selected={selected.has(lead.id)}
                      isActive={active?.id === lead.id}
                      today={today}
                      onToggle={toggleOne}
                      onOpen={openLead}
                    />
                  ))
                )}
              </tbody>
            </table>

            {showEmpty && (
              <EmptyState
                icon={hasFilters ? SearchX : Users}
                title={hasFilters ? 'No leads match your filters' : 'No leads yet'}
                description={
                  hasFilters
                    ? 'Try removing a filter or searching for something else.'
                    : 'Import a CSV or add your first lead to get started.'
                }
                action={emptyAction}
              />
            )}
          </div>
          {paginationBar}
        </div>
      )}

      {/* Drawer + modals (code-split; mounted only when used) */}
      {active && (
        <LeadDrawer
          leadId={active.id}
          initialLead={active.initial}
          onClose={() => setActive(null)}
          onUpdated={handleUpdated}
        />
      )}
      {isImportOpen && (
        <LeadImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImported={() => {
            setPage(1);
            refetch();
          }}
          onSuccess={() => {
            setPage(1);
            refetch();
          }}
        />
      )}
      {isCreateOpen && (
        <LeadCreateModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setPage(1);
            refetch();
          }}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !busy && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} lead{selected.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected leads together with their email history and campaign records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'delete'}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === 'delete'}
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy === 'delete' ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
