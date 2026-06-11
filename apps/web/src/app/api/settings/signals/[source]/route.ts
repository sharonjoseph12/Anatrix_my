// apps/web/src/app/api/settings/signals/[source]/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US3 (FR-PRI-002)
//   contracts/api.md → DELETE /api/settings/signals/{source}
// source is one of: ide_vscode, ide_cursor, biometric_healthkit,
// biometric_google_fit, biometric_oura, biometric_whoop.
// For IDE sources: zero score contribution on aggregates and queue a
// signal-purge. For biometric sources: flip the connection status.

import { NextResponse } from "next/server";
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

type Source =
  | "ide_vscode"
  | "ide_cursor"
  | "biometric_healthkit"
  | "biometric_google_fit"
  | "biometric_oura"
  | "biometric_whoop";

const VALID_SOURCES: ReadonlySet<Source> = new Set([
  "ide_vscode",
  "ide_cursor",
  "biometric_healthkit",
  "biometric_google_fit",
  "biometric_oura",
  "biometric_whoop",
]);

function isSource(s: string): s is Source {
  return VALID_SOURCES.has(s as Source);
}

function editorForSource(s: Source): "vscode" | "cursor" | null {
  if (s === "ide_vscode") return "vscode";
  if (s === "ide_cursor") return "cursor";
  return null;
}

function biometricProviderFor(s: Source):
  | "healthkit"
  | "google_fit"
  | "oura"
  | "whoop"
  | null {
  if (s === "biometric_healthkit") return "healthkit";
  if (s === "biometric_google_fit") return "google_fit";
  if (s === "biometric_oura") return "oura";
  if (s === "biometric_whoop") return "whoop";
  return null;
}

async function queuePurge(studentId: string, deviceId: string | null): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const queuedAt = new Date().toISOString();
  if (!supabaseUrl || !serviceKey) return queuedAt;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    await fetch(`${supabaseUrl}/functions/v1/signal-purge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ student_id: studentId, device_id: deviceId ?? undefined }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (e) {
    console.error("signal-purge dispatch failed", e);
  }
  return queuedAt;
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ source: string }> },
) {
  const { source } = await params;
  if (!isSource(source)) {
    return err("invalid_input", "unknown source", 400);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to disable a signal source", 401);

  const rl = rateLimit({ key: `signals-source-delete:${user.id}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const service = createSupabaseServiceClient();
  let queuedAt: string | null = null;

  const editor = editorForSource(source);
  if (editor) {
    const { data: matchingSessions, error: mErr } = await service
      .from("ide_sessions")
      .select("device_id")
      .eq("student_id", user.id)
      .eq("editor", editor)
      .order("started_at", { ascending: false })
      .limit(500);
    if (mErr) return err("internal_error", mErr.message, 500);
    const deviceIds = Array.from(
      new Set(
        (matchingSessions ?? [])
          .map((r) => (r as { device_id: string }).device_id)
          .filter((id): id is string => typeof id === "string"),
      ),
    );
    if (deviceIds.length > 0) {
      const { error: aggUpdErr } = await service
        .from("ide_aggregates")
        .update({ score_contribution: 0 })
        .eq("student_id", user.id)
        .in("device_id", deviceIds);
      if (aggUpdErr) return err("internal_error", aggUpdErr.message, 500);
      for (const deviceId of deviceIds) {
        queuedAt = await queuePurge(user.id, deviceId);
      }
    }
  }

  const bioProvider = biometricProviderFor(source);
  if (bioProvider) {
    const { error } = await service
      .from("biometric_connections")
      .update({ status: "disconnected" })
      .eq("student_id", user.id)
      .eq("provider", bioProvider);
    if (error) return err("internal_error", error.message, 500);
  }

  try {
    await writeSignalAudit({
      actor_id: user.id,
      actor_type: "student",
      student_id: user.id,
      provider: source,
      action: editor ? "delete_one" : "disable",
      byte_count: 0,
      aggregate_hash: null,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  return json({ ok: true, queued_purge_at: queuedAt });
}
