// packages/utils/suppress-nudge.ts
// T025 — Pure gate: should this nudge be suppressed, and why?
// The dispatch MUST NOT send when this returns a reason.
// Moved here from supabase/functions/_shared so it's testable from Node and
// importable from both the web app and edge functions. The supabase wrapper
// now re-exports this file as a passthrough.

export type NudgeType =
  | "daily_morning"
  | "real_time_peak"
  | "streak_risk"
  | "weekly_summary"
  | "verification"
  | "pause_confirmation";

export type Channel = "whatsapp" | "push" | "dashboard";

export type SuppressReason =
  | "pause_all"
  | "quiet_hours"
  | "exam_week"
  | "opt_out_whatsapp"
  | "opt_out_push"
  | "opt_out_dashboard"
  | "type_disabled"
  | "channel_disabled";

export type NudgePrefs = {
  pause_all: boolean;
  quiet_hours_start: string; // "HH:MM"
  quiet_hours_end: string;   // "HH:MM"
  real_time_peak_nudges: boolean;
  streak_risk_nudges: boolean;
  whatsapp_channel: boolean;
  push_channel: boolean;
  dashboard_channel: boolean;
};

export type ExamWindow = { start: string; end: string };

function toMinutes(hhmm: string): number {
  const parts = hhmm.split(":");
  const h = Number(parts[0] ?? "0");
  const m = Number(parts[1] ?? "0");
  return h * 60 + m;
}

export function isWithinQuietHours(localNow: string, prefs: NudgePrefs): boolean {
  if (prefs.quiet_hours_start === prefs.quiet_hours_end) return false;
  const now = toMinutes(localNow);
  const start = toMinutes(prefs.quiet_hours_start);
  const end = toMinutes(prefs.quiet_hours_end);
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

export function isInExamWindow(localDate: string, windows: ExamWindow[]): boolean {
  return windows.some((w) => localDate >= w.start && localDate <= w.end);
}

export function shouldSuppress(args: {
  prefs: NudgePrefs;
  type: NudgeType;
  channel: Channel;
  localNow: string;  // "HH:MM"
  localDate: string; // "YYYY-MM-DD"
  examWindows?: ExamWindow[];
}): SuppressReason | null {
  const { prefs, type, channel, localNow, localDate, examWindows = [] } = args;
  if (prefs.pause_all) return "pause_all";
  if (isWithinQuietHours(localNow, prefs)) return "quiet_hours";
  if (
    (type === "real_time_peak" || type === "streak_risk") &&
    isInExamWindow(localDate, examWindows)
  ) {
    return "exam_week";
  }
  if (type === "real_time_peak" && !prefs.real_time_peak_nudges) return "type_disabled";
  if (type === "streak_risk" && !prefs.streak_risk_nudges) return "type_disabled";
  if (channel === "whatsapp" && !prefs.whatsapp_channel) return "channel_disabled";
  if (channel === "push" && !prefs.push_channel) return "channel_disabled";
  if (channel === "dashboard" && !prefs.dashboard_channel) return "channel_disabled";
  return null;
}
