// ─── OG Image for On-Chain Verification ─────────────────────────────────────
import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const alt = 'Antarix On-Chain Mirror';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ attestation_uid: string }> }) {
  const { attestation_uid } = await params;
  const supabase = await createClient();

  const { data: audit } = await supabase
    .from('chain_mirror_audit')
    .select('*')
    .eq('attestation_uid', attestation_uid)
    .eq('action', 'mirror')
    .limit(1)
    .single();

  const score = audit?.usd_cost ?? '—';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#0f172a',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10b981' }} />
          <span style={{ fontSize: '32px', fontWeight: 'bold' }}>Mirrored on Base L2 by Antarix</span>
        </div>
        <div style={{ fontSize: '24px', color: '#94a3b8' }}>
          {attestation_uid.slice(0, 20)}…
        </div>
      </div>
    ),
    { ...size },
  );
}
