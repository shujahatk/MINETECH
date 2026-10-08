import { createSupabaseModel } from '../supabaseAdapter.js';

export const EmailThread = createSupabaseModel('email_threads');
export default EmailThread;
