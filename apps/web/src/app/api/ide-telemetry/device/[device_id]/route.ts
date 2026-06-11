// apps/web/src/app/api/ide-telemetry/device/[device_id]/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US1 acceptance scenario 3
//   contracts/api.md → DELETE /api/ide-telemetry/device/{device_id}
// Marks the device inactive and queues a signal-purge run. A signal_audit
// row is written with action=delete_one (FR-PRI-004).

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

async function queuePurge(deviceId: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const queuedAt = new Date().toISOString();
  if (!supabaseUrl || !serviceKey) {
    return queuedAt;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    await fetch(`${supabaseUrl}/functions/v1/signal-purge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ device_id: deviceId }),
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
  { params }: { params: Promise<{ device_id: string }> },
) {
  const { device_id: deviceId } = await params;
  if (!deviceId) {
    return err("invalid_input", "device_id is required", 400);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to uninstall a device", 401);

  const rl = rateLimit({ key: `ide-device-delete:${user.id}`, limit: 20, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  // TODO(prod): verify device ownership via a device_owners table. RLS on
  // ide_sessions/ide_aggregates already restricts to student_id=auth.uid()
  // so a malicious caller cannot delete another student's rows, but we
  // also want to short-circuit the request before queuing the purge.
  const { data: aggRow } = await supabase
    .from("ide_aggregates")
    .select("id, student_id")
    .eq("device_id", deviceId)
    .limit(1)
    .maybeSingle();
  const ownerId = (aggRow as { student_id?: string } | null)?.student_id;
  if (ownerId && ownerId !== user.id) {
    return err("forbidden", "device does not belong to caller", 403);
  }

  const service = createSupabaseServiceClient();
  const { error: aggUpdErr } = await service
    .from("ide_aggregates")
    .update({ score_contribution: 0 })
    .eq("device_id", deviceId)
    .eq("student_id", user.id);
  if (aggUpdErr) {
    return err("internal_error", aggUpdErr.message, 500);
  }

  // TODO(prod): flip a device_owners.is_active=false column. There is no
  // device_owners table in the schema yet; we mark the device inactive by
  // zeroing the score contribution on its daily aggregates and queue a
  // purge, which is what the user sees as "uninstall".
  const queuedAt = await queuePurge(deviceId);

  const editor = await service
    .from("ide_sessions")
    .select("editor")
    .eq("device_id", deviceId)
    .eq("student_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const editorName = (editor.data as { editor?: string } | null)?.editor ?? "vscode";
  const provider: "ide_vscode" | "ide_cursor" =
    editorName === "cursor" ? "ide_cursor" : "ide_vscode";

  try {
    await writeSignalAudit({
      actor_id: user.id,
      actor_type: "student",
      student_id: user.id,
      provider,
      action: "delete_one",
      byte_count: 0,
      aggregate_hash: null,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  return json({ ok: true, queued_purge_at: queuedAt });
}
