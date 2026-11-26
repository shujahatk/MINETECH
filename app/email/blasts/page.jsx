import { redirect } from 'next/navigation';

export default function BlastsPage() {
  redirect('/email/workspace?view=campaigns');
}
