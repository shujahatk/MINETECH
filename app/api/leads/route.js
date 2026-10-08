import { NextResponse } from 'next/server';
import { getLeadsList, createLead } from '@/lib/services/leadService';

import { requireAdmin } from '@/lib/auth/adminGuard';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response || !auth?.user) return auth;

  try {
    // All filtering / sorting / pagination happens in the database.
    // Supported params: search, status, temperature (HOT|WARM|COLD), owner, campaign, followUp
    // (overdue|today|week|none), product, ai, tag, page, limit (<=100), sortBy, sortDir, view=board.
    const { searchParams } = new URL(request.url);
    const result = await getLeadsList(searchParams);
    return NextResponse.json(
      { success: true, ...result },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    console.error('[GET /api/leads]', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response || !auth?.user) return auth;

  try {
    const body = await request.json();
    const lead = await createLead(body);
    return NextResponse.json({ success: true, data: lead }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
