// ─── Verify On-Chain API Route ──────────────────────────────────────────────
// JSON variant of the resolver for API consumers

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/onchain/resolver-cache';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attestation_uid: string }> },
) {
  const { attestation_uid } = await params;

  // Check cache
  const cached = getCached<object>(`resolve:${attestation_uid}`);
  if (cached) {
    return NextResponse.json(cached);
  }

  const supabase = await createClient();

  const { data: audit } = await supabase
    .from('chain_mirror_audit')
    .select('*')
    .eq('attestation_uid', attestation_uid)
    .eq('action', 'mirror')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!audit) {
    return NextResponse.json({ error: 'attestation_not_found' }, { status: 404 });
  }

  const { data: revocation } = await supabase
    .from('chain_mirror_revocations')
    .select('*')
    .eq('attestation_uid', attestation_uid)
    .single();

  let credential = null;
  if (audit.credential_id) {
    const { data } = await supabase
      .from('verifiable_credentials')
      .select('public_slug, revocation_status')
      .eq('id', audit.credential_id)
      .single();
    credential = data;
  }

  const response = {
    attestation_uid,
    attested_by: process.env.EAS_ATTESTER_ADDRESS_BASE,
    chain: 'base',
    chain_id: 8453,
    tx_hash: audit.tx_hash,
    block_number: audit.block_number,
    chain_status: revocation ? 'revoked' : 'active',
    tombstoned_at: revocation?.revoked_at ?? null,
    vc_status: credential?.revocation_status ?? 'active',
    revocation_pointer: credential?.public_slug
      ? `${process.env.CREDENTIAL_PUBLIC_BASE_URL}/verify/${credential.public_slug}`
      : null,
    explorer_url: `https://basescan.org/tx/${audit.tx_hash}`,
    eas_scan_url: `https://base.easscan.org/attestation/view/${attestation_uid}`,
  };

  setCached(`resolve:${attestation_uid}`, response);

  return NextResponse.json(response);
}
