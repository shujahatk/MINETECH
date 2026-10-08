import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import EmailTemplate from '@/lib/models/EmailTemplate';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    await connectToDatabase();
    const templates = await EmailTemplate.find({ active: true }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: templates || [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { name, subject, bodyHtml, bodyText, category } = body;

    if (!name || !subject || !bodyHtml) {
      return NextResponse.json(
        { success: false, error: 'Template name, subject, and body HTML are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const template = await EmailTemplate.create({
      name,
      subject,
      bodyHtml,
      bodyText: bodyText || bodyHtml.replace(/<[^>]+>/g, '').trim(),
      category: category || 'general',
      createdBy: auth.user.id,
      active: true,
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
