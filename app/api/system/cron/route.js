import { NextResponse } from 'next/server.js';
import { dispatchScheduledTasks } from '../../../../lib/workers/schedulerDispatcher.js';

export const dynamic = 'force-dynamic';

async function handleCron(request) {
  try {
    // Optional secret validation for production cron invocations (e.g. Vercel Cron, external monitoring)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && process.env.NODE_ENV === 'production') {
      const expectedBearer = `Bearer ${cronSecret}`;
      if (authHeader !== expectedBearer && request.headers.get('x-cron-secret') !== cronSecret) {
        return NextResponse.json({ success: false, error: 'Unauthorized cron invocation' }, { status: 401 });
      }
    }

    const result = await dispatchScheduledTasks();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), result });
  } catch (err) {
    console.error('[Cron API Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  return handleCron(request);
}

export async function POST(request) {
  return handleCron(request);
}
