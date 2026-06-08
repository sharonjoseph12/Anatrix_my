import { useEffect, useState } from "react";
import type { SessionCategory, FocusLevel } from "@antarix/types";
import { formatDuration } from "@antarix/utils";

const CATEGORY_LABELS: Record<SessionCategory, string> = {
  dsa: "DSA",
  coding: "Coding",
  project: "Project",
  learning: "Learning",
  research: "Research",
};

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface ActiveSessionView {
  category: SessionCategory;
  projectName: string | null;
  startedAt: string;
  focusLevel: FocusLevel;
  focusScore: number | null;
  tabSwitches: number;
}

export function SessionTimer({
  session,
  onEnd,
}: {
  session: ActiveSessionView;
  onEnd: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="timer">
        <span className="timer__label">Recording</span>
        <span className="timer__display">{formatClock(elapsedSec)}</span>
        <span className="timer__category">
          {CATEGORY_LABELS[session.category]}
          {session.projectName ? ` · ${session.projectName}` : ""}
        </span>
        <div className="focus-meter" aria-label="focus quality">
          <span className={`focus-dot focus-dot--${session.focusLevel}`} />
          <span>
            {session.focusLevel.toUpperCase()} focus
            {session.focusScore !== null ? ` · ${Math.round(session.focusScore * 100)}%` : ""}
          </span>
        </div>
      </div>

      <button type="button" className="btn btn--danger btn--block" onClick={onEnd}>
        End Session
      </button>

      <p className="muted" style={{ fontSize: 12, textAlign: "center", margin: 0 }}>
        {session.tabSwitches} tab switches · started {new Date(session.startedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
