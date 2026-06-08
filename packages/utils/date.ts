// Date utilities — used by web, extension, and edge functions

export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

export function nowIso(): string {
  return new Date().toISOString();
}

export function toIso(date: Date | string | number): string {
  return new Date(date).toISOString();
}

export function fromIso(iso: string): Date {
  return new Date(iso);
}

export function addMinutes(date: Date | string, minutes: number): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function addHours(date: Date | string, hours: number): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  d.setHours(d.getHours() + hours);
  return d;
}

export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export function diffMinutes(a: Date | string, b: Date | string): number {
  const ta = typeof a === "string" ? new Date(a).getTime() : a.getTime();
  const tb = typeof b === "string" ? new Date(b).getTime() : b.getTime();
  return Math.round((tb - ta) / MS_PER_MINUTE);
}

export function diffHours(a: Date | string, b: Date | string): number {
  return diffMinutes(a, b) / MINUTES_PER_HOUR;
}

export function diffDays(a: Date | string, b: Date | string): number {
  return diffMinutes(a, b) / (MINUTES_PER_HOUR * HOURS_PER_DAY);
}

export function startOfDay(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date: Date | string): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function startOfHour(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  d.setMinutes(0, 0, 0);
  return d;
}

export function hourOfDay(date: Date | string): number {
  return new Date(date).getHours();
}

export function dayOfWeek(date: Date | string): number {
  return new Date(date).getDay();
}

export function isWithinDays(date: Date | string, days: number): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  return Date.now() - d.getTime() <= days * MS_PER_DAY;
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((Date.now() - d.getTime()) / MS_PER_SECOND);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
