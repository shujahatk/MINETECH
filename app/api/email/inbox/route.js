import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import EmailThread from '@/lib/models/EmailThread';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const search = searchParams.get('search') || '';

    const query = { status: filter === 'archived' ? 'archived' : 'active' };

    if (filter === 'unread') {
      query.unread = true;
    } else if (filter === 'replies') {
      query.lastMessageDirection = 'inbound';
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { subject: searchRegex },
        { snippet: searchRegex },
        { 'participants.email': searchRegex },
        { 'participants.name': searchRegex },
      ];
    }

    try {
      await connectToDatabase();
      const [threads, unreadCount, totalCount] = await Promise.all([
        EmailThread.find(query)
          .populate('leadId', 'fullName firstName lastName email company jobTitle status phone suppression')
          .sort({ lastMessageAt: -1 })
          .limit(50)
          .lean(),
        EmailThread.countDocuments({ status: 'active', unread: true }),
        EmailThread.countDocuments({ status: 'active' }),
      ]);

      return NextResponse.json({
        success: true,
        data: threads || [],
        counts: {
          unread: unreadCount || 0,
          total: totalCount || 0,
        },
      });
    } catch (dbErr) {
      return NextResponse.json({
        success: true,
        data: [],
        counts: { unread: 0, total: 0 },
      });
    }
  } catch (err) {
    return NextResponse.json({
      success: true,
      data: [],
      counts: { unread: 0, total: 0 },
    });
  }
}
