import { createSupabaseModel } from '../supabaseAdapter.js';

export const EmailRecipient = createSupabaseModel('email_recipients');
export default EmailRecipient;
