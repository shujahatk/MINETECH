import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Cheap unread-thread counter for the sidebar badge.
 * One head-only COUNT query — replaces polling the full inbox route (100 threads + 4 joins) every 45s.
 */
export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    let { count, error } = await supabaseAdmin
      .from('email_threads')
      .select('id', { count: 'exact', head: true })
      .or('unread_count.gt.0,unread.eq.true');

    if (error) {
      // Schema without the legacy `unread` boolean column.
      ({ count, error } = await supabaseAdmin
        .from('email_threads')
        .select('id', { count: 'exact', head: true })
        .gt('unread_count', 0));
    }
    if (error) throw error;

    return NextResponse.json(
      { success: true, unreadCount: count || 0 },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json({ success: false, unreadCount: 0, message: err.message }, { status: 500 });
  }
}
