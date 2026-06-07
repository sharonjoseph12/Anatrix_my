// packages/utils/whatsapp-cost-guard.ts
// T097 — Soft cap on outbound WhatsApp messages per student per week.
// When exceeded, nudge-dispatch falls back to push-only and emits a metric.

export const DEFAULT_WEEKLY_CAP = 20;

export type CostGuardResult = {
  allowed: boolean;
  reason: "ok" | "weekly_cap" | "channel_disabled";
  cap: number;
  current: number;
};

export function shouldSendWhatsApp(
  currentWeeklyCount: number,
  cap = DEFAULT_WEEKLY_CAP,
): CostGuardResult {
  if (currentWeeklyCount >= cap) {
    return { allowed: false, reason: "weekly_cap", cap, current: currentWeeklyCount };
  }
  return { allowed: true, reason: "ok", cap, current: currentWeeklyCount };
}
