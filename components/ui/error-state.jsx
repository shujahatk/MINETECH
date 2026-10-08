'use client';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorState({ message = 'This information could not be loaded.', onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-[13px] text-rose-800 dark:text-rose-300"
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  );
}
