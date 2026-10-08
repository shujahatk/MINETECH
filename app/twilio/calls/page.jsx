'use client';

import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import StatusBadge from '@/components/ui/StatusBadge';
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
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-border bg-card">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground tracking-tight">Call History & Voice Telephony</h1>
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                TWILIO WEBRTC
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Direct browser dialing, recorded calls, call duration, and prospect contact history.
            </p>
          </div>
        </div>

        <Button
          onClick={() => setIsDialerOpen(true)}
          className="gap-2 h-9 px-4 shrink-0"
        >
          <PhoneCall className="h-4 w-4" /> Open Dialer Pad
        </Button>
      </Card>

      {/* Calls Table */}
      <Card className="p-0 overflow-hidden shadow-subtle border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs font-bold text-muted-foreground">Prospect & Target</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground">Destination Phone</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground">Duration</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground">Call Recording</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border bg-card">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-12 text-center text-muted-foreground font-mono">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading call history...
                  </TableCell>
                </TableRow>
              ) : calls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-12 text-center text-xs text-muted-foreground">
                    No calls recorded yet. Click &quot;Open Dialer Pad&quot; to place your first call.
                  </TableCell>
                </TableRow>
              ) : (
                calls.map((c) => (
                  <TableRow key={c._id || c.id} className="hover:bg-muted/40 border-border transition-colors">
                    <TableCell className="font-bold text-foreground py-3 text-xs">
                      {c.leadId?.fullName || c.leadId?.company || 'Direct Dial Prospect'}
                    </TableCell>
                    <TableCell className="font-mono text-primary text-xs py-3 font-medium">{c.to}</TableCell>
                    <TableCell className="py-3">
                      <StatusBadge status={c.status} size="sm" />
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground font-medium py-3 text-xs">{c.duration || 0}s</TableCell>
                    <TableCell className="py-3">
                      {c.recordingUrl ? (
                        <div className="flex items-center gap-2">
                          <audio controls className="h-7 w-40 opacity-90" src={c.recordingUrl} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs font-mono">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono py-3">
                      {new Date(c.startTime || c.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {isDialerOpen && <DialerModal onClose={() => setIsDialerOpen(false)} onCallEnded={fetchCalls} />}
    </div>
  );
}
