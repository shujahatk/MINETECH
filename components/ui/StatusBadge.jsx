'use client';
import React from 'react';

export default function StatusBadge({
  status = 'active',
  label,
  pulse = false,
  className = '',
  size = 'md',
}) {
  const normalized = (status || '').toLowerCase().trim();

  const getStyles = () => {
    switch (normalized) {
      case 'approved_supplier':
      case 'recurring_customer':
      case 'customer':
      case 'won':
      case 'approved':
      case 'delivered':
      case 'operational':
        return {
          bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
          dot: 'bg-emerald-500',
          ping: 'bg-emerald-400',
          defaultText: label || (normalized === 'approved_supplier' ? 'Approved Supplier' : normalized === 'recurring_customer' ? 'Recurring Customer' : 'Approved'),
        };
      case 'trial_order':
      case 'ordered':
        return {
          bg: 'bg-primary/20 text-primary border-primary/30',
          dot: 'bg-primary',
          ping: 'bg-primary/60',
          defaultText: label || (normalized === 'trial_order' ? 'Trial Order' : 'Ordered'),
        };
      case 'commercial_discussion':
      case 'qualified':
        return {
          bg: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
          dot: 'bg-amber-500',
          ping: 'bg-amber-400',
          defaultText: label || (normalized === 'commercial_discussion' ? 'Commercial Discussion' : 'Qualified'),
        };
      case 'technical_evaluation':
      case 'testing':
      case 'sent':
        return {
          bg: 'bg-primary/10 text-primary border-primary/25',
          dot: 'bg-primary',
          ping: 'bg-primary/60',
          defaultText: label || (normalized === 'technical_evaluation' ? 'Technical Evaluation' : normalized === 'testing' ? 'Testing' : 'Sent'),
        };
      case 'engaged':
      case 'interested':
      case 'connected_interested':
      case 'meeting_booked':
      case 'in_sequence':
      case 'in-progress':
      case 'running':
      case 'active':
      case 'connected':
      case 'online':
      case 'ready':
        return {
          bg: 'bg-primary/10 text-primary border-primary/25',
          dot: 'bg-primary',
          ping: 'bg-primary/60',
          defaultText: label || (normalized === 'engaged' ? 'Engaged' : 'Active'),
        };
      case 'requested':
      case 'planned':
      case 'warning':
      case 'paused':
      case 'pending':
      case 'queued':
      case 'initiating':
      case 'ringing':
      case 'follow_up':
      case 'follow-up':
      case 'contacted':
      case 'on_hold':
      case 'on hold':
      case 'standby':
        return {
          bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
          dot: 'bg-amber-500',
          ping: 'bg-amber-400',
          defaultText: label || (normalized === 'contacted' ? 'Contacted' : normalized === 'on_hold' || normalized === 'on hold' ? 'On Hold' : 'Pending'),
        };
      case 'critical':
      case 'error':
      case 'failed':
      case 'busy':
      case 'no-answer':
      case 'rejected':
      case 'lost':
      case 'not_interested':
      case 'do_not_contact':
      case 'bounced':
      case 'gatekeeper_blocked':
      case 'wrong_number':
        return {
          bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
          dot: 'bg-rose-500',
          ping: 'bg-rose-400',
          defaultText: label || (normalized === 'lost' ? 'Lost' : normalized === 'rejected' ? 'Rejected' : 'Failed'),
        };
      case 'not_required':
      case 'not required':
      case 'new':
      case 'draft':
      case 'idle':
      case 'archived':
      case 'completed':
      default:
        return {
          bg: 'bg-muted text-muted-foreground border-border',
          dot: 'bg-muted-foreground',
          ping: 'bg-muted-foreground/60',
          defaultText: label || (normalized === 'new' ? 'New Lead' : normalized === 'not_required' || normalized === 'not required' ? 'Not Required' : status),
        };
    }
  };

  const style = getStyles();
  const isPulsing = pulse || ['ringing', 'initiating', 'running', 'in-progress'].includes(normalized);

  // Same anatomy as TemperatureBadge / Badge: 20px chip, 6px radius, status dot + label.
  const sizeClasses = size === 'sm' ? 'h-5 px-1.5 text-[11px]' : 'h-[22px] px-2 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border font-medium leading-none ${style.bg} ${sizeClasses} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
        {isPulsing && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${style.ping}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${style.dot}`} />
      </span>
      <span>{label || style.defaultText}</span>
    </span>
  );
}
