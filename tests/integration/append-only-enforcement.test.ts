// tests/integration/append-only-enforcement.test.ts — 11/10 — signal_audit append-only DB test
// Spec: specs/006-deep-signal-capture/spec.md FR-PRI-008, data-model.md line 290
// Coverage: migration file contains the REVOKE statement

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.resolve(__dirname, "../../supabase/migrations/043_deep_signal_capture.sql");

describe("signal_audit append-only enforcement", () => {
  it("migration 043 contains the signal_audit REVOKE statement", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).toContain("revoke update, delete on public.signal_audit from authenticated, anon, service_role");
  });

  it("REVOKE explicitly lists all three roles on the actual SQL line (not comment)", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    const revokeLine = sql
      .split("\n")
      .find((l) => l.trim().toLowerCase().startsWith("revoke") && l.includes("signal_audit"));
    expect(revokeLine).toBeTruthy();
    expect(revokeLine!.toLowerCase()).toContain("authenticated");
    expect(revokeLine!.toLowerCase()).toContain("anon");
    expect(revokeLine!.toLowerCase()).toContain("service_role");
  });

  it("the INSERT privilege is not revoked", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    const revokeLine = sql
      .split("\n")
      .find((l) => l.trim().toLowerCase().startsWith("revoke") && l.includes("signal_audit"));
    expect(revokeLine).toBeTruthy();
    expect(revokeLine!.toLowerCase()).not.toContain("insert");
  });
});
