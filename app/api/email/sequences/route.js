import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import EmailSequence from '@/lib/models/EmailSequence';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    await connectToDatabase();
    const sequences = await EmailSequence.find({ active: true }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: sequences || [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { name, steps, description } = body;

    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sequence name and at least one step are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const sequence = await EmailSequence.create({
      name,
      description: description || '',
      steps,
      createdBy: auth.user.id,
      active: true,
    });

    return NextResponse.json({ success: true, data: sequence }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
