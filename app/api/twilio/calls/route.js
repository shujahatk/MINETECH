import { NextResponse } from 'next/server.js';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { requireAuth } from '../../../../lib/middleware/authGuard.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const callSid = searchParams.get('callSid') || searchParams.get('sid');

    if (callSid) {
      const { data: call, error: callErr } = await supabaseAdmin
        .from('calls')
        .select('*, leads(id, full_name, first_name, last_name, phone, company)')
        .eq('call_sid', callSid)
        .maybeSingle();

      if (callErr) throw callErr;
      if (!call) {
        return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: call });
    }

    const { data: calls, error } = await supabaseAdmin
      .from('calls')
      .select('*, leads(id, full_name, first_name, last_name, phone, company)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ success: true, count: (calls || []).length, data: calls || [] });
  } catch (err) {
    console.error('[Twilio Calls List Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
