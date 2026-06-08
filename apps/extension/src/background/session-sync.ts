// apps/extension/src/background/session-sync.ts
// The hourly alarm delegates here. It delegates to the `runSync` helper in
// ./sync.ts which already knows how to drain the pending-session queue via
// the supabase functions.invoke edge function `session-upload`. This thin
// wrapper exists so the service worker can `import()` it lazily and to give
// us a place to add retry/circuit-breaker logic later without touching
// the worker entry point.

import { runSync, type SyncResult } from "./sync";

export async function runSessionSync(): Promise<SyncResult> {
  return runSync();
}
