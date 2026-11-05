import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware/authGuard';
import { unpackTemplateMetadata } from '@/lib/services/templateIntelligenceService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { data: template, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !template) {
      return NextResponse.json({ success: false, message: 'Template not found' }, { status: 404 });
    }

    const meta = unpackTemplateMetadata(template);
    return NextResponse.json({ success: true, data: { ...template, ...meta } });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const payload = {};
    if (body.name) payload.name = body.name;
    if (body.subject) payload.subject = body.subject;
    if (body.bodyPlain || body.body) payload.body_plain = body.bodyPlain || body.body;
    if (body.bodyHtml) payload.body_html = body.bodyHtml;
    if (body.category) payload.category = body.category;
    payload.updated_at = new Date().toISOString();

    const { data: template, error } = await supabaseAdmin
      .from('email_templates')
      .update(payload)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    const meta = unpackTemplateMetadata(template);
    return NextResponse.json({ success: true, data: { ...template, ...meta } });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { error } = await supabaseAdmin
      .from('email_templates')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
