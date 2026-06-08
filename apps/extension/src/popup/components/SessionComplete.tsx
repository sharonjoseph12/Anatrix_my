import { useEffect, useState } from "react";
import type { SessionCategory, FocusLevel } from "@antarix/types";
import { formatDuration } from "@antarix/utils";

export interface CompletedSessionView {
  category: SessionCategory;
  projectName: string | null;
  durationMinutes: number;
  focusLevel: FocusLevel;
  focusScore: number | null;
  tabSwitches: number;
  endedAt: string;
}

const FOCUS_LABEL: Record<FocusLevel, string> = {
  high: "High focus",
  medium: "Medium focus",
  low: "Low focus",
};

export function SessionComplete({
  session,
  onSync,
  onDismiss,
}: {
  session: CompletedSessionView;
  onSync: () => void;
  onDismiss: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  async function handleSync() {
    setSyncing(true);
    onSync();
    setTimeout(() => {
      setSynced(true);
      setSyncing(false);
    }, 800);
  }

  useEffect(() => {
    if (synced) {
      const id = setTimeout(onDismiss, 1500);
      return () => clearTimeout(id);
    }
  }, [synced, onDismiss]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="summary" aria-label="session summary">
        <div style={{ fontWeight: 600, fontSize: 14 }}>Session complete</div>
        <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="summary__row">
            <dt>Duration</dt>
            <dd>{formatDuration(session.durationMinutes)}</dd>
          </div>
          <div className="summary__row">
            <dt>Focus</dt>
            <dd>
              <span className={`focus-dot focus-dot--${session.focusLevel}`} style={{ display: "inline-block", marginRight: 6, verticalAlign: "middle" }} />
              {FOCUS_LABEL[session.focusLevel]}
            </dd>
          </div>
          <div className="summary__row">
            <dt>Tab switches</dt>
            <dd>{session.tabSwitches}</dd>
          </div>
          {session.projectName ? (
            <div className="summary__row">
              <dt>Project</dt>
              <dd>{session.projectName}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {synced ? (
        <div style={{ textAlign: "center", color: "var(--success)", fontSize: 13 }}>
          ✓ Synced to Antarix
        </div>
      ) : (
        <button type="button" className="btn btn--primary btn--block" onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
      )}
    </div>
  );
}
