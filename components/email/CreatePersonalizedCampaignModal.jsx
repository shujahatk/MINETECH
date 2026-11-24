'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building,
  Mail,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Sparkles,
  Eye,
  ArrowRight
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
  const router = useRouter();
  const [name, setName] = useState(
    `Personalized Outreach — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [createdCampaignId, setCreatedCampaignId] = useState(null);

  const campaignFiles = React.useMemo(() => {
    for (const d of selectedDrafts) {
      if (Array.isArray(d.assigned_attachments) && d.assigned_attachments.length > 0) {
        return d.assigned_attachments;
      }
    }
    return [];
  }, [selectedDrafts]);

  const signatureSummary = React.useMemo(() => {
    for (const d of selectedDrafts) {
      if (d.assigned_signature_name) return d.assigned_signature_name;
    }
    return 'Abdullah Rauf — Minetech Resources BV';
  }, [selectedDrafts]);

  if (!isOpen) return null;

  const totalCompanies = selectedDrafts.length;
  const approvedCount = selectedDrafts.filter((d) => d.approval_status === 'approved' && d.user_approved).length;
  const unapprovedCount = totalCompanies - approvedCount;
  const unmatchedCount = selectedDrafts.filter((d) => d.match_status === 'unmatched').length;

  const totalContacts = selectedDrafts.reduce((sum, d) => {
    const count = Array.isArray(d.selected_contacts) && d.selected_contacts.length > 0
      ? d.selected_contacts.length
      : 1;
    return sum + count;
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
          autoLaunch: false, // Strictly DRAFT! Never send automatically.
          allowUnapproved: true, // allow staging; review screen will require final approval
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create campaign draft');
      }

      toast.success(`Draft campaign "${data.campaign?.name || name}" created!`);
      setCreatedCampaignId(data.campaignId);
      onCampaignCreated?.(data.campaignId);
    } catch (err) {
      toast.error(err.message || 'Error creating campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReview = () => {
    const targetId = createdCampaignId || selectedDrafts.find((d) => d.campaign_id)?.campaign_id;
    if (targetId) {
      router.push(`/email/blasts/${targetId}`);
      onClose();
    } else {
      toast.error('Campaign ID not available. Please try refreshing.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-xl bg-card border-border text-foreground shadow-dialog overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Create Campaign Draft
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Creates a draft campaign for review. No emails will be sent until final confirmation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {createdCampaignId ? (
            /* Success State */
            <div className="p-6 rounded-xl bg-muted/20 border border-emerald-500/30 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-foreground">Draft Campaign Created Successfully</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Your personalized emails, matched CRM contacts, signatures, and attachments have been assembled into draft campaign <strong className="text-foreground">&ldquo;{name}&rdquo;</strong>.
                </p>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg border border-border text-xs text-foreground flex items-center justify-center gap-4">
                <span><strong>{totalCompanies}</strong> Companies</span>
                <span>•</span>
                <span><strong>{totalContacts}</strong> Outgoing Emails</span>
                <span>•</span>
                <span className="text-primary font-medium"><strong>Status:</strong> Draft (Unsent)</span>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
                <Button
                  onClick={handleOpenReview}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs py-2.5 px-5 flex items-center justify-center gap-2 shadow-xs"
                >
                  <Eye className="w-4 h-4" />
                  View Campaign (Review & Send)
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-border text-foreground hover:bg-muted text-xs"
                >
                  Stay in Workspace
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Campaign Name Input */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Campaign Name:
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q4 Bleaching Earth Outreach — LATAM"
                  className="bg-background border-border text-foreground font-medium focus:border-primary"
                />
              </div>

              {/* Stats Summary Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-center">
                  <Building className="w-4 h-4 text-primary mx-auto mb-1" />
                  <span className="text-xl font-bold text-foreground">{totalCompanies}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Companies</p>
                </div>

                <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-center">
                  <Mail className="w-4 h-4 text-primary mx-auto mb-1" />
                  <span className="text-xl font-bold text-foreground">{totalContacts}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Target Contacts</p>
                </div>

                <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-center">
                  <Paperclip className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <span className="text-xl font-bold text-foreground">{campaignFiles.length}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Campaign Files</p>
                </div>
              </div>

              {/* Readiness Checklist */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2.5 text-xs">
                <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground block">
                  Campaign Composition:
                </span>

                <div className="flex items-center justify-between">
                  <span className="text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Approved Emails:
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {approvedCount} of {totalCompanies}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-foreground flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-primary" />
                    Campaign Attachments:
                  </span>
                  <span className="font-semibold text-primary">
                    {campaignFiles.length > 0
                      ? `${campaignFiles.length} file${campaignFiles.length > 1 ? 's' : ''} auto-attached to all`
                      : '0 files (None attached)'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Email Signature:
                  </span>
                  <span className="font-semibold text-foreground">
                    {signatureSummary}
                  </span>
                </div>

                {unapprovedCount > 0 && (
                  <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <span>
                      <strong>{unapprovedCount} email{unapprovedCount > 1 ? 's are' : ' is'} pending review.</strong> They will be included in the draft, and you can inspect, edit, or approve them individually in the Campaign Review screen.
                    </span>
                  </div>
                )}

                {unmatchedCount > 0 && (
                  <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                    <span>
                      <strong>{unmatchedCount} companies</strong> have not been matched to a CRM record. You must match or deselect them before creating the campaign.
                    </span>
                  </div>
                )}
              </div>

              {/* Safety notice */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-foreground text-xs flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <span>
                  <strong className="text-primary">Safety Guaranteed:</strong> This action only organizes your emails into a Draft Campaign. No emails will ever be dispatched without your explicit confirmation on the Campaign Review Screen.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!createdCampaignId && (
          <div className="p-4 px-6 border-t border-border bg-muted/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Unselected drafts remain safe in your workspace.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-border text-foreground hover:bg-muted text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCampaign}
                disabled={!canProceed || submitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    Creating Draft...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Create Campaign Draft
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
