import { NextResponse } from 'next/server';
import { getCustomCatalog, saveCustomCatalog } from '@/lib/services/catalogService';
import { requireAuth, requireAdmin } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const catalog = await getCustomCatalog();
    return NextResponse.json({ success: true, data: catalog });
  } catch (err) {
    console.error('[Catalog API GET] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const auth = await requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const saved = await saveCustomCatalog(body.catalog, auth.user?.id || 'admin');
    return NextResponse.json({ success: true, data: saved, message: 'Catalog updated successfully' });
  } catch (err) {
    console.error('[Catalog API PUT] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
