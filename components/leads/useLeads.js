'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Data layer for the Leads page.
 *  - one request per distinct query (aborts the previous in-flight request)
 *  - small stale-while-revalidate cache: revisiting a filter/page shows data instantly
 *  - local patch / remove so edits never trigger a full refetch
 */

const FRESH_MS = 20_000; // within this window a cached page is shown without hitting the network
const MAX_CACHE_ENTRIES = 40;
const leadsCache = new Map(); // queryString -> { data, at }

function cacheSet(key, data, at = Date.now()) {
  if (leadsCache.size >= MAX_CACHE_ENTRIES) {
    leadsCache.delete(leadsCache.keys().next().value);
  }
  leadsCache.set(key, { data, at });
}

export function invalidateLeadsCache() {
  leadsCache.clear();
}

export const EMPTY_FILTERS = {
  search: '',
  temperature: '',
  status: '',
  owner: '',
  campaign: '',
  followUp: '',
  product: '',
  ai: '',
};

function toLocalDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildLeadsQuery({ view, filters, page, limit, sortBy, sortDir }) {
  const p = new URLSearchParams();
  p.set('page', String(page));
  p.set('limit', String(limit));
  p.set('sortBy', sortBy);
  p.set('sortDir', sortDir);
  if (view === 'board') p.set('view', 'board');
  Object.entries(filters).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  if (filters.followUp) p.set('today', toLocalDateString()); // follow-up buckets use the user's local day
  return p.toString();
}

export function useLeads({ enabled = true, view, filters, page, limit, sortBy, sortDir }) {
  const query = useMemo(
    () => buildLeadsQuery({ view, filters, page, limit, sortBy, sortDir }),
    [view, filters, page, limit, sortBy, sortDir]
  );

  const [data, setData] = useState({ leads: [], total: 0, pagination: { page: 1, totalPages: 1, total: 0, limit } });
  const [loading, setLoading] = useState(true); // no data to show yet -> skeleton
  const [refreshing, setRefreshing] = useState(false); // data visible, revalidating in background
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);

  const dataRef = useRef(data);
  const queryRef = useRef(query);
  const forceRef = useRef(false);
  queryRef.current = query;

  const commit = useCallback((next) => {
    dataRef.current = next;
    setData(next);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const cached = leadsCache.get(query);
    const force = forceRef.current;
    forceRef.current = false;

    if (cached && !force) {
      commit(cached.data);
      setLoading(false);
      setError('');
      if (Date.now() - cached.at < FRESH_MS) {
        setRefreshing(false);
        return undefined;
      }
      setRefreshing(true);
    } else if (dataRef.current.leads.length > 0 || force) {
      // keep the previous rows on screen while the new page loads
      setRefreshing(true);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/leads?${query}`, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = await res.json();
        if (json.success === false) throw new Error(json.message || 'Request failed');
        const next = {
          leads: json.leads || [],
          total: json.total ?? json.pagination?.total ?? 0,
          pagination: json.pagination || { page, totalPages: 1, total: 0, limit },
        };
        cacheSet(query, next);
        commit(next);
        setError('');
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Error fetching leads:', err);
        setError('Could not load leads.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, nonce, enabled]);

  /** Force a network refresh of the current page. */
  const refetch = useCallback(() => {
    leadsCache.clear();
    forceRef.current = true;
    setNonce((n) => n + 1);
  }, []);

  /** Update one or many leads in place (no network). Other cached pages are dropped since membership may change. */
  const patchLead = useCallback(
    (idOrIds, patch) => {
      const ids = new Set([].concat(idOrIds));
      const cur = dataRef.current;
      const next = {
        ...cur,
        leads: cur.leads.map((l) => (ids.has(l.id) || ids.has(l._id) ? { ...l, ...patch } : l)),
      };
      commit(next);
      leadsCache.clear();
      cacheSet(queryRef.current, next, 0); // shown instantly next time, but revalidated
    },
    [commit]
  );

  /** Remove leads locally after a delete. */
  const removeLeads = useCallback(
    (ids) => {
      const gone = new Set(ids);
      const cur = dataRef.current;
      const leads = cur.leads.filter((l) => !gone.has(l.id) && !gone.has(l._id));
      const total = Math.max(0, (cur.total || 0) - (cur.leads.length - leads.length));
      const next = {
        ...cur,
        leads,
        total,
        pagination: { ...cur.pagination, total, totalPages: Math.max(1, Math.ceil(total / (cur.pagination?.limit || limit))) },
      };
      commit(next);
      leadsCache.clear();
      cacheSet(queryRef.current, next, 0);
    },
    [commit, limit]
  );

  return {
    leads: data.leads,
    total: data.total,
    pagination: data.pagination,
    loading,
    refreshing,
    error,
    refetch,
    patchLead,
    removeLeads,
  };
}

/** Owners + campaigns for the filter dropdowns — loaded once per session, not per render. */
let filterOptionsPromise = null;
export function useLeadFilterOptions() {
  const [options, setOptions] = useState({ owners: [], campaigns: [] });
  useEffect(() => {
    let alive = true;
    if (!filterOptionsPromise) {
      filterOptionsPromise = fetch('/api/leads/filters')
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.data || null)
        .catch(() => null);
    }
    filterOptionsPromise.then((d) => {
      if (alive && d) setOptions(d);
      if (!d) filterOptionsPromise = null; // allow a retry next mount
    });
    return () => {
      alive = false;
    };
  }, []);
  return options;
}
