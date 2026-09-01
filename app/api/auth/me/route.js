import { NextResponse } from 'next/server';
import { getAuthenticatedUser, ensureDefaultAdmin } from '@/lib/services/authService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await ensureDefaultAdmin();
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthenticated. Please log in.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
