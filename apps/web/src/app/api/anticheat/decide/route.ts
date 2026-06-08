import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { anticheatDecideSchema, parseOrError } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({
    key: `anticheat-decide:${user.id}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(anticheatDecideSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { appeal_id, decision, mentor_note } = parsed.data;

  const { data: appeal, error: appErr } = await supabase
    .from("anticheat_appeals")
    .select("id,signal_id,student_id,status,signal:anticheat_signals!inner(id,entity_type,entity_id,signal,confidence,evidence_payload)")
    .eq("id", appeal_id)
    .maybeSingle();
  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 });
  if (!appeal) return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
  if ((appeal as { status: string }).status !== "pending") {
    return NextResponse.json(
      { error: "Appeal is not pending", current_status: (appeal as { status: string }).status },
      { status: 409 },
    );
  }

  const studentId = (appeal as { student_id: string }).student_id;

  const { data: studentMembership, error: memErr } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", studentId)
    .eq("role", "student")
    .limit(1)
    .maybeSingle();
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
  if (!studentMembership) {
    return NextResponse.json({ error: "Student is not affiliated with an institution" }, { status: 403 });
  }
  const institutionId = (studentMembership as { institution_id: string }).institution_id;

  const { data: fv, error: fvErr } = await supabase
    .from("faculty_verifications")
    .select("verified,revoked_at")
    .eq("user_id", user.id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (fvErr) return NextResponse.json({ error: fvErr.message }, { status: 500 });

  let isAuthorised = false;
  if (fv && (fv as { verified: boolean; revoked_at: string | null }).verified) {
    if (!(fv as { revoked_at: string | null }).revoked_at) isAuthorised = true;
  }
  if (!isAuthorised) {
    const { data: meMembership, error: meErr } = await supabase
      .from("institution_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("institution_id", institutionId)
      .in("role", ["admin", "placement_officer", "faculty"])
      .maybeSingle();
    if (meErr) return NextResponse.json({ error: meErr.message }, { status: 500 });
    if (meMembership) isAuthorised = true;
  }
  if (!isAuthorised) {
    return NextResponse.json(
      { error: "Not a verified faculty/mentor at the student's institution" },
      { status: 403 },
    );
  }

  const decidedAt = new Date().toISOString();
  const { data: updated, error: upErr } = await supabase
    .from("anticheat_appeals")
    .update({
      status: decision,
      mentor_id: user.id,
      ...(mentor_note ? { mentor_note } : {}),
      decided_at: decidedAt,
    })
    .eq("id", appeal_id)
    .select("id,status,decided_at")
    .single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const signal = (appeal as { signal: unknown }).signal as {
    id: string;
    entity_type: "github_repo" | "dsa_record";
    entity_id: string;
  };

  if (decision === "approved") {
    try {
      const service = createSupabaseServiceClient();

      if (signal.entity_type === "dsa_record") {
        await service
          .from("user_dsa_profiles")
          .update({ quarantined_at: null, anticheat_score: 0 })
          .eq("id", signal.entity_id);
      } else if (signal.entity_type === "github_repo") {
        const { error: grErr } = await service
          .from("github_repos")
          .update({ quarantined_at: null, anticheat_score: 0 })
          .eq("id", signal.entity_id);
        if (grErr) {
          // github_repos may not yet exist as a table; migration 034 alters
          // it. Degrade gracefully — the anticheat_signals update below is
          // the canonical source of truth for the student.
          console.warn("github_repos unquarantine skipped:", grErr.message);
        }
      }

      // Mark the original signal superseded by a confidence-0 system signal
      // so the partial-unique index treats it as no longer active.
      const { data: superseding, error: supInsErr } = await service
        .from("anticheat_signals")
        .insert({
          entity_type: signal.entity_type,
          entity_id: signal.entity_id,
          student_id: studentId,
          signal: "fork_no_commits", // placeholder kind — overridden by evidence
          confidence: 0,
          evidence_payload: { restored_by_appeal: appeal_id },
        })
        .select("id")
        .single();
      if (supInsErr) {
        console.warn("superseding signal insert failed:", supInsErr.message);
      } else if (superseding) {
        const { error: supLinkErr } = await service
          .from("anticheat_signals")
          .update({ superseded_by: (superseding as { id: string }).id })
          .eq("id", signal.id);
        if (supLinkErr) {
          console.warn("supersede link failed:", supLinkErr.message);
        }
      }
    } catch (e) {
      console.error("post-decision cleanup failed", e);
    }
  }

  // Audit row. RLS denies INSERT for authenticated; use service client.
  try {
    const service = createSupabaseServiceClient();
    await service.from("anticheat_audit").insert({
      actor_id: user.id,
      actor_type: "mentor",
      action: "appeal_decided",
      subject_signal_id: signal.id,
      payload: { appeal_id, decision, mentor_note: mentor_note ?? null },
    });
  } catch (e) {
    console.error("anticheat_audit insert failed", e);
  }

  return NextResponse.json({
    appeal_id: (updated as { id: string }).id,
    status: (updated as { status: string }).status,
    decided_at: (updated as { decided_at: string }).decided_at,
  });
}
