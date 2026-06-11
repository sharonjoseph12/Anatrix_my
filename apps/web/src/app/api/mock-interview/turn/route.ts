import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { mockInterviewTurnSchema, parseOrError } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

// Student submits a turn; the response is an SSE stream of the LLM's
// follow-up question. We proxy the upstream SSE from
// `mock-interview-llm` directly: a 1:1 byte forward is the simplest
// way to preserve the wire format (deltas + `[DONE]` + final
// done-event) without re-implementing the parser.
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit({ key: `mock-turn:${user.id}`, limit: 60, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(mockInterviewTurnSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { interview_id, message } = parsed.data;

  // Ownership + status preflight. We avoid sending a turn for a
  // completed/abandoned interview — the edge function would reject
  // it with 410, but we can short-circuit with a clearer error here.
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
  if ((iv as { status: string }).status !== "in_progress") {
    return NextResponse.json(
      { error: `Interview status is '${(iv as { status: string }).status}'.` },
      { status: 410 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Open the upstream connection. The LLM edge function does its own
  // cap check; we forward its 402 / 410 / 404 / 500 responses as-is
  // (the client gets a single SSE error event in those cases).
  const upstream = await fetch(
    `${supabaseUrl}/functions/v1/mock-interview-llm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ interview_id, message }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    // Try to forward a structured error so the client EventSource
    // can surface a useful message.
    let errBody: unknown = { error: "upstream_error" };
    try {
      errBody = await upstream.json();
    } catch { /* keep generic */ }
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "upstream_error", upstream_status: upstream.status, detail: errBody })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      status: upstream.status === 402 ? 200 : upstream.status, // keep 200 so EventSource opens
      headers: SSE_HEADERS,
    });
  }

  // Forward the upstream body verbatim. Next.js (App Router) supports
  // piping a fetch ReadableStream into the Response body, preserving
  // chunked transfer encoding.
  return new Response(upstream.body, { status: 200, headers: SSE_HEADERS });
}
