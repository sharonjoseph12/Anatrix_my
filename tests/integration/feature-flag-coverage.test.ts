// tests/integration/feature-flag-coverage.test.ts — 11/10 — Feature flag check test
// Spec: specs/006-deep-signal-capture/spec.md (Feature flags section)
// Coverage: all 006_* flags exist in seed.sql with safe defaults

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SEED_PATH = path.resolve(__dirname, "../../supabase/seed.sql");

const EXPECTED_FLAGS = [
  "006_ide_telemetry",
  "006_biometrics_oura",
  "006_biometrics_whoop",
  "006_biometrics_mobile",
  "006_privacy_center",
  "006_audit_integrity_check",
  "006_deterministic_aggregates",
];

describe("feature-flags coverage", () => {
  it("seed.sql contains all 7 006_* feature flag keys", () => {
    const sql = readFileSync(SEED_PATH, "utf8");
    for (const flag of EXPECTED_FLAGS) {
      expect(sql).toContain(flag);
    }
  });

  it("each flag in seed.sql has enabled=false and cohort_pct=0 (safe defaults)", () => {
    const sql = readFileSync(SEED_PATH, "utf8");
    for (const flag of EXPECTED_FLAGS) {
      const line = sql.split("\n").find((l) => l.includes(flag));
      expect(line).toBeTruthy();
      expect(line!).toContain("false");
      expect(line!).toContain(", 0,");
    }
  });
});
