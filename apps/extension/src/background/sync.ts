import type { Session, SessionUploadResponse } from "@antarix/types";
import { getPendingSessions, clearPendingSessions } from "../storage/session-store";
import { getSupabaseClient } from "../lib/supabase";

const SUPABASE_FUNCTION_NAME = "session-upload";

export interface SyncResult {
  uploaded: number;
  duplicates: number;
  rejected: number;
  errors: string[];
}

export async function runSync(): Promise<SyncResult> {
  const pending = await getPendingSessions();
  if (pending.length === 0) {
    return { uploaded: 0, duplicates: 0, rejected: 0, errors: [] };
  }

  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke<SessionUploadResponse>(
    SUPABASE_FUNCTION_NAME,
    {
      body: { sessions: pending.map(serialize) },
    }
  );

  if (error) {
    return {
      uploaded: 0,
      duplicates: 0,
      rejected: pending.length,
      errors: [error.message],
    };
  }

  if (!data) {
    return { uploaded: 0, duplicates: 0, rejected: pending.length, errors: ["empty response"] };
  }

  await clearPendingSessions(pending.map((s) => s.id));
  return {
    uploaded: data.accepted,
    duplicates: data.duplicates,
    rejected: data.rejected,
    errors: [],
  };
}

function serialize(session: Session) {
  return {
    client_id: session.id,
    category: session.category,
    project_name: session.project_name,
    started_at: session.started_at,
    ended_at: session.ended_at,
    duration_minutes: session.duration_minutes,
    focus_level: session.focus_level,
    focus_score: session.focus_score,
    tab_switches: session.tab_switches,
    distraction_seconds: session.distraction_seconds,
  };
}
