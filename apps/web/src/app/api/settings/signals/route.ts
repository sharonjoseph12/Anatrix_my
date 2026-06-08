// apps/web/src/app/api/settings/signals/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US3 (FR-PRI-001..008)
//   contracts/api.md → GET /api/settings/signals
// Builds the privacy-center snapshot. Aggregates biometric_connections
// and the last 30 days of ide_sessions/ide_aggregates per device into
// SignalSource rows, with the plain-language "what we learned" panel.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderWhatWeLearned } from "@/lib/signals/plain-language";
import { writeSignalAudit } from "@/lib/audit/log";
import type { SignalSource, SignalCenterSnapshot } from "@antarix/types/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function err(code: string, message: string, status: number) {
  return json({ error: { code, message } }, { status });
}

type Source = SignalSource;

const PROVIDER_TO_KIND: Record<string, "ide" | "biometric" | null> = {
  ide_vscode: "ide",
  ide_cursor: "ide",
  biometric_healthkit: "biometric",
  biometric_google_fit: "biometric",
  biometric_oura: "biometric",
  biometric_whoop: "biometric",
};

function buildBiometricSource(args: {
  provider: "healthkit" | "google_fit" | "oura" | "whoop";
  status: "connected" | "disconnected" | "expired";
  connected_at: string | null;
  last_sync_at: string | null;
  lastFive: {
    period_start: string;
    sleep_duration_minutes: number | null;
    sleep_quality_score: number | null;
    hrv_ms: number | null;
    resting_hr_bpm: number | null;
    daily_readiness_score: number | null;
  }[];
}): Source {
  const auditProvider = `biometric_${args.provider}` as
    | "biometric_healthkit"
    | "biometric_google_fit"
    | "biometric_oura"
    | "biometric_whoop";
  const aggregates = args.lastFive.map((a) => ({
    period_start: a.period_start,
    summary: {
      sleep_duration_minutes: a.sleep_duration_minutes,
      hrv_ms: a.hrv_ms,
      resting_hr_bpm: a.resting_hr_bpm,
    },
  }));
  const shell: Source = {
    provider: auditProvider,
    kind: "biometric",
    status: args.status,
    biometric_provider: args.provider,
    connected_at: args.connected_at,
    last_sync_at: args.last_sync_at,
    last_5_aggregates: aggregates,
    what_we_learned: "",
    total_score_cap_pct: 2,
  };
  shell.what_we_learned = renderWhatWeLearned(shell, aggregates, "en");
  return shell;
}

function buildIDESource(args: {
  editor: "vscode" | "cursor";
  deviceId: string;
  sessions: number;
  totalActiveSeconds: number;
  language: string;
  lastFive: { period_start: string; score_contribution: number | null; session_count: number | null; total_active_seconds: number | null }[];
  partial: boolean;
}): Source {
  const provider: "ide_vscode" | "ide_cursor" =
    args.editor === "cursor" ? "ide_cursor" : "ide_vscode";
  const aggregates = args.lastFive.map((a) => ({
    period_start: a.period_start,
    score_contribution: a.score_contribution ?? 0,
    summary: {
      total_active_seconds: a.total_active_seconds ?? 0,
      session_count: a.session_count ?? 0,
      language: args.language,
    },
  }));
  const shell: Source = {
    provider,
    kind: "ide",
    status: "connected",
    editor: args.editor,
    connected_at: null,
    last_sync_at: null,
    last_5_aggregates: aggregates,
    what_we_learned: "",
    total_score_cap_pct: 3,
  };
  shell.what_we_learned = renderWhatWeLearned(
    shell,
    [
      {
        period_start: args.lastFive[0]?.period_start ?? new Date().toISOString().slice(0, 10),
        summary: {
          total_active_seconds: args.totalActiveSeconds,
          session_count: args.sessions,
          language: args.language,
        },
      },
    ],
    "en",
  );
  void args.partial;
  return shell;
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to view the privacy center", 401);

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") ?? "en";

  const { data: biometricRows, error: bErr } = await supabase
    .from("biometric_connections")
    .select("id, provider, status, connected_at, last_sync_at")
    .eq("student_id", user.id);
  if (bErr) return err("internal_error", bErr.message, 500);

  const connIds = (biometricRows ?? []).map((c) => (c as { id: string }).id);
  const bioAggsByConn = new Map<
    string,
    {
      period_start: string;
      sleep_duration_minutes: number | null;
      sleep_quality_score: number | null;
      hrv_ms: number | null;
      resting_hr_bpm: number | null;
      daily_readiness_score: number | null;
    }[]
  >();
  if (connIds.length > 0) {
    const { data: aggs, error: aErr } = await supabase
      .from("biometric_aggregates")
      .select(
        "connection_id, period_start, sleep_duration_minutes, sleep_quality_score, hrv_ms, resting_hr_bpm, daily_readiness_score",
      )
      .in("connection_id", connIds)
      .eq("period_type", "daily")
      .order("period_start", { ascending: false })
      .limit(connIds.length * 5);
    if (aErr) return err("internal_error", aErr.message, 500);
    for (const row of aggs ?? []) {
      const r = row as {
        connection_id: string;
        period_start: string;
        sleep_duration_minutes: number | null;
        sleep_quality_score: number | null;
        hrv_ms: number | null;
        resting_hr_bpm: number | null;
        daily_readiness_score: number | null;
      };
      const list = bioAggsByConn.get(r.connection_id) ?? [];
      if (list.length < 5) {
        list.push({
          period_start: r.period_start,
          sleep_duration_minutes: r.sleep_duration_minutes,
          sleep_quality_score: r.sleep_quality_score,
          hrv_ms: r.hrv_ms,
          resting_hr_bpm: r.resting_hr_bpm,
          daily_readiness_score: r.daily_readiness_score,
        });
        bioAggsByConn.set(r.connection_id, list);
      }
    }
  }

  const sources: Source[] = [];
  for (const row of biometricRows ?? []) {
    const r = row as {
      id: string;
      provider: "healthkit" | "google_fit" | "oura" | "whoop";
      status: "connected" | "disconnected" | "expired";
      connected_at: string | null;
      last_sync_at: string | null;
    };
    const src = buildBiometricSource({
      provider: r.provider,
      status: r.status,
      connected_at: r.connected_at,
      last_sync_at: r.last_sync_at,
      lastFive: bioAggsByConn.get(r.id) ?? [],
    });
    if (locale !== "en") {
      src.what_we_learned = renderWhatWeLearned(src, src.last_5_aggregates, locale);
    }
    sources.push(src);
  }

  const { data: ideAggs, error: iErr } = await supabase
    .from("ide_aggregates")
    .select("device_id, period_start, period_type, session_count, total_active_seconds, language_breakdown_json, score_contribution, raw_partial_capture")
    .eq("student_id", user.id)
    .eq("period_type", "daily")
    .order("period_start", { ascending: false })
    .limit(120);
  void iErr;
  const byDevice = new Map<
    string,
    {
      sessions: number;
      totalActiveSeconds: number;
      language: string;
      lastFive: { period_start: string; score_contribution: number | null; session_count: number | null; total_active_seconds: number | null }[];
      partial: boolean;
    }
  >();
  for (const row of ideAggs ?? []) {
    const r = row as {
      device_id: string;
      period_start: string;
      session_count: number;
      total_active_seconds: number;
      language_breakdown_json: Record<string, number> | null;
      score_contribution: number | null;
      raw_partial_capture?: boolean;
    };
    const existing = byDevice.get(r.device_id) ?? {
      sessions: 0,
      totalActiveSeconds: 0,
      language: "mixed",
      lastFive: [] as { period_start: string; score_contribution: number | null; session_count: number | null; total_active_seconds: number | null }[],
      partial: false,
    };
    existing.sessions += r.session_count ?? 0;
    existing.totalActiveSeconds += r.total_active_seconds ?? 0;
    if (existing.lastFive.length < 5) {
      existing.lastFive.push({
        period_start: r.period_start,
        score_contribution: r.score_contribution ?? null,
        session_count: r.session_count ?? null,
        total_active_seconds: r.total_active_seconds ?? null,
      });
    }
    const langs = r.language_breakdown_json ?? {};
    const top = Object.entries(langs).sort((a, b) => b[1] - a[1])[0];
    if (top && top[0]) existing.language = top[0];
    if (r.raw_partial_capture) existing.partial = true;
    byDevice.set(r.device_id, existing);
  }

  const { data: ideSessions, error: sErr } = await supabase
    .from("ide_sessions")
    .select("device_id, editor")
    .eq("student_id", user.id)
    .order("started_at", { ascending: false })
    .limit(500);
  void sErr;
  const editorByDevice = new Map<string, "vscode" | "cursor">();
  for (const row of ideSessions ?? []) {
    const r = row as { device_id: string; editor: "vscode" | "cursor" };
    if (!editorByDevice.has(r.device_id)) editorByDevice.set(r.device_id, r.editor);
  }

  for (const [deviceId, agg] of byDevice.entries()) {
    const editor = editorByDevice.get(deviceId) ?? "vscode";
    sources.push(buildIDESource({ editor, deviceId, ...agg }));
  }

  const partialCapture = Array.from(byDevice.values()).some((v) => v.partial);
  const totalActive = sources.reduce(
    (acc, s) => acc + (s.kind === "ide" ? 3 : s.kind === "biometric" ? 2 : 0),
    0,
  );
  const totalActiveScoreCapPct: 5 = (totalActive >= 5 ? 5 : totalActive >= 3 ? 3 : totalActive >= 2 ? 2 : 0) as 5;

  const snapshot: SignalCenterSnapshot = {
    sources: sources.sort((a, b) => a.provider.localeCompare(b.provider)),
    total_active_score_cap_pct: totalActiveScoreCapPct,
    partial_capture: partialCapture,
  };

  try {
    await writeSignalAudit({
      actor_id: user.id,
      actor_type: "student",
      student_id: user.id,
      provider: "privacy_center",
      action: "read",
      byte_count: 0,
      aggregate_hash: null,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  void PROVIDER_TO_KIND;
  return json(snapshot);
}
