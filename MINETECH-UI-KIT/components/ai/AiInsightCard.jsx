'use client';

import React from 'react';
import { Sparkles, BrainCircuit, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '../feedback/Badge';
import { Button } from '../buttons/Button';
import { cn } from '../../utils/cn';

export function AiInsightCard({
  title = 'AI Prospect Intelligence',
  fitScore = 94,
  priority = 'HOT',
  summary = 'High-probability conversion detected based on industrial purchasing triggers and expansion announcements.',
  reasons = [
    'Recent procurement quota update aligns with Bentonite volume pricing.',
    'Technical specifications match lab batch BT-409.',
    'Decision-maker is active during afternoon business hours.',
  ],
  recommendedAction = 'Send commercial proposal with custom bulk pricing tier',
  onApplyAction = null,
  className = '',
}) {
  return (
    <div className={cn('panel border-primary/30 bg-gradient-to-br from-card via-card to-primary/[0.04] space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BrainCircuit className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">{title}</h4>
            <span className="text-[10px] text-muted-foreground">Powered by MINE-TECH AI</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge variant={priority === 'HOT' ? 'destructive' : 'warning'}>
            {priority} PRIORITY
          </Badge>
          <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md tabular-nums">
            <Sparkles className="h-3 w-3" /> {fitScore}/100
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-xs leading-relaxed text-foreground/90 font-medium">{summary}</p>

      {/* Reasoning Bullets */}
      {reasons && reasons.length > 0 && (
        <div className="space-y-1.5">
          <span className="field-label text-[10px]">Key Intelligence Factors</span>
          <ul className="space-y-1">
            {reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span className="leading-snug">{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation Action Button */}
      {recommendedAction && (
        <div className="pt-2 border-t border-border/70 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="field-label text-[10px] block">Recommended Action</span>
            <span className="text-xs font-semibold text-foreground truncate block">{recommendedAction}</span>
          </div>
          {onApplyAction && (
            <Button size="sm" onClick={onApplyAction} className="shrink-0 gap-1.5 text-xs cursor-pointer">
              <span>Execute</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default AiInsightCard;
