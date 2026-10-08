'use client';
import { ModalFrame } from '@/components/ui/modal-frame';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  User,
  PhoneCall,
  CheckCircle,
  Zap,
  Activity,
  ShieldAlert,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export default function DialerModal({ initialNumber = '', lead = null, onClose, onCallEnded }) {
  const [phoneNumber, setPhoneNumber] = useState(initialNumber || '');
  const [callState, setCallState] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [disposition, setDisposition] = useState('Connected');
  const [callSid, setCallSid] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEndingCall, setIsEndingCall] = useState(false);
  const pollIntervalRef = useRef(null);

  // Real duration timer — active ONLY when Twilio status is actually 'in-progress'
  useEffect(() => {
    let timer;
    if (callState === 'in-progress') {
      timer = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  // Server-driven status polling for real Twilio call lifecycle
  useEffect(() => {
    const isLiveState = ['queued', 'initiating', 'ringing', 'in-progress'].includes(callState);

    if (callSid && isLiveState) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/twilio/calls?callSid=${encodeURIComponent(callSid)}`);
          if (!res.ok) return;
          const json = await res.json();
          if (json.success && json.data) {
            const rawStatus = (json.data.status || '').toLowerCase();
            mapServerStatusToCallState(rawStatus, json.data.duration);
          }
        } catch (pollErr) {
          console.warn('[DialerModal Poll Error]:', pollErr.message);
        }
      }, 1500);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [callSid, callState]);

  const mapServerStatusToCallState = (rawStatus, serverDuration) => {
    switch (rawStatus) {
      case 'queued':
        setCallState('queued');
        break;
      case 'initiated':
      case 'initiating':
        setCallState('initiating');
        break;
      case 'ringing':
        setCallState('ringing');
        break;
      case 'in-progress':
        setCallState('in-progress');
        if (serverDuration) setDuration(Number(serverDuration));
        break;
      case 'completed':
        setCallState('completed');
        if (serverDuration) setDuration(Number(serverDuration));
        if (onCallEnded) onCallEnded();
        break;
      case 'busy':
        setCallState('busy');
        setErrorMessage('Line is busy');
        break;
      case 'no-answer':
        setCallState('no-answer');
        setErrorMessage('No answer from prospect');
        break;
      case 'canceled':
      case 'cancelled':
        setCallState('cancelled');
        break;
      case 'failed':
        setCallState('failed');
        setErrorMessage('Twilio call failed to connect');
        break;
      default:
        break;
    }
  };

  const handleKeyPress = (key) => {
    setPhoneNumber((prev) => prev + key);
  };

  const handleStartCall = async () => {
    if (!phoneNumber) return;
    setCallState('initiating');
    setErrorMessage('');
    setDuration(0);

    try {
      const res = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead?._id || lead?.id || null,
          to: phoneNumber,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const sid = json.data?.call_sid || json.data?.callSid;
        setCallSid(sid);
        const initialStatus = (json.data?.status || 'queued').toLowerCase();
        mapServerStatusToCallState(initialStatus, 0);
      } else {
        const errText = json.error || json.message || 'Call failed to initiate';
        setErrorMessage(errText);
        setCallState('failed');
      }
    } catch (e) {
      setErrorMessage(e.message || 'Error initiating call');
      setCallState('failed');
    }
  };

  const handleEndCall = async () => {
    if (!callSid) {
      setCallState('completed');
      if (onCallEnded) onCallEnded();
      return;
    }

    setIsEndingCall(true);
    try {
      const res = await fetch('/api/twilio/call/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setCallState('completed');
        if (onCallEnded) onCallEnded();
      } else {
        const errMsg = json.error || 'Failed to terminate call with Twilio';
        setErrorMessage(errMsg);
        setCallState('failed');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error terminating call');
      setCallState('failed');
    } finally {
      setIsEndingCall(false);
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (callState) {
      case 'queued':
        return (
          <span className="tone-warning border px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse font-mono text-xs">
            <Radio className="h-3 w-3" /> Queued in Twilio...
          </span>
        );
      case 'initiating':
        return (
          <span className="tone-warning border px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse font-mono text-xs">
            <Activity className="h-3 w-3" /> Initiating Trunk...
          </span>
        );
      case 'ringing':
        return (
          <span className="border border-primary/30 bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse font-mono text-xs">
            <PhoneCall className="h-3 w-3 text-primary" /> Ringing Prospect...
          </span>
        );
      case 'in-progress':
        return (
          <span className="border border-primary/30 bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono text-xs">
            <Zap className="h-3 w-3 text-primary" /> Connected ({formatTime(duration)})
          </span>
        );
      case 'completed':
        return (
          <span className="border border-border bg-muted text-foreground px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono text-xs">
            <CheckCircle className="h-3 w-3 text-primary" /> Call Completed ({formatTime(duration)})
          </span>
        );
      case 'busy':
        return (
          <span className="border border-destructive/30 bg-destructive/10 text-destructive px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono text-xs">
            <AlertCircle className="h-3 w-3" /> Busy
          </span>
        );
      case 'no-answer':
        return (
          <span className="border border-destructive/30 bg-destructive/10 text-destructive px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono text-xs">
            <Clock className="h-3 w-3" /> No Answer
          </span>
        );
      case 'cancelled':
        return (
          <span className="border border-border bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono text-xs">
            Cancelled
          </span>
        );
      case 'failed':
        return (
          <span className="border border-destructive/30 bg-destructive/10 text-destructive px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono text-xs">
            <ShieldAlert className="h-3 w-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="border border-border bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full font-mono text-xs">
            Ready to Dial
          </span>
        );
    }
  };

  const isLive = ['queued', 'initiating', 'ringing', 'in-progress'].includes(callState);

  return (
    <ModalFrame title="Dial pad" onClose={onClose}>
      <div className="bg-card border border-border shadow-dialog rounded-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-foreground">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
              <PhoneCall className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Outbound Phone Dialer</h3>
              <p className="text-[11px] text-muted-foreground font-mono">Twilio Direct Telephony</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Lead Context */}
        {lead && (
          <div className="px-4 py-2.5 bg-muted/20 border-b border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="truncate">
                <span className="font-bold text-foreground">{lead.fullName || lead.firstName || 'Prospect'}</span>
                {lead.company && <span className="text-muted-foreground"> • {lead.company}</span>}
              </div>
            </div>
            {lead.status && (
              <span className="px-2 py-0.5 rounded-md bg-card border border-border text-foreground text-[10px] font-semibold uppercase shrink-0">
                {lead.status.replace('_', ' ')}
              </span>
            )}
          </div>
        )}

        {/* Status Bar */}
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusBadge()}
          </div>
          {callState === 'in-progress' && (
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-primary">
              <Clock className="h-3.5 w-3.5 animate-pulse" />
              {formatTime(duration)}
            </div>
          )}
        </div>

        {/* Error Display */}
        {errorMessage && (
          <div className="p-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Dialpad Display & Controls */}
        <div className="p-6 flex flex-col items-center flex-1 bg-card">
          <div className="w-full mb-5">
            <Input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={isLive}
              placeholder="+1 (555) 000-0000"
              className="h-12 text-center text-xl font-mono tracking-wider font-bold bg-muted/40 border-border text-foreground rounded-xl"
            />
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] mb-6">
            {DIAL_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                disabled={isLive}
                className="h-12 text-lg font-bold rounded-xl bg-muted/40 hover:bg-muted text-foreground border border-border active:scale-95 transition-all shadow-subtle disabled:opacity-40"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Call Action Bar */}
          <div className="flex items-center justify-center gap-4 w-full">
            {isLive ? (
              <>
                <Button
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`h-12 w-12 rounded-full ${isMuted ? 'bg-amber-500 hover:bg-amber-400 text-white' : 'bg-muted hover:bg-muted/80 text-foreground border border-border'}`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  size="icon"
                  onClick={handleEndCall}
                  disabled={isEndingCall}
                  className="h-12 w-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-md animate-pulse"
                  title="End Call"
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <Button
                onClick={handleStartCall}
                disabled={!phoneNumber}
                className="w-full max-w-[260px] h-11 text-sm gap-2 active:scale-98"
              >
                <Phone className="h-4 w-4" /> Start Outbound Call
              </Button>
            )}
          </div>
        </div>

        {/* Post-Call Disposition Bar */}
        {callState === 'completed' && (
          <div className="p-3.5 bg-muted/30 border-t border-border flex items-center justify-between gap-3">
            <select
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
              className="flex-1 h-9 rounded-xl bg-card border border-border px-3 text-xs text-foreground focus:outline-none focus:border-primary font-medium"
            >
              <option value="Connected">Connected / Pitched</option>
              <option value="Meeting Booked">Meeting Booked</option>
              <option value="Follow-Up Scheduled">Follow-Up Scheduled</option>
              <option value="Voicemail">Left Voicemail</option>
              <option value="Gatekeeper Blocked">Gatekeeper Blocked</option>
              <option value="Wrong Number / DNC">Wrong Number / Add to DNC</option>
            </select>
            <Button
              size="sm"
              onClick={() => {
                setCallState('idle');
                setDuration(0);
                setCallSid(null);
              }}
              className="h-9 px-4"
            >
              Log & Reset
            </Button>
          </div>
        )}
      </div>
    </ModalFrame>
  );
}
