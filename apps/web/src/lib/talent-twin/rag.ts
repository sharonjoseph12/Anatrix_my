import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TalentTwinChunk } from "@antarix/types/talent-twin";

export interface RAGResult {
  answer: string;
  citations: Array<{ number: number; source_url: string; title: string; chunk_type: string }>;
  candidateCount: number;
  chunksRetrieved: number;
  latencyMs: number;
}

export async function askTalentTwin(
  userIds: string[],
  question: string,
  maxCandidates = 10,
): Promise<RAGResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.functions.invoke("talent-twin-ask", {
    body: { user_ids: userIds, question, max_candidates: maxCandidates },
  });

  if (error) throw new Error(error.message);

  return {
    answer: data.answer,
    citations: data.citations,
    candidateCount: data.candidate_count,
    chunksRetrieved: data.chunks_retrieved,
    latencyMs: data.latency_ms,
  };
}

export async function buildChunksOverview(userId: string): Promise<{
  totalChunks: number;
  byType: Record<string, number>;
  topRepos: Array<{ repo: string; chunks: number; commits: number; linesAdded: number }>;
  status: "ready" | "rebuilding" | "disabled";
}> {
  const supabase = await createSupabaseServerClient();
  const [{ data: chunks }, { data: user }] = await Promise.all([
    supabase
      .from("talent_twin_chunks")
      .select("chunk_type, metadata")
      .eq("user_id", userId),
    supabase.from("users").select("talent_twin_opt_in").eq("id", userId).single(),
  ]);

  if (!user?.talent_twin_opt_in) {
    return { totalChunks: 0, byType: {}, topRepos: [], status: "disabled" };
  }

  const byType: Record<string, number> = {};
  const repoMap: Record<string, { chunks: number; commits: number; linesAdded: number }> = {};

  for (const c of (chunks ?? []) as TalentTwinChunk[]) {
    byType[c.chunkType] = (byType[c.chunkType] ?? 0) + 1;
    const meta = c.metadata as Record<string, unknown>;
    const repo = meta?.repo as string | undefined;
    if (repo) {
      if (!repoMap[repo]) repoMap[repo] = { chunks: 0, commits: 0, linesAdded: 0 };
      repoMap[repo].chunks++;
      if (c.chunkType === "commit") repoMap[repo].commits++;
      repoMap[repo].linesAdded += (meta?.linesAdded as number) ?? 0;
    }
  }

  const topRepos = Object.entries(repoMap)
    .sort(([, a], [, b]) => b.chunks - a.chunks)
    .slice(0, 3)
    .map(([repo, stats]) => ({ repo, ...stats }));

  return {
    totalChunks: chunks?.length ?? 0,
    byType,
    topRepos,
    status: (chunks?.length ?? 0) > 0 ? "ready" : "rebuilding",
  };
}
