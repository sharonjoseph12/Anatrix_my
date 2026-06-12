import { useEffect, useState } from "react";
import { LoginPanel } from "./components/LoginPanel";
import { SessionForm } from "./components/SessionForm";
import { SessionTimer } from "./components/SessionTimer";
import { SessionComplete } from "./components/SessionComplete";
import { getAccessToken, clearStoredTokens, ensureAuthenticatedClient } from "../lib/supabase";
import {
  getCurrentSession,
  setCurrentSession,
  enqueuePendingSession,
  type CurrentSession,
} from "../storage/session-store";
import { evaluateFocus } from "../background/focus-monitor";
import { runSync, type SyncResult } from "../background/sync";
import type { SessionCategory, FocusLevel, Session } from "@antarix/types";
import { formatDuration, initials, nowIso } from "@antarix/utils";

type View = "loading" | "login" | "idle" | "active" | "complete";

interface CompletedSession {
  category: SessionCategory;
  projectName: string | null;
  durationMinutes: number;
  focusLevel: FocusLevel;
  focusScore: number | null;
  tabSwitches: number;
  endedAt: string;
}

export function App() {
  const [view, setView] = useState<View>("loading");
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [active, setActive] = useState<CurrentSession | null>(null);
  const [completed, setCompleted] = useState<CompletedSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const token = await getAccessToken();
      if (!token) {
        setView("login");
        return;
      }
      const supabase = await ensureAuthenticatedClient();
      if (!supabase) {
        await clearStoredTokens();
        setView("login");
        return;
      }
      const { data, error: userErr } = await supabase.auth.getUser();
      if (userErr || !data.user) {
        await clearStoredTokens();
        setView("login");
        return;
      }
      setAuthEmail(data.user.email ?? null);
      const current = await getCurrentSession();
      if (current) {
        setActive(current);
        setView("active");
      } else {
        setView("idle");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setView("login");
    }
  }

  async function startSession(data: { category: SessionCategory; projectName: string }) {
    const clientId = crypto.randomUUID();
    const newSession: CurrentSession = {
      clientId,
      category: data.category,
      projectName: data.projectName || null,
      startedAt: nowIso(),
      tabSwitches: 0,
      distractionSeconds: 0,
      focusedTabCount: 1,
      distractionDomains: [],
    };
    await setCurrentSession(newSession);
    setActive(newSession);
    setView("active");
    chrome.runtime.sendMessage({ type: "antarix:startTracking" }).catch(() => undefined);
  }

  async function endSession() {
    if (!active) return;
    const endedAt = nowIso();
    const totalSeconds = Math.max(
      1,
      Math.floor((new Date(endedAt).getTime() - new Date(active.startedAt).getTime()) / 1000)
    );
    const { level, score } = evaluateFocus(active, totalSeconds);
    const durationMinutes = Math.max(1, Math.round(totalSeconds / 60));

    const session: Session = {
      id: active.clientId,
      user_id: "",
      category: active.category,
      project_name: active.projectName,
      started_at: active.startedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
      focus_level: level,
      focus_score: score,
      quality_rating: null,
      tab_switches: active.tabSwitches,
      distraction_seconds: active.distractionSeconds,
      extensions_used: null,
      notes: null,
      client_id: active.clientId,
      synced_at: null,
      created_at: endedAt,
      extension_version: "0.1.0",
      sync_error: null,
      sync_status: "pending",
    };

    await enqueuePendingSession(session);
    await setCurrentSession(null);
    setCompleted({
      category: active.category,
      projectName: active.projectName,
      durationMinutes,
      focusLevel: level,
      focusScore: score,
      tabSwitches: active.tabSwitches,
      endedAt,
    });
    setActive(null);
    setView("complete");
    chrome.runtime.sendMessage({ type: "antarix:stopTracking" }).catch(() => undefined);
  }

  async function syncNow() {
    try {
      const result: SyncResult = await runSync();
      if (result.errors.length > 0) {
        setError(result.errors.join("; "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    }
  }

  function dismissCompleted() {
    setCompleted(null);
    setView("idle");
  }

  async function signOut() {
    await clearStoredTokens();
    setAuthEmail(null);
    setView("login");
  }

  if (view === "loading") {
    return (
      <main className="app">
        <div className="app__body">
          <p className="muted" style={{ textAlign: "center" }}>Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__brand">Antarix</div>
        {authEmail ? (
          <div className="app__user">
            <div className="avatar" aria-hidden="true">{initials(authEmail)}</div>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ padding: "4px 8px", fontSize: 12 }}
              onClick={signOut}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </header>

      <div className="app__body">
        {error ? (
          <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>
        ) : null}

        {view === "login" ? (
          <LoginPanel onSignedIn={bootstrap} />
        ) : view === "active" && active ? (
          <SessionTimer
            session={{
              category: active.category,
              projectName: active.projectName,
              startedAt: active.startedAt,
              focusLevel: "medium",
              focusScore: null,
              tabSwitches: active.tabSwitches,
            }}
            onEnd={endSession}
          />
        ) : view === "complete" && completed ? (
          <SessionComplete
            session={completed}
            onSync={syncNow}
            onDismiss={dismissCompleted}
          />
        ) : (
          <SessionForm onStart={startSession} />
        )}
      </div>
    </main>
  );
}

export default App;
