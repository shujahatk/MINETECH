import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/middleware/authGuard';
import { supabaseAdmin } from '@/lib/supabase';
import { checkListmonkHealth } from '@/lib/services/listmonkService';
import { TELEPHONY_ENABLED } from '@/lib/config/features';

export const dynamic = 'force-dynamic';

async function checkDatabase() {
  const started = Date.now();
  try {
    const { error } = await supabaseAdmin.from('leads').select('id').limit(1);
    const connected = !error;
    return {
      name: 'Supabase PostgreSQL',
      status: connected ? 'operational' : 'degraded',
      connected,
      latencyMs: Date.now() - started,
      database: 'Postgres (Supabase)',
      error: error ? error.message : null,
    };
  } catch (err) {
    return {
      name: 'Supabase PostgreSQL',
      status: 'error',
      connected: false,
      latencyMs: Date.now() - started,
      error: err.message,
    };
  }
}

async function checkEmail() {
  const resendConfigured = Boolean(process.env.RESEND_API_KEY || process.env.RESEND_SMTP_PASSWORD);
  let listmonk;
  try {
    const lmHealth = await checkListmonkHealth();
    listmonk = {
      name: 'Listmonk Campaign Engine',
      status: lmHealth.connected ? 'operational' : 'standby',
      connected: lmHealth.connected,
      url: lmHealth.url,
    };
  } catch {
    listmonk = { name: 'Listmonk', status: 'error', connected: false };
  }
  return {
    listmonk,
    resend: {
      name: 'Resend SMTP Relay',
      status: resendConfigured ? 'operational' : 'not_configured',
      connected: resendConfigured,
    },
  };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  // Database ping and email provider checks are independent: run them together.
  const [database, email] = await Promise.all([checkDatabase(), checkEmail()]);

  const claudeConfigured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);

  const services = {
    database,
    listmonk: email.listmonk,
    resend: email.resend,
    claude: {
      name: 'Anthropic Claude',
      status: claudeConfigured ? 'operational' : 'standby_fallback',
      connected: claudeConfigured,
      model: process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || null,
    },
    workers: {
      name: 'Background Dispatch Worker',
      status: 'operational',
      mode: 'Supabase atomic claims',
      activeJobs: 0,
    },
  };

  // Legacy telephony is only reported when explicitly enabled.
  if (TELEPHONY_ENABLED) {
    const twilioConfigured = Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER
    );
    services.twilio = {
      name: 'Twilio Voice & SMS',
      status: twilioConfigured ? 'operational' : 'not_configured',
      connected: twilioConfigured,
    };
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    services,
  });
}
