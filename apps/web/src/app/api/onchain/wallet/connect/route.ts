// ─── Wallet Connect API Route ───────────────────────────────────────────────
// POST; SIWE verify; returns verified address

import { verifySiwe } from '@/lib/onchain/siwe-verify';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { siwe_message, siwe_signature } = await req.json();
  const result = await verifySiwe(siwe_message, siwe_signature);

  return NextResponse.json({
    address: result.address,
    verified: true,
  });
}
