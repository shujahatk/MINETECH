import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware/authGuard';
import { transformFromDb } from '@/lib/supabaseAdapter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const search = searchParams.get('search') || '';

    // 1. Build Base Supabase Query for Threads
    let query = supabaseAdmin
      .from('email_threads')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (filter === 'archived') {
      query = query.or('status.eq.ARCHIVED,status.eq.archived');
    } else {
      query = query.not('status', 'in', '("ARCHIVED","archived")');
    }

    if (filter === 'unread') {
      query = query.or('unread_count.gt.0,unread.eq.true');
    }

    const { data: rawThreads, error: threadsErr } = await query.limit(100);
    if (threadsErr) {
      console.warn('[Inbox API] Query error on email_threads:', threadsErr.message);
    }

    let threads = (rawThreads || []).map(transformFromDb);

    // 2. Fetch Lead Records, Messages, and Blast Tags in Parallel
    const leadIds = [...new Set(threads.map((t) => t.lead_id || t.leadId).filter(Boolean))];
    const threadIds = threads.map((t) => t.id);

    const [leadsRes, threadMsgsRes, blastRecipientsRes, blastLogsRes, unreadCountRes] = await Promise.all([
      leadIds.length > 0
        ? supabaseAdmin.from('leads').select('id, first_name, last_name, full_name, email, phone, company, job_title, status, is_dnc').in('id', leadIds)
        : Promise.resolve({ data: [] }),
      threadIds.length > 0
        ? supabaseAdmin.from('email_messages').select('thread_id, direction, subject').in('thread_id', threadIds)
        : Promise.resolve({ data: [] }),
      leadIds.length > 0
        ? supabaseAdmin.from('email_recipients').select('lead_id, email, status').in('lead_id', leadIds).eq('status', 'SENT')
        : Promise.resolve({ data: [] }),
      leadIds.length > 0
        ? supabaseAdmin.from('activity_logs').select('lead_id, metadata, type').in('lead_id', leadIds).eq('type', 'BLAST_EMAIL_SENT')
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from('email_threads')
        .select('id', { count: 'exact', head: true })
        .or('unread_count.gt.0,unread.eq.true'),
    ]);

    let leadsMap = {};
    (leadsRes?.data || []).forEach((l) => {
      leadsMap[l.id] = transformFromDb(l);
    });

    let inboundThreadIds = new Set();
    let outboundThreadIds = new Set();
    (threadMsgsRes?.data || []).forEach((m) => {
      if (m.direction === 'inbound') inboundThreadIds.add(m.thread_id);
      if (m.direction === 'outbound') outboundThreadIds.add(m.thread_id);
    });

    let blastLeadIds = new Set();
    let blastThreadIds = new Set();
    (blastRecipientsRes?.data || []).forEach((r) => {
      if (r.lead_id) blastLeadIds.add(r.lead_id);
    });
    (blastLogsRes?.data || []).forEach((l) => {
      if (l.metadata?.threadId) blastThreadIds.add(l.metadata.threadId);
      if (l.lead_id) blastLeadIds.add(l.lead_id);
    });

    // Attach populated leadId and direction / dispatch source metadata to each thread
    threads = threads.map((t) => {
      const targetLeadId = t.lead_id || t.leadId;
      const populatedLead = targetLeadId ? leadsMap[targetLeadId] : null;

      const isBlast =
        blastThreadIds.has(t.id) ||
        (targetLeadId && blastLeadIds.has(targetLeadId)) ||
        (t.subject && (t.subject.toLowerCase().includes('blast') || t.subject.toLowerCase().includes('pipeline')));

      const hasInbound = inboundThreadIds.has(t.id);
      const hasOutbound = outboundThreadIds.has(t.id);

      return {
        ...t,
        leadId: populatedLead || {
          id: targetLeadId || t.id,
          _id: targetLeadId || t.id,
          fullName: 'Prospect Contact',
          email: 'prospect@example.com',
        },
        isBlast,
        isIndividual: !isBlast,
        hasInbound,
        hasOutbound,
        dispatchType: isBlast ? 'blast' : 'individual',
      };
    });

    // 3. Compute Granular Counts for All Filter Tabs
    const allThreads = threads;
    const repliesCount = allThreads.filter((t) => t.hasInbound || t.unreadCount > 0 || t.unread).length;
    const blastCount = allThreads.filter((t) => t.isBlast).length;
    const individualCount = allThreads.filter((t) => t.isIndividual).length;

    // 4. Apply Additional Category Filters
    if (filter === 'replies') {
      threads = threads.filter((t) => t.hasInbound || t.unreadCount > 0 || t.unread);
    } else if (filter === 'outbound' || filter === 'blast') {
      threads = threads.filter((t) => t.isBlast);
    } else if (filter === 'individual') {
      threads = threads.filter((t) => t.isIndividual);
    }

    // 5. In-Memory Search Filtering if Specified
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      threads = threads.filter((t) => {
        const lead = t.leadId || {};
        const name = (lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`).toLowerCase();
        const company = (lead.company || '').toLowerCase();
        const email = (lead.email || '').toLowerCase();
        const subject = (t.subject || '').toLowerCase();
        const snippet = (t.snippet || '').toLowerCase();
        return name.includes(q) || company.includes(q) || email.includes(q) || subject.includes(q) || snippet.includes(q);
      });
    }

    const unreadCount = unreadCountRes?.count || 0;

    return NextResponse.json(
      {
        success: true,
        data: threads,
        counts: {
          unread: unreadCount || 0,
          total: allThreads.length,
          replies: repliesCount,
          outbound: blastCount,
          blast: blastCount,
          individual: individualCount,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err) {
    console.error('[Email Inbox API] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
