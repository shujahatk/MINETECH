'use client';

import React, { useState } from 'react';
import {
  Send,
  Building,
  Mail,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export default function CreatePersonalizedCampaignModal({
  isOpen,
  onClose,
  selectedDrafts = [],
  batchId,
  onCampaignCreated,
}) {
  const [name, setName] = useState(
    `Personalized Outreach — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  );
  const [autoLaunch, setAutoLaunch] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalCompanies = selectedDrafts.length;
  const approvedCount = selectedDrafts.filter((d) => d.approval_status === 'approved').length;
  const unapprovedCount = totalCompanies - approvedCount;
  const unmatchedCount = selectedDrafts.filter((d) => d.match_status === 'unmatched').length;

  const totalContacts = selectedDrafts.reduce((sum, d) => {
    const count = Array.isArray(d.selected_contacts) && d.selected_contacts.length > 0
      ? d.selected_contacts.length
      : 1;
    return sum + count;
  }, 0);

  const totalAttachments = selectedDrafts.reduce((sum, d) => {
    return sum + (Array.isArray(d.assigned_attachments) ? d.assigned_attachments.length : 0);
  }, 0);

  const canProceed = totalCompanies > 0 && unmatchedCount === 0;

  const handleCreateCampaign = async () => {
    if (!canProceed) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/email/workspace/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          batchId,
          draftIds: selectedDrafts.map((d) => d.id),
          autoLaunch,
          allowUnapproved: true, // allow if user explicitly confirmed
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create campaign');
      }

      toast.success(
        autoLaunch
          ? `Campaign launched! ${data.recipientsCount} personalized emails dispatched to sending queue.`
          : `Campaign "${data.campaign?.name}" created as draft.`
      );

      onCampaignCreated?.(data.campaignId);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error launching campaign');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-xl bg-slate-900 border-slate-700 text-slate-100 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Create & Send Personalized Campaign
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every company receives its own individualized email & attachments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Campaign Name Input */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Campaign Name:
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Bleaching Earth Outreach — LATAM"
              className="bg-slate-950 border-slate-700 text-white font-medium focus:border-amber-500"
            />
          </div>

          {/* Stats Summary Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
              <Building className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <span className="text-xl font-bold text-white">{totalCompanies}</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Companies</p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
              <Mail className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <span className="text-xl font-bold text-white">{totalContacts}</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Target Contacts</p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
              <Paperclip className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <span className="text-xl font-bold text-white">{totalAttachments}</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Attachments</p>
            </div>
          </div>

          {/* Readiness Checklist */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2.5 text-xs">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
              Pre-flight Campaign Checklist:
            </span>

            <div className="flex items-center justify-between">
              <span className="text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Approved Emails:
              </span>
              <span className="font-semibold text-emerald-400">
                {approvedCount} of {totalCompanies}
              </span>
            </div>

            {unapprovedCount > 0 && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  <strong>{unapprovedCount} emails</strong> are still marked as Needs Review. They will still be sent if you proceed.
                </span>
              </div>
            )}

            {unmatchedCount > 0 && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>
                  <strong>{unmatchedCount} companies</strong> have not been matched to a CRM record. You must match or deselect them before launching.
                </span>
              </div>
            )}
          </div>

          {/* Send Options Toggle */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-200">
                Send Campaign Immediately
              </span>
              <p className="text-[11px] text-slate-400">
                Dispatches all personalized emails into the delivery queue right now.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoLaunch}
              onChange={(e) => setAutoLaunch(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Unselected drafts remain in your workspace.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={!canProceed || submitting}
              className={`text-xs font-semibold shadow flex items-center gap-1.5 ${
                autoLaunch
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  {autoLaunch ? 'Dispatching...' : 'Creating...'}
                </>
              ) : autoLaunch ? (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Send Campaign Now (1-Click Bulk Send)
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  Save as Draft Campaign
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
