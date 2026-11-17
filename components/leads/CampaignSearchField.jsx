'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  ChevronDown,
  Megaphone,
  Check,
  RotateCcw,
  Users,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Status color helper for campaign status badge
 */
function getCampaignStatusBadge(status) {
  const s = String(status || 'DRAFT').toUpperCase();
  if (s === 'COMPLETED' || s === 'SENT') {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
  if (s === 'ACTIVE' || s === 'SENDING' || s === 'SCHEDULED') {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }
  if (s === 'PAUSED') {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
  return 'bg-muted text-muted-foreground border-border';
}

/**
 * Substring highlight helper for autocomplete suggestions
 */
function HighlightMatch({ text, query }) {
  if (!query || !query.trim()) return <span>{text}</span>;
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <span>{text}</span>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);

  return (
    <span>
      {before}
      <span className="font-bold text-amber-400 underline decoration-amber-400/50 underline-offset-2">
        {match}
      </span>
      {after}
    </span>
  );
}

export default function CampaignSearchField({
  campaigns = [],
  selectedCampaignId = '',
  totalMatchingLeads = 0,
  onSelectCampaign,
  loading = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Identify currently selected campaign object
  const activeCampaign = useMemo(() => {
    if (!selectedCampaignId) return null;
    return campaigns.find((c) => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  // Sync input text when external selectedCampaignId changes
  useEffect(() => {
    if (activeCampaign) {
      setQuery(activeCampaign.name);
    } else if (!selectedCampaignId) {
      setQuery('');
    }
  }, [activeCampaign, selectedCampaignId]);

  // Filter campaigns with partial-name matching and optional status matching
  const filteredCampaigns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.status || '').toLowerCase().includes(q)
    );
  }, [campaigns, query]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredCampaigns.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-campaign-item]');
    if (items[highlightedIndex]) {
      items[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        // If a campaign was active, restore its name in the query input
        if (activeCampaign) {
          setQuery(activeCampaign.name);
        } else if (!selectedCampaignId) {
          setQuery('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeCampaign, selectedCampaignId]);

  // Select campaign handler
  const handleSelect = (campaign) => {
    if (!campaign) {
      onSelectCampaign('');
      setQuery('');
    } else {
      onSelectCampaign(campaign.id);
      setQuery(campaign.name);
    }
    setIsOpen(false);
  };

  // Clear / Reset to all leads
  const handleClear = (e) => {
    e?.stopPropagation();
    onSelectCampaign('');
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredCampaigns.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCampaigns.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredCampaigns.length > 0) {
        handleSelect(filteredCampaigns[highlightedIndex]);
      } else if (!isOpen && filteredCampaigns.length > 0) {
        handleSelect(filteredCampaigns[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      if (activeCampaign) {
        setQuery(activeCampaign.name);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative rounded-xl border border-border bg-card/90 backdrop-blur-sm p-3 shadow-subtle transition-all ${className}`}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Label & Search Input */}
        <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <label
            htmlFor="campaign-search-input"
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
          >
            <Megaphone className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            <span>Search by Campaign</span>
          </label>

          {/* Autocomplete Input Container */}
          <div className="relative flex-1 max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              id="campaign-search-input"
              type="text"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Type or select a campaign name (e.g. Bentonite Suppliers)..."
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-16 text-xs text-foreground placeholder:text-muted-foreground focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />

            {/* Trailing action icons */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {loading && (
                <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
              )}
              {(query || selectedCampaignId) && (
                <button
                  type="button"
                  aria-label="Clear campaign search and return to all leads"
                  onClick={handleClear}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                aria-label={isOpen ? 'Close campaigns dropdown' : 'Open campaigns dropdown'}
                onClick={() => {
                  setIsOpen((prev) => !prev);
                  inputRef.current?.focus();
                }}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {/* Dropdown Suggestions Menu */}
            {isOpen && (
              <div
                ref={listRef}
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg ring-1 ring-border"
                role="listbox"
              >
                {/* Reset to All Leads Option */}
                <button
                  type="button"
                  role="option"
                  aria-selected={!selectedCampaignId}
                  onClick={() => handleSelect(null)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-muted/80 ${
                    !selectedCampaignId
                      ? 'bg-amber-500/10 font-semibold text-amber-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="h-3 w-3" />
                    <span>All Leads (No Campaign Filter)</span>
                  </span>
                  {!selectedCampaignId && <Check className="h-3.5 w-3.5" />}
                </button>

                <div className="my-1 border-t border-border/60" />

                {filteredCampaigns.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                    No campaigns found matching &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  filteredCampaigns.map((camp, idx) => {
                    const isSelected = selectedCampaignId === camp.id;
                    const isHighlighted = idx === highlightedIndex;
                    const leadCount = camp.leadCount ?? camp.totalLeads ?? 0;

                    return (
                      <button
                        key={camp.id}
                        type="button"
                        role="option"
                        data-campaign-item
                        aria-selected={isSelected}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => handleSelect(camp)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                          isHighlighted ? 'bg-muted' : ''
                        } ${
                          isSelected
                            ? 'bg-amber-500/10 font-medium text-amber-300'
                            : 'text-foreground'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {isSelected ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          ) : (
                            <Megaphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate">
                            <HighlightMatch text={camp.name} query={query} />
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getCampaignStatusBadge(
                              camp.status
                            )}`}
                          >
                            {camp.status || 'DRAFT'}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            <Users className="h-2.5 w-2.5" />
                            {leadCount} {leadCount === 1 ? 'lead' : 'leads'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Campaign Status Pill & Lead Count Summary */}
        {activeCampaign ? (
          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
              <span className="text-[11px] font-medium text-muted-foreground">
                Showing:
              </span>
              <span className="font-semibold text-amber-400">
                {activeCampaign.name}
              </span>
              <span
                className={`rounded border px-1.5 py-0.2 text-[9px] font-bold uppercase ${getCampaignStatusBadge(
                  activeCampaign.status
                )}`}
              >
                {activeCampaign.status}
              </span>
              <span className="border-l border-amber-500/30 pl-2 font-mono font-bold text-amber-300">
                {totalMatchingLeads} {totalMatchingLeads === 1 ? 'lead' : 'leads'} found
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-7 gap-1 border-border text-[11px] font-medium hover:bg-muted"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to all leads
            </Button>
          </div>
        ) : (
          <div className="hidden text-xs text-muted-foreground sm:block">
            {campaigns.length} available {campaigns.length === 1 ? 'campaign' : 'campaigns'} in system
          </div>
        )}
      </div>
    </div>
  );
}
