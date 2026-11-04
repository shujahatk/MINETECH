'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Mail,
  Zap,
  Users,
  CheckCircle2,
  Eye,
  MessageSquareReply,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/ui/StatusBadge';

export default function CampaignLeadsView({ onOpenLead, onComposeLead }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  // Campaign Detail Leads State
  const [campaignData, setCampaignData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedClassification, setSelectedClassification] = useState('ALL'); // 'ALL' | 'Buyer' | 'Seller' | 'Unclassified'
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'DELIVERED' | 'OPENED' | 'REPLIED' | 'BOUNCED'

  const fetchCampaigns = async () => {
    try {
      setLoadingCampaigns(true);
      const res = await fetch('/api/leads/by-campaign');
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setCampaigns(list);
        if (list.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(list[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch campaigns list:', e);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchCampaignLeads = async (campId) => {
    if (!campId) return;
    try {
      setLoadingDetail(true);
      const url = `/api/leads/by-campaign?campaignId=${campId}&classification=${selectedClassification}&status=${selectedStatus}&search=${encodeURIComponent(leadSearch)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setCampaignData(json);
      }
    } catch (e) {
      console.error('Failed to fetch campaign leads:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      fetchCampaignLeads(selectedCampaignId);
    }
  }, [selectedCampaignId, selectedClassification, selectedStatus, leadSearch]);

  const handleExportCsv = () => {
    if (!selectedCampaignId) return;
    const url = `/api/leads/by-campaign?campaignId=${selectedCampaignId}&classification=${selectedClassification}&status=${selectedStatus}&search=${encodeURIComponent(leadSearch)}&format=csv`;
    window.open(url, '_blank');
  };

  const filteredCampaigns = campaigns.filter((c) =>
    (c.name || '').toLowerCase().includes(campaignSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* 2-Column Split: Campaigns Sidebar & Selected Campaign Associated Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
        {/* Left Column: Campaign List & Selection */}
        <Card className="p-3 space-y-3 bg-card border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-xs uppercase tracking-wider text-foreground">Campaigns ({campaigns.length})</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={fetchCampaigns}
              title="Refresh campaigns"
            >
              <RefreshCw className={`h-3 w-3 ${loadingCampaigns ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search campaigns..."
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-muted/30"
            />
          </div>

          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {loadingCampaigns ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading campaigns...</div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No campaigns found</div>
            ) : (
              filteredCampaigns.map((camp) => {
                const isSelected = selectedCampaignId === camp.id;
                return (
                  <div
                    key={camp.id}
                    onClick={() => setSelectedCampaignId(camp.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'border-primary/50 bg-primary/5 shadow-subtle'
                        : 'border-border/60 bg-card hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-foreground truncate">{camp.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {camp.createdAt ? new Date(camp.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                        </p>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border border-border bg-muted/60 text-muted-foreground">
                        {camp.status}
                      </span>
                    </div>

                    {/* Breakdown Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono font-medium">
                        {camp.totalLeads} leads
                      </span>
                      {camp.buyersCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                          {camp.buyersCount} Buyers
                        </span>
                      )}
                      {camp.sellersCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                          {camp.sellersCount} Sellers
                        </span>
                      )}
                      {camp.unclassifiedCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                          {camp.unclassifiedCount} Unclassified
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Column: Detailed Associated Leads */}
        <Card className="p-4 space-y-4 bg-card border-border min-h-[500px]">
          {loadingDetail && !campaignData ? (
            <div className="py-24 text-center text-xs text-muted-foreground">Loading campaign leads...</div>
          ) : !campaignData ? (
            <div className="py-24 text-center text-xs text-muted-foreground">Select a campaign to inspect its leads</div>
          ) : (
            <>
              {/* Campaign Header & Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-foreground">{campaignData.campaign?.name}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border border-border bg-muted/60 text-muted-foreground">
                      {campaignData.campaign?.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Associated campaign audience with delivery tracking and classification filtering.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    className="gap-1.5 h-8 text-xs border-border text-foreground hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>

              {/* Filtering Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* Search within leads */}
                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search leads in campaign..."
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-muted/30"
                  />
                </div>

                {/* Classification Pills */}
                <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg border border-border text-xs">
                  {[
                    { id: 'ALL', label: 'All Leads' },
                    { id: 'Buyer', label: `Buyers (${campaignData.counts?.buyers ?? 0})` },
                    { id: 'Seller', label: `Sellers (${campaignData.counts?.sellers ?? 0})` },
                    { id: 'Unclassified', label: `Unclassified (${campaignData.counts?.unclassified ?? 0})` },
                  ].map((tab) => {
                    const isTabActive = selectedClassification === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedClassification(tab.id)}
                        className={`px-2.5 py-1 rounded-md transition font-medium text-[11px] ${
                          isTabActive
                            ? 'bg-card text-foreground shadow-subtle border border-border'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Email Status Filter */}
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="ALL">All Delivery Statuses</option>
                    <option value="DELIVERED">Delivered ({campaignData.counts?.delivered ?? 0})</option>
                    <option value="OPENED">Opened ({campaignData.counts?.opened ?? 0})</option>
                    <option value="REPLIED">Replied ({campaignData.counts?.replied ?? 0})</option>
                    <option value="BOUNCED">Bounced ({campaignData.counts?.bounced ?? 0})</option>
                  </select>
                </div>
              </div>

              {/* Leads Table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="px-3 py-2.5">Lead Name</th>
                      <th className="px-3 py-2.5">Company</th>
                      <th className="px-3 py-2.5">Classification</th>
                      <th className="px-3 py-2.5">Email Status</th>
                      <th className="px-3 py-2.5">Product Fit</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {campaignData.leads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                          No leads match the current filters.
                        </td>
                      </tr>
                    ) : (
                      campaignData.leads.map((lead) => {
                        return (
                          <tr key={lead.recipientId || lead.leadId} className="hover:bg-muted/40 transition">
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-foreground text-xs">{lead.fullName}</div>
                              <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">{lead.email}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-foreground text-xs font-medium">{lead.company || '—'}</span>
                              {lead.country && <div className="text-[10px] text-muted-foreground">{lead.country}</div>}
                            </td>
                            <td className="px-3 py-2.5">
                              {lead.classification === 'Buyer' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Buyer
                                </span>
                              ) : lead.classification === 'Seller' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  Seller
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                                  Unclassified
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  lead.emailStatus === 'DELIVERED'
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                    : lead.emailStatus === 'OPENED'
                                    ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                    : lead.emailStatus === 'REPLIED'
                                    ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                                    : lead.emailStatus === 'BOUNCED'
                                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {lead.emailStatus}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-muted-foreground text-xs truncate max-w-[150px] inline-block">
                                {lead.productCategory || '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {onComposeLead && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => onComposeLead(lead)}
                                    title="Compose email"
                                  >
                                    <Mail className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {onOpenLead && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => onOpenLead(lead.leadId)}
                                    title="Open lead drawer"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

