import { createSupabaseModel } from '../supabaseAdapter.js';

export const EmailMessage = createSupabaseModel('email_messages');
export default EmailMessage;
