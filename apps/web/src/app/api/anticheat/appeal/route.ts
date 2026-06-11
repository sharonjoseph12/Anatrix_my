import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { anticheatAppealSchema, parseOrError } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({
    key: `anticheat-appeal:${user.id}`,
    limit: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(anticheatAppealSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { signal_id, explanation, evidence_url } = parsed.data;

  const { data: signal, error: sigErr } = await supabase
    .from("anticheat_signals")
    .select("id,student_id,signal,confidence")
    .eq("id", signal_id)
    .eq("student_id", user.id)
    .maybeSingle();
  if (sigErr) return NextResponse.json({ error: sigErr.message }, { status: 500 });
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  const { data: existing, error: existErr } = await supabase
    .from("anticheat_appeals")
    .select("id,status")
    .eq("signal_id", signal_id)
    .eq("status", "pending")
    .maybeSingle();
  if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 });
  if (existing) {
    return NextResponse.json(
      { error: "An appeal is already pending for this signal", appeal_id: (existing as { id: string }).id },
      { status: 409 },
    );
  }

  const { data: appeal, error: insErr } = await supabase
    .from("anticheat_appeals")
    .insert({
      signal_id,
      student_id: user.id,
      explanation,
      ...(evidence_url ? { evidence_url } : {}),
    })
    .select("id,status")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const { error: auditErr } = await supabase
    .from("anticheat_audit")
    .insert({
      actor_id: user.id,
      actor_type: "student",
      action: "appeal_filed",
      subject_signal_id: signal_id,
      payload: {
        appeal_id: (appeal as { id: string }).id,
        has_evidence_url: Boolean(evidence_url),
        signal: (signal as { signal: string }).signal,
      },
    });
  if (auditErr) {
    // anticheat_audit is service-role-only per migration 034; retry via
    // service client so the audit row is durable even when RLS denies
    // the user-scoped client. A failure here is logged but never blocks
    // the student's appeal.
    try {
      const service = createSupabaseServiceClient();
      const { error: svcErr } = await service.from("anticheat_audit").insert({
        actor_id: user.id,
        actor_type: "student",
        action: "appeal_filed",
        subject_signal_id: signal_id,
        payload: {
          appeal_id: (appeal as { id: string }).id,
          has_evidence_url: Boolean(evidence_url),
          signal: (signal as { signal: string }).signal,
        },
      });
      if (svcErr) console.error("anticheat_audit service insert failed", svcErr);
    } catch (e) {
      console.error("anticheat_audit fallback failed", e);
    }
  }

  return NextResponse.json(
    { appeal_id: (appeal as { id: string }).id, status: (appeal as { status: string }).status },
    { status: 201 },
  );
}
