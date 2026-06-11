'use client';

// ─── Custodial Prompt ───────────────────────────────────────────────────────
// "No wallet? Use an Antarix-custodial address" CTA

interface CustodialPromptProps {
  onAccept?: () => void;
}

export default function CustodialPrompt({ onAccept }: CustodialPromptProps) {
  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-4">
      <h3 className="text-sm font-semibold text-blue-400 mb-2">No wallet detected</h3>
      <p className="text-xs text-slate-400 mb-3">
        Don't have a crypto wallet? Antarix can create a custodial address for you.
        Your key will be stored securely — you can export it any time from Settings.
      </p>
      <button
        onClick={onAccept}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
      >
        Use Antarix-Custodial Address
      </button>
    </div>
  );
}
