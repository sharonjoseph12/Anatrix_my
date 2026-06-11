import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeSignalAudit } from "./log";

export type DPDPRequestStatus = "pending" | "in_progress" | "complete" | "failed";

export interface DPDPErasureRequest {
  id: string;
  student_id: string;
  status: DPDPRequestStatus;
  requested_at: string;
  due_by: string;
  completed_at: string | null;
}

const DPDP_WINDOW_DAYS = 30;

export async function requestDPDPErasure(
  studentId: string,
): Promise<DPDPErasureRequest> {
  const supabase = await createSupabaseServerClient();

  const dueBy = new Date(
    Date.now() + DPDP_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: existing, error: exErr } = await supabase
    .from("dpdp_erasure_requests")
    .select("*")
    .eq("student_id", studentId)
    .in("status", ["pending", "in_progress"])
    .maybeSingle();
  if (exErr) {
    throw new Error(`dpdp_erasure_requests select: ${exErr.message}`);
  }
  if (existing) return existing as DPDPErasureRequest;

  const { data: inserted, error: insErr } = await supabase
    .from("dpdp_erasure_requests")
    .insert({
      student_id: studentId,
      status: "pending",
      due_by: dueBy,
    })
    .select("*")
    .single();
  if (insErr) {
    throw new Error(`dpdp_erasure_requests insert: ${insErr.message}`);
  }

  await writeSignalAudit({
    actor_id: studentId,
    actor_type: "student",
    student_id: studentId,
    provider: "dpdp_erasure",
    action: "delete_all",
    byte_count: 0,
  });

  return inserted as DPDPErasureRequest;
}

export async function processDPDPErasure(
  requestId: string,
): Promise<{ ok: true; purged: number }> {
  const supabase = await createSupabaseServerClient();
  const { data: req, error: reqErr } = await supabase
    .from("dpdp_erasure_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (reqErr) {
    throw new Error(`dpdp_erasure_requests select: ${reqErr.message}`);
  }
  const r = req as DPDPErasureRequest;

  const { error: updErr } = await supabase
    .from("dpdp_erasure_requests")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (updErr) {
    throw new Error(`dpdp_erasure_requests update: ${updErr.message}`);
  }

  await writeSignalAudit({
    actor_id: null,
    actor_type: "system",
    student_id: r.student_id,
    provider: "dpdp_erasure",
    action: "erasure_complete",
    byte_count: 0,
  });

  return { ok: true, purged: 0 };
}
