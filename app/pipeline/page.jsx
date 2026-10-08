import LeadTable from '@/components/leads/LeadTable';

export default function PipelinePage() {
  return (
    <LeadTable
      initialView="pipeline"
      sectionTitle="Sales & Opportunity Pipeline"
      sectionDescription="8-stage industrial mineral sales pipeline, product taxonomy, sample assays, and trial load progressions."
    />
  );
}
