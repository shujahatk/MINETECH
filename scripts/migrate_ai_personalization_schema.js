import 'dotenv/config';
import EmailCampaign from '../lib/models/EmailCampaign.js';
import EmailRecipient from '../lib/models/EmailRecipient.js';
import Lead from '../lib/models/Lead.js';

async function migrate() {
  console.log('--- Checking Supabase Model Support for AI Personalization ---');

  // Test EmailCampaign model
  const camp = await EmailCampaign.create({
    name: `Migration Probe ${Date.now()}`,
    masterPrompt: 'Pitch our SEO service, professional tone, reference their industry',
    campaignType: 'ai_personalized',
    status: 'DRAFT',
  });

  console.log('✅ EmailCampaign Created:', camp.id);
  console.log('   masterPrompt:', camp.masterPrompt);
  console.log('   campaignType:', camp.campaignType);

  // Test EmailRecipient model
  let lead = await Lead.findOne();
  if (!lead) {
    lead = await Lead.create({ email: `probe_${Date.now()}@test.com`, firstName: 'Probe' });
  }

  const rec = await EmailRecipient.create({
    campaignId: camp.id,
    leadId: lead.id,
    email: lead.email,
    status: 'PENDING',
    generatedSubject: 'Custom Tailored SEO Proposal',
    generatedBody: 'Hi Probe, noticed your web presence...',
    generationStatus: 'ready',
    generationError: '',
  });

  console.log('✅ EmailRecipient Created:', rec.id);
  console.log('   generatedSubject:', rec.generatedSubject);
  console.log('   generatedBody:', rec.generatedBody);
  console.log('   generationStatus:', rec.generationStatus);

  // Clean up
  await EmailRecipient.findByIdAndDelete(rec.id);
  await EmailCampaign.findByIdAndDelete(camp.id);
  console.log('--- Model Schema Verification Complete & Cleaned Up ---');
}

migrate().catch(console.error);

