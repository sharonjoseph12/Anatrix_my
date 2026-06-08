// apps/web/src/app/api/settings/signals/delete-all/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US3 (FR-PRI-003)
//   contracts/api.md → POST /api/settings/signals/delete-all
// Confirms the destructive action with a literal sentinel, soft-disconnects
// every biometric connection, zeros the IDE score contributions, and
// files a DPDP erasure request (30-day statutory window).

import { NextResponse } from "next/server";
import { ZodSignals } from "@antarix/types";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { writeSignalAudit } from "@/lib/audit/log";
import { requestDPDPErasure } from "@/lib/audit/dpdp-erasure";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function err(code: string, message: string, status: number) {
  return json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to delete all signal data", 401);

  const rl = rateLimit({ key: `signals-delete-all:${user.id}`, limit: 3, windowMs: 60 * 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = ZodSignals.deleteAllSignalsSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: { code: "invalid_input", message: "Confirmation required", issues: parsed.error.issues } },
      { status: 400 },
    );
  }
  void parsed.data;

  const service = createSupabaseServiceClient();
  const { error: bErr } = await service
    .from("biometric_connections")
    .update({ status: "disconnected" })
    .eq("student_id", user.id)
    .neq("status", "disconnected");
  if (bErr) return err("internal_error", bErr.message, 500);

  const { error: iErr } = await service
    .from("ide_aggregates")
    .update({ score_contribution: 0 })
    .eq("student_id", user.id);
  if (iErr) return err("internal_error", iErr.message, 500);

  let erasureRequest;
  try {
    erasureRequest = await requestDPDPErasure(user.id);
  } catch (e) {
    return err("internal_error", (e as Error).message, 500);
  }

  try {
    await writeSignalAudit({
      actor_id: user.id,
      actor_type: "student",
      student_id: user.id,
      provider: "privacy_center",
      action: "delete_all",
      byte_count: 0,
      aggregate_hash: null,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  return json({
    ok: true,
    dpdp_request_id: erasureRequest.id,
    due_by: erasureRequest.due_by,
  });
}
