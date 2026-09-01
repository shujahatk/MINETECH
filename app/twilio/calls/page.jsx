'use client';

import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, Clock, User, CheckCircle2, Play } from 'lucide-react';
import DialerModal from '@/components/twilio/DialerModal';

export default function VoiceCallsPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialerOpen, setIsDialerOpen] = useState(false);

  const fetchCalls = async () => {
    try {
      const res = await fetch('/api/twilio/calls');
      if (res.ok) {
        const j = await res.json();
        setCalls(j.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Phone className="w-6 h-6 text-emerald-400" /> Twilio Voice Calling
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Browser calling logs, call recording recordings, and duration telemetry.
          </p>
        </div>

        <button
          onClick={() => setIsDialerOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition"
        >
          <PhoneCall className="w-4 h-4" /> Open Dialer Pad
        </button>
      </div>

      {/* Calls Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Prospect</th>
                <th className="py-3 px-4">To Phone</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Recording</th>
                <th className="py-3 px-4">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Loading call history...
                  </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No calls recorded yet. Open the dialer pad to place your first call.
                  </td>
                </tr>
              ) : (
                calls.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      {c.leadId?.fullName || c.leadId?.company || 'Direct Dial'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{c.to}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                          c.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{c.duration || 0}s</td>
                    <td className="py-3.5 px-4">
                      {c.recordingUrl ? (
                        <audio controls className="h-6 w-36" src={c.recordingUrl}></audio>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(c.startTime || c.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isDialerOpen && <DialerModal onClose={() => setIsDialerOpen(false)} onCallEnded={fetchCalls} />}
    </div>
  );
}
