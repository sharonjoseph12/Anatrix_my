// supabase/functions/hackathon-grader/index.ts
// 11/10 — Hackathon code-execution grader (FR-HK-002, FR-HK-003, FR-HK-005).
//
// v1 implements the deterministic stub path described in D6. The Edge
// Function runtime in Supabase does NOT expose `Deno.run` / a process
// sandbox that can safely execute arbitrary student code, so we run in
// `EVALUATION_MODE=stub` (the default) and write a `test_results` row
// that documents what real execution would have produced. When
// `EVALUATION_MODE=external` is set, we POST the code + test cases to
// `EVALUATION_RUNNER_URL` (Judge0 / HackerEarth / internal runner) and
// translate the response back into the same shape.
//
// All writes go through the service role. The route is invoked fire-
// and-forget from the `submissions` Next.js API route, but it is also
// idempotent: re-running the same `submission_id` is safe (the final
// UPDATE / credential inserts are deduplicated by submission_id).
//
// Local dev:  npx supabase functions serve hackathon-grader
// Deploy:     npx supabase functions deploy hackathon-grader
//
// Request:  POST /functions/v1/hackathon-grader
//           body: { "submission_id": "<uuid>" }
// Response: 200 { ok, score, rank?, credential_kind }
//           400 / 404 / 500 on validation / not-found / internal errors
//
// Env:
//   EVALUATION_MODE              "stub" (default) | "external"
//   EVALUATION_RUNNER_URL        URL of an external judge (external mode)
//   EVALUATION_RUNNER_TOKEN      Bearer token for the external runner
//   HACKATHON_CPU_SECONDS        hard wall-clock cap (default 30)
//   HACKATHON_MEMORY_MB          advisory memory cap (default 256)
//   HACKATHON_DISALLOW_NETWORK   "true" (default) – logged for audit

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
const VC_ISSUE_ENDPOINT = "/functions/v1/credential-vc-issue";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function errRes(code: string, message: string, status: number): Response {
  return jsonRes({ error: code, message }, status);
}

type TestCase = {
  name?: string;
  input?: unknown;
  expected_output?: unknown;
  stdin?: string;
  stdout?: string;
  weight?: number;
};

type GraderOutcome = {
  per_case: Array<{
    name: string;
    passed: boolean;
    actual: string;
    expected: string;
    duration_ms: number;
    note?: string;
  }>;
  passed: number;
  failed: number;
  total: number;
  log: string;
};

serve(
  withObservability("hackathon-grader", async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") {
      return errRes("method_not_allowed", "Use POST.", 405);
    }

    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return errRes("invalid_request", "Body must be valid JSON.", 400);
    }
    const submissionId =
      typeof body.submission_id === "string" ? body.submission_id : undefined;
    if (!submissionId || !UUID_RE.test(submissionId)) {
      return errRes("invalid_request", "submission_id must be a UUID.", 400);
    }
    ctx.span.setAttribute("submission_id", submissionId);

    const mode = (Deno.env.get("EVALUATION_MODE") ?? "stub").toLowerCase();
    const cpuSeconds = Number(Deno.env.get("HACKATHON_CPU_SECONDS") ?? "30");
    const memoryMb = Number(Deno.env.get("HACKATHON_MEMORY_MB") ?? "256");
    const disallowNetwork =
      (Deno.env.get("HACKATHON_DISALLOW_NETWORK") ?? "true").toLowerCase() !==
      "false";
    ctx.span.setAttribute("evaluation_mode", mode);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1. Load submission + parent hackathon. The submission row holds
    //    the language + signed code URL; the hackathon row holds the
    //    signed test-cases URL + status + window.
    const fetchSpan = ctx.span.startChild("db.select.submission");
    const { data: submission, error: subErr } = await supabase
      .from("hackathon_submissions")
      .select("id,hackathon_id,student_id,code_url,language,score,test_results")
      .eq("id", submissionId)
      .maybeSingle();
    fetchSpan.end();
    if (subErr) {
      ctx.log.error("select hackathon_submissions failed", { error: subErr.message });
      return errRes("db_error", subErr.message, 500);
    }
    if (!submission) {
      return errRes("not_found", "Submission not found.", 404);
    }
    if (submission.score !== null) {
      ctx.log.info("submission already graded, returning cached result");
      return jsonRes({ ok: true, already_graded: true, score: submission.score });
    }

    const hackSpan = ctx.span.startChild("db.select.hackathon");
    const { data: hackathon, error: hErr } = await supabase
      .from("hackathons")
      .select("id,recruiter_id,test_cases_url,status,starts_at,ends_at,title")
      .eq("id", submission.hackathon_id)
      .maybeSingle();
    hackSpan.end();
    if (hErr) {
      ctx.log.error("select hackathons failed", { error: hErr.message });
      return errRes("db_error", hErr.message, 500);
    }
    if (!hackathon) {
      return errRes("not_found", "Parent hackathon not found.", 404);
    }
    if (hackathon.status !== "live") {
      return errRes(
        "hackathon_not_live",
        `Hackathon status is '${hackathon.status}', cannot grade.`,
        409,
      );
    }

    // 2. Fetch test cases + student code (both signed Supabase storage
    //    URLs, valid for ~1h). The Deno fetch sandbox has no FS access
    //    in the Edge runtime, so the runner pulls bytes over HTTP.
    let testCases: TestCase[] = [];
    let code = "";
    try {
      const [tcRaw, codeRaw] = await Promise.all([
        fetch(hackathon.test_cases_url),
        fetch(submission.code_url),
      ]);
      if (!tcRaw.ok) throw new Error(`test cases fetch ${tcRaw.status}`);
      if (!codeRaw.ok) throw new Error(`code fetch ${codeRaw.status}`);
      const tcBody = await tcRaw.json();
      code = await codeRaw.text();
      testCases = Array.isArray(tcBody)
        ? (tcBody as TestCase[])
        : Array.isArray((tcBody as { cases?: TestCase[] }).cases)
          ? ((tcBody as { cases: TestCase[] }).cases)
          : [];
      if (testCases.length === 0) {
        throw new Error("test_cases file is empty or not an array");
      }
    } catch (e) {
      const msg = (e as Error).message;
      ctx.log.error("storage fetch failed", { error: msg });
      return errRes("storage_error", msg, 502);
    }

    // 3. Run the grader. Stub mode never actually executes student
    //    code (Deno Edge runtime has no safe subprocess API). External
    //    mode POSTs to a dedicated runner and normalises the response.
    let outcome: GraderOutcome;
    if (mode === "external") {
      const runnerUrl = Deno.env.get("EVALUATION_RUNNER_URL");
      if (!runnerUrl) {
        return errRes(
          "config_error",
          "EVALUATION_MODE=external but EVALUATION_RUNNER_URL is unset.",
          500,
        );
      }
      outcome = await runExternal({
        url: runnerUrl,
        token: Deno.env.get("EVALUATION_RUNNER_TOKEN"),
        language: submission.language as string,
        code,
        testCases,
        cpuSeconds,
        memoryMb,
        disallowNetwork,
        log: ctx.log,
      });
    } else {
      outcome = runStub({
        language: submission.language as string,
        code,
        testCases,
        cpuSeconds,
        memoryMb,
        disallowNetwork,
      });
    }
    ctx.span.setAttribute("cases.total", outcome.total);
    ctx.span.setAttribute("cases.passed", outcome.passed);

    // 4. Persist test_results + score on the submission row. Score is
    //    forced to 0 in stub mode (no execution → no fair grading).
    const score = mode === "stub"
      ? 0
      : outcome.total === 0
        ? 0
        : Math.round((outcome.passed / outcome.total) * 100);

    const updSpan = ctx.span.startChild("db.update.submission");
    const { error: updErr } = await supabase
      .from("hackathon_submissions")
      .update({
        test_results: { ...outcome, mode, note: mode === "stub"
          ? "stub mode — replace with real runner"
          : undefined },
        score,
        graded_at: new Date().toISOString(),
      })
      .eq("id", submissionId);
    updSpan.end();
    if (updErr) {
      ctx.log.error("update submission failed", { error: updErr.message });
      return errRes("db_error", updErr.message, 500);
    }

    // 5. Award credentials. Skip the leaderboard-based tiering when
    //    we're in stub mode (no real winners), but always issue a
    //    `participation` row so the verification path is exercised.
    const credsSpan = ctx.span.startChild("db.insert.credentials");
    const credentialKind = await awardCredentials({
      supabase,
      hackathonId: submission.hackathon_id,
      studentId: submission.student_id,
      submissionId: submission.id,
      score,
      mode,
      log: ctx.log,
    });
    credsSpan.end();

    return jsonRes({
      ok: true,
      score,
      mode,
      credential_kind: credentialKind,
    });
  }),
);

// ---------------------------------------------------------------------------
// Stub grader — placeholder. Reads test cases + code, validates the
// shape, and returns a deterministic "all-failed" outcome with score=0
// recorded by the caller. This is the v1 path; the external mode below
// is what production judges should use once a runner is configured.
// ---------------------------------------------------------------------------
function runStub(args: {
  language: string;
  code: string;
  testCases: TestCase[];
  cpuSeconds: number;
  memoryMb: number;
  disallowNetwork: boolean;
}): GraderOutcome {
  const perCase = args.testCases.map((tc, i) => {
    const name = tc.name ?? `case_${i + 1}`;
    const expected = stringify(tc.expected_output ?? tc.stdout ?? "");
    return {
      name,
      passed: false,
      actual: "",
      expected,
      duration_ms: 0,
      note:
        "stub mode: code not executed. Set EVALUATION_MODE=external to grade.",
    };
  });
  return {
    per_case: perCase,
    passed: 0,
    failed: perCase.length,
    total: perCase.length,
    log: `stub: language=${args.language} bytes=${args.code.length} ` +
      `cpu_cap=${args.cpuSeconds}s mem_cap=${args.memoryMb}MB ` +
      `network=${args.disallowNetwork ? "blocked" : "allowed"}`,
  };
}

// ---------------------------------------------------------------------------
// External grader — POST code + cases to a configured runner. The
// runner contract is intentionally simple (we translate the
// runner-specific shape into our own on the way out).
// ---------------------------------------------------------------------------
async function runExternal(args: {
  url: string;
  token: string | undefined;
  language: string;
  code: string;
  testCases: TestCase[];
  cpuSeconds: number;
  memoryMb: number;
  disallowNetwork: boolean;
  log: { info: (m: string, f?: Record<string, unknown>) => void; error: (m: string, f?: Record<string, unknown>) => void };
}): Promise<GraderOutcome> {
  const startedAt = Date.now();
  const ctl = new AbortController();
  const timeout = setTimeout(
    () => ctl.abort(),
    Math.max(1, args.cpuSeconds) * 1000 + 5_000,
  );
  try {
    const res = await fetch(args.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
      },
      body: JSON.stringify({
        language: args.language,
        source: args.code,
        cpu_time_limit: args.cpuSeconds,
        memory_limit: args.memoryMb * 1024 * 1024,
        network: args.disallowNetwork ? "blocked" : "allowed",
        cases: args.testCases.map((tc, i) => ({
          name: tc.name ?? `case_${i + 1}`,
          stdin: tc.stdin ?? "",
          expected_stdout: tc.expected_output ?? tc.stdout ?? "",
          weight: tc.weight ?? 1,
        })),
      }),
      signal: ctl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      args.log.error("external runner non-2xx", { status: res.status, text });
      throw new Error(`runner ${res.status}`);
    }
    const body = (await res.json()) as {
      results?: Array<{
        name?: string;
        passed?: boolean;
        stdout?: string;
        expected_stdout?: string;
        time_ms?: number;
        stderr?: string;
      }>;
    };
    const perCase = (body.results ?? []).map((r, i) => ({
      name: r.name ?? `case_${i + 1}`,
      passed: !!r.passed,
      actual: r.stdout ?? "",
      expected: r.expected_stdout ?? "",
      duration_ms: r.time_ms ?? 0,
      note: r.stderr,
    }));
    return {
      per_case: perCase,
      passed: perCase.filter((c) => c.passed).length,
      failed: perCase.filter((c) => !c.passed).length,
      total: perCase.length,
      log: `external: ${args.url} in ${Date.now() - startedAt}ms`,
    };
  } catch (e) {
    args.log.error("external runner error", { error: (e as Error).message });
    return {
      per_case: args.testCases.map((tc, i) => ({
        name: tc.name ?? `case_${i + 1}`,
        passed: false,
        actual: "",
        expected: stringify(tc.expected_output ?? tc.stdout ?? ""),
        duration_ms: 0,
        note: `runner error: ${(e as Error).message}`,
      })),
      passed: 0,
      failed: args.testCases.length,
      total: args.testCases.length,
      log: `external runner failed: ${(e as Error).message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Award hackathon credentials. Every graded submission earns at least
// a `participation` row. Top-N% badges are derived from the live
// leaderboard (best score per student). We do this here rather than in
// a separate cron because the read-after-write consistency window on a
// single Edge Function invocation is acceptable for the badge audit
// trail, and recruiters want the badge to show up as soon as the
// leaderboard updates.
// ---------------------------------------------------------------------------
async function awardCredentials(args: {
  supabase: ReturnType<typeof createClient>;
  hackathonId: string;
  studentId: string;
  submissionId: string;
  score: number;
  mode: string;
  log: { info: (m: string, f?: Record<string, unknown>) => void; error: (m: string, f?: Record<string, unknown>) => void };
}): Promise<string> {
  const sb = args.supabase as any;

  // Rank this student vs the field. `best_score_per_student` is a
  // cheap window aggregate over the indexed (hackathon_id, score).
  const rankSpan = (args.supabase as any);
  const { data: ranked, error: rankErr } = await sb
    .from("hackathon_submissions")
    .select("student_id,score")
    .eq("hackathon_id", args.hackathonId)
    .not("score", "is", null)
    .order("score", { ascending: false });
  if (rankErr) {
    args.log.error("rank query failed", { error: rankErr.message });
  }
  const bestByStudent = new Map<string, number>();
  for (const r of (ranked ?? []) as Array<{ student_id: string; score: number | null }>) {
    if (r.score == null) continue;
    const prev = bestByStudent.get(r.student_id) ?? -1;
    if (r.score > prev) bestByStudent.set(r.student_id, r.score);
  }
  const sorted = Array.from(bestByStudent.entries()).sort((a, b) => b[1] - a[1]);
  const myBest = bestByStudent.get(args.studentId);
  const myRank = myBest == null
    ? null
    : sorted.findIndex(([uid]) => uid === args.studentId) + 1;
  const totalParticipants = sorted.length;

  // Decide the badge. Stub mode never promotes.
  const kinds: string[] = ["participation"];
  if (args.mode !== "stub" && myBest != null && myRank != null) {
    const top10Threshold = Math.max(1, Math.floor(totalParticipants * 0.1));
    const top1Threshold = Math.max(1, Math.floor(totalParticipants * 0.01));
    if (myRank === 1) kinds.push("winner");
    if (myRank <= top1Threshold) kinds.push("top_1_pct");
    if (myRank <= top10Threshold) kinds.push("top_10_pct");
  }
  const credentialKind = myRank === 1
    ? "winner"
    : kinds[kinds.length - 1] ?? "participation";

  // Idempotent insert: rely on the lack of an ON CONFLICT clause by
  // first checking whether a participation row already exists for
  // (hackathon_id, student_id, kind). Postgres `INSERT … RETURNING`
  // is the simplest way to get the row back.
  for (const kind of kinds) {
    const { data: existing } = await sb
      .from("hackathon_credentials")
      .select("id,vc_id")
      .eq("hackathon_id", args.hackathonId)
      .eq("student_id", args.studentId)
      .eq("kind", kind)
      .maybeSingle();
    if (existing) continue;

    // Mirror the W3C VC flow: every credential also gets a row in
    // `verifiable_credentials` so the existing vc-issue pipeline can
    // anchor it. The credential row's `vc_id` is filled in by either
    // the inline issue attempt below or by a follow-up admin action.
    const publicSlug = `hackathon-${args.hackathonId.slice(0, 8)}-${args.studentId.slice(0, 8)}-${kind}`;
    const { data: vcRow, error: vcErr } = await sb
      .from("verifiable_credentials")
      .insert({
        user_id: args.studentId,
        public_slug: publicSlug,
        snapshot_overall_score: args.score,
        snapshot_per_skill: { kind, rank: myRank, score: args.score },
        snapshot_cohort_percentile: totalParticipants === 0
          ? null
          : Math.round((1 - (myRank ?? totalParticipants) / totalParticipants) * 100),
        snapshot_taken_at: new Date().toISOString(),
        revocation_status: "active",
      })
      .select("id")
      .single();
    if (vcErr) {
      args.log.warn("verifiable_credentials insert failed", { error: vcErr.message });
    }

    const { data: cred, error: credErr } = await sb
      .from("hackathon_credentials")
      .insert({
        hackathon_id: args.hackathonId,
        student_id: args.studentId,
        rank: myRank,
        kind,
        vc_id: vcRow?.id ?? null,
      })
      .select("id")
      .single();
    if (credErr) {
      args.log.error("hackathon_credentials insert failed", {
        error: credErr.message,
        kind,
      });
      continue;
    }

    // Best-effort: ask the existing vc-issue edge function to anchor
    // the W3C envelope. Failures are logged and ignored — the row
    // stays usable even without a signed proof.
    if (vcRow?.id) {
      try {
        await tryIssueVc(vcRow.id as string);
      } catch (e) {
        args.log.warn("vc-issue call failed", { error: (e as Error).message });
      }
    }
  }

  return credentialKind;
}

async function tryIssueVc(credentialId: string): Promise<void> {
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) return;
  await fetch(`${base}${VC_ISSUE_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ credential_id: credentialId }),
  });
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
