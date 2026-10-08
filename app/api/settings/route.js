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
          listmonkConnected: lmHealth.connected,
          listmonkStatus: lmHealth.status,
          listmonkUrl: lmHealth.url,
          postgresConfigured: Boolean(process.env.LISTMONK_DB_HOST || process.env.LISTMONK_DB_NAME),
          resendConfigured: Boolean(process.env.RESEND_API_KEY || process.env.RESEND_SMTP_PASSWORD),
          aiConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY),
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
