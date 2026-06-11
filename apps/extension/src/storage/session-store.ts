import type { Session, SessionCategory, FocusLevel } from "@antarix/types";

const STORAGE_KEY_CURRENT = "antarix:currentSession";
const STORAGE_KEY_PENDING = "antarix:pendingSessions";

export interface CurrentSession {
  clientId: string;
  category: SessionCategory;
  projectName: string | null;
  startedAt: string;
  tabSwitches: number;
  distractionSeconds: number;
  focusedTabCount: number;
  distractionDomains: string[];
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY_CURRENT);
  return (result[STORAGE_KEY_CURRENT] as CurrentSession | undefined) ?? null;
}

export async function setCurrentSession(session: CurrentSession | null): Promise<void> {
  if (session === null) {
    await chrome.storage.local.remove(STORAGE_KEY_CURRENT);
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY_CURRENT]: session });
}

export async function getPendingSessions(): Promise<Session[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_PENDING);
  return (result[STORAGE_KEY_PENDING] as Session[] | undefined) ?? [];
}

export async function setPendingSessions(sessions: Session[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_PENDING]: sessions });
}

export async function enqueuePendingSession(session: Session): Promise<void> {
  const pending = await getPendingSessions();
  pending.push(session);
  await setPendingSessions(pending);
}

export async function clearPendingSessions(ids: string[]): Promise<void> {
  const pending = await getPendingSessions();
  const remaining = pending.filter((s) => !ids.includes(s.id));
  await setPendingSessions(remaining);
}

export function calculateFocusLevel(focusedTabCount: number, distractionSeconds: number): FocusLevel {
  if (focusedTabCount <= 2 && distractionSeconds < 60) return "high";
  if (focusedTabCount <= 5 && distractionSeconds < 300) return "medium";
  return "low";
}

export function calculateFocusScore(focusedTabCount: number, distractionSeconds: number, totalSeconds: number): number {
  if (totalSeconds <= 0) return 0;
  const focusRatio = Math.max(0, 1 - distractionSeconds / totalSeconds);
  const tabPenalty = Math.max(0, 1 - (focusedTabCount - 1) * 0.1);
  return Math.round((focusRatio * 0.7 + tabPenalty * 0.3) * 100);
}
