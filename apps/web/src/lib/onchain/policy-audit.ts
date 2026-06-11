// ─── Policy Audit ───────────────────────────────────────────────────────────
// Pure function: emit an audit row for every policy change

import { createClient } from '@supabase/supabase-js';
import type { MirrorAction } from '@antarix/types';

/**
 * Emit a policy audit event to chain_mirror_audit.
 * Called from every consent/policy change.
 */
export async function emitPolicyAudit(
  action: MirrorAction,
  actor: string,       // user ID of the person making the change
  subject: string,     // user ID of the student affected (may be same as actor)
  payload?: {
    institution_id?: string;
    consent_version?: string;
    error_message?: string;
  },
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await supabase.from('chain_mirror_audit').insert({
    student_id: subject,
    institution_id: payload?.institution_id ?? null,
    action,
    consent_version: payload?.consent_version ?? null,
    attempt_index: 1,
    error_message: payload?.error_message ?? null,
  });
}
