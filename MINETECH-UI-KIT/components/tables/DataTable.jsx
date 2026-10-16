'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  X,
  Trash2,
  Mail,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '../buttons/Button';
import { StatusBadge } from '../feedback/StatusBadge';
import { TemperatureBadge } from '../feedback/TemperatureBadge';
import { EmptyState } from '../feedback/EmptyState';
import { cn } from '../../utils/cn';

export function DataTable({
  columns = [],
  data = [],
  onRowClick = null,
  searchPlaceholder = 'Search records...',
  filterOptions = null, // { status: [], temperature: [] }
  bulkActions = null,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search or filters.',
  className = '',
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tempFilter, setTempFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filter & Search
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Search check
      if (search) {
        const query = search.toLowerCase();
        const matches = Object.values(item).some(
          (val) => typeof val === 'string' && val.toLowerCase().includes(query)
        );
        if (!matches) return false;
      }
      // Status filter
      if (statusFilter && item.status !== statusFilter) return false;
      // Temperature filter
      if (tempFilter && item.temperature !== tempFilter) return false;

      return true;
    });
  }, [data, search, statusFilter, tempFilter]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn] ?? '';
      const bVal = b[sortColumn] ?? '';
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page]);

  // Sorting Handler
  const handleSort = (colKey) => {
    if (sortColumn === colKey) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortColumn('');
        setSortDirection('asc');
      }
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  };

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedData.map((d) => d.id || d._id)));
    }
  };

  const toggleSelectRow = (id, e) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className={cn('panel p-0 overflow-hidden space-y-0', className)}>
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3.5 bg-card">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-lg border border-border bg-muted/40 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="NEW">New Lead</option>
            <option value="CONTACTED">Contacted</option>
            <option value="ENGAGED">Engaged</option>
            <option value="TECHNICAL_EVALUATION">Tech Evaluation</option>
            <option value="COMMERCIAL_DISCUSSION">Commercial Discussion</option>
            <option value="TRIAL_ORDER">Trial Order</option>
            <option value="APPROVED_SUPPLIER">Approved Supplier</option>
          </select>

          {/* Temperature Filter */}
          <select
            value={tempFilter}
            onChange={(e) => {
              setTempFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="">All Warmth</option>
            <option value="HOT">Hot</option>
            <option value="WARM">Warm</option>
            <option value="COLD">Cold</option>
          </select>
        </div>

        <div className="text-xs text-muted-foreground tabular-nums">
          <span>{filteredData.length} records</span>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between border-b border-primary/20 bg-primary/10 px-4 py-2 text-xs text-primary anim-fade-in">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {selectedIds.size}
            </span>
            <span>selected across current page</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Mail className="mr-1.5 h-3.5 w-3.5" /> Send Sequence
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
            </Button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table Surface */}
      <div className="relative overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length}
                  onChange={toggleSelectAll}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary"
                />
              </th>
              {columns.map((col) => {
                const isSorted = sortColumn === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn('h-9 px-3 text-left font-semibold', col.className)}
                  >
                    {col.sortable !== false ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none"
                      >
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3 text-primary" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    ) : (
                      <span>{col.label}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="p-8">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => {
                const id = row.id || row._id;
                const isSelected = selectedIds.has(id);
                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={cn(
                      'transition-colors cursor-pointer',
                      isSelected ? 'row-selected' : 'hover:bg-muted/40'
                    )}
                  >
                    <td className="w-9 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectRow(id, e)}
                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary"
                      />
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-3 py-2.5 align-middle', col.cellClassName)}>
                        {col.render ? (
                          col.render(row[col.key], row)
                        ) : col.key === 'status' ? (
                          <StatusBadge status={row.status} />
                        ) : col.key === 'temperature' ? (
                          <TemperatureBadge temperature={row.temperature} score={row.score} showScore />
                        ) : (
                          <span className="text-foreground">{row[col.key]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card">
        <span className="text-xs text-muted-foreground">
          Page <strong className="text-foreground">{page}</strong> of{' '}
          <strong className="text-foreground">{totalPages}</strong>
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-7 px-2 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-7 px-2 text-xs"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
