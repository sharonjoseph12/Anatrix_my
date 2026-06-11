// tests/integration/audit-pseudonymisation.test.ts — 11/10 — Pseudonymisation tests
// Spec: specs/006-deep-signal-capture/spec.md FR-AUD-002
// Coverage: sha256Hex determinism, different inputs produce different hashes

import { describe, it, expect } from "vitest";
import { sha256Hex } from "@antarix/utils/hash";

const SALT = "yearly-salt-2026";
const ACTOR_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("sha256Hex pseudonymisation", () => {
  it("sha256Hex(actorId + salt) produces a 64-char hex string", () => {
    const hash = sha256Hex(ACTOR_ID + SALT);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same inputs produce same hash (determinism)", () => {
    const hash1 = sha256Hex(ACTOR_ID + SALT);
    const hash2 = sha256Hex(ACTOR_ID + SALT);
    expect(hash1).toBe(hash2);
  });

  it("different inputs produce different hashes", () => {
    const hash1 = sha256Hex(ACTOR_ID + SALT);
    const hash2 = sha256Hex("different-actor" + SALT);
    const hash3 = sha256Hex(ACTOR_ID + "different-salt");
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash2).not.toBe(hash3);
  });
});
