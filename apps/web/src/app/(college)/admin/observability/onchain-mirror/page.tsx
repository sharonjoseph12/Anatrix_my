// ─── On-Chain Mirror Observability Dashboard ────────────────────────────────
// Admin-only, read-only dashboard showing daily metrics + kill-switch state

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'On-Chain Mirror Observability — Antarix Admin',
  description: 'Daily metrics and kill-switch status for on-chain mirrors',
};

export default async function OnChainObservabilityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin') redirect('/');

  // Fetch metrics
  const { data: metrics } = await supabase
    .from('daily_chain_mirror_metrics')
    .select('*')
    .order('day', { ascending: false })
    .limit(30);

  // Queue health
  const { data: queueHealth } = await supabase
    .from('chain_mirror_queue')
    .select('status')
    .then(({ data }) => {
      const counts: Record<string, number> = {};
      data?.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
      return { data: counts };
    });

  const masterEnabled = process.env.ONCHAIN_MIRROR_ENABLED === 'true';

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">On-Chain Mirror — Observability</h1>

        {/* Kill-switch state */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold mb-4">Kill-Switch State</h2>
          <div className="flex items-center gap-3">
            <div className={`h-4 w-4 rounded-full ${masterEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-lg font-medium">{masterEnabled ? 'ACTIVE (mirrors allowed)' : 'KILLED (no new mirrors)'}</span>
          </div>
        </section>

        {/* Queue health */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold mb-4">Queue Health</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {['pending', 'submitted', 'confirmed', 'failed', 'cancelled', 'dead_letter'].map((status) => (
              <div key={status} className="text-center">
                <p className="text-2xl font-bold">{(queueHealth as any)?.[status] ?? 0}</p>
                <p className="text-xs text-slate-400 mt-1">{status}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Daily metrics table */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Metrics (last 30 days)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-2 text-left">Day</th>
                  <th className="py-2 text-right">Mirrors</th>
                  <th className="py-2 text-right">Unmirrors</th>
                  <th className="py-2 text-right">Dead Letters</th>
                  <th className="py-2 text-right">Median Cost</th>
                  <th className="py-2 text-right">P95 Cost</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.map((row: any) => (
                  <tr key={row.day} className="border-b border-slate-800">
                    <td className="py-2">{row.day}</td>
                    <td className="py-2 text-right">{row.mirror_count}</td>
                    <td className="py-2 text-right">{row.unmirror_count}</td>
                    <td className="py-2 text-right">{row.dead_letter_count}</td>
                    <td className="py-2 text-right">${row.median_cost_usd?.toFixed(4) ?? '—'}</td>
                    <td className="py-2 text-right">${row.p95_cost_usd?.toFixed(4) ?? '—'}</td>
                  </tr>
                ))}
                {(!metrics || metrics.length === 0) && (
                  <tr><td colSpan={6} className="py-4 text-center text-slate-500">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
