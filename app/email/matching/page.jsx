import UnifiedEmailWorkspace from '@/components/email/UnifiedEmailWorkspace';

export const metadata = {
  title: 'Personalized Email Workspace | MineTech Resources',
  description: 'AI-assisted B2B company matching, contact resolution, document attachments, and bulk personalized campaign orchestration',
};

export const dynamic = 'force-dynamic';

export default function MatchingPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <UnifiedEmailWorkspace />
    </div>
  );
}
