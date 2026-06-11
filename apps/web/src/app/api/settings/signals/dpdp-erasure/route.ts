// apps/web/src/app/api/settings/signals/dpdp-erasure/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US3 (FR-PRI-006, FR-AUD-003)
//   contracts/api.md → GET / POST /api/settings/signals/dpdp-erasure
// GET:  list the caller's DPDP erasure requests.
// POST: alias for the destructive delete-all action. Provides URL
//   discoverability for the DPDP data-principal-rights flow.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to view DPDP requests", 401);

  const { data, error } = await supabase
    .from("dpdp_erasure_requests")
    .select("id, status, requested_at, due_by, completed_at")
    .eq("student_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(50);
  if (error) return err("internal_error", error.message, 500);

  return json({ requests: data ?? [] });
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to file a DPDP erasure", 401);

  const rl = rateLimit({ key: `signals-dpdp:${user.id}`, limit: 3, windowMs: 60 * 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  let erasure;
  try {
    erasure = await requestDPDPErasure(user.id);
  } catch (e) {
    return err("internal_error", (e as Error).message, 500);
  }

  try {
    await writeSignalAudit({
      actor_id: user.id,
      actor_type: "student",
      student_id: user.id,
      provider: "dpdp_erasure",
      action: "delete_all",
      byte_count: 0,
      aggregate_hash: null,
    });
  } catch (e) {
    console.error("writeSignalAudit failed", e);
  }

  return json({ ok: true, dpdp_request_id: erasure.id, due_by: erasure.due_by });
}
