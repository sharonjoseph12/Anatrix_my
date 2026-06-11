// ─── Consent API Route ──────────────────────────────────────────────────────
// POST (grant consent) + DELETE (revoke consent)

import { createClient } from '@/lib/supabase/server';
import { verifySiwe } from '@/lib/onchain/siwe-verify';
import { NextRequest, NextResponse } from 'next/server';
import { keccak256, stringToBytes } from 'viem';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { wallet_type, siwe_message, siwe_signature, consent_text } = body;

  let walletAddress: string;
  let custodialPath: string | null = null;

  if (wallet_type === 'self_custody') {
    // Verify SIWE
    const result = await verifySiwe(siwe_message, siwe_signature);
    walletAddress = result.address;
  } else {
    // Platform custodial — derive address
    // In production, fetch seed from Vault and derive
    walletAddress = `0x${'0'.repeat(40)}`; // placeholder
    custodialPath = `m/44'/60'/0'/0/0`; // placeholder
  }

  const consentTextHash = keccak256(stringToBytes(consent_text));
  const ipHash = keccak256(stringToBytes(req.headers.get('x-forwarded-for') ?? 'unknown'));

  // Insert consent
  const { error } = await supabase.from('chain_mirror_consents').insert({
    student_id: user.id,
    consent_version: process.env.CHAIN_MIRROR_CONSENT_VERSION ?? 'v1.0',
    wallet_type,
    wallet_address: walletAddress,
    custodial_derivation_path: custodialPath,
    consent_text_hash: consentTextHash,
    ip_hash: ipHash,
    user_agent: req.headers.get('user-agent')?.slice(0, 512) ?? 'unknown',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Update user opt-in + wallet
  await supabase.from('users').update({
    onchain_mirror_opt_in: true,
    wallet_address: walletAddress,
  }).eq('id', user.id);

  // Audit
  await supabase.from('chain_mirror_audit').insert({
    student_id: user.id,
    action: 'consent_granted',
    consent_version: process.env.CHAIN_MIRROR_CONSENT_VERSION ?? 'v1.0',
    attempt_index: 1,
  });

  return NextResponse.json({ status: 'consent_granted' }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Revoke active consent
  await supabase
    .from('chain_mirror_consents')
    .update({ revoked_at: new Date().toISOString() })
    .eq('student_id', user.id)
    .is('revoked_at', null);

  // Update user opt-in
  await supabase.from('users').update({ onchain_mirror_opt_in: false }).eq('id', user.id);

  // Audit
  await supabase.from('chain_mirror_audit').insert({
    student_id: user.id,
    action: 'consent_revoked',
    attempt_index: 1,
  });

  return NextResponse.json({ status: 'consent_revoked' });
}
