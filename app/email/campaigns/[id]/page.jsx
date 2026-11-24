'use client';

import React from 'react';
import CampaignReviewScreen from '@/components/email/CampaignReviewScreen';
import { useRouter, useParams } from 'next/navigation';

export default function CampaignReviewPage({ params }) {
  const router = useRouter();
  const routeParams = useParams();
  const campaignId = routeParams?.id || params?.id;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <CampaignReviewScreen
        campaignId={campaignId}
        onBack={() => router.push('/email/workspace')}
      />
    </div>
  );
}
