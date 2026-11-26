import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('email_sequences')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const sequences = (rows || []).map((s) => ({
      ...s,
      _id: s.id,
      active: s.is_active ?? true,
      steps: Array.isArray(s.steps) ? s.steps : [],
    }));

    return NextResponse.json({ success: true, data: sequences });
  } catch (err) {
    console.error('[API /api/email/sequences GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { name, steps, description, is_active = true } = body;

    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sequence name and at least one step are required.' },
        { status: 400 }
      );
    }

    const userId = auth.user?.id || auth.user?._id || null;
    const nowIso = new Date().toISOString();

    const newRecord = {
      name: name.trim(),
      description: description || '',
      steps: steps.map((s, idx) => ({
        stepNumber: idx + 1,
        type: s.type || 'EMAIL',
        templateId: s.templateId || null,
        subject: s.subject || '',
        body: s.body || '',
        delayDays: Number(s.delayDays) || 0,
        delayHours: Number(s.delayHours) || 0,
      })),
      is_active: Boolean(is_active),
      created_by: userId,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: created, error } = await supabaseAdmin
      .from('email_sequences')
      .insert(newRecord)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { ...created, _id: created.id, active: created.is_active },
      message: 'Follow-up sequence created successfully.',
    }, { status: 201 });
  } catch (err) {
    console.error('[API /api/email/sequences POST Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { id, action, name, description, steps, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Sequence ID is required' }, { status: 400 });
    }

    // Duplicate action
    if (action === 'duplicate') {
      const { data: source, error: fetchErr } = await supabaseAdmin
        .from('email_sequences')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !source) throw new Error('Source sequence not found');

      const nowIso = new Date().toISOString();
      const duplicateRecord = {
        name: `${source.name} (Copy)`,
        description: source.description || '',
        steps: source.steps || [],
        is_active: false,
        created_by: auth.user?.id || null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data: dupCreated, error: dupErr } = await supabaseAdmin
        .from('email_sequences')
        .insert(duplicateRecord)
        .select()
        .single();

      if (dupErr) throw dupErr;

      return NextResponse.json({
        success: true,
        data: { ...dupCreated, _id: dupCreated.id, active: dupCreated.is_active },
        message: 'Sequence duplicated successfully.',
      });
    }

    // Toggle active state
    if (action === 'toggle_active') {
      const { data: current } = await supabaseAdmin
        .from('email_sequences')
        .select('is_active')
        .eq('id', id)
        .single();

      const newActive = is_active !== undefined ? Boolean(is_active) : !current?.is_active;

      const { data: updated, error } = await supabaseAdmin
        .from('email_sequences')
        .update({
          is_active: newActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: { ...updated, _id: updated.id, active: updated.is_active },
        message: `Sequence ${newActive ? 'activated' : 'paused'}.`,
      });
    }

    // Full update
    const updatePayload = {
      updated_at: new Date().toISOString(),
    };
    if (name) updatePayload.name = name.trim();
    if (description !== undefined) updatePayload.description = description;
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);
    if (Array.isArray(steps)) {
      updatePayload.steps = steps.map((s, idx) => ({
        stepNumber: idx + 1,
        type: s.type || 'EMAIL',
        templateId: s.templateId || null,
        subject: s.subject || '',
        body: s.body || '',
        delayDays: Number(s.delayDays) || 0,
        delayHours: Number(s.delayHours) || 0,
      }));
    }

    const { data: updated, error } = await supabaseAdmin
      .from('email_sequences')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { ...updated, _id: updated.id, active: updated.is_active },
      message: 'Sequence updated successfully.',
    });
  } catch (err) {
    console.error('[API /api/email/sequences PATCH Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  return PATCH(request);
}

export async function DELETE(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Sequence ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('email_sequences')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      deletedId: id,
      message: 'Sequence permanently deleted.',
    });
  } catch (err) {
    console.error('[API /api/email/sequences DELETE Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
