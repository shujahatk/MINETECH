import { createSupabaseModel } from '../supabaseAdapter.js';

export const SMSMessage = createSupabaseModel('sms_messages');
export default SMSMessage;
