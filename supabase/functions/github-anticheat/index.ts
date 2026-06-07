// supabase/functions/github-anticheat/index.ts
// MIRRORS apps/web/src/lib/anticheat/github-signals.ts — keep in sync.
//
// Feature 004 — Anti-cheat edge function for GitHub-sourced entities.
// Runs the 4 detectors (fork_no_commits, commit_cluster_time,
// ai_generated_suspect, copied_content_overlap) per student, per repo,
// aggregates via the same max-confidence rule, persists signals + audit
// rows, and (best-effort) updates github_repos.{anticheat_score,quarantined_at}.
//
// Two modes:
//   - Single:  POST { user_id: "<uuid>" }
//   - Sweep:   POST { sweep: true }    (or {} from the cron — see 038_cron_004.sql)
//
// Source data: public.github_activity (the only per-user per-commit table
// that exists in 001-033). We aggregate commits into per-repo buckets
// and run the detectors against each bucket. NOTE: the spec/data-model
// references a `github_repos` table; migration 034 alters it but it does
// not currently exist in any 001-033 migration. The github_repos
// UPDATE in this function is therefore best-effort and wrapped in a
// try/catch so the signal + audit writes still succeed when the table
// is missing.

import { createClient } from "jsr:@supabase/supabase-js@2.45.0";
import { withObservability } from "../_shared/observability.ts";

// ----- env -------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const QUARANTINE_THRESHOLD = Number(
  Deno.env.get("ANTICHEAT_QUARANTINE_THRESHOLD") ?? "0.6",
);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ----- types (mirror apps/web types) ----------------------------------------

type SignalKind =
  | "fork_no_commits"
  | "commit_cluster_time"
  | "ai_generated_suspect"
  | "copied_content_overlap";

interface SignalDetectionResult {
  signal: SignalKind;
  confidence: number;
  evidence: Record<string, unknown>;
}

interface GitHubRepoInput {
  id: string;
  full_name: string;
  is_fork: boolean;
  parent_full_name?: string;
  student_commit_count: number;
  total_commit_count: number;
}

interface GitHubCommitInput {
  sha: string;
  committed_at: string;
  author_email: string;
  message: string;
  additions: number;
  deletions: number;
}

interface GitHubFileInput {
  path: string;
  content: string;
  loc: number;
}

interface AggregateResult {
  score: number;
  primary_signal: SignalDetectionResult | null;
  all_signals: SignalDetectionResult[];
  is_quarantined: boolean;
}

// ----- mirrored detectors (keep in sync) -----------------------------------

const CLUSTER_WINDOW_MS = 30 * 60 * 1000;
const CLUSTER_RATIO_THRESHOLD = 0.8;
const CLUSTER_MIN_COMMITS = 3;

function detectForkNoCommits(repo: GitHubRepoInput): SignalDetectionResult | null {
  if (!repo.is_fork) return null;
  if (repo.student_commit_count !== 0) return null;
  return {
    signal: "fork_no_commits",
    confidence: 0.95,
    evidence: {
      repo_id: repo.id,
      repo_full_name: repo.full_name,
      is_fork: true,
      student_commit_count: 0,
      total_commit_count: repo.total_commit_count,
      parent_full_name: repo.parent_full_name ?? null,
    },
  };
}

function detectCommitClusterTime(commits: GitHubCommitInput[]): SignalDetectionResult | null {
  if (commits.length < CLUSTER_MIN_COMMITS) return null;
  const sortedTimestamps = commits
    .map((c) => new Date(c.committed_at).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (sortedTimestamps.length < CLUSTER_MIN_COMMITS) return null;

  let bestStart = sortedTimestamps[0]!;
  let bestEnd = bestStart + CLUSTER_WINDOW_MS;
  let bestCount = 0;
  let left = 0;
  for (let right = 0; right < sortedTimestamps.length; right++) {
    const r = sortedTimestamps[right]!;
    while (sortedTimestamps[left]! < r - CLUSTER_WINDOW_MS) left++;
    const inWindow = right - left + 1;
    if (inWindow > bestCount) {
      bestCount = inWindow;
      bestStart = sortedTimestamps[left]!;
      bestEnd = r;
    }
  }
  const total = sortedTimestamps.length;
  const ratio = bestCount / total;
  if (ratio <= CLUSTER_RATIO_THRESHOLD) return null;
  const confidence = roundTo(Math.min(0.95, 0.6 + ratio * 0.35), 3);
  return {
    signal: "commit_cluster_time",
    confidence,
    evidence: {
      window_start: new Date(bestStart).toISOString(),
      window_end: new Date(bestEnd).toISOString(),
      in_window_count: bestCount,
      total_count: total,
      ratio: roundTo(ratio, 3),
    },
  };
}

const AI_COMMIT_PATTERNS: ReadonlyArray<RegExp> = [
  /^initial commit$/i,
  /^feat:\s*add\b/i,
  /^feat:\s*implement\b/i,
  /^feat:\s*create\b/i,
  /^add\s+(new\s+)?(feature|file|module|component|class|functionality)\b/i,
  /^implement\s+[a-z0-9_-]+\s*(class|function|module|api)\b/i,
  /^create\s+(initial|new)\s+(structure|scaffold|setup)\b/i,
];
const AI_CODE_PATTERNS: ReadonlyArray<RegExp> = [
  /\/\/\s*this function\s+(does|returns|handles|calculates|checks)/i,
  /\/\/\s*this method\s+(does|returns|handles|calculates|checks)/i,
  /\/\/\s*helper function (to|that)/i,
  /\/\/\s*(initialize|setup|configure|prepare)\s+[a-z]/i,
  /^#\s*this function\s+(does|returns|handles|calculates|checks)/i,
  /^#\s*this method\s+(does|returns|handles|calculates|checks)/i,
  /^#\s*helper function (to|that)/i,
  /TODO:\s*implement\s+(this|the|a)\b/i,
  /\/\/\s*returns the\s+[a-z]/i,
  /^#\s*returns the\s+[a-z]/i,
];

function detectAiGeneratedSuspect(
  commits: GitHubCommitInput[],
  files: GitHubFileInput[],
): SignalDetectionResult | null {
  const commitHits: string[] = [];
  for (const c of commits) {
    for (const re of AI_COMMIT_PATTERNS) {
      if (re.test(c.message.trim())) {
        commitHits.push(re.source);
        break;
      }
    }
  }
  const codeHits: Array<{ path: string; pattern: string }> = [];
  for (const f of files) {
    if (!f.content) continue;
    const lines = f.content.split(/\r?\n/);
    for (const line of lines) {
      for (const re of AI_CODE_PATTERNS) {
        if (re.test(line)) {
          codeHits.push({ path: f.path, pattern: re.source });
          break;
        }
      }
    }
  }
  const totalHits = commitHits.length + codeHits.length;
  if (totalHits < 1) return null;
  const confidence = roundTo(Math.min(0.9, 0.3 + 0.1 * totalHits), 3);
  return {
    signal: "ai_generated_suspect",
    confidence,
    evidence: {
      commit_hits: commitHits.length,
      code_hits: codeHits.length,
      total_hits: totalHits,
      commit_patterns: commitHits.slice(0, 5),
      code_hits_sample: codeHits.slice(0, 5),
    },
  };
}

function detectCopiedContentOverlap(
  files: GitHubFileInput[],
  publicCorpus: ReadonlyArray<{ repo_url: string; lines: ReadonlyArray<string> }>,
): SignalDetectionResult | null {
  if (files.length === 0 || publicCorpus.length === 0) return null;
  const OVERLAP_THRESHOLD = 0.7;
  let bestMatch: {
    repo_url: string;
    overlap: number;
    matched: number;
    total: number;
    file_path: string;
  } | null = null;
  for (const file of files) {
    const fileLines = new Set(
      file.content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    );
    if (fileLines.size === 0) continue;
    for (const corpus of publicCorpus) {
      if (corpus.lines.length === 0) continue;
      const corpusLines = new Set(
        corpus.lines.map((l) => l.trim()).filter((l) => l.length > 0),
      );
      if (corpusLines.size === 0) continue;
      let matched = 0;
      for (const line of fileLines) if (corpusLines.has(line)) matched++;
      const overlap = matched / fileLines.size;
      if (overlap >= OVERLAP_THRESHOLD) {
        if (!bestMatch || overlap > bestMatch.overlap) {
          bestMatch = {
            repo_url: corpus.repo_url,
            overlap,
            matched,
            total: fileLines.size,
            file_path: file.path,
          };
        }
      }
    }
  }
  if (!bestMatch) return null;
  const confidence = roundTo(Math.min(0.95, 0.4 + 0.5 * bestMatch.overlap), 3);
  return {
    signal: "copied_content_overlap",
    confidence,
    evidence: {
      matched_repo_url: bestMatch.repo_url,
      file_path: bestMatch.file_path,
      matched_lines: bestMatch.matched,
      total_lines: bestMatch.total,
      overlap_ratio: roundTo(bestMatch.overlap, 3),
    },
  };
}

function aggregateSignals(
  signals: ReadonlyArray<SignalDetectionResult | null>,
  threshold: number,
): AggregateResult {
  const allSignals: SignalDetectionResult[] = [];
  for (const s of signals) if (s !== null) allSignals.push(s);
  if (allSignals.length === 0) {
    return { score: 0, primary_signal: null, all_signals: [], is_quarantined: false };
  }
  let primary: SignalDetectionResult = allSignals[0]!;
  let maxConfidence = primary.confidence;
  for (let i = 1; i < allSignals.length; i++) {
    const s = allSignals[i]!;
    if (s.confidence > maxConfidence) {
      maxConfidence = s.confidence;
      primary = s;
    }
  }
  const score = clamp01(maxConfidence);
  return { score, primary_signal: primary, all_signals: allSignals, is_quarantined: score >= threshold };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
function roundTo(n: number, decimals: number): number {
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

// ----- deterministic entity id (UUID v5-shape from a string seed) -----------

async function entityIdFor(userId: string, repoFullName: string): Promise<string> {
  const seed = `github_repo:${userId}:${repoFullName}`;
  const bytes = new TextEncoder().encode(seed);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes));
  // RFC 4122 v5-ish: set version (0101) and variant (10xx) bits.
  hash[6] = ((hash[6]! & 0x0f) | 0x50);
  hash[8] = ((hash[8]! & 0x3f) | 0x80);
  const hex = Array.from(hash.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ----- per-student scan -----------------------------------------------------

interface ScanResult {
  user_id: string;
  scanned: number;
  quarantined: number;
  errors: number;
}

async function scanStudent(userId: string, ctx: { log: { info: (m: string, f?: Record<string, unknown>) => void; warn: (m: string, f?: Record<string, unknown>) => void; error: (m: string, f?: Record<string, unknown>) => void } }): Promise<ScanResult> {
  // Pull all activity for the user in the last 90 days. Older commits
  // are still relevant for fork_no_commits (a fork with no commits
  // stays a fork with no commits forever), so we don't bound by date
  // for that detector; for cluster / AI detectors we filter to 90d.
  const cutoffIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: activity, error: actErr } = await supabase
    .from("github_activity")
    .select("commit_hash, repo_full_name, repo_name, message, committed_at, additions, deletions, files_changed, primary_language")
    .eq("user_id", userId)
    .order("committed_at", { ascending: false })
    .limit(2000);
  if (actErr) {
    ctx.log.error("github_activity read failed", { user_id: userId, error: actErr.message });
    return { user_id: userId, scanned: 0, quarantined: 0, errors: 1 };
  }

  // Bucket by repo_full_name.
  const buckets = new Map<
    string,
    { full_name: string; commits: GitHubCommitInput[]; student_commits: number; is_fork_hint: boolean }
  >();
  for (const row of activity ?? []) {
    const fullName = (row as { repo_full_name: string }).repo_full_name;
    if (!fullName) continue;
    const bucket = buckets.get(fullName) ?? {
      full_name: fullName,
      commits: [],
      student_commits: 0,
      // is_fork cannot be determined from github_activity alone; the
      // detector treats the absence of a fork flag as a non-fork. The
      // GitHub events API does not surface the parent in this view.
      is_fork_hint: false,
    };
    bucket.commits.push({
      sha: (row as { commit_hash: string }).commit_hash,
      committed_at: (row as { committed_at: string }).committed_at,
      author_email: "",
      message: (row as { message: string | null }).message ?? "",
      additions: (row as { additions: number | null }).additions ?? 0,
      deletions: (row as { deletions: number | null }).deletions ?? 0,
    });
    bucket.student_commits += 1;
    buckets.set(fullName, bucket);
  }

  // No corpus for copied_content_overlap in v1 (would need a stored
  // public-corpus table we don't have). The detector therefore never
  // fires from this entry point; it remains available in the lib mirror
  // for callers that DO have a corpus.
  const publicCorpus: ReadonlyArray<{ repo_url: string; lines: ReadonlyArray<string> }> = [];

  let scanned = 0;
  let quarantined = 0;
  let errors = 0;

  for (const [fullName, bucket] of buckets) {
    scanned += 1;
    const entityId = await entityIdFor(userId, fullName);

    // Filter to recent for the cluster + AI detectors.
    const recentCommits = bucket.commits.filter(
      (c) => new Date(c.committed_at).getTime() >= new Date(cutoffIso).getTime(),
    );

    const repo: GitHubRepoInput = {
      id: entityId,
      full_name: fullName,
      is_fork: bucket.is_fork_hint,
      student_commit_count: bucket.student_commits,
      total_commit_count: bucket.commits.length,
    };

    const aggregate = aggregateSignals(
      [
        detectForkNoCommits(repo),
        detectCommitClusterTime(recentCommits),
        // detectAiGeneratedSuspect needs file content; we don't store
        // file blobs in github_activity. We pass empty file list, so
        // only commit-message fingerprints can fire here.
        detectAiGeneratedSuspect(bucket.commits, []),
        detectCopiedContentOverlap([], publicCorpus),
      ],
      QUARANTINE_THRESHOLD,
    );

    if (aggregate.all_signals.length === 0) continue;

    try {
      // Supersede any prior active signal for the same (entity_type,
      // entity_id, signal). One UPSERT pattern via select+update: query
      // for the most recent active row per signal kind, then link to
      // the new one we are about to insert.
      const { data: priorSignals, error: priorErr } = await supabase
        .from("anticheat_signals")
        .select("id,signal")
        .eq("entity_type", "github_repo")
        .eq("entity_id", entityId)
        .is("superseded_by", null);
      if (priorErr) {
        ctx.log.warn("prior signals read failed", { entity_id: entityId, error: priorErr.message });
      }

      // Insert a new signal for the primary signal kind (the max-confidence
      // one). We persist one row per non-null detection result so the
      // history is faithful to the detectors.
      const insertedIds: string[] = [];
      for (const sig of aggregate.all_signals) {
        const { data: ins, error: insErr } = await supabase
          .from("anticheat_signals")
          .insert({
            entity_type: "github_repo",
            entity_id: entityId,
            student_id: userId,
            signal: sig.signal,
            confidence: sig.confidence,
            evidence_payload: {
              ...sig.evidence,
              repo_full_name: fullName,
              aggregate_score: aggregate.score,
              quarantined: aggregate.is_quarantined,
            },
          })
          .select("id")
          .single();
        if (insErr) {
          ctx.log.error("signal insert failed", { signal: sig.signal, error: insErr.message });
          errors += 1;
          continue;
        }
        if (ins) insertedIds.push((ins as { id: string }).id);
      }

      // Supersede the prior active rows of the same kinds.
      if (priorSignals && priorSignals.length > 0) {
        const priorByKind = new Map(
          (priorSignals as Array<{ id: string; signal: string }>).map((p) => [p.signal, p.id]),
        );
        for (let i = 0; i < aggregate.all_signals.length; i++) {
          const kind = aggregate.all_signals[i]!.signal;
          const priorId = priorByKind.get(kind);
          const newId = insertedIds[i];
          if (priorId && newId && priorId !== newId) {
            await supabase
              .from("anticheat_signals")
              .update({ superseded_by: newId })
              .eq("id", priorId);
          }
        }
      }

      // If quarantined, attempt the github_repos UPDATE (best effort).
      if (aggregate.is_quarantined) {
        quarantined += 1;
        const { error: grErr } = await supabase
          .from("github_repos")
          .update({
            anticheat_score: aggregate.score,
            quarantined_at: new Date().toISOString(),
          })
          .eq("id", entityId);
        if (grErr) {
          // github_repos is referenced by migration 034 but does not
          // exist as a table in 001-033. Swallow the error and continue —
          // anticheat_signals + anticheat_audit are the source of truth
          // for the student-facing appeal flow.
          ctx.log.warn("github_repos quarantine update skipped", {
            entity_id: entityId,
            error: grErr.message,
          });
        }

        // Audit row for the primary signal.
        if (aggregate.primary_signal && insertedIds.length > 0) {
          const primaryIndex = aggregate.all_signals.findIndex(
            (s) => s.signal === aggregate.primary_signal!.signal,
          );
          const primaryId = insertedIds[primaryIndex] ?? insertedIds[0]!;
          const { error: audErr } = await supabase.from("anticheat_audit").insert({
            actor_id: null,
            actor_type: "system",
            action: "quarantine",
            subject_signal_id: primaryId,
            payload: {
              entity_type: "github_repo",
              entity_id: entityId,
              repo_full_name: fullName,
              student_id: userId,
              score: aggregate.score,
              primary_signal: aggregate.primary_signal.signal,
              confidence: aggregate.primary_signal.confidence,
            },
          });
          if (audErr) {
            ctx.log.error("audit insert failed", { error: audErr.message });
            errors += 1;
          }
        }
      }
    } catch (e) {
      ctx.log.error("repo scan failed", { full_name: fullName, error: (e as Error).message });
      errors += 1;
    }
  }

  return { user_id: userId, scanned, quarantined, errors };
}

// ----- sweep ----------------------------------------------------------------

async function sweep(ctx: { log: { info: (m: string, f?: Record<string, unknown>) => void; warn: (m: string, f?: Record<string, unknown>) => void; error: (m: string, f?: Record<string, unknown>) => void } }): Promise<{ ok: true; scanned: number; quarantined: number; errors: number; students: number }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("github_activity")
    .select("user_id")
    .gte("committed_at", cutoff)
    .order("committed_at", { ascending: false })
    .limit(2000);
  if (error) {
    ctx.log.error("sweep read failed", { error: error.message });
    return { ok: true, scanned: 0, quarantined: 0, errors: 1, students: 0 };
  }
  const uniqueUserIds = Array.from(
    new Set(((rows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
  );

  let scanned = 0;
  let quarantined = 0;
  let errors = 0;
  for (const userId of uniqueUserIds) {
    try {
      const r = await scanStudent(userId, ctx);
      scanned += r.scanned;
      quarantined += r.quarantined;
      errors += r.errors;
    } catch (e) {
      ctx.log.error("sweep student failed", { user_id: userId, error: (e as Error).message });
      errors += 1;
    }
  }
  return { ok: true, scanned, quarantined, errors, students: uniqueUserIds.length };
}

// ----- handler --------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const handler = async (
  req: Request,
  ctx: { log: { info: (m: string, f?: Record<string, unknown>) => void; warn: (m: string, f?: Record<string, unknown>) => void; error: (m: string, f?: Record<string, unknown>) => void } },
): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  const body = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    sweep?: boolean;
  };

  if (body.sweep || (!body.user_id && !body.sweep)) {
    // Empty body {} from the cron (see 038_cron_004.sql) and explicit
    // {sweep:true} both mean "scan everyone active in the last 7 days".
    const r = await sweep(ctx);
    return json(r);
  }
  if (!body.user_id) return json({ error: "user_id is required" }, 400);

  const r = await scanStudent(body.user_id, ctx);
  return json({ ok: true, user_id: r.user_id, scanned: r.scanned, quarantined: r.quarantined, errors: r.errors });
};

Deno.serve(withObservability("github-anticheat", handler));
