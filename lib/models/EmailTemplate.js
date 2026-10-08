import { createSupabaseModel } from '../supabaseAdapter.js';

export const EmailTemplate = createSupabaseModel('email_templates');
export default EmailTemplate;
