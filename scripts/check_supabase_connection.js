const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('\n--- SUPABASE CONNECTION CHECK ---');
  console.log(`URL: ${url}`);
  console.log(`Key: ${key ? key.substring(0, 15) + '...' : 'NOT FOUND'}`);

  if (!url || !key) {
    console.error('FATAL: Supabase URL or Key missing in .env');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  try {
    const { data, error } = await supabase.from('users').select('id, email, role').limit(5);
    if (error) {
      if (error.code === '42P01' || error.message.includes('relation "public.users" does not exist') || error.message.includes('does not exist')) {
        console.log('\n[Status] Connected to Supabase successfully!');
        console.log('[Notice] Tables are not created yet. Please execute `supabase/schema.sql` in the Supabase SQL Editor.');
        return;
      }
      console.error('Supabase Query Error:', error);
    } else {
      console.log('\n[Status] Connected to Supabase successfully!');
      console.log(`[Status] Users Table accessible. Found ${data ? data.length : 0} user records.`);
    }
  } catch (err) {
    console.error('Connection exception:', err.message);
  }
}

testConnection();
