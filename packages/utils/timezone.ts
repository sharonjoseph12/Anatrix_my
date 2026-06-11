// packages/utils/timezone.ts
// IANA-safe local-time conversion. Pure functions, no Date side effects.

export type TimezoneOptions = { timeZone: string; locale?: string };

export function toLocalIsoString(date: Date | string, opts: TimezoneOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: opts.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:00`;
}

export function localHourOfDay(date: Date | string, tz: string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  })
    .format(d)
    .split(":")[0];
  return Number(hour);
}

export function isInQuietHours(localHour: number, start: string, end: string): boolean {
  const sh = Number(start.split(":")[0]);
  const eh = Number(end.split(":")[0]);
  if (sh <= eh) return localHour >= sh && localHour < eh;
  return localHour >= sh || localHour < eh;
}

export function isExamWindow(
  localDate: string,
  windows: Array<{ start_date: string; end_date: string }>,
): boolean {
  return windows.some((w) => w.start_date <= localDate && localDate <= w.end_date);
}
