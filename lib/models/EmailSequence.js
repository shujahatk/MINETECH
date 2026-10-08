import { createSupabaseModel } from '../supabaseAdapter.js';

export const EmailSequence = createSupabaseModel('email_sequences');
export default EmailSequence;
