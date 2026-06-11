// ─── College Admin On-Chain Policy Page ─────────────────────────────────────
// Per-tenant flag toggle for on-chain mirror

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'On-Chain Policy — Antarix Admin',
  description: 'Manage on-chain mirror policy for your institution',
};

export default async function OnChainPolicyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('role, institution_id')
    .eq('id', user.id)
    .single();

  if (!userData || userData.role !== 'admin') redirect('/');

  const { data: institution } = await supabase
    .from('institutions')
    .select('id, name, onchain_mirror_enabled')
    .eq('id', userData.institution_id)
    .single();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">On-Chain Mirror Policy</h1>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold mb-4">{institution?.name ?? 'Your Institution'}</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Allow On-Chain Mirrors</p>
              <p className="text-xs text-slate-400 mt-1">
                Students can mirror their W3C credentials to Base L2 via EAS
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${institution?.onchain_mirror_enabled ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              <span className="text-sm">{institution?.onchain_mirror_enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
