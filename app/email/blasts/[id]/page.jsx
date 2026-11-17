'use client';

import React from 'react';
import CampaignReviewScreen from '@/components/email/CampaignReviewScreen';
import { useRouter } from 'next/navigation';

export default function CampaignReviewPage({ params }) {
  const router = useRouter();
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <CampaignReviewScreen
        campaignId={params.id}
        onBack={() => router.push('/email/blasts')}
      />
    </div>
  );
}
