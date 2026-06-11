// tests/integration/feature-flag-coverage.test.ts — 11/10 — Feature flag check test
// Spec: specs/006-deep-signal-capture/spec.md (Feature flags section)
// Coverage: all 006_* flags in feature-flag.ts type, FLAG_ENV_MAP, seed.sql migration doc

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const FEATURE_FLAG_SRC = path.resolve(__dirname, "../../apps/web/src/lib/signals/feature-flag.ts");
const MIGRATION_PATH = path.resolve(__dirname, "../../supabase/migrations/043_deep_signal_capture.sql");

const EXPECTED_FLAGS = [
  "006_ide_telemetry",
  "006_biometrics_oura",
  "006_biometrics_whoop",
  "006_biometrics_mobile",
  "006_privacy_center",
  "006_audit_integrity_check",
];

describe("feature-flags coverage", () => {
  it("feature-flag.ts type definition includes all 6 006_* flag keys", () => {
    const src = readFileSync(FEATURE_FLAG_SRC, "utf8");
    for (const flag of EXPECTED_FLAGS) {
      expect(src).toContain(flag);
    }
  });

  it("feature-flag.ts export type FeatureFlagKey has all 6 flags", () => {
    const src = readFileSync(FEATURE_FLAG_SRC, "utf8");
    const typeBlock = src.match(/export type FeatureFlagKey =[\s\S]*?;/);
    expect(typeBlock).toBeTruthy();
    for (const flag of EXPECTED_FLAGS) {
      expect(typeBlock![0]).toContain(flag);
    }
  });

  it("FLAG_ENV_MAP in feature-flag.ts has entries for all 6 flags", () => {
    const src = readFileSync(FEATURE_FLAG_SRC, "utf8");
    const mapBlock = src.match(/const FLAG_ENV_MAP[\s\S]*?\};/);
    expect(mapBlock).toBeTruthy();
    for (const flag of EXPECTED_FLAGS) {
      expect(mapBlock![0]).toContain(flag);
    }
  });

  it("migration 043 header references 006 Deep Signal Capture", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).toContain("006");
    expect(sql).toContain("Deep Signal Capture");
  });
});
