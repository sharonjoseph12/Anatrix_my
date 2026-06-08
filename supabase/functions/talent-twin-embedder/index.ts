// supabase/functions/talent-twin-embedder/index.ts
// Daily cron: iterate all opted-in students, chunk + embed new artifacts.

import "https://deno.land/std@0.208.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildEmbedding } from "../_shared/twin-helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RATE_PER_MINUTE = 1000;
const MIN_DELAY_MS = 60000 / RATE_PER_MINUTE;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface ChunkInput {
  user_id: string;
  chunk_type: "code" | "commit" | "ide_session" | "collaboration";
  chunk_text: string;
  metadata: Record<string, unknown>;
}

function chunkCode(commit: {
  sha: string;
  message: string;
  repo: string;
  lines_added: number;
  files: string[];
  author_name: string;
  committed_at: string;
}): ChunkInput[] {
  const chunks: ChunkInput[] = [];
  const base = { repo: commit.repo, sha: commit.sha, date: commit.committed_at, author: commit.author_name };

  chunks.push({
    chunk_type: "commit",
    chunk_text: `${commit.message}\nFiles: ${commit.files.join(", ")}\nLines added: ${commit.lines_added}`,
    user_id: "",
    metadata: { ...base, type: "commit_message" },
  });

  return chunks;
}

function chunkIdeSession(session: {
  id: string;
  file_path: string;
  language: string;
  events: Array<{ timestamp: string; action: string; content?: string }>;
  started_at: string;
  ended_at: string;
}): ChunkInput[] {
  const chunks: ChunkInput[] = [];
  const WINDOW_MS = 30 * 60 * 1000;
  const start = new Date(session.started_at).getTime();
  const end = new Date(session.ended_at).getTime();
  let windowStart = start;

  while (windowStart < end) {
    const windowEnd = Math.min(windowStart + WINDOW_MS, end);
    const windowEvents = session.events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= windowStart && t < windowEnd;
    });

    if (windowEvents.length > 0) {
      const text = windowEvents
        .map((e) => (e.content ? `${e.action}: ${e.content}` : e.action))
        .join("\n");

      chunks.push({
        chunk_type: "ide_session",
        chunk_text: text,
        user_id: "",
        metadata: {
          session_id: session.id,
          file_path: session.file_path,
          language: session.language,
          window_start: new Date(windowStart).toISOString(),
          window_end: new Date(windowEnd).toISOString(),
        },
      });
    }
    windowStart = windowEnd;
  }

  return chunks;
}

function chunkCollab(artifact: {
  id: string;
  pr_url: string;
  repo: string;
  description: string;
  co_authors: string[];
  created_at: string;
}): ChunkInput[] {
  return [{
    chunk_type: "collaboration",
    chunk_text: artifact.description,
    user_id: "",
    metadata: {
      artifact_id: artifact.id,
      pr_url: artifact.pr_url,
      repo: artifact.repo,
      co_authors: artifact.co_authors,
      date: artifact.created_at,
    },
  }];
}

async function processStudent(
  userId: string,
  lastRun: string | null,
): Promise<{ chunks: number; errors: number }> {
  let chunks = 0;
  let errors = 0;
  const sinceParam = lastRun ?? "1970-01-01T00:00:00Z";

  try {
    const { data: commits, error: ce } = await supabase
      .from("github_commits")
      .select("sha, message, repo, lines_added, files, author_name, committed_at")
      .eq("user_id", userId)
      .gt("committed_at", sinceParam);
    if (ce) throw ce;

    for (const c of commits ?? []) {
      const inputs = chunkCode(c);
      for (const inp of inputs) {
        inp.user_id = userId;
        const emb = await buildEmbedding(inp.chunk_text);
        const { error } = await supabase.rpc("insert_twin_chunk", {
          p_user_id: userId,
          p_chunk_type: inp.chunk_type,
          p_chunk_text: inp.chunk_text,
          p_embedding: emb,
          p_metadata: inp.metadata,
        });
        if (error) errors++;
        else chunks++;
        await new Promise((r) => setTimeout(r, MIN_DELAY_MS));
      }
    }
  } catch (e) {
    console.error(`Error processing commits for ${userId}:`, e);
    errors++;
  }

  try {
    const { data: sessions, error: se } = await supabase
      .from("ide_sessions")
      .select("id, file_path, language, events, started_at, ended_at")
      .eq("user_id", userId)
      .gt("started_at", sinceParam);
    if (se) throw se;

    for (const s of sessions ?? []) {
      const inputs = chunkIdeSession(s);
      for (const inp of inputs) {
        inp.user_id = userId;
        const emb = await buildEmbedding(inp.chunk_text);
        const { error } = await supabase.rpc("insert_twin_chunk", {
          p_user_id: userId,
          p_chunk_type: inp.chunk_type,
          p_chunk_text: inp.chunk_text,
          p_embedding: emb,
          p_metadata: inp.metadata,
        });
        if (error) errors++;
        else chunks++;
        await new Promise((r) => setTimeout(r, MIN_DELAY_MS));
      }
    }
  } catch (e) {
    console.error(`Error processing IDE sessions for ${userId}:`, e);
    errors++;
  }

  try {
    const { data: artifacts, error: ae } = await supabase
      .from("collab_artifacts")
      .select("id, pr_url, repo, description, co_authors, created_at")
      .eq("user_id", userId)
      .gt("created_at", sinceParam);
    if (ae) throw ae;

    for (const a of artifacts ?? []) {
      const inputs = chunkCollab(a);
      for (const inp of inputs) {
        inp.user_id = userId;
        const emb = await buildEmbedding(inp.chunk_text);
        const { error } = await supabase.rpc("insert_twin_chunk", {
          p_user_id: userId,
          p_chunk_type: inp.chunk_type,
          p_chunk_text: inp.chunk_text,
          p_embedding: emb,
          p_metadata: inp.metadata,
        });
        if (error) errors++;
        else chunks++;
        await new Promise((r) => setTimeout(r, MIN_DELAY_MS));
      }
    }
  } catch (e) {
    console.error(`Error processing collab artifacts for ${userId}:`, e);
    errors++;
  }

  return { chunks, errors };
}

Deno.serve(async (_req: Request) => {
  const startMs = Date.now();
  let totalStudents = 0;
  let totalChunks = 0;
  let totalErrors = 0;

  const { data: lastRunRow } = await supabase
    .from("talent_twin_qa_log")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastRun = lastRunRow?.created_at ?? null;

  const { data: students, error: se } = await supabase
    .from("users")
    .select("id")
    .eq("talent_twin_opt_in", true);
  if (se) {
    return new Response(JSON.stringify({ error: se.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  for (const student of students ?? []) {
    totalStudents++;
    const { chunks, errors } = await processStudent(student.id, lastRun);
    totalChunks += chunks;
    totalErrors += errors;
  }

  const durationMs = Date.now() - startMs;
  const result = {
    students_processed: totalStudents,
    chunks_created: totalChunks,
    errors: totalErrors,
    duration_ms: durationMs,
  };

  console.log(JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
