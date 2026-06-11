// apps/web/src/app/api/ide-telemetry/sessions/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US1 acceptance scenario 1
//   contracts/api.md → GET /api/ide-telemetry/sessions
// Returns the caller's last 30 days of ide_sessions ordered DESC.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function err(code: string, message: string, status: number) {
  return json({ error: { code, message } }, { status });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to view IDE sessions", 401);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ide_sessions")
    .select(
      "id, device_id, started_at, ended_at, duration_seconds, editor, project_hash, language, keystroke_entropy_bpm, debug_session_duration_seconds, debug_step_ratio, ast_refactor_distance, time_in_file_seconds, test_run_count, error_resolution_latency_ms, raw_partial_capture, uploaded_at",
    )
    .eq("student_id", user.id)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(500);
  if (error) return err("internal_error", error.message, 500);

  return json({ sessions: data ?? [] });
}
