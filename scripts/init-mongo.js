/**
 * Automated MongoDB Schema & Index Migration Script
 * Initializes all required collections and compound/unique indexes for the Single-User Outbound System
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function safeCreateIndex(collection, indexSpec, options = {}) {
  try {
    await collection.createIndex(indexSpec, options);
  } catch (err) {
    if (err.code === 85 || err.code === 86 || err.codeName === 'IndexOptionsConflict' || err.codeName === 'IndexKeySpecsConflict') {
      console.log(`  [Notice] Existing index conflict for ${JSON.stringify(indexSpec)}, rebuilding index...`);
      try {
        // Try dropping existing index on this key if conflicting
        const existingIndexes = await collection.indexes();
        const keyName = Object.keys(indexSpec)[0];
        const match = existingIndexes.find((idx) => idx.key && Object.keys(idx.key)[0] === keyName && Object.keys(idx.key).length === Object.keys(indexSpec).length);
        if (match && match.name !== '_id_') {
          await collection.dropIndex(match.name).catch(() => null);
        }
        await collection.createIndex(indexSpec, options);
      } catch (innerErr) {
        console.warn(`  [Warning] Keeping existing index for ${JSON.stringify(indexSpec)}: ${innerErr.message}`);
      }
    } else {
      throw err;
    }
  }
}

async function initMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('FATAL: MONGODB_URI is not set in environment or .env file.');
    process.exit(1);
  }

  console.log('[InitMongo] Connecting to MongoDB...');
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    const db = client.db();
    console.log(`[InitMongo] Connected to database: "${db.databaseName}"`);

    // 1. Leads Collection & Indexes
    console.log('[InitMongo] Setting up "leads" collection and indexes...');
    const leadsCollection = db.collection('leads');
    await safeCreateIndex(leadsCollection, { email: 1 }, { unique: true, sparse: true });
    await safeCreateIndex(leadsCollection, { phone: 1 });
    await safeCreateIndex(leadsCollection, { status: 1 });
    await safeCreateIndex(leadsCollection, { tags: 1 });
    console.log('  -> "leads" indexes configured.');

    // 2. Campaigns Collection & Indexes
    console.log('[InitMongo] Setting up "campaigns" collection and indexes...');
    const campaignsCollection = db.collection('campaigns');
    await safeCreateIndex(campaignsCollection, { status: 1 });
    await safeCreateIndex(campaignsCollection, { created_at: -1 });
    console.log('  -> "campaigns" indexes configured.');

    // 3. Campaign Recipients Collection & Indexes
    console.log('[InitMongo] Setting up "campaign_recipients" collection and indexes...');
    const campaignRecipientsCollection = db.collection('campaign_recipients');
    await safeCreateIndex(campaignRecipientsCollection, { campaign_id: 1, lead_id: 1 }, { unique: true });
    await safeCreateIndex(campaignRecipientsCollection, { status: 1, scheduled_at: 1, locked_at: 1 });
    console.log('  -> "campaign_recipients" indexes configured.');

    // 4. AI Email Generations Collection & Indexes
    console.log('[InitMongo] Setting up "ai_email_generations" collection and indexes...');
    const aiEmailGenerationsCollection = db.collection('ai_email_generations');
    await safeCreateIndex(aiEmailGenerationsCollection, { lead_id: 1 });
    await safeCreateIndex(aiEmailGenerationsCollection, { campaign_id: 1 });
    console.log('  -> "ai_email_generations" indexes configured.');

    // 5. Calls Collection & Indexes
    console.log('[InitMongo] Setting up "calls" collection and indexes...');
    const callsCollection = db.collection('calls');
    await safeCreateIndex(callsCollection, { lead_id: 1 });
    await safeCreateIndex(callsCollection, { created_at: -1 });
    console.log('  -> "calls" indexes configured.');

    console.log('\n[InitMongo] SUCCESS: All MongoDB collections and indexes migrated successfully.');
  } catch (err) {
    console.error('[InitMongo] Migration failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  initMongo();
}

module.exports = { initMongo };
