import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import SendingInbox from '@/lib/models/SendingInbox';
import User from '@/lib/models/User';
import AuditLog from '@/lib/models/AuditLog';
import { ensureDefaultAdmin } from '@/lib/services/authService';
import { checkListmonkHealth } from '@/lib/services/listmonkService';
import { requireAdmin, requireAuth } from '@/lib/middleware/authGuard';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    // Independent lookups run together instead of one after another.
    const [dbResult, admin, inboxes, lmHealth] = await Promise.all([
      supabaseAdmin.from('users').select('id').limit(1),
      ensureDefaultAdmin(),
      SendingInbox.find().lean(),
      checkListmonkHealth(),
    ]);
    const isSupabaseConnected = !dbResult.error;

    return NextResponse.json({
      success: true,
      data: {
        user: {
          name: admin.name || 'Admin User',
          email: admin.email || process.env.ADMIN_EMAIL || 'admin@8020outbound.com',
          role: auth.user.role || 'admin',
          dailyEmailLimit: admin.dailyEmailLimit || 200,
          centralSendingEmail: admin.centralSendingEmail || process.env.EMAIL_FROM || '',
          centralReplyTo: admin.centralReplyTo || process.env.REPLY_TO || '',
        },
        inboxes: inboxes || [],
        integrations: {
          supabaseConnected: isSupabaseConnected,
          resendConfigured: Boolean(process.env.RESEND_API_KEY || process.env.RESEND_SMTP_PASSWORD),
          aiConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
          listmonkConnected: lmHealth.connected,
          listmonkStatus: lmHealth.status,
          listmonkUrl: lmHealth.url,
          postgresConfigured: Boolean(process.env.LISTMONK_DB_HOST || process.env.LISTMONK_DB_NAME),
          services: {
            supabase: {
              name: 'Supabase Database',
              status: isSupabaseConnected ? 'operational' : 'degraded',
              label: isSupabaseConnected ? 'Operational' : 'Connection Failed',
              details: isSupabaseConnected ? 'Primary data store connected (PostgreSQL / RLS)' : (dbResult.error?.message || 'Database unreachable'),
              optional: false,
            },
            resend: {
              name: 'Resend Email Relay',
              status: (process.env.RESEND_API_KEY || '').startsWith('re_') ? 'operational' : 'not_configured',
              label: (process.env.RESEND_API_KEY || '').startsWith('re_') ? 'Operational' : 'Not configured',
              details: (process.env.RESEND_API_KEY || '').startsWith('re_') ? 'Verified sending domain: mine-tech.be' : 'Set RESEND_API_KEY in environment to enable email delivery',
              verifiedDomain: 'mine-tech.be',
              optional: false,
            },
            ai: {
              name: 'AI Intelligence Provider',
              status: (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.OPENAI_API_KEY) ? 'operational' : 'not_configured',
              label: (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.OPENAI_API_KEY) ? 'Operational' : 'Not configured',
              details: (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) ? 'Anthropic Claude (claude-sonnet-4-6)' : (process.env.OPENAI_API_KEY ? 'OpenAI' : 'Set ANTHROPIC_API_KEY in environment for AI drafting'),
              model: (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) ? 'claude-sonnet-4-6' : 'standard',
              optional: false,
            },
            listmonk: {
              name: 'Listmonk Campaign Engine',
              status: lmHealth.connected ? 'operational' : 'standby',
              label: lmHealth.connected ? 'Operational' : 'Optional / Standby',
              details: lmHealth.connected ? `Connected (${lmHealth.url})` : 'Optional local mass mailer (standby; primary email delivery runs via Resend relay)',
              optional: true,
            },
          },
        },
      },
    });
  } catch (err) {
    console.error('[Settings API GET] Error:', err);
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
    await connectToDatabase();
    const admin = await ensureDefaultAdmin();

    if (body.name) admin.name = body.name;
    if (body.dailyEmailLimit) admin.dailyEmailLimit = Number(body.dailyEmailLimit);
    if (body.dailyCallTarget) admin.dailyCallTarget = Number(body.dailyCallTarget);
    if (body.centralSendingEmail !== undefined) admin.centralSendingEmail = body.centralSendingEmail;
    if (body.centralReplyTo !== undefined) admin.centralReplyTo = body.centralReplyTo;

    if (body.newPassword) {
      admin.password = body.newPassword;
    }

    await admin.save();

    await AuditLog.create({
      action: 'SETTINGS_UPDATED',
      actorId: auth.user.id || auth.user._id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      targetResource: 'Settings',
      summary: `System settings updated by ${auth.user.email}`,
      metadata: {
        dailyEmailLimit: admin.dailyEmailLimit,
        dailyCallTarget: admin.dailyCallTarget,
        centralSendingEmail: admin.centralSendingEmail,
      },
    });

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    console.error('[Settings API PUT] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
