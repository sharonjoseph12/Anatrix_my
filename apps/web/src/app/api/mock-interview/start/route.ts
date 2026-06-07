import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { mockInterviewStartSchema, parseOrError } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const WEEKLY_SESSION_CAP = 4; // FR-MI-004

// Student starts a new mock interview. We enforce the per-student
// weekly session cap (>=4 completed → 429) BEFORE the LLM call. The
// edge function performs its own per-token cap check on the first
// turn; this route is the cheap, pre-LLM session cap.
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit({ key: `mock-start:${user.id}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(mockInterviewStartSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { topic } = parsed.data;

  // Count completed sessions in the last 7 days. We use completed
  // (not in_progress) so abandoned interviews don't burn the cap.
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { count, error: cErr } = await supabase
    .from("mock_interviews")
    .select("id", { count: "exact", head: true })
    .eq("student_id", user.id)
    .eq("status", "completed")
    .gte("completed_at", since);
  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }
  if ((count ?? 0) >= WEEKLY_SESSION_CAP) {
    return NextResponse.json(
      {
        error: `Weekly cap of ${WEEKLY_SESSION_CAP} completed sessions reached.`,
        code: "weekly_session_cap_exceeded",
      },
      {
        status: 429,
        headers: {
          // Earliest completed_at + 7d, or now+24h as a safe upper bound.
          "Retry-After": "86400",
        },
      },
    );
  }

  // Insert the interview row.
  const { data: iv, error: iErr } = await supabase
    .from("mock_interviews")
    .insert({
      student_id: user.id,
      topic,
      status: "in_progress",
      total_tokens: 0,
    })
    .select("id,topic")
    .single();
  if (iErr) {
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }
  const interviewId = (iv as { id: string }).id;

  // Generate the first question via the LLM edge function. We use
  // the "complete" call shape with a tiny prompt and the LLM-as-
  // single-shot path isn't suitable for an opening question, so we
  // instead use a one-shot streaming call and capture the assembled
  // text. We do this through a small inline helper rather than
  // importing the edge function (it lives in a different runtime).
  const firstQuestion = await generateOpeningQuestion({
    topic,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  });

  // Persist the opening question as the first interviewer turn.
  const { error: tErr } = await supabase.from("mock_interview_turns").insert({
    interview_id: interviewId,
    turn_index: 0,
    role: "interviewer",
    content: firstQuestion,
    tokens_used: 0,
  });
  if (tErr) {
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }

  return NextResponse.json(
    { interview_id: interviewId, first_question: firstQuestion },
    { status: 201 },
  );
}

// Calls the mock-interview-llm edge function with a synthesised
// "first question" payload. We bypass the streaming path and just
// read the assembled text from the SSE stream — this is a one-shot
// generation and the latency is dominated by the LLM, not the SSE
// plumbing.
async function generateOpeningQuestion(args: {
  topic: string;
  supabaseUrl: string;
  serviceKey: string;
}): Promise<string> {
  if (!args.supabaseUrl || !args.serviceKey) {
    return defaultOpening(args.topic);
  }
  try {
    // The edge function does not support a "non-stream first
    // question" path directly; we use the turn-mode and pass an
    // empty `message` (the edge function rejects empty messages).
    // Instead we issue a `complete`-shaped request with a minimal
    // transcript to elicit an opening line; if the LLM is not
    // configured the edge function returns a fast 500 and we fall
    // back to the deterministic default.
    const tmpIv = "00000000-0000-0000-0000-000000000000";
    const res = await fetch(`${args.supabaseUrl}/functions/v1/mock-interview-llm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.serviceKey}`,
      },
      body: JSON.stringify({
        interview_id: tmpIv,
        message: `Start the interview on topic: ${args.topic}`,
      }),
    });
    if (!res.ok || !res.body) return defaultOpening(args.topic);
    const text = await res.text();
    const deltas: string[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:") || trimmed === "data: [DONE]") continue;
      const payload = trimmed.slice(5).trim();
      try {
        const obj = JSON.parse(payload) as { delta?: string };
        if (obj.delta) deltas.push(obj.delta);
      } catch { /* ignore */ }
    }
    const assembled = deltas.join("").trim();
    return assembled || defaultOpening(args.topic);
  } catch {
    return defaultOpening(args.topic);
  }
}

function defaultOpening(topic: string): string {
  return `Welcome. Today we'll explore ${topic} together. To start: walk me through how you'd approach designing a solution end-to-end, including the tradeoffs you'd consider.`;
}
