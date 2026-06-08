// apps/web/src/lib/signals/feature-flag.ts
// 11/10 — Feature-flag helper for 006 capabilities (FR-IDE-001, FR-BIO-001,
// FR-PRI-001). Reads from the public.feature_flags table (created in 002,
// extended in 004 and 006); falls back to env-var guard for local dev.
//
// The six 006 flags (set in seed.sql via supabase/seed.sql) are:
//   006_ide_telemetry, 006_biometrics_oura, 006_biometrics_whoop,
//   006_biometrics_mobile, 006_privacy_center, 006_audit_integrity_check.

import { createSupabaseServerClient } from '@/lib/supabase/server';

export type FeatureFlagKey =
  | '006_ide_telemetry'
  | '006_biometrics_oura'
  | '006_biometrics_whoop'
  | '006_biometrics_mobile'
  | '006_privacy_center'
  | '006_audit_integrity_check';

const FLAG_ENV_MAP: Record<FeatureFlagKey, string | undefined> = {
  '006_ide_telemetry':         process.env.IDE_TELEMETRY_ENABLED,
  '006_biometrics_oura':       undefined,
  '006_biometrics_whoop':      undefined,
  '006_biometrics_mobile':     process.env.MOBILE_BRIDGE_SHARED_SECRET ? 'true' : undefined,
  '006_privacy_center':        undefined,
  '006_audit_integrity_check': undefined,
};

export async function isFlagEnabled(key: FeatureFlagKey, studentId: string): Promise<boolean> {
  // Dev/local override via env var.
  const envVal = FLAG_ENV_MAP[key];
  if (envVal === 'true') return true;
  if (envVal === undefined || envVal === 'false') {
    // No env override — check the DB feature_flags table.
    // This skip is fine in local dev where the table may not be seeded;
    // the env var is the dev escape hatch.
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('feature_flags')
      .select('enabled, cohort_pct')
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return false;
    if (!data.enabled) return false;
    // cohort_pct-based rollout (0-100): use student_id as a deterministic
    // hash bucket so a student sees a consistent experience.
    if (typeof data.cohort_pct !== 'number' || data.cohort_pct >= 100) return data.enabled ?? false;
    const bucket = simpleHash(studentId) % 100;
    return bucket < data.cohort_pct;
  } catch {
    // If the feature_flags table doesn't exist yet (early migration state),
    // default to off.
    return false;
  }
}

function simpleHash(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + code;
    hash |= 0;
  }
  return Math.abs(hash);
}
