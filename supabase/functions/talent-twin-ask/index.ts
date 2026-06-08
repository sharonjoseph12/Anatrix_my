import { buildEmbedding, buildPrompt, parseChunks } from "../_shared/twin-helpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { withObservability } from "../_shared/observability.ts";
import { withRateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LLM_ENDPOINT = Deno.env.get("TALENT_TWIN_LLM_ENDPOINT") ?? "https://api.openai.com/v1/chat/completions";
const LLM_API_KEY = Deno.env.get("TALENT_TWIN_LLM_API_KEY") ?? "";

interface AskRequest {
  user_ids: string[];
  question: string;
}

async function getLlmAnswer(prompt: string): Promise<string> {
  const resp = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`LLM error ${resp.status}: ${body}`);
  }
  const json = await resp.json();
  return json.choices?.[0]?.message?.content ?? "No answer generated.";
}

function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest("SHA-256", encoder.encode(text)).then(
    (hash) => Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join(""),
  );
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "unauthorized", message: "Invalid or expired JWT" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const { data: profile } = await client.from("users").select("company_plan").eq("id", user.id).single();
  if (!profile || (profile.company_plan !== "pro" && profile.company_plan !== "enterprise")) {
    return new Response(JSON.stringify({ error: "forbidden", message: "AI Talent Twin requires a Pro or Enterprise plan." }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const body: AskRequest = await req.json();
  if (!body.question || body.question.length < 1 || body.question.length > 500) {
    return new Response(JSON.stringify({ error: "invalid_request", message: "question must be between 1 and 500 characters" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (!body.user_ids || body.user_ids.length === 0 || body.user_ids.length > 50) {
    return new Response(JSON.stringify({ error: "invalid_request", message: "user_ids must contain 1-50 entries" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { data: optedInUsers } = await client
    .from("users")
    .select("id")
    .in("id", body.user_ids)
    .eq("talent_twin_opt_in", true);

  const eligibleIds = (optedInUsers ?? []).map((u: Record<string, unknown>) => u.id as string);
  if (eligibleIds.length === 0) {
    return new Response(JSON.stringify({ error: "no_eligible_candidates", message: "None of the specified candidates have opted in to the AI Talent Twin." }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const startTime = Date.now();
  const embedding = await buildEmbedding(body.question);

  const { data: dbChunks, error: searchError } = await client.rpc("search_twin_chunks", {
    p_user_ids: eligibleIds,
    p_query_embedding: embedding,
    p_limit: 10,
  });

  if (searchError) {
    return new Response(JSON.stringify({ error: "internal_error", message: searchError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const chunks = parseChunks(dbChunks ?? []);
  if (chunks.length === 0) {
    return new Response(JSON.stringify({ error: "no_eligible_candidates", message: "No relevant work artifacts found for the selected candidates." }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const prompt = buildPrompt(body.question, chunks);
  const answer = await getLlmAnswer(prompt);

  const citations = chunks.map((c, i) => ({
    number: i + 1,
    source_url: c.sourceUrl ?? "",
    title: c.title ?? c.chunkType,
    chunk_type: c.chunkType,
  }));

  const latencyMs = Date.now() - startTime;

  const qHash = await sha256(body.question);
  const aHash = await sha256(answer);
  await client.from("talent_twin_qa_log").insert({
    student_id: eligibleIds[0],
    recruiter_id: user.id,
    question_hash: qHash,
    answer_hash: aHash,
    citation_links: citations,
    status: "pending",
    latency_ms: latencyMs,
  });

  return new Response(JSON.stringify({
    answer,
    citations,
    candidate_count: eligibleIds.length,
    chunks_retrieved: chunks.length,
    latency_ms: latencyMs,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

export default withObservability(withRateLimit(handler, "talent-twin-ask"));
