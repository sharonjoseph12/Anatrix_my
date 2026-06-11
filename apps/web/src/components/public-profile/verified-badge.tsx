import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ className, size = "default" }: { className?: string; size?: "sm" | "default" | "lg" }) {
  const dim = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300",
        className,
      )}
    >
      <ShieldCheck className={dim} />
      Verified by Antarix
    </span>
  );
}
