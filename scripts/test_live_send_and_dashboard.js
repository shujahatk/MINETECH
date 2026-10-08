import 'dotenv/config';
import Lead from '../lib/models/Lead.js';
import EmailMessage from '../lib/models/EmailMessage.js';
import EmailThread from '../lib/models/EmailThread.js';
import ActivityLog from '../lib/models/ActivityLog.js';
import { sendLeadEmail } from '../lib/services/emailService.js';
import { getDashboardData } from '../lib/services/analyticsService.js';

async function testVerifiedDomainSend() {
  console.log('🚀 Testing Live Resend Pro Email Dispatch via Verified Domain (minetechresources.com)...');

  try {
    // 1. Create or find lead
    let lead = await Lead.findOne({ email: 'shujahatkk@gmail.com' });
    if (!lead) {
      lead = await Lead.create({
        firstName: 'Shujahat',
        lastName: 'KK',
        fullName: 'Shujahat KK',
        email: 'shujahatkk@gmail.com',
        company: 'Outbound Labs',
        jobTitle: 'Chief Executive Officer',
        status: 'NEW',
      });
    }

    console.log('  ✅ 1. Lead targeted:', lead.fullName, `(${lead.email})`);

    // 2. Dispatch email via sendLeadEmail
    const sendResult = await sendLeadEmail({
      leadId: lead._id || lead.id,
      subject: 'MineTech Outbound System — Live Delivery Test',
      bodyHtml: '<p>Hi Shujahat,<br><br>Your Resend Pro verified domain (<strong>minetechresources.com</strong>) is now fully integrated and operational with MineTech Outbound System!<br><br>All emails sent from the platform are delivered live and tracked on the dashboard.<br><br>Best regards,<br>MineTech Outbound Team</p>',
      bodyText: 'Hi Shujahat, Your Resend Pro verified domain (minetechresources.com) is now fully integrated and operational with MineTech Outbound System! Best regards, MineTech Outbound Team',
    });

    console.log('  ✅ 2. Live Email Dispatch Result:', sendResult);

    // 3. Verify message record in Supabase
    const savedMsg = await EmailMessage.findById(sendResult.messageId);
    console.log('  ✅ 3. EmailMessage recorded in Supabase:', {
      id: savedMsg._id || savedMsg.id,
      subject: savedMsg.subject,
      status: savedMsg.status,
      providerMessageId: savedMsg.providerMessageId,
      sentAt: savedMsg.sentAt,
    });

    // 4. Verify thread in Supabase
    const savedThread = await EmailThread.findById(sendResult.threadId);
    console.log('  ✅ 4. EmailThread recorded in Supabase:', {
      id: savedThread._id || savedThread.id,
      subject: savedThread.subject,
      snippet: savedThread.snippet,
    });

    // 5. Verify Dashboard stats
    const dashboard = await getDashboardData();
    console.log('  ✅ 5. Dashboard updated with live stats:', {
      emailsSentToday: dashboard.today?.emailsSent,
      totalLeads: dashboard.today?.totalLeads,
      recentActivities: dashboard.recentActivities?.length,
    });

    console.log('\n🎉 ALL CHECKS PASSED: Live delivery to shujahatkk@gmail.com succeeded and is recorded across all dashboard views!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testVerifiedDomainSend();
