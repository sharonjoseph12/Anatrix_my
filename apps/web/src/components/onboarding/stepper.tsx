"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "profile", label: "Profile", href: "/onboarding/profile" },
  { id: "github", label: "GitHub", href: "/onboarding/github" },
  { id: "calendar", label: "Calendar", href: "/onboarding/calendar" },
  { id: "complete", label: "Done", href: "/onboarding/complete" },
] as const;

export function OnboardingStepper({ currentStep }: { currentStep: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Onboarding progress" className="mx-auto w-full max-w-2xl">
      <ol className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const isComplete = idx < currentStep;
          const isCurrent = pathname?.endsWith(`/${step.id}`) || idx === currentStep;
          return (
            <li key={step.id} className="flex flex-1 items-center">
              <Link
                href={step.href}
                className={cn(
                  "group flex flex-col items-center gap-2",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    isComplete && "border-primary bg-primary text-primary-foreground",
                    isCurrent && !isComplete && "border-primary text-primary",
                    !isCurrent && !isComplete && "border-muted-foreground/30"
                  )}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : idx + 1}
                </span>
                <span className="text-xs font-medium">{step.label}</span>
              </Link>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-px flex-1",
                    isComplete ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
