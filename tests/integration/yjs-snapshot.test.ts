import { describe, expect, it } from "vitest";

import {
  Y,
  applyUpdate,
  encodeUpdate,
  mergeUpdates,
  shouldCreateSnapshot,
} from "../../apps/web/src/lib/collab/yjs-snapshot";

describe("Y.js snapshot helpers", () => {
  it("roundtrips a document snapshot", () => {
    const source = new Y.Doc();
    source.getText("code").insert(0, "export const answer = 42;");

    const target = new Y.Doc();
    applyUpdate(target, encodeUpdate(source));

    expect(target.getText("code").toString()).toBe("export const answer = 42;");
  });

  it("merges incremental updates before rehydration", () => {
    const source = new Y.Doc();
    const updates: Uint8Array[] = [];
    source.on("update", (update: Uint8Array) => updates.push(update));

    const text = source.getText("code");
    text.insert(0, "const ");
    text.insert(6, "value = 1;");

    const target = new Y.Doc();
    applyUpdate(target, mergeUpdates(updates));

    expect(target.getText("code").toString()).toBe("const value = 1;");
  });

  it("starts a snapshot at the five-minute boundary", () => {
    const start = Date.UTC(2026, 5, 11, 12, 0, 0);

    expect(shouldCreateSnapshot(null, start)).toBe(true);
    expect(shouldCreateSnapshot(start, start + 299_999)).toBe(false);
    expect(shouldCreateSnapshot(start, start + 300_000)).toBe(true);
  });
});
