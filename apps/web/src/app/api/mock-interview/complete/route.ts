import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Body = z.object({
  interview_id: z.string().uuid(),
});

// Student completes a mock interview. The edge function grades the
// full transcript and returns the rubric + score_contribution; we
// reflect the result back to the client. The `status='completed'`
// update happens server-side in the edge function, so we don't need
// to write it again here.
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit({ key: `mock-complete:${user.id}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { interview_id } = parsed.data;

  // Ownership check.
  const { data: iv, error: ivErr } = await supabase
    .from("mock_interviews")
    .select("id,student_id,status")
    .eq("id", interview_id)
    .maybeSingle();
  if (ivErr) {
    return NextResponse.json({ error: ivErr.message }, { status: 500 });
  }
  if (!iv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((iv as { student_id: string }).student_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if ((iv as { status: string }).status === "completed") {
    return NextResponse.json(
      { error: "Interview is already completed" },
      { status: 410 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const upstream = await fetch(
    `${supabaseUrl}/functions/v1/mock-interview-llm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ interview_id, complete: true }),
    },
  );

  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try {
      errBody = await upstream.json();
    } catch { /* keep generic */ }
    return NextResponse.json(
      { error: "Grading failed", detail: errBody },
      { status: upstream.status },
    );
  }
  const result = (await upstream.json()) as {
    ok: boolean;
    rubric: { clarity: number; depth: number; correctness: number; summary: string };
    score_contribution: number;
  };

  return NextResponse.json({
    rubric: result.rubric,
    score_contribution: result.score_contribution,
  });
}
