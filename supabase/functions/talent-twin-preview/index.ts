import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { withObservability } from "../_shared/observability.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "unauthorized", message: "Invalid or expired JWT" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const { data: profile } = await client.from("users").select("talent_twin_opt_in, created_at").eq("id", user.id).single();
  if (!profile) {
    return new Response(JSON.stringify({ error: "not_found", message: "User not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const { data: chunks, error: chunkError } = await client
    .from("talent_twin_chunks")
    .select("chunk_type, metadata, created_at")
    .eq("user_id", user.id);

  if (chunkError) {
    return new Response(JSON.stringify({ error: "internal_error", message: chunkError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  if (!profile.talent_twin_opt_in) {
    return new Response(JSON.stringify({ opt_in: false, total_chunks: 0, by_type: {}, top_repos: [], claimable_commits: 0, badges_issued: 0, query_count_last_30d: 0, status: "disabled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const byType: Record<string, number> = {};
  const repoCounts: Record<string, { chunks: number; commits: number; linesAdded: number }> = {};

  for (const c of chunks ?? []) {
    const t = c.chunk_type as string;
    byType[t] = (byType[t] ?? 0) + 1;

    const meta = c.metadata as Record<string, unknown> ?? {};
    const repo = meta.repo as string;
    if (repo) {
      if (!repoCounts[repo]) repoCounts[repo] = { chunks: 0, commits: 0, linesAdded: 0 };
      repoCounts[repo].chunks++;
      if (t === "commit") repoCounts[repo].commits++;
      repoCounts[repo].linesAdded += (meta.linesAdded as number) ?? 0;
    }
  }

  const topRepos = Object.entries(repoCounts)
    .sort(([, a], [, b]) => b.chunks - a.chunks)
    .slice(0, 3)
    .map(([repo, stats]) => ({ repo, ...stats }));

  const { count: badgeCount } = await client
    .from("authorship_proof")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user.id)
    .eq("status", "completed");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: queryCount } = await client
    .from("talent_twin_qa_log")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user.id)
    .gte("created_at", thirtyDaysAgo);

  const totalChunks = chunks?.length ?? 0;
  const status = totalChunks > 0 ? "ready" : "rebuilding";

  return new Response(JSON.stringify({
    opt_in: true,
    opt_in_since: profile.created_at,
    total_chunks: totalChunks,
    by_type: byType,
    top_repos: topRepos,
    claimable_commits: byType.commit ?? 0,
    badges_issued: badgeCount ?? 0,
    query_count_last_30d: queryCount ?? 0,
    status,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

export default withObservability(handler);
