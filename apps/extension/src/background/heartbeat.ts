// apps/extension/src/background/heartbeat.ts
// T054 — Fire a POST to /extension/heartbeat every 15 minutes while running.

import { getStoredAuth } from "./auth-store";

const HEARTBEAT_ALARM = "antarix-heartbeat";
const HEARTBEAT_PERIOD_MIN = 15;

interface HeartbeatPayload {
  extension_version: string;
  browser: string;
  session_id?: string;
}

export async function sendHeartbeat(): Promise<{ ok: boolean; status: number }> {
  const auth = await getStoredAuth();
  if (!auth) return { ok: false, status: 401 };

  const payload: HeartbeatPayload = {
    extension_version: chrome.runtime.getManifest().version,
    browser: (await browserInfo()).browser,
  };

  try {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
    const r = await fetch(`${auth.apiBase}/functions/v1/extension-heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
        ...(anonKey ? { apikey: anonKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    return { ok: r.ok, status: r.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export function installHeartbeatAlarm() {
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_PERIOD_MIN });
}

export function isHeartbeatAlarm(name: string) {
  return name === HEARTBEAT_ALARM;
}

async function browserInfo(): Promise<{ browser: string; version: string }> {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return { browser: "edge", version: ua.split("Edg/")[1]?.split(" ")[0] ?? "" };
  if (ua.includes("Chrome/")) return { browser: "chrome", version: ua.split("Chrome/")[1]?.split(" ")[0] ?? "" };
  if (ua.includes("Firefox/")) return { browser: "firefox", version: ua.split("Firefox/")[1]?.split(" ")[0] ?? "" };
  return { browser: "unknown", version: "" };
}
