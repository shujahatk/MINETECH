import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware/authGuard';
import {
  createAndClassifyTemplate,
  unpackTemplateMetadata
} from '@/lib/services/templateIntelligenceService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { data: templates, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const unpacked = (templates || []).map((t) => {
      const meta = unpackTemplateMetadata(t);
      return {
        ...t,
        ...meta
      };
    });

    return NextResponse.json({ success: true, data: unpacked });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { name, subject, bodyHtml, bodyText, bodyPlain, category } = body;

    if (!name || !subject || (!bodyHtml && !bodyText && !bodyPlain)) {
      return NextResponse.json(
        { success: false, error: 'Template name, subject, and body content are required.' },
        { status: 400 }
      );
    }

    const bodyToUse = bodyPlain || bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, '').trim() : '');

    const saved = await createAndClassifyTemplate({
      name,
      subject,
      body: bodyToUse,
      bodyHtml: bodyHtml || `<p>${bodyToUse.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
      category: category || null,
      userId: auth.user?.id || null
    });

    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
