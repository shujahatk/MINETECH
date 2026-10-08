import { createSupabaseModel } from '../supabaseAdapter.js';

export const ActivityLog = createSupabaseModel('activity_logs');
export default ActivityLog;
