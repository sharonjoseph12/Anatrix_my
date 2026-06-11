'use client';

// ─── Mirror Button ──────────────────────────────────────────────────────────
// "Mirror on-chain" CTA with consent modal

import { useState } from 'react';

interface MirrorButtonProps {
  credentialId: string;
  snapshotScore?: number;
}

export default function MirrorButton({ credentialId, snapshotScore }: MirrorButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [walletType, setWalletType] = useState<'self_custody' | 'platform_custodial'>('platform_custodial');
  const [includeBonus, setIncludeBonus] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const consentText = `I authorize Antarix to write a hash of my verified W3C credential to the Ethereum Attestation Service (EAS) on Base L2. The on-chain entry contains no personal information — only a checksum of the credential, a pointer back to the credential's public verification page, and a snapshot score. I can revoke the on-chain entry at any time; revocation marks the entry as inactive on-chain (it cannot be deleted). I understand this is optional and is in addition to my existing 002 W3C VC, which remains the source of truth.`;

  async function handleMirror() {
    setLoading(true);
    try {
      // 1. Grant consent
      const consentRes = await fetch('/api/onchain/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_type: walletType,
          consent_text: consentText,
        }),
      });

      if (!consentRes.ok) {
        const err = await consentRes.json();
        setStatus(`Consent failed: ${err.error}`);
        return;
      }

      // 2. Request mirror
      const mirrorRes = await fetch(`/api/credentials/${credentialId}/onchain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ include_reputation_bonus: includeBonus }),
      });

      const data = await mirrorRes.json();
      if (mirrorRes.ok) {
        setStatus('Mirror queued! The dispatcher will process it within 5 minutes.');
        setIsOpen(false);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 transition-all"
      >
        <span className="text-lg">⛓</span>
        Mirror On-Chain
      </button>

      {status && (
        <p className="mt-2 text-sm text-slate-400">{status}</p>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Mirror Credential On-Chain</h2>

            {/* Consent text */}
            <div className="mb-4 rounded-lg bg-slate-800 p-4 text-sm text-slate-300 max-h-40 overflow-y-auto">
              {consentText}
            </div>

            {/* Wallet choice */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-400 mb-2">Wallet</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setWalletType('platform_custodial')}
                  className={`flex-1 rounded-lg border p-3 text-sm ${
                    walletType === 'platform_custodial'
                      ? 'border-blue-500 bg-blue-950/30 text-blue-400'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  Platform Custodial
                </button>
                <button
                  onClick={() => setWalletType('self_custody')}
                  className={`flex-1 rounded-lg border p-3 text-sm ${
                    walletType === 'self_custody'
                      ? 'border-blue-500 bg-blue-950/30 text-blue-400'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  Self-Custody Wallet
                </button>
              </div>
            </div>

            {/* Reputation bonus toggle */}
            {snapshotScore && snapshotScore >= 90 && (
              <div className="mb-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="bonus"
                  checked={includeBonus}
                  onChange={(e) => setIncludeBonus(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="bonus" className="text-sm text-slate-300">
                  Include reputation bonus (score ≥ 90)
                </label>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleMirror}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? 'Processing…' : 'Confirm & Mirror'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
