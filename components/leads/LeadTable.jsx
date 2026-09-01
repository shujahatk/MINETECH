'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Upload,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Flame,
  AlertCircle,
  Building,
  Tag,
  LayoutGrid,
  List,
} from 'lucide-react';
import LeadDrawer from '@/components/leads/LeadDrawer';
import LeadImportModal from '@/components/leads/LeadImportModal';
import LeadCreateModal from '@/components/leads/LeadCreateModal';
import PipelineKanban from '@/components/leads/PipelineKanban';

const STATUS_OPTIONS = [
  'ALL',
  'NEW',
  'CONTACTED',
  'ENGAGED',
  'INTERESTED',
  'QUALIFIED',
  'CUSTOMER',
  'FOLLOW_UP',
  'NO_RESPONSE',
  'NOT_INTERESTED',
  'DO_NOT_CONTACT',
];

export default function LeadTable() {
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'pipeline'

  const fetchLeads = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        search,
        status: statusFilter,
      });
      const res = await fetch(`/api/leads?${params}`);
      if (res.ok) {
        const json = await res.json();
        setLeads(json.leads || []);
        setPagination(json.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchLeads(1);
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Leads & Prospects</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your personal outbound CRM pipeline ({pagination.total} total leads)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => setViewMode('pipeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'pipeline' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Pipeline Board
            </button>
          </div>

          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition"
          >
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel p-3.5 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Box */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads by name, email, phone, company..."
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {STATUS_OPTIONS.slice(0, 7).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800/60 border border-slate-700 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none"
          >
            <option value="ALL">More Statuses...</option>
            {STATUS_OPTIONS.slice(7).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* View Mode: Pipeline Kanban Board */}
      {viewMode === 'pipeline' ? (
        <PipelineKanban
          leads={leads}
          onSelectLead={(id) => setSelectedLeadId(id)}
          onUpdateStage={(id, newStage) => {
            setLeads((prev) =>
              prev.map((l) => (l._id === id ? { ...l, status: newStage } : l))
            );
          }}
        />
      ) : (
        /* Leads Table Card */
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-b border-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Company & Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Loading leads...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No leads found matching your search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr
                      key={lead._id}
                      onClick={() => setSelectedLeadId(lead._id)}
                      className="hover:bg-slate-800/40 cursor-pointer transition group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400 shrink-0">
                            {lead.firstName ? lead.firstName[0] : 'L'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-100 group-hover:text-indigo-400 transition">
                                {lead.fullName || lead.email}
                              </span>
                              {lead.hasUnansweredReply && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block">{lead.email || lead.phone}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-200 block">{lead.company || '—'}</span>
                        <span className="text-[11px] text-slate-500 block">{lead.jobTitle || ''}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold badge-${lead.status?.toLowerCase()}`}>
                          {lead.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {lead.tags && lead.tags.length > 0 ? (
                            lead.tags.slice(0, 2).map((t, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : 'Never'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLeadId(lead._id);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-400 transition"
                        >
                          View &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="p-4 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total leads)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLeads(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchLeads(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      {selectedLeadId && (
        <LeadDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdated={() => fetchLeads(pagination.page)}
        />
      )}

      {isImportOpen && (
        <LeadImportModal
          onClose={() => setIsImportOpen(false)}
          onImported={() => {
            setIsImportOpen(false);
            fetchLeads(1);
          }}
        />
      )}

      {isCreateOpen && (
        <LeadCreateModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            fetchLeads(1);
          }}
        />
      )}
    </div>
  );
}
