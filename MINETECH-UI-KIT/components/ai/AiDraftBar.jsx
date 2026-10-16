'use client';

import React, { useState } from 'react';
import { Sparkles, RefreshCw, Check, ArrowRight } from 'lucide-react';
import { Button } from '../buttons/Button';
import { cn } from '../../utils/cn';

export function AiDraftBar({
  onGenerate = () => {},
  onInsert = () => {},
  tones = ['Direct', 'Consultative', 'Urgent', 'Friendly'],
  className = '',
}) {
  const [selectedTone, setSelectedTone] = useState(tones[0]);
  const [loading, setLoading] = useState(false);
  const [draftGenerated, setDraftGenerated] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDraftGenerated(true);
      onGenerate({ tone: selectedTone });
    }, 800);
  };

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-xs', className)}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <span className="font-semibold text-foreground">AI Email Assistant:</span>
        <div className="flex items-center gap-1">
          {tones.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTone(t)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
                selectedTone === t
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={handleGenerate}
          className="h-7 text-xs gap-1.5"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          <span>{loading ? 'Synthesizing...' : 'Draft Response'}</span>
        </Button>

        {draftGenerated && (
          <Button
            size="sm"
            onClick={onInsert}
            className="h-7 text-xs gap-1.5 anim-scale-in"
          >
            <Check className="h-3 w-3" />
            <span>Insert Draft</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export default AiDraftBar;
