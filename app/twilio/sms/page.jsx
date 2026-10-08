'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Search, CheckCircle, Sparkles, Building, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function SMSPage() {
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [toPhone, setToPhone] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/leads?limit=100')
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
    if (e) e.preventDefault();
    if (!toPhone || !body.trim()) return;

    setSending(true);
    try {
      const res = await fetch('/api/twilio/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead?._id || selectedLead?.id || null,
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
      alert('Error sending SMS: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const filteredLeads = leads.filter((l) => {
    const q = search.toLowerCase();
    return (
      (l.fullName || l.name || '').toLowerCase().includes(q) ||
      (l.company || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q)
    );
  });

  const segmentCount = Math.ceil((body.length || 1) / 160);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-border bg-card">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground tracking-tight">Twilio SMS Messenger</h1>
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                DIRECT CARRIER DISPATCH
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Two-way text messaging, real-time message delivery, and prospect notifications.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Contact Roster */}
        <Card className="md:col-span-4 p-4 space-y-3 shadow-subtle h-fit border-border bg-card">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone contacts..."
              className="pl-8 h-8 text-xs bg-muted/30 border-border rounded-xl text-foreground"
            />
          </div>

          <div className="space-y-1 max-h-[500px] overflow-y-auto divide-y divide-border">
            {filteredLeads.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No leads with phone numbers found.
              </div>
            ) : (
              filteredLeads.map((l) => {
                const isSelected = selectedLead?._id === l._id || selectedLead?.id === l.id;
                return (
                  <div
                    key={l._id || l.id}
                    onClick={() => {
                      setSelectedLead(l);
                      setToPhone(l.phone);
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-primary/10 border border-primary/40 text-foreground shadow-subtle'
                        : 'hover:bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs truncate text-foreground">{l.fullName || l.name || 'Prospect'}</span>
                      {l.company && <span className="text-[10px] text-muted-foreground font-medium truncate">{l.company}</span>}
                    </div>
                    <span className="text-[11px] text-primary font-mono block mt-0.5">{l.phone}</span>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Right: SMS Composer & Thread */}
        <Card className="md:col-span-8 p-6 flex flex-col justify-between space-y-6 shadow-subtle border-border bg-card">
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Destination Phone (E.164 Format)
              </label>
              <Input
                type="text"
                required
                value={toPhone}
                onChange={(e) => setToPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="bg-muted/30 border-border font-mono text-sm font-semibold rounded-xl text-foreground"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">SMS Message Body</label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {body.length} chars • {segmentCount} Segment(s)
                </span>
              </div>
              <Textarea
                rows={4}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type SMS message..."
                className="bg-muted/30 border-border text-xs leading-relaxed rounded-xl text-foreground"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted-foreground font-mono">Twilio carrier verified dispatch</span>
              <Button
                type="submit"
                disabled={sending || !body.trim() || !toPhone}
                className="gap-2 h-9 px-5"
              >
                <Send className="h-3.5 w-3.5" /> {sending ? 'Transmitting...' : 'Send SMS Dispatch'}
              </Button>
            </div>
          </form>

          {/* Session History Stream */}
          {history.length > 0 && (
            <div className="pt-4 border-t border-border space-y-2">
              <span className="text-xs font-bold text-muted-foreground block font-mono">SENT IN THIS SESSION:</span>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono mb-1">
                      <span className="text-primary font-semibold">To: {h.to}</span>
                      <span>{h.time}</span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">{h.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
