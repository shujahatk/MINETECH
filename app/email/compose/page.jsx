'use client';

import React from 'react';
import ComposeModal from '@/components/email/ComposeModal';
import { useRouter } from 'next/navigation';

export default function ComposePage() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <ComposeModal
        onClose={() => router.push('/email/inbox')}
        onSent={() => router.push('/email/inbox')}
      />
    </div>
  );
}
