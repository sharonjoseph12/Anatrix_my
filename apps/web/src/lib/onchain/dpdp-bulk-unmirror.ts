// ─── DPDP Bulk Unmirror ─────────────────────────────────────────────────────
// Enqueue unmirror for all active mirrors of a deleted student

import { createClient } from '@supabase/supabase-js';

/**
 * Enqueue a bulk unmirror for all confirmed mirrors of a student.
 * Called when users.deletion_requested_at is set.
 *
 * @returns Array of queue IDs that were cancelled
 */
export async function enqueueBulkUnmirrorForStudent(
  studentId: string,
): Promise<string[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Find all confirmed mirrors
  const { data: mirrors } = await supabase
    .from('chain_mirror_queue')
    .select('id, attestation_uid, credential_id')
    .eq('student_id', studentId)
    .eq('status', 'confirmed');

  if (!mirrors?.length) return [];

  const cancelledIds: string[] = [];

  for (const mirror of mirrors) {
    // Cancel the mirror (unmirror dispatcher will pick it up)
    await supabase
      .from('chain_mirror_queue')
      .update({ status: 'cancelled' })
      .eq('id', mirror.id);

    // Audit
    await supabase.from('chain_mirror_audit').insert({
      student_id: studentId,
      credential_id: mirror.credential_id,
      attestation_uid: mirror.attestation_uid,
      action: 'unmirror_post_deletion',
      attempt_index: 1,
    });

    cancelledIds.push(mirror.id);
  }

  // Also cancel any pending/submitted mirrors
  const { data: pending } = await supabase
    .from('chain_mirror_queue')
    .select('id')
    .eq('student_id', studentId)
    .in('status', ['pending', 'submitted']);

  if (pending?.length) {
    for (const p of pending) {
      await supabase
        .from('chain_mirror_queue')
        .update({ status: 'cancelled', last_error: 'deletion_requested' })
        .eq('id', p.id);
      cancelledIds.push(p.id);
    }
  }

  return cancelledIds;
}
