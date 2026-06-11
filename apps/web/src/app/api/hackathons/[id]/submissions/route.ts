import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { hackathonSubmitSchema, parseOrError } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Student submits code to a live hackathon. The DB-level check on
// `hackathons` (status='live') is mirrored here for a fast 409
// response; the edge function will re-check on its side. We
// fire-and-forget the grader call — failures there don't roll back
// the submission, the row sits with `score=NULL` until a worker
// re-tries.
export async function POST(req: Request, ctx: Params) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const rl = rateLimit({ key: `hackathon-submit:${user.id}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(hackathonSubmitSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { code_url, language } = parsed.data;

  // Confirm the hackathon is live AND the current time is inside the
  // submission window. We re-check on insert via the `status` field
  // (not the window) and we don't trust the client clock.
  const { data: hack, error: hErr } = await supabase
    .from("hackathons")
    .select("id,status,starts_at,ends_at")
    .eq("id", id)
    .maybeSingle();
  if (hErr) {
    return NextResponse.json({ error: hErr.message }, { status: 500 });
  }
  if (!hack) {
    return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
  }
  const h = hack as { status: string; starts_at: string; ends_at: string };
  if (h.status !== "live") {
    return NextResponse.json(
      { error: `Hackathon is '${h.status}', submissions are closed.` },
      { status: 409 },
    );
  }
  const now = Date.now();
  if (now < new Date(h.starts_at).getTime() || now > new Date(h.ends_at).getTime()) {
    return NextResponse.json(
      { error: "Submission is outside the hackathon window." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("hackathon_submissions")
    .insert({
      hackathon_id: id,
      student_id: user.id,
      code_url,
      language,
    })
    .select("id,status")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const submissionId = (data as { id: string }).id;

  // Fire-and-forget the grader. We use the service role key to
  // authenticate the edge function so the worker can write back the
  // results (RLS would otherwise block the service-side UPDATE).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    fetch(`${supabaseUrl}/functions/v1/hackathon-grader`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ submission_id: submissionId }),
    }).catch(() => null);
  }

  return NextResponse.json(
    { submission_id: submissionId, status: "pending_grade" },
    { status: 202 },
  );
}
