import { createSupabaseModel } from '../supabaseAdapter.js';

export const User = createSupabaseModel('users');
export default User;
