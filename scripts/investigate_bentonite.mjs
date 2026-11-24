import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import { supabaseAdmin } from '../lib/supabase.js';

async function main() {
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('id, company, full_name, email, tags, created_at, status')
    .filter('created_at', 'gte', '2026-11-03T00:00:00')
    .filter('created_at', 'lte', '2026-11-03T23:59:59');

  console.log(`Recovered Bentonite Suppliers Leads Count: ${leads.length}`);
  leads.forEach((l, idx) => {
    console.log(`${idx + 1}. [${l.id}] ${l.company || l.full_name} (${l.email || 'No email'}) - Status: ${l.status}`);
  });
}

main().catch(console.error);
