// ─── On-Chain Badge ─────────────────────────────────────────────────────────
// Recruiter dashboard widget showing on-chain mirror status

import { createClient } from '@/lib/supabase/server';

interface OnChainBadgeProps {
  studentId: string;
}

export default async function OnChainBadge({ studentId }: OnChainBadgeProps) {
  const supabase = await createClient();

  const { data: mirrors, count } = await supabase
    .from('chain_mirror_queue')
    .select('attestation_uid, confirmed_at', { count: 'exact' })
    .eq('student_id', studentId)
    .eq('status', 'confirmed')
    .order('confirmed_at', { ascending: false })
    .limit(1);

  if (!count || count === 0) return null;

  const latest = mirrors?.[0];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/10 px-3 py-2">
      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-sm font-medium text-emerald-400">On-Chain Mirror</span>
      <span className="text-xs text-slate-400">({count} attestation{count > 1 ? 's' : ''})</span>
      {latest?.attestation_uid && (
        <a
          href={`https://base.easscan.org/attestation/view/${latest.attestation_uid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-blue-400 hover:text-blue-300"
        >
          EAS Scan ↗
        </a>
      )}
    </div>
  );
}
