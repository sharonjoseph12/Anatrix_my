import { buildEmbedding } from "../_shared/twin-helpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { withObservability } from "../_shared/observability.ts";

interface ChunkInput {
  userId: string;
  chunkType: string;
  sourceId: string;
  sourceUrl?: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BATCH_SIZE = 50;
const RATE_LIMIT_MS = 60; // 1000 embeddings/min = ~1 per 60ms

function createChunksForCommit(row: Record<string, unknown>): ChunkInput[] {
  return [{
    userId: row.user_id as string,
    chunkType: "commit",
    sourceId: `commit:${row.sha}`,
    sourceUrl: row.url as string,
    title: row.message as string,
    content: `${row.message}\n\nFiles changed: ${row.files_changed ?? "?"}\nLines added: ${row.lines_added ?? "?"}\nLines deleted: ${row.lines_deleted ?? "?"}`,
    metadata: {
      repo: row.repo,
      sha: row.sha,
      date: row.committed_at,
      linesAdded: row.lines_added,
      authoredByUser: row.author_id === row.user_id,
    },
  }];
}

function createChunksForIdeSession(row: Record<string, unknown>): ChunkInput[] {
  const rows: ChunkInput[] = [];
  const sessions = (row.sessions as Array<Record<string, unknown>>) ?? [];
  let index = 0;
  for (const session of sessions) {
    const windowStart = new Date(session.start_time as string);
    const windowEnd = new Date(windowStart.getTime() + 30 * 60 * 1000);
    rows.push({
      userId: row.user_id as string,
      chunkType: "ide_session",
      sourceId: `ide:${row.session_id}:${index++}`,
      sourceUrl: null,
      title: `IDE session ${windowStart.toISOString().slice(0, 16)}`,
      content: `Session at ${windowStart.toISOString()} in ${session.file_path ?? "unknown"} (${session.language ?? "unknown"}). Metrics: keystrokes=${session.keystrokes ?? "?"}, refactors=${session.refactors ?? "?"}, errors=${session.errors ?? "?"}, test_runs=${session.test_runs ?? "?"}.`,
      metadata: {
        filePath: session.file_path,
        language: session.language,
        startTime: session.start_time,
        endTime: session.end_time,
        keystrokes: session.keystrokes,
        refactors: session.refactors,
      },
    });
  }
  return rows;
}

function createChunksForCollab(row: Record<string, unknown>): ChunkInput[] {
  return [{
    userId: row.user_id as string,
    chunkType: "collab",
    sourceId: `collab:${row.artifact_id}`,
    sourceUrl: row.url as string,
    title: row.title as string ?? "Collab session",
    content: `Collaborative session: ${row.description as string ?? "No description"}\nRole: ${row.role as string}\nPR: ${row.pr_url as string}`,
    metadata: {
      artifactId: row.artifact_id,
      role: row.role,
      prUrl: row.pr_url,
      coAuthors: row.co_authors,
    },
  }];
}

async function fetchSourceData(client: ReturnType<typeof createClient>, userId: string, table: string, columns: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .eq("user_id", userId)
    .limit(500);
  if (error) {
    console.error(`fetch ${table} for ${userId}: ${error.message}`);
    return [];
  }
  return (data ?? []) as Record<string, unknown>[];
}

async function processStudent(client: ReturnType<typeof createClient>, userId: string): Promise<number> {
  const allChunks: ChunkInput[] = [];

  const commits = await fetchSourceData(client, userId, "github_commits", "sha,message,url,repo,committed_at,files_changed,lines_added,lines_deleted,author_id,user_id");
  for (const row of commits) {
    allChunks.push(...createChunksForCommit(row));
  }

  const sessions = await fetchSourceData(client, userId, "ide_sessions", "user_id,session_id,sessions");
  for (const row of sessions) {
    allChunks.push(...createChunksForIdeSession(row));
  }

  const artifacts = await fetchSourceData(client, userId, "collab_artifacts", "user_id,artifact_id,title,description,url,role,pr_url,co_authors");
  for (const row of artifacts) {
    allChunks.push(...createChunksForCollab(row));
  }

  let done = 0;
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    for (const chunk of batch) {
      try {
        const embedding = await buildEmbedding(chunk.content);
        const { error } = await client.rpc("insert_twin_chunk", {
          p_user_id: chunk.userId,
          p_chunk_type: chunk.chunkType,
          p_source_id: chunk.sourceId,
          p_source_url: chunk.sourceUrl ?? null,
          p_title: chunk.title ?? null,
          p_content: chunk.content,
          p_embedding: embedding,
          p_metadata: chunk.metadata ?? {},
        });
        if (error) {
          console.error(`insert chunk ${chunk.sourceId}: ${error.message}`);
        } else {
          done++;
        }
      } catch (err) {
        console.error(`process chunk ${chunk.sourceId}: ${err}`);
      }
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }
  }
  return done;
}

async function handler(_req: Request): Promise<Response> {
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: students, error } = await client
    .from("users")
    .select("id")
    .eq("talent_twin_opt_in", true)
    .limit(1000);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const userIds = (students ?? []).map((s: Record<string, unknown>) => s.id as string);
  let totalChunks = 0;
  for (const uid of userIds) {
    const n = await processStudent(client, uid);
    totalChunks += n;
  }

  return new Response(JSON.stringify({ studentsProcessed: userIds.length, totalChunks }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withObservability(handler);
