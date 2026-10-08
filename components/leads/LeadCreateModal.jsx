'use client';
import { ModalFrame } from '@/components/ui/modal-frame';

import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, Sparkles, Beaker, PackageCheck, Layers, MapPin, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_INDUSTRIES,
  INCOTERMS_OPTIONS,
  SAMPLE_TECHNICAL_STATUSES,
  TRIAL_STATUSES,
  NEXT_ACTION_PRESETS,
  OPPORTUNITY_PRIORITIES,
  LEAD_SOURCE_OPTIONS,
  KNOWN_TRADE_SHOWS,
  COMPANY_TYPE_OPTIONS,
} from '@/lib/services/catalogService';

const MINETECH_STAGES = [
  { id: 'NEW', label: '1. New Lead — Identified, not contacted' },
  { id: 'CONTACTED', label: '2. Contacted — Outreach sent / call made' },
  { id: 'ENGAGED', label: '3. Engaged — Replied / meeting booked' },
  { id: 'TECHNICAL_EVALUATION', label: '4. Technical Evaluation — Specs, samples & testing' },
  { id: 'COMMERCIAL_DISCUSSION', label: '5. Commercial Discussion — Price, volume, Incoterms' },
  { id: 'TRIAL_ORDER', label: '6. Trial Order — Paid trial load / commercial test' },
  { id: 'APPROVED_SUPPLIER', label: '7. Approved Supplier — Technically & commercially approved' },
  { id: 'RECURRING_CUSTOMER', label: '8. Recurring Customer — Regular orders & loads' },
];

export default function LeadCreateModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    company: '',
    country: 'Germany',
    city: '',
    website: '',
    companyType: 'Manufacturer',
    contactName: '',
    jobTitle: 'Purchasing Manager',
    email: '',
    phone: '',
    productCategory: 'Kaolin',
    productGrade: 'Perfometa – Calcined Kaolin, Metakaolin',
    industry: 'Ceramics',
    application: 'Sanitaryware',
    status: 'NEW',
    sampleStatus: 'Requirements Not Yet Received',
    trialStatus: 'Trial Discussed',
    priority: 'WARM',
    estimatedMonthlyTonnage: '',
    incoterm: 'CIF',
    nextAction: 'Send Follow-up Email',
    nextActionDate: '',
    leadSource: 'Cold Outreach',
    tradeShowEvent: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const activeCategoryObj = DEFAULT_PRODUCT_CATEGORIES.find((c) => c.name === formData.productCategory);
  const availableGrades = activeCategoryObj?.grades || [];

  const activeIndustryObj = DEFAULT_INDUSTRIES.find((i) => i.name === formData.industry);
  const availableApps = activeIndustryObj?.applications || [];

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.company && !formData.contactName) {
      setError('Please provide either a Company Name or Contact Name.');
      return;
    }

    setLoading(true);
    setError('');

    const nameParts = (formData.contactName || 'Prospect Contact').trim().split(' ');
    const firstName = nameParts[0] || 'Prospect';
    const lastName = nameParts.slice(1).join(' ') || '';

    const payload = {
      company: formData.company,
      firstName,
      lastName,
      fullName: formData.contactName || firstName,
      jobTitle: formData.jobTitle,
      email: formData.email,
      phone: formData.phone,
      country: formData.country,
      city: formData.city,
      website: formData.website,
      companyType: formData.companyType,
      productCategory: formData.productCategory,
      productGrade: formData.productGrade,
      industry: formData.industry,
      application: formData.application,
      status: formData.status,
      sampleStatus: formData.sampleStatus,
      trialStatus: formData.trialStatus,
      priority: formData.priority,
      estimatedMonthlyTonnage: formData.estimatedMonthlyTonnage,
      incoterm: formData.incoterm,
      nextAction: formData.nextAction,
      nextActionDate: formData.nextActionDate ? new Date(formData.nextActionDate).toISOString() : null,
      leadSource: formData.leadSource,
      tradeShowEvent: formData.tradeShowEvent,
      notes: formData.notes,
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok) {
        if (onSuccess) onSuccess(json.data);
        onClose();
      } else {
        setError(json.message || 'Failed to create opportunity.');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalFrame title="Add MineTech Opportunity" onClose={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-xl overflow-hidden shadow-dialog animate-in zoom-in-95 duration-150 text-foreground max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground tracking-tight">New Mineral Opportunity</h3>
              <p className="text-[10px] text-muted-foreground font-medium uppercase">MineTech Sales CRM Intake</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto flex-1 bg-card"
        >
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span>{error}</span>
            </div>
          )}

          {/* Company & Country */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Company Name *</label>
              <Input
                type="text"
                name="company"
                required
                value={formData.company}
                onChange={handleChange}
                placeholder="e.g. ABC Ceramics GmbH"
                className="w-full bg-background border-border text-xs text-foreground h-9 rounded-xl"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Country</label>
              <Input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="e.g. Germany / Italy / Poland"
                className="w-full bg-background border-border text-xs text-foreground h-9 rounded-xl"
              />
            </div>
          </div>

          {/* Contact Person */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Main Contact</label>
              <Input
                type="text"
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                placeholder="e.g. Simone Schnau"
                className="w-full bg-background border-border text-xs text-foreground h-9 rounded-xl"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Email</label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contact@company.com"
                className="w-full bg-background border-border text-xs text-foreground h-9 rounded-xl"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Phone / Direct</label>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+49 221 555..."
                className="w-full bg-background border-border text-xs text-foreground h-9 rounded-xl"
              />
            </div>
          </div>

          {/* Product Category & Grade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Product Category</label>
              <select
                name="productCategory"
                value={formData.productCategory}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    productCategory: e.target.value,
                    productGrade: '',
                  });
                }}
                className="w-full h-9 text-xs rounded-xl border border-border bg-background text-foreground px-2.5 font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                {DEFAULT_PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Product Grade</label>
              {availableGrades.length > 0 ? (
                <select
                  name="productGrade"
                  value={formData.productGrade}
                  onChange={handleChange}
                  className="w-full h-9 text-xs rounded-xl border border-border bg-background text-foreground px-2.5 font-semibold focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">Select Grade...</option>
                  {availableGrades.map((g, idx) => (
                    <option key={idx} value={g}>{g}</option>
                  ))}
                </select>
              ) : (
                <Input
                  name="productGrade"
                  value={formData.productGrade}
                  onChange={handleChange}
                  placeholder="e.g. Standard Refined"
                  className="w-full bg-background border-border text-xs text-foreground h-9 rounded-xl"
                />
              )}
            </div>
          </div>

          {/* Industry & Application */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Industry</label>
              <select
                name="industry"
                value={formData.industry}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    industry: e.target.value,
                    application: '',
                  });
                }}
                className="w-full h-9 text-xs rounded-xl border border-border bg-background text-foreground px-2.5 font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                {DEFAULT_INDUSTRIES.map((ind) => (
                  <option key={ind.id} value={ind.name}>{ind.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Application</label>
              {availableApps.length > 0 ? (
                <select
                  name="application"
                  value={formData.application}
                  onChange={handleChange}
                  className="w-full h-9 text-xs rounded-xl border border-border bg-background text-foreground px-2.5 font-semibold focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">Select Application...</option>
                  {availableApps.map((a, idx) => (
                    <option key={idx} value={a}>{a}</option>
                  ))}
                </select>
              ) : (
                <Input
                  name="application"
                  value={formData.application}
                  onChange={handleChange}
                  placeholder="e.g. Sanitaryware, Palm Oil Refining"
                  className="w-full bg-background border-border text-xs text-foreground h-9 rounded-xl"
                />
              )}
            </div>
          </div>

          {/* Pipeline Stage & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Initial Pipeline Stage</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full h-9 text-xs rounded-xl border border-border bg-background text-foreground px-2.5 font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                {MINETECH_STAGES.map((st) => (
                  <option key={st.id} value={st.id}>{st.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Priority / Temperature</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full h-9 text-xs rounded-xl border border-border bg-background text-foreground px-2.5 font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                {OPPORTUNITY_PRIORITIES.map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Next Action & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Next Action Required</label>
              <select
                name="nextAction"
                value={formData.nextAction}
                onChange={handleChange}
                className="w-full h-9 text-xs rounded-xl border border-border bg-background text-foreground px-2.5 font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                {NEXT_ACTION_PRESETS.map((na, idx) => (
                  <option key={idx} value={na}>{na}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Next Action Due Date</label>
              <Input
                type="date"
                name="nextActionDate"
                value={formData.nextActionDate}
                onChange={handleChange}
                className="w-full bg-background border-border text-xs text-foreground h-9 rounded-xl"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 border-border hover:bg-muted text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-9 px-5"
            >
              {loading ? 'Creating...' : 'Create Opportunity'}
            </Button>
          </div>
        </form>
      </div>
    </ModalFrame>
  );
}
