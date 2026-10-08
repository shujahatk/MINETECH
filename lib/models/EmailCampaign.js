import { createSupabaseModel } from '../supabaseAdapter.js';

export const EmailCampaign = createSupabaseModel('email_campaigns');
export default EmailCampaign;
