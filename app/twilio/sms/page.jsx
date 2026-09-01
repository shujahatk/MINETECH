'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, User, Search, CheckCircle } from 'lucide-react';

export default function SMSPage() {
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [toPhone, setToPhone] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('/api/leads?limit=50')
      .then((r) => r.json())
      .then((j) => {
        const withPhone = (j.leads || []).filter((l) => l.phone);
        setLeads(withPhone);
        if (withPhone.length > 0) {
          setSelectedLead(withPhone[0]);
          setToPhone(withPhone[0].phone);
        }
      });
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!toPhone || !body.trim()) return;

    setSending(true);
    try {
      const res = await fetch('/api/twilio/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead?._id || null,
          to: toPhone,
          body,
        }),
      });

      if (res.ok) {
        setHistory((prev) => [
          { to: toPhone, body, time: new Date().toLocaleTimeString(), direction: 'outbound' },
          ...prev,
        ]);
        setBody('');
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to send SMS');
      }
    } catch (e) {
      alert('Error sending SMS');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-sky-400" /> Twilio SMS & WhatsApp
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Direct two-way prospect messaging and notifications.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Lead select */}
        <div className="md:col-span-4 glass-panel rounded-2xl p-4 space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Leads with Phone</span>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {leads.map((l) => (
              <div
                key={l._id}
                onClick={() => {
                  setSelectedLead(l);
                  setToPhone(l.phone);
                }}
                className={`p-3 rounded-xl cursor-pointer transition ${
                  selectedLead?._id === l._id ? 'bg-sky-600/20 border border-sky-500/40 text-white' : 'glass-card text-slate-300'
                }`}
              >
                <span className="font-semibold text-xs block">{l.fullName || l.email}</span>
                <span className="text-[11px] text-slate-400 font-mono block">{l.phone}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: SMS Composer & history */}
        <div className="md:col-span-8 glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Destination Phone (E.164)</label>
              <input
                type="text"
                required
                value={toPhone}
                onChange={(e) => setToPhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">SMS Body</label>
              <textarea
                rows={4}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type SMS message..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-sky-500"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/20"
            >
              <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send SMS'}
            </button>
          </form>

          {/* Local Session History */}
          {history.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 block">Sent in this session:</span>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>To: {h.to}</span>
                      <span>{h.time}</span>
                    </div>
                    <p className="text-slate-200">{h.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
