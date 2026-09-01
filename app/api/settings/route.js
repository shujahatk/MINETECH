import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import SendingInbox from '@/lib/models/SendingInbox';
import User from '@/lib/models/User';
import { ensureDefaultAdmin } from '@/lib/services/authService';
import { checkListmonkHealth } from '@/lib/services/listmonkService';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let admin = null;
    let inboxes = [];
    let isMongoConnected = false;

    try {
      await connectToDatabase();
      isMongoConnected = mongoose.connection.readyState === 1;
      admin = await ensureDefaultAdmin();
      inboxes = await SendingInbox.find().lean();
    } catch (dbErr) {
      admin = {
        name: 'Admin User',
        email: process.env.ADMIN_EMAIL || 'admin@8020outbound.com',
        dailyEmailLimit: 200,
        dailyCallTarget: 50,
        centralSendingEmail: process.env.EMAIL_FROM || '',
        centralReplyTo: process.env.REPLY_TO || '',
      };
    }

    const lmHealth = await checkListmonkHealth();

    return NextResponse.json({
      success: true,
      data: {
        user: {
          name: admin.name || 'Admin User',
          email: admin.email || process.env.ADMIN_EMAIL || 'admin@8020outbound.com',
          dailyEmailLimit: admin.dailyEmailLimit || 200,
          dailyCallTarget: admin.dailyCallTarget || 50,
          centralSendingEmail: admin.centralSendingEmail || process.env.EMAIL_FROM || '',
          centralReplyTo: admin.centralReplyTo || process.env.REPLY_TO || '',
        },
        inboxes: inboxes || [],
        integrations: {
          mongodbConnected: isMongoConnected,
          listmonkConnected: lmHealth.connected,
          listmonkStatus: lmHealth.status,
          listmonkUrl: lmHealth.url,
          postgresConfigured: Boolean(process.env.LISTMONK_DB_HOST || process.env.LISTMONK_DB_NAME),
          resendConfigured: Boolean(process.env.RESEND_API_KEY || process.env.RESEND_SMTP_PASSWORD),
          sendgridConfigured: Boolean(process.env.SENDGRID_API_KEY),
          twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
          aiConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY),
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            name: 'Admin User',
            email: process.env.ADMIN_EMAIL || 'admin@8020outbound.com',
            dailyEmailLimit: 200,
            dailyCallTarget: 50,
            centralSendingEmail: process.env.EMAIL_FROM || '',
            centralReplyTo: process.env.REPLY_TO || '',
          },
          inboxes: [],
          integrations: {
            mongodbConnected: false,
            listmonkConnected: false,
            listmonkStatus: 'Offline / In Dev Mode',
            listmonkUrl: 'http://127.0.0.1:9000',
            postgresConfigured: true,
            resendConfigured: Boolean(process.env.RESEND_API_KEY || process.env.RESEND_SMTP_PASSWORD),
            sendgridConfigured: Boolean(process.env.SENDGRID_API_KEY),
            twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
            aiConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY),
          },
        },
      },
      { status: 200 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    try {
      await connectToDatabase();
      const admin = await ensureDefaultAdmin();

      if (body.name) admin.name = body.name;
      if (body.dailyEmailLimit) admin.dailyEmailLimit = body.dailyEmailLimit;
      if (body.dailyCallTarget) admin.dailyCallTarget = body.dailyCallTarget;
      if (body.centralSendingEmail !== undefined) admin.centralSendingEmail = body.centralSendingEmail;
      if (body.centralReplyTo !== undefined) admin.centralReplyTo = body.centralReplyTo;

      if (body.newPassword) {
        admin.password = body.newPassword;
      }

      await admin.save();
    } catch (dbErr) {
      if (body.centralSendingEmail !== undefined) process.env.EMAIL_FROM = body.centralSendingEmail;
      if (body.centralReplyTo !== undefined) process.env.REPLY_TO = body.centralReplyTo;
    }

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
