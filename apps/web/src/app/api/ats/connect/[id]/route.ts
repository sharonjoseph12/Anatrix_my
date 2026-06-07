import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

// DELETE /api/ats/connect/:id — revoke a recruiter ATS connection.
//
// Spec: specs/004-eleven-of-ten/contracts/api.md → DELETE /api/ats/connect/:id
//
// We never hard-delete the row — sync history (ats_sync_log) FKs into it
// and the audit trail must be preserved. Instead we flip the connection
// to status='revoked' which suppresses the cron evaluator and blocks
// future sync attempts (see ats-sync-{greenhouse,lever} which both
// require status='active').

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `ats-revoke:${user.id}`, limit: 20, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  // The SELECT policy on ats_connections already restricts to the owning
  // recruiter; if maybeSingle returns null the user either doesn't own
  // the row or it doesn't exist. Treat both as 404.
  const { data: existing } = await supabase
    .from("ats_connections")
    .select("id,recruiter_id,status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = existing as { id: string; recruiter_id: string; status: string };
  if (row.recruiter_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (row.status === "revoked") {
    // Idempotent: revoking an already-revoked connection is fine.
    return new NextResponse(null, { status: 204 });
  }

  const { error } = await supabase
    .from("ats_connections")
    .update({ status: "revoked" })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
