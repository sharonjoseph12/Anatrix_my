import { Info } from "lucide-react";

export function WhatWeLearned({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="italic leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

export default WhatWeLearned;
