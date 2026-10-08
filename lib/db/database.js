import { supabaseAdmin } from '../supabase.js';

let cached = global._supabaseConnectionChecked || false;

/**
 * Validates primary Supabase PostgreSQL Database Connection
 */
export async function connectToDatabase() {
  if (cached) {
    return supabaseAdmin;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('FATAL: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable is not defined.');
  }

  global._supabaseConnectionChecked = true;
  cached = true;
  return supabaseAdmin;
}

export default connectToDatabase;
