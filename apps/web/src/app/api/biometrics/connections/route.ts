// apps/web/src/app/api/biometrics/connections/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US2 + US3 (FR-BIO-001..007, FR-PRI-001)
//   contracts/api.md → GET / POST / DELETE /api/biometrics/connections
// GET: list the caller's biometric_connections with the last 5 daily
//   aggregates per connection.
// POST: register a mobile-handled provider (healthkit, google_fit).
//   Oura/Whoop are wired via /api/biometrics/connect/[provider].
// DELETE: soft-disconnect all connections for the caller. Used by
//   "Delete all and disconnect" flows. Writes a signal_audit row.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { writeSignalAudit } from "@/lib/audit/log";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

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
  if (!user) return err("unauthorized", "Sign in to view biometric connections", 401);

  const { data: connections, error: cErr } = await supabase
    .from("biometric_connections")
    .select(
      "id, student_id, provider, status, last_sync_at, last_error, connected_at, scopes_json",
    )
    .eq("student_id", user.id)
    .order("connected_at", { ascending: false });
  if (cErr) return err("internal_error", cErr.message, 500);

  const connIds = (connections ?? []).map((c) => (c as { id: string }).id);
  const aggByConn = new Map<string, { period_start: string; sleep_duration_minutes: number | null; sleep_quality_score: number | null; hrv_ms: number | null; resting_hr_bpm: number | null; daily_readiness_score: number | null }[]>();
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
      const list = aggByConn.get(r.connection_id) ?? [];
      if (list.length < 5) {
        list.push({
          period_start: r.period_start,
          sleep_duration_minutes: r.sleep_duration_minutes,
          sleep_quality_score: r.sleep_quality_score,
          hrv_ms: r.hrv_ms,
          resting_hr_bpm: r.resting_hr_bpm,
          daily_readiness_score: r.daily_readiness_score,
        });
        aggByConn.set(r.connection_id, list);
      }
    }
  }

  const out = (connections ?? []).map((c) => {
    const conn = c as { id: string };
    return {
      ...(c as Record<string, unknown>),
      last_5_aggregates: aggByConn.get(conn.id) ?? [],
    };
  });

  return json({ connections: out });
}

const mobileConnectSchema = z.object({
  provider: z.enum(["healthkit", "google_fit"]),
  scopes: z.array(z.enum(["sleep", "hrv", "resting_hr", "readiness"])).min(1).max(4),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to register a mobile biometric provider", 401);

  const rl = rateLimit({ key: `biometric-conn:${user.id}`, limit: 20, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = mobileConnectSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: { code: "invalid_input", message: "Invalid request", issues: parsed.error.issues } },
      { status: 400 },
    );
  }
  const { provider, scopes } = parsed.data;

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("biometric_connections")
    .upsert(
      {
        student_id: user.id,
        provider,
        status: "connected",
        oauth_refresh_token_encrypted: null,
        scopes_json: scopes,
      },
      { onConflict: "student_id,provider" },
    )
    .select("id, student_id, provider, status, scopes_json, connected_at, last_sync_at, last_error")
    .single();
  if (error) return err("internal_error", error.message, 500);

  try {
    await writeSignalAudit({
      actor_id: user.id,
      actor_type: "student",
      student_id: user.id,
      provider: provider === "healthkit" ? "biometric_healthkit" : "biometric_google_fit",
      action: "enable",
      byte_count: 0,
      aggregate_hash: null,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  return json({ connection: data }, { status: 201 });
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to disconnect biometric providers", 401);

  const rl = rateLimit({ key: `biometric-disconnect-all:${user.id}`, limit: 5, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const service = createSupabaseServiceClient();
  const { data: existing } = await service
    .from("biometric_connections")
    .select("id, provider")
    .eq("student_id", user.id)
    .neq("status", "disconnected");
  const ids = (existing ?? []).map((r) => (r as { id: string }).id);

  if (ids.length === 0) {
    return json({ ok: true, disconnected: 0 });
  }

  const { error } = await service
    .from("biometric_connections")
    .update({ status: "disconnected" })
    .eq("student_id", user.id)
    .in("id", ids);
  if (error) return err("internal_error", error.message, 500);

  for (const row of existing ?? []) {
    const provider = (row as { provider: string }).provider;
    const auditProvider = (
      {
        healthkit: "biometric_healthkit",
        google_fit: "biometric_google_fit",
        oura: "biometric_oura",
        whoop: "biometric_whoop",
      } as const
    )[provider as "healthkit" | "google_fit" | "oura" | "whoop"];
    if (!auditProvider) continue;
    try {
      await writeSignalAudit({
        actor_id: user.id,
        actor_type: "student",
        student_id: user.id,
        provider: auditProvider,
        action: "delete_all",
        byte_count: 0,
        aggregate_hash: null,
      });
    } catch (e) {
      console.error("writeSignalAudit failed", e);
    }
  }

  return json({ ok: true, disconnected: ids.length });
}
