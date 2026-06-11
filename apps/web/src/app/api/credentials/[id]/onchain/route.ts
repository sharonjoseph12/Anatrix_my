// ─── Credentials On-Chain API Route ─────────────────────────────────────────
// POST (request mirror) + GET (status)

import { createClient } from '@/lib/supabase/server';
import { evaluateMirrorGate } from '@/lib/kill-switch';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: credentialId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Gate check
  const gate = await evaluateMirrorGate(user.id);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason }, { status: gate.reason === 'kill_switch_active' ? 503 : 403 });
  }

  // Check for existing in-flight mirror
  const { data: existing } = await supabase
    .from('chain_mirror_queue')
    .select('id, status')
    .eq('credential_id', credentialId)
    .in('status', ['pending', 'submitted'])
    .single();

  if (existing) {
    return NextResponse.json({ error: 'mirror_already_in_flight', queue_id: existing.id }, { status: 409 });
  }

  // Enqueue
  const { data: queueRow, error } = await supabase
    .from('chain_mirror_queue')
    .insert({ student_id: user.id, credential_id: credentialId })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Audit
  await supabase.from('chain_mirror_audit').insert({
    student_id: user.id,
    credential_id: credentialId,
    action: 'mirror',
    attempt_index: 1,
  });

  return NextResponse.json({ queue_id: queueRow.id, status: 'pending' }, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: credentialId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: queue } = await supabase
    .from('chain_mirror_queue')
    .select('*')
    .eq('student_id', user.id)
    .eq('credential_id', credentialId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!queue) {
    return NextResponse.json({ status: 'not_mirrored' });
  }

  return NextResponse.json({
    queue_id: queue.id,
    status: queue.status,
    attestation_uid: queue.attestation_uid,
    explorer_url: queue.attestation_uid
      ? `https://basescan.org/tx/${queue.attestation_uid}`
      : null,
  });
}
