import UnifiedEmailWorkspace from '@/components/email/UnifiedEmailWorkspace';

export const metadata = {
  title: 'Personalized Email Workspace | MineTech Resources',
  description: 'Upload PDF emails, match with CRM companies and contacts, attach brochures, and dispatch bulk personalized outreach campaigns.',
};

export const dynamic = 'force-dynamic';

export default function WorkspacePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <UnifiedEmailWorkspace />
    </div>
  );
}
