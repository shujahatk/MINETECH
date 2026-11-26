import { redirect } from 'next/navigation';

export default function CampaignsPage() {
  redirect('/email/workspace?view=campaigns');
}
