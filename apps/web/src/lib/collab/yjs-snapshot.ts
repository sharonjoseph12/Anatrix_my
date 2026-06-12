import * as Y from "yjs";

export { Y };

export const DEFAULT_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

export function encodeUpdate(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function applyUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update);
}

export function mergeUpdates(updates: readonly Uint8Array[]): Uint8Array {
  return Y.mergeUpdates([...updates]);
}

export function shouldCreateSnapshot(
  lastSnapshotAtMs: number | null,
  nowMs: number,
  intervalMs = DEFAULT_SNAPSHOT_INTERVAL_MS,
): boolean {
  if (lastSnapshotAtMs === null) return true;
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastSnapshotAtMs)) return false;
  return nowMs - lastSnapshotAtMs >= intervalMs;
}
