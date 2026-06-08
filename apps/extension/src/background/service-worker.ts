// apps/extension/src/background/service-worker.ts
// MV3 service worker entry. Registers both alarms on install and dispatches
// the heartbeat + hourly session-sync on every alarm tick. Also wires the
// uninstall URL and the onSuspend last-heartbeat (T061).

/// <reference lib="WebWorker" />

declare const self: ServiceWorkerGlobalScope;

import { installHeartbeatAlarm, isHeartbeatAlarm, sendHeartbeat } from "./heartbeat";
import { registerAlarms, getSyncAlarmName } from "./alarms";

const UNINSTALL_URL = "https://antarix.app/extension/goodbye";

// On install: register both the heartbeat alarm (15m) and the session sync
// (60m, via the alarms helper).
self.addEventListener("install", () => {
  installHeartbeatAlarm();
  registerAlarms();
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("alarm", (alarm) => {
  const name = (alarm as unknown as { name: string }).name;
  if (isHeartbeatAlarm(name)) {
    void sendHeartbeat();
    return;
  }
  if (name === getSyncAlarmName()) {
    // Lazy import to keep the cold-start payload small.
    void import("./session-sync").then((m) => m.runSessionSync());
  }
});

chrome.runtime.setUninstallURL(UNINSTALL_URL);

// T061 — best-effort last heartbeat + clear current-session state when the
// browser is about to evict the worker. `onSuspend` only exists in MV3.
chrome.runtime.onSuspend?.addListener(() => {
  void sendHeartbeat();
  void chrome.storage.local.remove(["antarix:currentSession"]);
});
