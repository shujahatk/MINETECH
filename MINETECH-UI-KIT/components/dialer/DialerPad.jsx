'use client';

import React, { useState, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  User,
  Clock,
  Zap,
  Radio,
  Delete,
} from 'lucide-react';
import { StatusBadge } from '../feedback/StatusBadge';
import { Button } from '../buttons/Button';
import { formatDuration } from '../../utils/format';
import { cn } from '../../utils/cn';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function DialerPad({
  initialNumber = '',
  contactName = '',
  contactCompany = '',
  onCallStateChange = null,
  onCallEnded = null,
  className = '',
}) {
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);
  const [callState, setCallState] = useState('idle'); // 'idle' | 'initiating' | 'ringing' | 'in-progress' | 'completed'
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Call timer
  useEffect(() => {
    let timer;
    if (callState === 'in-progress') {
      timer = setInterval(() => setDuration((d) => d + 1), 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(timer);
  }, [callState]);

  // Simulate call progression in demo mode
  const startCall = () => {
    if (!phoneNumber) return;
    setCallState('initiating');
    onCallStateChange?.('initiating');

    setTimeout(() => {
      setCallState('ringing');
      onCallStateChange?.('ringing');
    }, 1200);

    setTimeout(() => {
      setCallState('in-progress');
      onCallStateChange?.('in-progress');
    }, 2800);
  };

  const endCall = () => {
    setCallState('completed');
    onCallStateChange?.('completed');
    onCallEnded?.({ duration, phoneNumber });

    setTimeout(() => {
      setCallState('idle');
      onCallStateChange?.('idle');
    }, 1500);
  };

  const handleKeyPress = (key) => {
    if (callState === 'idle') {
      setPhoneNumber((prev) => prev + key);
    }
  };

  const handleDelete = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const isLive = ['initiating', 'ringing', 'in-progress'].includes(callState);

  return (
    <div className={cn('w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-card select-none', className)}>
      {/* Contact Profile or Header */}
      <div className="text-center space-y-1 mb-4">
        {contactName ? (
          <div>
            <h4 className="text-sm font-semibold text-foreground">{contactName}</h4>
            <p className="text-xs text-muted-foreground">{contactCompany}</p>
          </div>
        ) : (
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            MineTech Cloud Dialer
          </span>
        )}

        {/* Call State & Duration */}
        <div className="pt-2 flex items-center justify-center gap-2">
          <StatusBadge status={callState} pulse={isLive} />
          {callState === 'in-progress' && (
            <span className="font-mono text-xs font-semibold text-primary tabular-nums">
              {formatDuration(duration)}
            </span>
          )}
        </div>
      </div>

      {/* Number Display Input */}
      <div className="relative mb-5">
        <input
          type="text"
          value={phoneNumber}
          readOnly={isLive}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+1 (555) 000-0000"
          className="w-full text-center font-mono text-lg font-semibold tracking-wider bg-muted/40 border border-border rounded-xl py-2 px-8 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {phoneNumber && !isLive && (
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Delete character"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
          >
            <Delete className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* DTMF Keypad Grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {DIAL_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKeyPress(key)}
            className="h-11 rounded-xl border border-border bg-card hover:bg-muted/70 text-foreground font-mono text-base font-semibold transition-all duration-100 active:scale-95 shadow-subtle flex items-center justify-center cursor-pointer"
          >
            {key}
          </button>
        ))}
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-center gap-3">
        {isLive ? (
          <>
            <Button
              type="button"
              variant={isMuted ? 'destructive' : 'outline'}
              size="icon"
              className="h-11 w-11 rounded-full cursor-pointer"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 px-6 rounded-full font-semibold gap-2 shadow-card cursor-pointer"
              onClick={endCall}
            >
              <PhoneOff className="h-4 w-4" />
              <span>End Call</span>
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="default"
            disabled={!phoneNumber}
            className="h-12 w-full rounded-xl font-semibold gap-2 text-sm shadow-card cursor-pointer"
            onClick={startCall}
          >
            <Phone className="h-4 w-4" />
            <span>Start Call</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export default DialerPad;
