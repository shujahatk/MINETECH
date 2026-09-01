'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  MessageSquare,
  Building,
  Briefcase,
  Globe,
  Tag,
  Calendar,
  Clock,
  Send,
  FileText,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Flame,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import ComposeModal from '@/components/email/ComposeModal';
import DialerModal from '@/components/twilio/DialerModal';

export default function LeadDrawer({ leadId, onClose, onUpdated }) {
  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline', 'notes', 'edit'
  const [noteText, setNoteText] = useState('');
  const [status, setStatus] = useState('NEW');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [smsBody, setSmsBody] = useState('');
  const [sendingSms, setSendingSms] = useState(false);

  const fetchLeadData = async () => {
    try {
      const [leadRes, timeRes] = await Promise.all([
        fetch(`/api/leads/${leadId}`),
        fetch(`/api/leads/${leadId}/timeline`),
      ]);

      if (leadRes.ok) {
        const leadJson = await leadRes.json();
        setLead(leadJson.data);
        setStatus(leadJson.data.status || 'NEW');
        setNoteText(leadJson.data.notes || '');
        if (leadJson.data.nextFollowUpAt) {
          setNextFollowUpAt(new Date(leadJson.data.nextFollowUpAt).toISOString().split('T')[0]);
        }
      }

      if (timeRes.ok) {
        const timeJson = await timeRes.json();
        setTimeline(timeJson.data || []);
      }
    } catch (err) {
      console.error('Error fetching lead data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leadId) {
      fetchLeadData();
    }
  }, [leadId]);

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchLeadData();
      if (onUpdated) onUpdated();
    } catch (err) {}
  };

  const handleSaveNotesAndFollowUp = async () => {
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: noteText,
          nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
        }),
      });
      fetchLeadData();
      if (onUpdated) onUpdated();
      alert('Lead details updated');
    } catch (err) {}
  };

  const handleSendQuickSMS = async () => {
    if (!smsBody.trim() || !lead?.phone) return;
    setSendingSms(true);
    try {
      const res = await fetch('/api/twilio/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead._id,
          to: lead.phone,
          body: smsBody,
        }),
      });
      if (res.ok) {
        setSmsBody('');
        fetchLeadData();
        if (onUpdated) onUpdated();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to send SMS');
      }
    } catch (e) {
      alert('Error sending SMS');
    } finally {
      setSendingSms(false);
    }
  };

  const handleToggleSuppression = async (channel) => {
    if (!lead) return;
    const current = lead.suppression?.[channel] || false;
    const newSuppression = {
      ...lead.suppression,
      [channel]: !current,
      suppressedAt: !current ? new Date() : null,
    };
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suppression: newSuppression }),
      });
      fetchLeadData();
      if (onUpdated) onUpdated();
    } catch (err) {}
  };

  if (!lead && loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 z-50 p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-[#0d1424] border-l border-slate-800/80 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-900/60 flex items-start justify-between">
        <div className="min-w-0 pr-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white truncate">{lead.fullName || lead.email}</h2>
            <span className={`px-2.5 py-0.5 text-xs rounded-full uppercase font-bold badge-${status.toLowerCase()}`}>
              {status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400">
            {lead.jobTitle && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-500" /> {lead.jobTitle}
              </span>
            )}
            {lead.company && (
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-500" /> {lead.company}
              </span>
            )}
            {lead.website && (
              <a
                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-indigo-400 hover:underline"
              >
                <Globe className="w-3.5 h-3.5" /> Website
              </a>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Channel Escalation Action Bar */}
      <div className="p-4 bg-slate-900/40 border-b border-slate-800 flex items-center gap-2">
        <button
          onClick={() => setIsComposeOpen(true)}
          disabled={lead.suppression?.email || !lead.email}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20"
        >
          <Mail className="w-4 h-4" /> Send Email
        </button>
        <button
          onClick={() => setIsDialerOpen(true)}
          disabled={lead.suppression?.phone || !lead.phone}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20"
        >
          <Phone className="w-4 h-4" /> Call Lead
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          disabled={lead.suppression?.sms || !lead.phone}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-sky-600/20"
        >
          <MessageSquare className="w-4 h-4" /> Quick SMS
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 border-b border-slate-800 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`py-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'timeline'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Unified Timeline ({timeline.length})
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={`py-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'details'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Lead Details & Notes
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={`py-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'sms'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Send SMS
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Communication History</h3>
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No communication logged yet for this lead.</p>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
                {timeline.map((item) => (
                  <div key={item.id} className="relative flex items-start gap-3 pl-1">
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 z-10">
                      {item.channel === 'email' && <Mail className="w-3.5 h-3.5 text-indigo-400" />}
                      {item.channel === 'call' && <Phone className="w-3.5 h-3.5 text-emerald-400" />}
                      {item.channel === 'sms' && <MessageSquare className="w-3.5 h-3.5 text-sky-400" />}
                      {item.channel === 'system' && <CheckCircle className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                    <div className="flex-1 glass-card p-3 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-200">{item.summary}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(item.timestamp).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {item.details?.snippet && (
                        <p className="text-xs text-slate-400 mt-1 italic">"{item.details.snippet}"</p>
                      )}
                      {item.details?.recordingUrl && (
                        <audio controls className="w-full mt-2 h-7" src={item.details.recordingUrl}></audio>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-5">
            {/* Status & Follow-up selector */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Lifecycle Status</label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="ENGAGED">ENGAGED</option>
                  <option value="INTERESTED">INTERESTED</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                  <option value="CUSTOMER">CUSTOMER</option>
                  <option value="FOLLOW_UP">FOLLOW_UP</option>
                  <option value="NO_RESPONSE">NO_RESPONSE</option>
                  <option value="NOT_INTERESTED">NOT_INTERESTED</option>
                  <option value="DO_NOT_CONTACT">DO_NOT_CONTACT</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Next Follow-Up Date</label>
                <input
                  type="date"
                  value={nextFollowUpAt}
                  onChange={(e) => setNextFollowUpAt(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Suppression toggles */}
            <div className="p-4 rounded-xl glass-card">
              <span className="text-xs font-bold text-slate-300 block mb-2">Communication Suppression / DNC</span>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(lead.suppression?.email)}
                    onChange={() => handleToggleSuppression('email')}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Suppress Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(lead.suppression?.phone)}
                    onChange={() => handleToggleSuppression('phone')}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Suppress Calls</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(lead.suppression?.sms)}
                    onChange={() => handleToggleSuppression('sms')}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Suppress SMS</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Notes & Research</label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={5}
                placeholder="Log notes about prospect pain points, qualification criteria, and conversation summaries..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              ></textarea>
            </div>

            <button
              onClick={handleSaveNotesAndFollowUp}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
            >
              Save Details
            </button>
          </div>
        )}

        {activeTab === 'sms' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Send Quick SMS via Twilio</h3>
            <div>
              <label className="text-xs text-slate-400 block mb-1">To Phone</label>
              <input
                type="text"
                disabled
                value={lead.phone || 'No phone number on record'}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Message Text</label>
              <textarea
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                rows={4}
                placeholder={`Hi ${lead.firstName || 'there'}, following up regarding...`}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              ></textarea>
            </div>
            <button
              onClick={handleSendQuickSMS}
              disabled={sendingSms || !smsBody.trim() || !lead.phone}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> {sendingSms ? 'Sending...' : 'Send SMS Now'}
            </button>
          </div>
        )}
      </div>

      {/* Action Modals */}
      {isComposeOpen && (
        <ComposeModal
          lead={lead}
          onClose={() => setIsComposeOpen(false)}
          onSent={() => {
            fetchLeadData();
            if (onUpdated) onUpdated();
          }}
        />
      )}

      {isDialerOpen && (
        <DialerModal
          initialNumber={lead.phone}
          lead={lead}
          onClose={() => setIsDialerOpen(false)}
          onCallEnded={() => {
            fetchLeadData();
            if (onUpdated) onUpdated();
          }}
        />
      )}
    </div>
  );
}
