// ─── On-Chain Policy API Route ──────────────────────────────────────────────
// GET (read all 3 gates) + PATCH (per-tenant flag, admin-only)

import { createClient } from '@/lib/supabase/server';
import { evaluateMirrorGate } from '@/lib/kill-switch';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const gate = await evaluateMirrorGate(user.id);

  return NextResponse.json({
    master_enabled: process.env.ONCHAIN_MIRROR_ENABLED === 'true',
    gate_result: gate,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Check admin role
  const { data: userData } = await supabase
    .from('users')
    .select('role, institution_id')
    .eq('id', user.id)
    .single();

  if (!userData || userData.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { onchain_mirror_enabled } = await req.json();

  const { error } = await supabase
    .from('institutions')
    .update({ onchain_mirror_enabled })
    .eq('id', userData.institution_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ status: 'updated', onchain_mirror_enabled });
}
