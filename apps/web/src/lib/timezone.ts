// apps/web/src/lib/timezone.ts
// Re-export from @antarix/utils for backward compatibility.

export {
  toLocalIsoString,
  localHourOfDay,
  isInQuietHours,
  isExamWindow,
  type TimezoneOptions,
} from "@antarix/utils";

// Local-only helper — stays here because it depends on the Request/Headers
// global which is web-runtime specific.
export function bestGuessTimezone(acceptLanguage: string | null, headers: Headers): string {
  const fromHeader = headers.get("x-timezone");
  if (fromHeader && /^[A-Za-z]+\/[A-Za-z_]+$/.test(fromHeader)) return fromHeader;
  try {
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (guess) return guess;
  } catch { /* ignore */ }
  return "UTC";
}
