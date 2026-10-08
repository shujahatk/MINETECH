import { createSupabaseModel } from '../supabaseAdapter.js';

export const AuditLog = createSupabaseModel('audit_logs');
export default AuditLog;
