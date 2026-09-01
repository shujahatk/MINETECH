import { connectToDatabase } from '@/lib/db/mongoose';
import Lead from '@/lib/models/Lead';
import EmailMessage from '@/lib/models/EmailMessage';
import EmailCampaign from '@/lib/models/EmailCampaign';
import Call from '@/lib/models/Call';
import SMSMessage from '@/lib/models/SMSMessage';
import ActivityLog from '@/lib/models/ActivityLog';

export async function getDashboardData() {
  const defaultDashboard = {
    today: {
      emailsSent: 0,
      repliesReceived: 0,
      callsMade: 0,
      callsConnected: 0,
      smsSent: 0,
      followUpsDue: 0,
      totalLeads: 0,
    },
    activeCampaigns: [],
    priorityLeads: [],
    recentActivities: [],
  };

  try {
    await connectToDatabase();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Today's Activity metrics
    const [
      emailsSentToday,
      emailsReceivedToday,
      callsMadeToday,
      callsConnectedToday,
      smsSentToday,
      followUpsDueToday,
      totalLeads,
    ] = await Promise.all([
      EmailMessage.countDocuments({ direction: 'outbound', createdAt: { $gte: startOfDay } }),
      EmailMessage.countDocuments({ direction: 'inbound', createdAt: { $gte: startOfDay } }),
      Call.countDocuments({ createdAt: { $gte: startOfDay } }),
      Call.countDocuments({ status: 'completed', createdAt: { $gte: startOfDay } }),
      SMSMessage.countDocuments({ direction: 'outbound', createdAt: { $gte: startOfDay } }),
      Lead.countDocuments({ nextFollowUpAt: { $lte: endOfDay }, status: { $nin: ['CUSTOMER', 'DO_NOT_CONTACT', 'NOT_INTERESTED'] } }),
      Lead.countDocuments(),
    ]);

    // 2. Active Campaigns
    const activeCampaigns = await EmailCampaign.find({
      status: { $in: ['running', 'queued', 'paused'] },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 3. Priority Leads
    const priorityLeads = await Lead.find({
      $or: [
        { hasUnansweredReply: true },
        { status: { $in: ['ENGAGED', 'INTERESTED', 'QUALIFIED'] } },
        { nextFollowUpAt: { $lte: endOfDay } },
      ],
    })
      .sort({ hasUnansweredReply: -1, lastEngagedAt: -1, nextFollowUpAt: 1 })
      .limit(10)
      .lean();

    // 4. Recent Unified Activity
    const recentActivities = await ActivityLog.find()
      .populate('leadId', 'fullName firstName lastName email company')
      .sort({ timestamp: -1 })
      .limit(12)
      .lean();

    return {
      today: {
        emailsSent: emailsSentToday,
        repliesReceived: emailsReceivedToday,
        callsMade: callsMadeToday,
        callsConnected: callsConnectedToday,
        smsSent: smsSentToday,
        followUpsDue: followUpsDueToday,
        totalLeads,
      },
      activeCampaigns,
      priorityLeads,
      recentActivities,
    };
  } catch (err) {
    console.warn('[Analytics] MongoDB offline, returning default dashboard structure');
    return defaultDashboard;
  }
}

export async function getPerformanceAnalytics() {
  const defaultAnalytics = {
    email: {
      sent: 0,
      delivered: 0,
      opened: 0,
      replied: 0,
      bounced: 0,
      openRate: '0.0%',
      replyRate: '0.0%',
      bounceRate: '0.0%',
    },
    calls: {
      total: 0,
      connected: 0,
      connectRate: '0.0%',
      avgDurationSeconds: 0,
      totalDurationSeconds: 0,
    },
    pipeline: {
      NEW: 0,
      CONTACTED: 0,
      ENGAGED: 0,
      INTERESTED: 0,
      QUALIFIED: 0,
      CUSTOMER: 0,
      FOLLOW_UP: 0,
      NO_RESPONSE: 0,
      NOT_INTERESTED: 0,
      DO_NOT_CONTACT: 0,
    },
  };

  try {
    await connectToDatabase();

    const [
      totalEmailsSent,
      totalEmailsDelivered,
      totalEmailsOpened,
      totalReplies,
      totalBounces,
      totalCalls,
      totalCallsConnected,
      callDurationAgg,
      leadsByStatus,
    ] = await Promise.all([
      EmailMessage.countDocuments({ direction: 'outbound' }),
      EmailMessage.countDocuments({ direction: 'outbound', status: { $in: ['delivered', 'opened', 'clicked', 'sent'] } }),
      EmailMessage.countDocuments({ direction: 'outbound', openedAt: { $exists: true } }),
      EmailMessage.countDocuments({ direction: 'inbound' }),
      EmailMessage.countDocuments({ status: 'bounced' }),
      Call.countDocuments(),
      Call.countDocuments({ status: 'completed' }),
      Call.aggregate([{ $group: { _id: null, totalDuration: { $sum: '$duration' }, avgDuration: { $avg: '$duration' } } }]),
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const openRate = totalEmailsSent > 0 ? ((totalEmailsOpened / totalEmailsSent) * 100).toFixed(1) : '0.0';
    const replyRate = totalEmailsSent > 0 ? ((totalReplies / totalEmailsSent) * 100).toFixed(1) : '0.0';
    const bounceRate = totalEmailsSent > 0 ? ((totalBounces / totalEmailsSent) * 100).toFixed(1) : '0.0';
    const callConnectRate = totalCalls > 0 ? ((totalCallsConnected / totalCalls) * 100).toFixed(1) : '0.0';

    const pipeline = { ...defaultAnalytics.pipeline };

    for (const item of leadsByStatus) {
      if (item._id && pipeline[item._id] !== undefined) {
        pipeline[item._id] = item.count;
      }
    }

    return {
      email: {
        sent: totalEmailsSent,
        delivered: totalEmailsDelivered,
        opened: totalEmailsOpened,
        replied: totalReplies,
        bounced: totalBounces,
        openRate: `${openRate}%`,
        replyRate: `${replyRate}%`,
        bounceRate: `${bounceRate}%`,
      },
      calls: {
        total: totalCalls,
        connected: totalCallsConnected,
        connectRate: `${callConnectRate}%`,
        avgDurationSeconds: Math.round(callDurationAgg[0]?.avgDuration || 0),
        totalDurationSeconds: Math.round(callDurationAgg[0]?.totalDuration || 0),
      },
      pipeline,
    };
  } catch (err) {
    console.warn('[Analytics] MongoDB offline, returning resilient pipeline defaults');
    return defaultAnalytics;
  }
}
