// apps/web/src/lib/algorithms/channel-resolver.ts
// T011 — Pure-function channel priority resolver (research D5).
// Returns the channel a nudge should be delivered on, or null if suppressed.

export type Channel = "in_app" | "telegram" | "discord" | "whatsapp";

export type ChannelPreferences = {
  whatsapp_handle?: string | null;
  whatsapp_verified?: boolean;
  whatsapp_premium_opt_in?: boolean;
  telegram_handle?: string | null;
  telegram_verified?: boolean;
  discord_handle?: string | null;
  discord_verified?: boolean;
  channel_priority?: Channel;
};

const PRIORITY: Record<Channel, number> = {
  in_app: 100,
  telegram: 75,
  discord: 50,
  whatsapp: 25,
};

export function pickChannel(
  prefs: ChannelPreferences,
  quiet: boolean,
  exam: boolean,
): Channel | null {
  if (quiet || exam) return null;
  if (prefs.whatsapp_premium_opt_in && prefs.whatsapp_verified && prefs.whatsapp_handle) {
    return "whatsapp";
  }
  if (prefs.telegram_verified && prefs.telegram_handle) return "telegram";
  if (prefs.discord_verified && prefs.discord_handle) return "discord";
  return "in_app";
}

export function compareChannels(a: Channel, b: Channel): number {
  return PRIORITY[a] - PRIORITY[b];
}
