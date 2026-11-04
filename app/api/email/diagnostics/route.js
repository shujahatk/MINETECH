import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/middleware/authGuard';
import { getEmailEnvironmentReport, checkResendDomains } from '@/lib/services/emailDiagnostics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/email/diagnostics  (admin only)
 *
 * Reports how THIS deployment sends email (sender address/domain + the env var it came from,
 * deployment environment, API-key fingerprint) and which domains the deployed RESEND_API_KEY can
 * actually see in Resend. It never returns the API key or any other secret, and it does not send email.
 */
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const report = getEmailEnvironmentReport();
    const resendDomains = await checkResendDomains({
      apiKey: (process.env.RESEND_API_KEY || '').trim(),
      senderDomain: report.sender.domain,
    });

    return NextResponse.json(
      { success: true, data: { ...report, resendDomains } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[Email Diagnostics] Error:', err.message);
    return NextResponse.json({ success: false, message: 'Diagnostics failed' }, { status: 500 });
  }
}
