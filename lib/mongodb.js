/**
 * Deprecated: MineTech operates solely on Supabase PostgreSQL.
 * Native MongoDB is neither used nor required.
 */
import { supabaseAdmin } from './supabase.js';

export async function getClient() {
  return supabaseAdmin;
}

export async function getDb() {
  return supabaseAdmin;
}

export default getDb;
