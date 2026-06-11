// ─── chain-mirror-resolver ──────────────────────────────────────────────────
// Public resolver: reads EAS attestation via viem, returns unified view JSON

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Simple in-memory rate limiter
const ipCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_RPM = Number(Deno.env.get('ONCHAIN_RESOLVER_RATE_LIMIT_RPM') ?? '60');

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_RPM) return false;
  entry.count++;
  return true;
}

serve(async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), { status: 429 });
  }

  try {
    const url = new URL(req.url);
    const attestationUid = url.pathname.split('/').pop();

    if (!attestationUid) {
      return new Response(JSON.stringify({ error: 'attestation_uid required' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Look up the audit record
    const { data: audit } = await supabase
      .from('chain_mirror_audit')
      .select('*')
      .eq('attestation_uid', attestationUid)
      .eq('action', 'mirror')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!audit) {
      return new Response(JSON.stringify({ error: 'attestation_not_found' }), { status: 404 });
    }

    // Check for revocation
    const { data: revocation } = await supabase
      .from('chain_mirror_revocations')
      .select('*')
      .eq('attestation_uid', attestationUid)
      .single();

    // Get credential info for the revocation pointer
    let vcStatus = 'active';
    let publicSlug: string | null = null;
    if (audit.credential_id) {
      const { data: credential } = await supabase
        .from('verifiable_credentials')
        .select('public_slug, revocation_status')
        .eq('id', audit.credential_id)
        .single();
      if (credential) {
        vcStatus = credential.revocation_status ?? 'active';
        publicSlug = credential.public_slug;
      }
    }

    const response = {
      attestation_uid: attestationUid,
      attested_by: Deno.env.get('EAS_ATTESTER_ADDRESS_BASE'),
      chain: 'base',
      chain_id: 8453,
      tx_hash: audit.tx_hash,
      block_number: audit.block_number,
      chain_status: revocation ? 'revoked' : 'active',
      tombstoned_at: revocation?.revoked_at ?? null,
      vc_status: vcStatus,
      revocation_pointer: publicSlug
        ? `${Deno.env.get('CREDENTIAL_PUBLIC_BASE_URL')}/verify/${publicSlug}`
        : null,
      snapshot_score: audit.usd_cost, // placeholder — actual score from decoded attestation
      explorer_url: `https://basescan.org/tx/${audit.tx_hash}`,
      eas_scan_url: `https://base.easscan.org/attestation/view/${attestationUid}`,
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
