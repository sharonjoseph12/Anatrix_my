// ─── Unmirror API Route ─────────────────────────────────────────────────────
// DELETE (unmirror); idempotent

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attestation_uid: string }> },
) {
  const { id: credentialId, attestation_uid } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Find the confirmed mirror
  const { data: queue } = await supabase
    .from('chain_mirror_queue')
    .select('*')
    .eq('student_id', user.id)
    .eq('credential_id', credentialId)
    .eq('attestation_uid', attestation_uid)
    .eq('status', 'confirmed')
    .single();

  if (!queue) {
    // Idempotent — already cancelled or not found
    return NextResponse.json({ status: 'already_unmirored_or_not_found' });
  }

  // Cancel it — the unmirror dispatcher will pick it up
  await supabase
    .from('chain_mirror_queue')
    .update({ status: 'cancelled' })
    .eq('id', queue.id);

  await supabase.from('chain_mirror_audit').insert({
    student_id: user.id,
    credential_id: credentialId,
    attestation_uid,
    action: 'unmirror',
    attempt_index: 1,
  });

  return NextResponse.json({ status: 'unmirror_queued' });
}
