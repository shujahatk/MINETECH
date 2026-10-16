import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../buttons/Button';
import { cn } from '../../utils/cn';

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this section.',
  onRetry,
  className = '',
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-6 text-center border border-destructive/20 bg-destructive/5 rounded-xl', className)}>
      <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-3.5 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Try again</span>
        </Button>
      )}
    </div>
  );
}

export default ErrorState;
