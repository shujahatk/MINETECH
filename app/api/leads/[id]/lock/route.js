import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { acquireLeadLock, releaseLeadLock } from '@/lib/services/leadService';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const leadId = params.id;
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'acquire'; // 'acquire' or 'release'

    if (action === 'release') {
      await releaseLeadLock(leadId, auth.user?.id);
      return NextResponse.json({ success: true, message: 'Lead lock released' });
    }

    const durationMinutes = body.durationMinutes || 5;
    const lockResult = await acquireLeadLock(leadId, auth.user?.id, auth.user?.name, durationMinutes);

    if (!lockResult.success) {
      return NextResponse.json(lockResult, { status: 409 });
    }

    return NextResponse.json({ success: true, lead: lockResult.lead });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
