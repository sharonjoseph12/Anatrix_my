// apps/web/src/lib/anticheat/github-signals.ts
// Feature 004 — Anti-cheat signal detectors for GitHub-sourced entities.
//
// Pure, deterministic, framework-free detectors. Each function returns null
// when no signal of its kind is detected, or a SignalDetectionResult whose
// `confidence` lies in [0, 1] and `evidence` contains the structured detail
// used to make the call.
//
// See specs/004-eleven-of-ten/research.md (D1) for the rule-based
// anti-cheat signal architecture rationale.

import type { SignalDetectionResult } from "@antarix/types";

export interface GitHubRepoInput {
  id: string;
  full_name: string;
  is_fork: boolean;
  parent_full_name?: string;
  student_commit_count: number;
  total_commit_count: number;
}

export interface GitHubCommitInput {
  sha: string;
  committed_at: string; // ISO
  author_email: string;
  message: string;
  additions: number;
  deletions: number;
}

export interface GitHubFileInput {
  path: string;
  content: string;
  loc: number;
}

/**
 * detectForkNoCommits — flags a repository that is a fork of an upstream
 * project and contains zero student-authored commits. The student has
 * imported the project history but contributed nothing of their own; this
 * is a strong indicator the repo should not contribute to skill proof.
 *
 * Confidence is high (0.95) because the rule is unambiguous: if is_fork
 * is true and the student has not committed, the project is inherited.
 */
export function detectForkNoCommits(
  repo: GitHubRepoInput,
): SignalDetectionResult | null {
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

const CLUSTER_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const CLUSTER_RATIO_THRESHOLD = 0.8; // > 80% of commits within the window
const CLUSTER_MIN_COMMITS = 3; // need at least 3 commits to fire

/**
 * detectCommitClusterTime — flags a commit history where the bulk of
 * activity is squeezed into a single 30-minute window. Human engineering
 * work rarely concentrates so tightly unless the code was bulk-pasted or
 * generated and committed in one sitting.
 *
 * The detector finds the densest 30-minute sliding window over the commit
 * timestamps and reports it; if the in-window count exceeds 80% of the
 * total commit count (and there are at least 3 commits), the rule fires.
 * Confidence scales with the cluster ratio.
 */
export function detectCommitClusterTime(
  commits: GitHubCommitInput[],
): SignalDetectionResult | null {
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
    while (sortedTimestamps[left]! < r - CLUSTER_WINDOW_MS) {
      left++;
    }
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

  // Map ratio ∈ (0.8, 1.0] → confidence ∈ [0.7, 0.95]. A perfectly clustered
  // repo (1.0) is treated as more suspect than a marginal cluster (0.8).
  const confidence = Math.min(0.95, 0.6 + ratio * 0.35);

  return {
    signal: "commit_cluster_time",
    confidence: roundTo(confidence, 3),
    evidence: {
      window_start: new Date(bestStart).toISOString(),
      window_end: new Date(bestEnd).toISOString(),
      in_window_count: bestCount,
      total_count: total,
      ratio: roundTo(ratio, 3),
    },
  };
}

// Conservative regex-based AI-fingerprint patterns. Each pattern is a
// high-precision signal; combinations raise confidence.
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

const AI_MIN_HITS = 1; // need at least 1 fingerprint hit to fire

/**
 * detectAiGeneratedSuspect — conservative regex-based detector for
 * commit-and-code combinations that match the well-known fingerprints of
 * LLM-generated content (GPT-4, Claude, Copilot).
 *
 * The detector looks for generic conventional commit messages ("feat: add
 * ...") and code comments that simply paraphrase the next line (e.g.
 * "// This function returns the user name"). One hit raises confidence to
 * 0.3; further hits add 0.1 each, capped at 0.9. The detector fires only
 * when at least one fingerprint hits; it never returns a signal purely
 * based on the volume of code or commits.
 */
export function detectAiGeneratedSuspect(
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
  if (totalHits < AI_MIN_HITS) return null;

  // 0.3 base + 0.1 per hit, capped at 0.9.
  const confidence = Math.min(0.9, 0.3 + 0.1 * totalHits);

  return {
    signal: "ai_generated_suspect",
    confidence: roundTo(confidence, 3),
    evidence: {
      commit_hits: commitHits.length,
      code_hits: codeHits.length,
      total_hits: totalHits,
      commit_patterns: commitHits.slice(0, 5),
      code_hits_sample: codeHits.slice(0, 5),
    },
  };
}

/**
 * detectCopiedContentOverlap — flags a file whose lines overlap heavily
 * with any repository in a public corpus. "Overlap" is measured as the
 * fraction of the student's non-empty trimmed lines that appear verbatim
 * in the corpus entry. A ratio of 0.7 or higher is treated as suspect
 * copy-paste.
 *
 * The detector iterates each (file, corpus) pair and reports the single
 * highest overlap it finds. Evidence includes the matched repo URL and
 * the observed ratio.
 */
export function detectCopiedContentOverlap(
  files: GitHubFileInput[],
  publicCorpus: ReadonlyArray<{ repo_url: string; lines: ReadonlyArray<string> }>,
): SignalDetectionResult | null {
  if (files.length === 0) return null;
  if (publicCorpus.length === 0) return null;

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
      for (const line of fileLines) {
        if (corpusLines.has(line)) matched++;
      }
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

  // Confidence scales above the threshold; 0.7 → 0.7, 1.0 → 0.95.
  const confidence = Math.min(0.95, 0.4 + 0.5 * bestMatch.overlap);

  return {
    signal: "copied_content_overlap",
    confidence: roundTo(confidence, 3),
    evidence: {
      matched_repo_url: bestMatch.repo_url,
      file_path: bestMatch.file_path,
      matched_lines: bestMatch.matched,
      total_lines: bestMatch.total,
      overlap_ratio: roundTo(bestMatch.overlap, 3),
    },
  };
}

function roundTo(n: number, decimals: number): number {
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}
