'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function GlobalErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error('[Application Error Boundary Caught]:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-card border-border shadow-dialog p-6 text-center space-y-5">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-foreground">
            Application Error
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {error?.message || 'An unexpected error occurred.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-9 gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/email/workspace';
            }}
            className="w-full sm:w-auto border-border text-foreground hover:bg-muted text-xs h-9 gap-1.5"
          >
            <Home className="w-3.5 h-3.5 text-primary" />
            Return to Workspace
          </Button>
        </div>
      </Card>
    </div>
  );
}
