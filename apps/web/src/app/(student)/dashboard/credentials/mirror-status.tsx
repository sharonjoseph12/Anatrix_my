'use client';

// ─── Mirror Status Badge ────────────────────────────────────────────────────
// Shows current on-chain mirror status for a credential

import { useEffect, useState } from 'react';
import type { QueueStatus } from '@antarix/types';

interface MirrorStatusProps {
  credentialId: string;
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  not_mirrored: { label: 'Not Mirrored', color: 'text-slate-500' },
  pending: { label: 'Pending', color: 'text-yellow-400' },
  submitted: { label: 'Submitted', color: 'text-blue-400' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-400' },
  failed: { label: 'Failed', color: 'text-red-400' },
  cancelled: { label: 'Cancelled', color: 'text-slate-400' },
  dead_letter: { label: 'Dead Letter', color: 'text-red-500' },
};

export default function MirrorStatus({ credentialId }: MirrorStatusProps) {
  const [status, setStatus] = useState<string>('not_mirrored');
  const [attestationUid, setAttestationUid] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      const res = await fetch(`/api/credentials/${credentialId}/onchain`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setAttestationUid(data.attestation_uid ?? null);
      }
    }
    fetchStatus();
  }, [credentialId]);

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.not_mirrored!;

  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-medium ${style.color}`}>{style.label}</span>
      {status === 'confirmed' && attestationUid && (
        <div className="flex gap-2 ml-2">
          <a
            href={`https://base.easscan.org/attestation/view/${attestationUid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            EAS Scan ↗
          </a>
          <a
            href={`/verify/onchain/${attestationUid}`}
            className="text-xs text-slate-400 hover:text-slate-300"
          >
            Resolver ↗
          </a>
        </div>
      )}
    </div>
  );
}
