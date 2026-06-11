// ─── On-Chain Verification Page ─────────────────────────────────────────────
// Public SSR page to view on-chain attestation details

import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ attestation_uid: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { attestation_uid } = await params;
  return {
    title: `On-Chain Verification — ${attestation_uid.slice(0, 10)}…`,
    description: 'Verify an Antarix credential mirrored on Base L2 via EAS',
  };
}

export default async function OnChainVerifyPage({ params }: Props) {
  const { attestation_uid } = await params;
  const supabase = await createClient();

  // Fetch audit record
  const { data: audit } = await supabase
    .from('chain_mirror_audit')
    .select('*')
    .eq('attestation_uid', attestation_uid)
    .eq('action', 'mirror')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!audit) return notFound();

  // Check revocation
  const { data: revocation } = await supabase
    .from('chain_mirror_revocations')
    .select('*')
    .eq('attestation_uid', attestation_uid)
    .single();

  // Fetch credential
  let credential = null;
  if (audit.credential_id) {
    const { data } = await supabase
      .from('verifiable_credentials')
      .select('public_slug, revocation_status')
      .eq('id', audit.credential_id)
      .single();
    credential = data;
  }

  const isRevoked = !!revocation;
  const chainStatus = isRevoked ? 'revoked' : 'active';
  const vcStatus = credential?.revocation_status ?? 'active';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-4 py-16">
        {/* Banner */}
        <div className={`rounded-2xl border p-6 mb-8 ${
          isRevoked
            ? 'border-red-500/30 bg-red-950/20'
            : 'border-emerald-500/30 bg-emerald-950/20'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${isRevoked ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
            <h1 className="text-2xl font-bold">
              {isRevoked ? 'Revoked On-Chain Mirror' : 'Verified On-Chain Mirror'}
            </h1>
          </div>
          <p className="mt-2 text-slate-400">
            Mirrored on Base L2 via Ethereum Attestation Service
          </p>
        </div>

        {/* Attestation Details */}
        <div className="space-y-4">
          <DetailRow label="Attestation UID" value={attestation_uid} mono />
          <DetailRow label="Chain Status" value={chainStatus} />
          <DetailRow label="VC Status" value={vcStatus} />
          {audit.tx_hash && (
            <DetailRow label="Transaction" value={audit.tx_hash} mono link={`https://basescan.org/tx/${audit.tx_hash}`} />
          )}
          {audit.block_number && (
            <DetailRow label="Block" value={String(audit.block_number)} />
          )}
          <DetailRow label="Attested At" value={new Date(audit.created_at).toLocaleString()} />
          {revocation && (
            <DetailRow label="Revoked At" value={new Date(revocation.revoked_at).toLocaleString()} />
          )}
        </div>

        {/* Links */}
        <div className="mt-8 flex gap-4">
          <a
            href={`https://base.easscan.org/attestation/view/${attestation_uid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            View on EAS Scan ↗
          </a>
          {credential?.public_slug && (
            <a
              href={`/verify/${credential.public_slug}`}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 transition-colors"
            >
              View W3C Credential
            </a>
          )}
        </div>
      </div>
    </main>
  );
}

function DetailRow({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 border-b border-slate-800 pb-3">
      <span className="text-sm font-medium text-slate-400 sm:w-40 shrink-0">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className={`text-blue-400 hover:text-blue-300 break-all ${mono ? 'font-mono text-sm' : ''}`}>
          {value}
        </a>
      ) : (
        <span className={`break-all ${mono ? 'font-mono text-sm' : ''}`}>{value}</span>
      )}
    </div>
  );
}
