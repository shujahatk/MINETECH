'use client';

import React, { useState, useEffect } from 'react';
import { Search, Building, User, Mail, Globe, Check, AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export default function RematchCompanyModal({
  isOpen,
  onClose,
  draft,
  onMatched,
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && draft) {
      const initialQuery = draft.extracted_company || '';
      setQuery(initialQuery);
      if (initialQuery.length >= 2) {
        searchLeads(initialQuery);
      }
    } else {
      setResults([]);
      setSelectedLeadId(null);
    }
  }, [isOpen, draft]);

  const searchLeads = async (searchVal) => {
    if (!searchVal || searchVal.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/email/workspace?action=search_leads&q=${encodeURIComponent(searchVal.trim())}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.leads || []);
      }
    } catch (err) {
      console.error('Lead search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    searchLeads(query);
  };

  const handleConfirmMatch = async () => {
    if (!selectedLeadId || !draft) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rematch_lead',
          draftId: draft.id,
          leadId: selectedLeadId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to link company');
      }

      toast.success('Company matched and contacts updated');
      onMatched?.(data.drafts);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error linking company');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-2xl bg-card border-border text-foreground shadow-dialog flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              Link Email to CRM Company
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Extracted from PDF: <strong className="text-primary">{draft.extracted_company || 'Unspecified'}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-5 border-b border-border bg-muted/10">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search CRM leads by company name, contact, domain, or email..."
                className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </Button>
          </form>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="text-sm">Searching CRM database...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">No matching companies found in CRM</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching by domain (e.g. mine-tech.be) or partial company name.
              </p>
            </div>
          ) : (
            results.map((lead) => {
              const isSelected = selectedLeadId === lead.id;
              const hasContacts = Array.isArray(lead.custom_fields?.additional_contacts)
                ? lead.custom_fields.additional_contacts.length + 1
                : 1;

              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${isSelected
                      ? 'border-primary bg-primary/10 text-foreground shadow-xs'
                      : 'border-border bg-card hover:border-border hover:bg-muted/40 text-foreground'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{lead.company_name || 'Unnamed Company'}</span>
                        {lead.country && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {lead.country}
                          </span>
                        )}
                        {lead.industry && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {lead.industry}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {lead.contact_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            {lead.contact_name}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                            {lead.email}
                          </span>
                        )}
                        {lead.website && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                            {lead.website.replace(/^https?:\/\//, '')}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {hasContacts} {hasContacts === 1 ? 'contact' : 'contacts'} available
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                          }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {selectedLeadId ? '1 CRM company selected' : 'Select a company to link'}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmMatch}
              disabled={!selectedLeadId || submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Linking...
                </>
              ) : (
                'Confirm & Link Company'
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
