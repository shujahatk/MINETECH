import { NextResponse } from 'next/server';
import { makeOutboundCall } from '@/lib/services/twilioService';
import { connectToDatabase } from '@/lib/db/mongoose';
import Lead from '@/lib/models/Lead';
import { isLeadSuppressed, checkContactHours } from '@/lib/services/leadService';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { leadId, to, forceOutsideHours = false } = await request.json();
    if (!to) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }

    await connectToDatabase();

    // 1. DNC / Suppression Guard
    if (leadId) {
      const lead = await Lead.findById(leadId);
      if (lead) {
        if (isLeadSuppressed(lead, 'phone')) {
          return NextResponse.json(
            { success: false, error: 'Cannot place call: Lead phone channel is suppressed by DNC policy.' },
            { status: 403 }
          );
        }

        // 2. Contact Hours Guard
        const hours = checkContactHours(lead);
        if (!hours.canContact && !forceOutsideHours) {
          return NextResponse.json(
            {
              success: false,
              error: `Blocked by Contact Hours Policy: ${hours.reason}`,
              requiresOverride: true,
              contactHours: hours,
            },
            { status: 400 }
          );
        }
      }
    }

    const callRecord = await makeOutboundCall({ leadId, to });
    return NextResponse.json({ success: true, data: callRecord }, { status: 201 });
  } catch (err) {
    console.error('[Twilio Call Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
