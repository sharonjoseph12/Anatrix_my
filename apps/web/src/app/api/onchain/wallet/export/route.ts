// ─── Wallet Export API Route ────────────────────────────────────────────────
// POST; 2FA-gated; returns platform-custodial private key

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // TODO: 2FA verification gate here
  const { totp_code } = await req.json();
  if (!totp_code) {
    return NextResponse.json({ error: '2fa_required' }, { status: 403 });
  }

  // Fetch user's custodial info
  const { data: userData } = await supabase
    .from('users')
    .select('wallet_address, custodial_address_index')
    .eq('id', user.id)
    .single();

  if (!userData?.custodial_address_index && userData?.custodial_address_index !== 0) {
    return NextResponse.json({ error: 'no_custodial_wallet' }, { status: 404 });
  }

  // TODO: Fetch seed from Vault, derive key, return as one-time download
  // For now, return a placeholder
  return NextResponse.json({
    message: 'Key export would be returned as a one-time downloadable file',
    wallet_address: userData.wallet_address,
    derivation_path: `m/44'/60'/0'/0/${userData.custodial_address_index}`,
  });
}
