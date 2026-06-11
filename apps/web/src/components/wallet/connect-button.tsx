'use client';

// ─── Wallet Connect Button ──────────────────────────────────────────────────
// Wagmi/rainbowkit-based wallet connect; falls back to custodial prompt

import { useState } from 'react';

interface ConnectButtonProps {
  onConnected?: (address: string) => void;
}

export default function ConnectButton({ onConnected }: ConnectButtonProps) {
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  async function handleConnect() {
    setConnecting(true);
    try {
      // Check if window.ethereum is available
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (accounts?.[0]) {
          setAddress(accounts[0]);
          onConnected?.(accounts[0]);
        }
      } else {
        // No wallet detected — show custodial prompt
        setAddress(null);
      }
    } catch (err) {
      console.error('Wallet connect failed:', err);
    } finally {
      setConnecting(false);
    }
  }

  if (address) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/10 px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-sm font-mono text-emerald-400">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
    >
      {connecting ? 'Connecting…' : 'Connect Wallet'}
    </button>
  );
}
