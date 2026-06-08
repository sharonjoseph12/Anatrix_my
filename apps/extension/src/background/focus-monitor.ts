import {
  getCurrentSession,
  setCurrentSession,
  calculateFocusLevel,
  calculateFocusScore,
  type CurrentSession,
} from "../storage/session-store";
import type { FocusLevel } from "@antarix/types";

const DISTRACTION_DOMAINS = new Set([
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "reddit.com",
  "tiktok.com",
  "netflix.com",
  "twitch.tv",
]);

const POLL_INTERVAL_MS = 5_000;

let pollHandle: ReturnType<typeof setInterval> | null = null;
const activeTabsByMinute = new Map<string, { focused: number; distraction: number }>();

export async function startFocusMonitor(): Promise<void> {
  if (pollHandle !== null) return;
  pollHandle = setInterval(pollActiveTab, POLL_INTERVAL_MS);
  await pollActiveTab();
}

export function stopFocusMonitor(): void {
  if (pollHandle !== null) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  activeTabsByMinute.clear();
}

async function pollActiveTab(): Promise<void> {
  const current = await getCurrentSession();
  if (!current) return;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.url) return;

  const url = new URL(activeTab.url);
  const domain = url.hostname.replace(/^www\./, "");
  const isDistraction = DISTRACTION_DOMAINS.has(domain);

  const minute = new Date().toISOString().slice(0, 16);
  const bucket = activeTabsByMinute.get(minute) ?? { focused: 0, distraction: 0 };
  if (isDistraction) {
    bucket.distraction += POLL_INTERVAL_MS / 1000;
  } else {
    bucket.focused += POLL_INTERVAL_MS / 1000;
  }
  activeTabsByMinute.set(minute, bucket);

  const totals = aggregateTotals();
  const focusedTabCount = await countFocusedTabs();
  const updated: CurrentSession = {
    ...current,
    tabSwitches: current.tabSwitches + 1,
    distractionSeconds: Math.round(totals.distraction),
    focusedTabCount,
  };
  await setCurrentSession(updated);
}

async function countFocusedTabs(): Promise<number> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  let count = 0;
  for (const tab of tabs) {
    if (!tab.url) continue;
    const domain = new URL(tab.url).hostname.replace(/^www\./, "");
    if (!DISTRACTION_DOMAINS.has(domain)) count += 1;
  }
  return count;
}

function aggregateTotals(): { focused: number; distraction: number } {
  let focused = 0;
  let distraction = 0;
  for (const bucket of activeTabsByMinute.values()) {
    focused += bucket.focused;
    distraction += bucket.distraction;
  }
  return { focused, distraction };
}

export function evaluateFocus(current: CurrentSession, totalSeconds: number) {
  return {
    level: calculateFocusLevel(current.focusedTabCount, current.distractionSeconds),
    score: calculateFocusScore(current.focusedTabCount, current.distractionSeconds, totalSeconds),
  };
}
