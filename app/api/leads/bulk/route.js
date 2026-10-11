import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/adminGuard';
import { supabaseAdmin } from '@/lib/supabase';
import { deleteLeadsByIds } from '@/lib/services/leadService';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 200;

/**
 * Bulk lead actions in ONE request (previously the UI issued one DELETE per lead).
 *   { action: 'delete', leadIds: [...] }
 *   { action: 'status', leadIds: [...], status: 'CONTACTED' }
 * Same effect per row as DELETE /api/leads/:id and PUT /api/leads/:id {status}.
 */
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response || !auth?.user) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');
    const ids = [...new Set((Array.isArray(body.leadIds) ? body.leadIds : []).filter((id) => UUID_RE.test(String(id))))];

    if (!ids.length) {
      return NextResponse.json({ success: false, message: 'No valid leadIds provided' }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json(
        { success: false, message: `Too many leads in one request (max ${MAX_IDS})` },
        { status: 400 }
      );
    }

    if (action === 'delete') {
      const result = await deleteLeadsByIds(ids);
      const partial = result.failed.length > 0 || result.notFound.length > 0;
      return NextResponse.json(
        {
          success: result.failed.length === 0,
          action,
          affected: result.affected,
          deleted: result.deleted,
          failed: result.failed,
          notFound: result.notFound,
          message: partial
            ? `Deleted ${result.affected} of ${ids.length} lead(s). ${result.failed.length ? `${result.failed.length} could not be removed.` : ''} ${result.notFound.length ? `${result.notFound.length} not found.` : ''}`.trim()
            : `Deleted ${result.affected} lead${result.affected === 1 ? '' : 's'}`,
        },
        { status: result.failed.length === 0 ? 200 : 207 }
      );
    }

    if (action === 'status') {
      const status = String(body.status || '').trim().toUpperCase();
      if (!/^[A-Z_]{2,40}$/.test(status)) {
        return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
      }
      const { error, count } = await supabaseAdmin
        .from('leads')
        .update({ status, updated_at: new Date().toISOString() }, { count: 'exact' })
        .in('id', ids);
      if (error) throw error;
      return NextResponse.json({ success: true, action, status, affected: count ?? ids.length, leadIds: ids });
    }

    return NextResponse.json({ success: false, message: 'Unsupported bulk action' }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/leads/bulk]', err);
    const status = err.status || 500;
    return NextResponse.json(
      {
        success: false,
        message: err.message || 'Bulk action failed',
        code: err.code || null,
        dependency: err.dependency || null,
      },
      { status }
    );
  }
}
