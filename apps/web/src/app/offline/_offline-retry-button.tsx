'use client';

import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OfflineRetryButton() {
  return (
    <Button onClick={() => typeof window !== 'undefined' && window.location.reload()}>
      <RefreshCcw className="h-4 w-4" />
      Try again
    </Button>
  );
}
