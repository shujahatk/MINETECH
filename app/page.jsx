import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/services/authService';

export const dynamic = 'force-dynamic';

export default function RootPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;
  const decoded = verifyToken(token);

  if (decoded && decoded.userId) {
    redirect('/workstation');
  } else {
    redirect('/login');
  }
}
