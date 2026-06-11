// ─── Kill Switch ────────────────────────────────────────────────────────────
// 3-tier gate: master → tenant → student opt-in

import { createClient } from '@supabase/supabase-js';

export type GateResult =
  | { allowed: true }
  | { allowed: false; reason: 'kill_switch_active' | 'tenant_disabled' | 'opt_in_required' };

/**
 * Evaluate whether a student is allowed to use the on-chain mirror.
 * Checks in order:
 * 1. Master kill-switch (env ONCHAIN_MIRROR_ENABLED)
 * 2. Per-tenant flag (institutions.onchain_mirror_enabled)
 * 3. Per-student opt-in (users.onchain_mirror_opt_in)
 */
export async function evaluateMirrorGate(studentId: string): Promise<GateResult> {
  // 1. Master kill-switch
  const masterEnabled = process.env.ONCHAIN_MIRROR_ENABLED === 'true';
  if (!masterEnabled) {
    return { allowed: false, reason: 'kill_switch_active' };
  }

  // 2. Per-tenant + 3. Per-student — query both in one call
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: student, error } = await supabase
    .from('users')
    .select(`
      onchain_mirror_opt_in,
      institution:institutions!users_institution_id_fkey (
        onchain_mirror_enabled
      )
    `)
    .eq('id', studentId)
    .single();

  if (error || !student) {
    return { allowed: false, reason: 'opt_in_required' };
  }

  // Check tenant flag
  const institution = student.institution as { onchain_mirror_enabled: boolean } | null;
  if (institution && !institution.onchain_mirror_enabled) {
    return { allowed: false, reason: 'tenant_disabled' };
  }

  // Check student opt-in
  if (!student.onchain_mirror_opt_in) {
    return { allowed: false, reason: 'opt_in_required' };
  }

  return { allowed: true };
}
