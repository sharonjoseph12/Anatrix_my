import { OfflineRetryButton } from './_offline-retry-button';

export default function OfflinePage() {
  return (
    <main className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">You&apos;re offline</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Some data may be stale. Reconnect to sync the latest updates.
      </p>
      <OfflineRetryButton />
    </main>
  );
}
