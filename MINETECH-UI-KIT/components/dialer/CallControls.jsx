'use client';

import React, { useState } from 'react';
import { Check, Clock, Save, UserCheck, Flame, Ban, HelpCircle } from 'lucide-react';
import { Button } from '../buttons/Button';
import { Textarea } from '../forms/Textarea';
import { cn } from '../../utils/cn';

export const DISPOSITION_OPTIONS = [
  { key: '1', label: 'Replied / Interested', value: 'REPLIED_INTERESTED', hotkey: '1', icon: Flame },
  { key: '2', label: 'Meeting Booked', value: 'MEETING_BOOKED', hotkey: '2', icon: UserCheck },
  { key: '3', label: 'No Response / Voicemail', value: 'NO_RESPONSE', hotkey: '3', icon: Clock },
  { key: '4', label: 'Follow-up Needed', value: 'FOLLOW_UP', hotkey: '4', icon: HelpCircle },
  { key: '5', label: 'Not Interested', value: 'NOT_INTERESTED', hotkey: '5', icon: Ban },
  { key: '6', label: 'Do Not Contact', value: 'DO_NOT_CONTACT', hotkey: '6', icon: Ban },
];

export function CallControls({
  onSaveDisposition = () => {},
  className = '',
}) {
  const [selectedDisposition, setSelectedDisposition] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDisposition) return;
    onSaveDisposition({ disposition: selectedDisposition, notes });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('panel space-y-4', className)}>
      <div>
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
          Call Disposition
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {DISPOSITION_OPTIONS.map((opt) => {
            const isSelected = selectedDisposition === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelectedDisposition(opt.value)}
                className={cn(
                  'flex items-center justify-between p-2 rounded-lg border text-xs font-medium transition-all duration-100 cursor-pointer text-left',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-border bg-card text-foreground hover:bg-muted/60'
                )}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{opt.label}</span>
                </div>
                <kbd className="kbd shrink-0 ml-1">
                  {opt.hotkey}
                </kbd>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="field-label">Call Notes & Next Steps</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter prospect feedback, objections, or commitments made..."
          rows={3}
        />
      </div>

      <Button
        type="submit"
        disabled={!selectedDisposition}
        className="w-full gap-2 cursor-pointer"
      >
        {isSaved ? (
          <>
            <Check className="h-4 w-4" />
            <span>Disposition Saved</span>
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            <span>Save & Next Lead</span>
          </>
        )}
      </Button>
    </form>
  );
}

export default CallControls;
