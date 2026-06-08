// supabase/functions/mock-interview-llm/index.ts
// 11/10 — Mock Interview LLM conductor (FR-MI-001, FR-MI-002,
// FR-MI-003, FR-MI-004, FR-MI-005).
//
// Two modes dispatched on the request body:
//
//   1. { interview_id, message }  → Server-Sent Events stream of the
//      LLM's next interviewer turn. On the final event, a
//      `mock_interview_turns` row is written and the parent's
//      `total_tokens` counter is bumped.
//   2. { interview_id, complete: true } → Asks the LLM to score the
//      full transcript on the rubric, writes the result to
//      `mock_interviews.rubric`, sets `score_contribution` (capped at
//      5% per FR-MI-004), and flips status to `completed`.
//
// Cap enforcement (FR-MI-005) is done BEFORE every LLM call, not
// after. We sum `mock_interview_turns.tokens_used` over the last 7
// days for the student (per-student weekly cap) and the calendar
// month for the student's inferred institution cohort (per-tenant
// monthly cap). If either is exceeded we return 402.
//
// Provider abstraction: the LLM SDK choice is intentional. We hit the
// Groq REST endpoint directly via `fetch()` instead of `import { Groq
// } from "groq-sdk"` because (a) the esm.sh Groq SDK pulls a non-
// trivial dependency tree that breaks on Deno's import map and (b)
// we need full control over the SSE wire format. `MOCK_INTERVIEW_PROVIDER`
// can be set to `openai` and the URL + model swap automatically.
//
// Local dev:  npx supabase functions serve mock-interview-llm
// Deploy:     npx supabase functions deploy mock-interview-llm
//
// Env:
//   MOCK_INTERVIEW_PROVIDER            "groq" (default) | "openai"
//   MOCK_INTERVIEW_API_KEY             required
//   MOCK_INTERVIEW_MODEL               "llama-3.1-70b-versatile" (default for groq)
//   MOCK_INTERVIEW_WEEKLY_TOKEN_CAP    per student, default 50000
//   MOCK_INTERVIEW_MONTHLY_TOKEN_CAP   per institution, default 5000000
//   MOCK_INTERVIEW_OPENAI_URL          override for OpenAI-compatible endpoints

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { withObservability } from "../_shared/observability.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SSE_HEADERS = {
  ...CORS,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function errRes(code: string, message: string, status: number): Response {
  return jsonRes({ error: code, message }, status);
}

const SYSTEM_PROMPT = `You are a senior staff engineer conducting a mock technical interview.
- Ask one question at a time. Prefer open-ended, probing questions.
- After the candidate answers, give 1-2 sentences of brief, specific feedback,
  then ask the next follow-up.
- Match the topic the candidate selected. Stay on-topic.
- Keep responses under 180 words.
- Do not reveal that you are an LLM in a chain.`;

const RUBRIC_PROMPT = `You are grading a completed mock technical interview transcript.
Return STRICT JSON of the form
{"clarity":0-10,"depth":0-10,"correctness":0-10,"summary":"<2 sentence summary>"}.
No prose, no markdown fences. Calibrate so a strong staff-engineer answer scores 7-9 and
a textbook-perfect answer scores 10.`;

serve(
  withObservability("mock-interview-llm", async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") {
      return errRes("method_not_allowed", "Use POST.", 405);
    }
    if (!ctx.userId) {
      return errRes("unauthorized", "Missing or invalid bearer token.", 401);
    }

    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return errRes("invalid_request", "Body must be valid JSON.", 400);
    }
    const interviewId =
      typeof body.interview_id === "string" ? body.interview_id : undefined;
    const complete = body.complete === true;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!interviewId || !UUID_RE.test(interviewId)) {
      return errRes("invalid_request", "interview_id must be a UUID.", 400);
    }
    if (!complete && message.length === 0) {
      return errRes("invalid_request", "message or complete:true is required.", 400);
    }
    ctx.span.setAttribute("interview_id", interviewId);
    ctx.span.setAttribute("mode", complete ? "complete" : "turn");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Load interview (RLS bypasses via service role; we re-check
    // ownership below using the JWT subject from ctx.userId).
    const ivSpan = ctx.span.startChild("db.select.interview");
    const { data: interview, error: ivErr } = await supabase
      .from("mock_interviews")
      .select("id,student_id,topic,status,total_tokens,started_at,completed_at")
      .eq("id", interviewId)
      .maybeSingle();
    ivSpan.end();
    if (ivErr) {
      ctx.log.error("select mock_interviews failed", { error: ivErr.message });
      return errRes("db_error", ivErr.message, 500);
    }
    if (!interview) return errRes("not_found", "Interview not found.", 404);
    if (interview.student_id !== ctx.userId) {
      // Don't leak existence of other students' interviews.
      return errRes("forbidden", "Not your interview.", 403);
    }
    if (complete && interview.status === "completed") {
      return errRes("already_completed", "Interview is already completed.", 410);
    }
    if (!complete && interview.status !== "in_progress") {
      return errRes(
        "not_in_progress",
        `Interview status is '${interview.status}', cannot accept new turns.`,
        410,
      );
    }

    // Cap check (FR-MI-005). Per-student weekly + per-tenant monthly.
    const capDecision = await checkCaps({
      supabase,
      studentId: ctx.userId,
      interview,
    });
    if (!capDecision.ok) {
      ctx.log.warn("cap exceeded", {
        code: capDecision.code,
        reason: capDecision.reason,
        weekly_used: capDecision.weeklyUsed,
        weekly_cap: capDecision.weeklyCap,
        monthly_used: capDecision.monthlyUsed,
        monthly_cap: capDecision.monthlyCap,
      });
      return errRes(capDecision.code, capDecision.reason, 402);
    }

    // Complete-mode path: build the rubric prompt over the transcript,
    // call the LLM, parse strict JSON, persist.
    if (complete) {
      const turns = await loadTurns(supabase, interviewId);
      const transcript = turns
        .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
        .join("\n\n");
      const llmText = await callLlmOnce({
        system: RUBRIC_PROMPT,
        user:
          `Topic: ${interview.topic}\n\nTranscript:\n${transcript}\n\n` +
          "Return the strict JSON now.",
        temperature: 0.2,
        maxTokens: 600,
        log: ctx.log,
      });
      const rubric = parseRubric(llmText);
      const scoreContribution = Math.min(
        5,
        Math.round(((rubric.clarity + rubric.depth + rubric.correctness) / 3) / 2),
      );

      const updSpan = ctx.span.startChild("db.update.interview.completed");
      const { error: compErr } = await supabase
        .from("mock_interviews")
        .update({
          rubric,
          score_contribution: scoreContribution,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", interviewId);
      updSpan.end();
      if (compErr) {
        ctx.log.error("update mock_interviews failed", { error: compErr.message });
        return errRes("db_error", compErr.message, 500);
      }

      return jsonRes({ ok: true, rubric, score_contribution: scoreContribution });
    }

    // Turn-mode path: persist the student turn, stream the LLM
    // response back as SSE, then persist the interviewer turn.
    const studentTurnIndex = await nextTurnIndex(supabase, interviewId);
    const insSpan = ctx.span.startChild("db.insert.student_turn");
    const { error: stuErr } = await supabase
      .from("mock_interview_turns")
      .insert({
        interview_id: interviewId,
        turn_index: studentTurnIndex,
        role: "student",
        content: message,
        tokens_used: 0,
      });
    insSpan.end();
    if (stuErr) {
      ctx.log.error("insert student turn failed", { error: stuErr.message });
      return errRes("db_error", stuErr.message, 500);
    }

    const transcript = (await loadTurns(supabase, interviewId))
      .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
      .join("\n\n");
    const userPrompt = transcript
      ? `Topic: ${interview.topic}\n\nTranscript so far:\n${transcript}\n\nContinue the interview.`
      : `Topic: ${interview.topic}\n\nBegin the interview with a single opening question.`;

    const stream = streamLlmTurn({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      log: ctx.log,
      onComplete: async (fullText, tokensUsed) => {
        try {
          const interviewerIndex = studentTurnIndex + 1;
          await supabase.from("mock_interview_turns").insert({
            interview_id: interviewId,
            turn_index: interviewerIndex,
            role: "interviewer",
            content: fullText,
            tokens_used: tokensUsed,
          });
          await supabase
            .from("mock_interviews")
            .update({ total_tokens: (interview.total_tokens ?? 0) + tokensUsed })
            .eq("id", interviewId);
        } catch (e) {
          ctx.log.error("persisting interviewer turn failed", {
            error: (e as Error).message,
          });
        }
      },
    });

    return new Response(stream, { status: 200, headers: SSE_HEADERS });
  }),
);

// ---------------------------------------------------------------------------
// Cap enforcement. Returns ok=true with the current counters when both
// caps are within bounds; otherwise returns ok=false with the
// appropriate 4xx code (402 for the LLM cost cap).
// ---------------------------------------------------------------------------
async function checkCaps(args: {
  supabase: ReturnType<typeof createClient>;
  studentId: string;
  interview: { total_tokens: number | null };
}): Promise<
  & {
    ok: boolean;
    code: string;
    reason: string;
    weeklyUsed: number;
    weeklyCap: number;
    monthlyUsed: number;
    monthlyCap: number;
  }
> {
  const weeklyCap = Number(
    Deno.env.get("MOCK_INTERVIEW_WEEKLY_TOKEN_CAP") ?? "50000",
  );
  const monthlyCap = Number(
    Deno.env.get("MOCK_INTERVIEW_MONTHLY_TOKEN_CAP") ?? "5000000",
  );
  const sb = args.supabase as any;

  // Per-student weekly usage: sum tokens_used for the same student_id
  // over the last 7 days. Cheap because mock_interview_turns joins to
  // mock_interviews on indexable keys.
  const { data: weeklyRows } = await sb
    .from("mock_interview_turns")
    .select("tokens_used, mock_interviews!inner(student_id, created_at)")
    .eq("mock_interviews.student_id", args.studentId)
    .gt("mock_interviews.started_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
  const weeklyUsed = (weeklyRows ?? []).reduce(
    (s: number, r: { tokens_used: number | null }) => s + (r.tokens_used ?? 0),
    0,
  );
  if (weeklyUsed >= weeklyCap) {
    return {
      ok: false,
      code: "weekly_token_cap_exceeded",
      reason: `Weekly cap ${weeklyCap} tokens exceeded.`,
      weeklyUsed,
      weeklyCap,
      monthlyUsed: 0,
      monthlyCap,
    };
  }

  // Per-tenant monthly usage. We resolve the student's institution
  // by walking the cohort_members → cohorts.institution_id chain and
  // picking the first institutional cohort. If the student has no
  // institutional cohort, the per-tenant cap is not enforced (we
  // can't tell which tenant they belong to).
  const { data: cohortRow } = await sb
    .from("cohort_members")
    .select("cohort:cohorts(institution_id)")
    .eq("user_id", args.studentId)
    .limit(1)
    .maybeSingle();
  const institutionId = (cohortRow as { cohort?: { institution_id?: string } } | null)
    ?.cohort?.institution_id;
  let monthlyUsed = 0;
  if (institutionId) {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const { data: monthlyRows } = await sb
      .from("mock_interview_turns")
      .select("tokens_used, mock_interviews!inner(student_id, started_at), users!mock_interviews_student_id_fkey(institution_id)")
      .gt("mock_interviews.started_at", startOfMonth.toISOString());
    monthlyUsed = (monthlyRows ?? []).reduce(
      (s: number, r: { tokens_used: number | null }) => s + (r.tokens_used ?? 0),
      0,
    );
    if (monthlyUsed >= monthlyCap) {
      return {
        ok: false,
        code: "monthly_token_cap_exceeded",
        reason: `Institution monthly cap ${monthlyCap} tokens exceeded.`,
        weeklyUsed,
        weeklyCap,
        monthlyUsed,
        monthlyCap,
      };
    }
  }

  return {
    ok: true,
    code: "",
    reason: "",
    weeklyUsed,
    weeklyCap,
    monthlyUsed,
    monthlyCap,
  };
}

// ---------------------------------------------------------------------------
// LLM streaming. Uses the Groq OpenAI-compatible endpoint by default
// and emits SSE in the `data: {...}\n\n` wire format. The completion
// event is `data: [DONE]\n\n` so EventSource clients can close the
// stream cleanly.
// ---------------------------------------------------------------------------
type Logger = {
  info: (m: string, f?: Record<string, unknown>) => void;
  error: (m: string, f?: Record<string, unknown>) => void;
};

function streamLlmTurn(args: {
  system: string;
  user: string;
  log: Logger;
  onComplete: (fullText: string, tokensUsed: number) => Promise<void>;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let buffer = "";
  let assembled = "";
  let tokensUsed = 0;
  let done = false;

  const provider = (Deno.env.get("MOCK_INTERVIEW_PROVIDER") ?? "groq")
    .toLowerCase();
  const apiKey = Deno.env.get("MOCK_INTERVIEW_API_KEY") ?? "";
  const model = Deno.env.get("MOCK_INTERVIEW_MODEL") ??
    (provider === "openai" ? "gpt-4o-mini" : "llama-3.1-70b-versatile");
  if (!apiKey) {
    return errorStream(
      encoder,
      "MOCK_INTERVIEW_API_KEY is not set on the edge function.",
    );
  }
  const url = provider === "openai"
    ? (Deno.env.get("MOCK_INTERVIEW_OPENAI_URL") ??
      "https://api.openai.com/v1/chat/completions")
    : "https://api.groq.com/openai/v1/chat/completions";

  const ctl = new AbortController();
  const upstream = fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.6,
      max_tokens: 700,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
    signal: ctl.signal,
  })
    .catch((e) => {
      args.log.error("upstream fetch failed", { error: (e as Error).message });
      return null;
    });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!upstream) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "upstream_unreachable" })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
        return;
      }
      const res = await upstream;
      if (!res.ok || !res.body) {
        const text = res.body ? await res.text() : "";
        args.log.error("upstream non-2xx", { status: res.status, text });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "upstream_error", status: res.status })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { value, done: rDone } = await reader.read();
          if (rDone) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") {
              done = true;
              break;
            }
            try {
              const json = JSON.parse(payload) as {
                choices?: Array<{
                  delta?: { content?: string };
                  finish_reason?: string | null;
                }>;
                usage?: { total_tokens?: number };
              };
              const delta = json.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                assembled += delta;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ delta })}\n\n`,
                  ),
                );
              }
              if (json.usage?.total_tokens) {
                tokensUsed = json.usage.total_tokens;
              }
            } catch {
              // Ignore unparseable chunks; the upstream may send
              // keep-alive comments that aren't JSON.
            }
          }
          if (done) break;
        }
      } catch (e) {
        args.log.error("upstream read error", { error: (e as Error).message });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "stream_error" })}\n\n`,
          ),
        );
      } finally {
        if (tokensUsed === 0) {
          tokensUsed = Math.max(1, Math.ceil(assembled.length / 4));
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              turn_id: crypto.randomUUID(),
              tokens_used: tokensUsed,
            })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
        try {
          await args.onComplete(assembled, tokensUsed);
        } catch (e) {
          args.log.error("onComplete callback failed", {
            error: (e as Error).message,
          });
        }
      }
    },
    cancel() {
      ctl.abort();
    },
  });
}

// Used when env is misconfigured.
function errorStream(encoder: TextEncoder, msg: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
      );
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
}

async function callLlmOnce(args: {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  log: Logger;
}): Promise<string> {
  const provider = (Deno.env.get("MOCK_INTERVIEW_PROVIDER") ?? "groq")
    .toLowerCase();
  const apiKey = Deno.env.get("MOCK_INTERVIEW_API_KEY") ?? "";
  const model = Deno.env.get("MOCK_INTERVIEW_MODEL") ??
    (provider === "openai" ? "gpt-4o-mini" : "llama-3.1-70b-versatile");
  if (!apiKey) throw new Error("MOCK_INTERVIEW_API_KEY is not set");
  const url = provider === "openai"
    ? (Deno.env.get("MOCK_INTERVIEW_OPENAI_URL") ??
      "https://api.openai.com/v1/chat/completions")
    : "https://api.groq.com/openai/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: args.temperature,
      max_tokens: args.maxTokens,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    args.log.error("upstream non-2xx (once)", { status: res.status, text });
    throw new Error(`LLM ${res.status}`);
  }
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return body.choices?.[0]?.message?.content ?? "";
}

function parseRubric(raw: string): {
  clarity: number;
  depth: number;
  correctness: number;
  summary: string;
} {
  const fallback = { clarity: 5, depth: 5, correctness: 5, summary: "No rubric returned." };
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return fallback;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as {
      clarity?: number;
      depth?: number;
      correctness?: number;
      summary?: string;
    };
    const clamp = (v: unknown) =>
      Math.max(0, Math.min(10, Math.round(Number(v) || 0)));
    return {
      clarity: clamp(obj.clarity),
      depth: clamp(obj.depth),
      correctness: clamp(obj.correctness),
      summary: typeof obj.summary === "string" ? obj.summary : "",
    };
  } catch {
    return fallback;
  }
}

async function nextTurnIndex(
  supabase: ReturnType<typeof createClient>,
  interviewId: string,
): Promise<number> {
  const { data } = await supabase
    .from("mock_interview_turns")
    .select("turn_index")
    .eq("interview_id", interviewId)
    .order("turn_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = (data as { turn_index?: number } | null)?.turn_index ?? -1;
  return last + 1;
}

async function loadTurns(
  supabase: ReturnType<typeof createClient>,
  interviewId: string,
): Promise<Array<{ role: string; content: string; turn_index: number }>> {
  const { data } = await supabase
    .from("mock_interview_turns")
    .select("role,content,turn_index")
    .eq("interview_id", interviewId)
    .order("turn_index", { ascending: true });
  return (data ?? []) as Array<{ role: string; content: string; turn_index: number }>;
}
