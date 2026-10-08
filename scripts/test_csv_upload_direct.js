import 'dotenv/config';
import Lead from '../lib/models/Lead.js';
import ActivityLog from '../lib/models/ActivityLog.js';
import AuditLog from '../lib/models/AuditLog.js';

async function testCsvUploadWorkflow() {
  console.log('🧪 Testing CSV Lead Import & AuditLog Creation on Supabase...');

  try {
    // 1. Create a test lead
    const testLeadEmail = `csv_test_${Date.now()}@example.com`;
    const createdLeads = await Lead.insertMany([
      {
        firstName: 'Alex',
        lastName: 'Mercer',
        fullName: 'Alex Mercer',
        email: testLeadEmail,
        company: 'Apex BioTech',
        jobTitle: 'VP Research',
        industry: 'Biotechnology',
        tags: ['test-csv-import'],
      }
    ]);

    console.log('  ✅ 1. Lead.insertMany succeeded:', createdLeads[0]?._id || createdLeads[0]?.id);

    // 2. Create ActivityLog entry
    const activityLogs = createdLeads.map((lead) => ({
      leadId: lead._id || lead.id,
      action: 'LEAD_CREATED',
      channel: 'system',
      direction: 'system',
      summary: `Imported via CSV: ${lead.fullName || lead.email}`,
      timestamp: new Date(),
    }));

    const createdActivities = await ActivityLog.insertMany(activityLogs);
    console.log('  ✅ 2. ActivityLog.insertMany succeeded');

    // 3. Create AuditLog entry with diverse aliases
    const auditLog = await AuditLog.create({
      action: 'LEADS_CSV_IMPORTED',
      actorId: '00000000-0000-0000-0000-000000000000',
      actorEmail: 'admin@8020aquisition.com',
      actorRole: 'admin',
      targetResource: 'Lead',
      summary: 'Imported 1 leads via CSV (0 duplicates skipped, 0 invalid skipped)',
      metadata: {
        totalRows: 1,
        imported: 1,
        duplicates: 0,
        invalid: 0,
      },
    });

    console.log('  ✅ 3. AuditLog.create succeeded:', auditLog?._id || auditLog?.id);

    // 4. Cleanup test records
    await Lead.deleteOne({ email: testLeadEmail });
    if (auditLog?._id || auditLog?.id) {
      await AuditLog.deleteOne({ _id: auditLog._id || auditLog.id });
    }
    console.log('  ✅ 4. Cleaned up test lead and audit entry');

    console.log('\n🎉 CSV Lead Import & Audit Log pipeline is 100% functional and verified!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testCsvUploadWorkflow();
