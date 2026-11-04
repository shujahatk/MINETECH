import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

if (typeof window === 'undefined' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: '.env' });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-service-key';

const publicAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-anon-key';

/**
 * Server-side Admin Supabase Client (bypasses RLS for backend API operations)
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Client-side / Public Supabase Client (Enforces RLS with public anonymous key)
 */
export const supabase = createClient(supabaseUrl, publicAnonKey);

export default supabaseAdmin;
