import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/middleware/authGuard';
import { connectToDatabase } from '@/lib/db/mongoose';
import User from '@/lib/models/User';
import AuditLog from '@/lib/models/AuditLog';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    await connectToDatabase();
    const users = await User.find({}).select('-password').sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    await connectToDatabase();
    const body = await request.json();
    const { userId, role, approved, active, dailyCallTarget, dailyEmailLimit } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const updates = {};
    if (role !== undefined && role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: MineTech is a single-administrator application. Agent/Salesperson roles are not permitted.' },
        { status: 400 }
      );
    }

    const prevUser = await User.findById(userId);
    if (!prevUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (dailyCallTarget !== undefined) updates.dailyCallTarget = dailyCallTarget;
    if (dailyEmailLimit !== undefined) updates.dailyEmailLimit = dailyEmailLimit;

    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');

    // Audit Log
    await AuditLog.create({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: 'USER_UPDATED',
      targetType: 'user',
      targetId: userId,
      details: updates,
      previousState: { role: prevUser.role, approved: prevUser.approved, active: prevUser.active },
      newState: { role: updatedUser.role, approved: updatedUser.approved, active: updatedUser.active },
      timestamp: new Date(),
    }).catch(() => null);

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
