'use client';

import React, { useState, useEffect } from 'react';
import { X, Phone, PhoneOff, Mic, MicOff, Clock, User, PhoneCall, CheckCircle } from 'lucide-react';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export default function DialerModal({ initialNumber = '', lead = null, onClose, onCallEnded }) {
  const [phoneNumber, setPhoneNumber] = useState(initialNumber || '');
  const [callState, setCallState] = useState('idle'); // 'idle', 'dialing', 'connected', 'ended'
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [disposition, setDisposition] = useState('Interested');
  const [callSid, setCallSid] = useState(null);

  useEffect(() => {
    let timer;
    if (callState === 'connected') {
      timer = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  const handleKeyPress = (key) => {
    setPhoneNumber((prev) => prev + key);
  };

  const handleStartCall = async () => {
    if (!phoneNumber) return;
    setCallState('dialing');
    try {
      const res = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead?._id || null,
          to: phoneNumber,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setCallSid(json.data?.callSid);
        // Simulate connecting
        setTimeout(() => setCallState('connected'), 2000);
      } else {
        const err = await res.json();
        alert(err.message || 'Call failed');
        setCallState('idle');
      }
    } catch (e) {
      alert('Error initiating call');
      setCallState('idle');
    }
  };

  const handleEndCall = () => {
    setCallState('ended');
    if (onCallEnded) onCallEnded();
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0c1322] border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs text-white">MINETECH Dialer</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display screen */}
        <div className="p-6 text-center bg-slate-950/60 border-b border-slate-800/80 space-y-1">
          {lead && (
            <span className="text-xs font-semibold text-slate-300 block truncate">
              {lead.fullName || lead.firstName} ({lead.company || 'Lead'})
            </span>
          )}
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full text-center bg-transparent text-xl font-mono font-bold text-white tracking-widest focus:outline-none"
          />

          {callState !== 'idle' && (
            <div className="pt-2 flex items-center justify-center gap-2">
              <span className={`w-2 h-2 rounded-full ${callState === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`}></span>
              <span className="text-xs font-mono text-slate-400">
                {callState === 'dialing' && 'Ringing...'}
                {callState === 'connected' && formatTime(duration)}
                {callState === 'ended' && `Call ended (${formatTime(duration)})`}
              </span>
            </div>
          )}
        </div>

        {/* Dial Pad Keys */}
        {callState === 'idle' && (
          <div className="p-6">
            <div className="grid grid-cols-3 gap-3">
              {DIAL_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => handleKeyPress(k)}
                  className="h-12 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-lg font-bold text-slate-200 border border-slate-800 transition active:scale-95 flex items-center justify-center shadow-sm"
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                onClick={handleStartCall}
                disabled={!phoneNumber}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" /> Start Call
              </button>
            </div>
          </div>
        )}

        {/* In-Call Controls */}
        {(callState === 'dialing' || callState === 'connected') && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-4 rounded-full border transition ${
                  isMuted ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={handleEndCall}
                className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Post-Call Disposition Logging */}
        {callState === 'ended' && (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
              <span className="font-bold text-sm text-white">Call Logged ({formatTime(duration)})</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Call Disposition</label>
              <select
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="Interested">Interested / Follow Up</option>
                <option value="Meeting Scheduled">Meeting Scheduled</option>
                <option value="Left Voicemail">Left Voicemail</option>
                <option value="No Answer">No Answer / Busy</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Wrong Number">Wrong Number</option>
              </select>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
