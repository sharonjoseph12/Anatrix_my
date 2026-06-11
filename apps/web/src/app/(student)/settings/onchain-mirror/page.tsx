// ─── On-Chain Mirror Settings Page ──────────────────────────────────────────
// Student settings: opt-in toggle, active mirrors list, unmirror all, key export

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'On-Chain Mirror Settings — Antarix',
  description: 'Manage your on-chain credential mirrors',
};

export default async function OnChainMirrorSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('onchain_mirror_opt_in, wallet_address, custodial_address_index')
    .eq('id', user.id)
    .single();

  const { data: activeMirrors } = await supabase
    .from('chain_mirror_queue')
    .select('id, credential_id, attestation_uid, status, confirmed_at')
    .eq('student_id', user.id)
    .eq('status', 'confirmed')
    .order('confirmed_at', { ascending: false });

  const { data: consent } = await supabase
    .from('chain_mirror_consents')
    .select('*')
    .eq('student_id', user.id)
    .is('revoked_at', null)
    .order('granted_at', { ascending: false })
    .limit(1)
    .single();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">On-Chain Mirror</h1>

        {/* Opt-in status */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold mb-4">Status</h2>
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${userData?.onchain_mirror_opt_in ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            <span>{userData?.onchain_mirror_opt_in ? 'Opted In' : 'Opted Out'}</span>
          </div>
          {userData?.wallet_address && (
            <p className="mt-2 text-sm text-slate-400 font-mono">{userData.wallet_address}</p>
          )}
          {consent && (
            <p className="mt-1 text-xs text-slate-500">Consent version: {consent.consent_version} · Wallet: {consent.wallet_type}</p>
          )}
        </section>

        {/* Active mirrors */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold mb-4">Active Mirrors ({activeMirrors?.length ?? 0})</h2>
          {activeMirrors && activeMirrors.length > 0 ? (
            <ul className="space-y-3">
              {activeMirrors.map((mirror) => (
                <li key={mirror.id} className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <p className="text-sm font-mono text-slate-300">{mirror.attestation_uid?.slice(0, 20)}…</p>
                    <p className="text-xs text-slate-500">{mirror.confirmed_at ? new Date(mirror.confirmed_at).toLocaleDateString() : ''}</p>
                  </div>
                  <a
                    href={`https://base.easscan.org/attestation/view/${mirror.attestation_uid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    EAS Scan ↗
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No active mirrors</p>
          )}
        </section>

        {/* Actions */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="flex gap-3">
            <form action="/api/onchain/consent" method="POST">
              <button
                type="submit"
                className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-2 text-sm text-red-400 hover:bg-red-950/40"
              >
                Unmirror All
              </button>
            </form>
            {userData?.custodial_address_index !== null && (
              <a
                href="/api/onchain/wallet/export"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800"
              >
                Export Key
              </a>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
