// tests/integration/anticheat-scoring.test.ts
// Feature 004 — Anti-cheat detector unit tests (Vitest).
//
// Verifies the rule-based detectors in apps/web/src/lib/anticheat/ against
// the acceptance scenarios from spec.md (User Story 1) and the threshold
// rules from research.md (D1). Pure-function tests; no DB / network.

import { describe, it, expect } from "vitest";
import {
  detectForkNoCommits,
  detectCommitClusterTime,
  detectAiGeneratedSuspect,
  detectCopiedContentOverlap,
  detectImpossibleVelocity,
  detectRatingDeltaAnomaly,
  aggregateSignals,
  type GitHubCommitInput,
  type GitHubFileInput,
  type GitHubRepoInput,
  type DsaProfileSnapshot,
  type AggregateResult,
} from "@/lib/anticheat";

const baseRepo: GitHubRepoInput = {
  id: "r1",
  full_name: "student/repo",
  is_fork: false,
  student_commit_count: 10,
  total_commit_count: 10,
};

const forkRepo: GitHubRepoInput = {
  ...baseRepo,
  is_fork: true,
  parent_full_name: "upstream/repo",
};

function makeCommit(suffix: number, minutesOffset: number): GitHubCommitInput {
  // Anchor at a fixed date so tests are deterministic.
  const t = new Date("2026-06-06T10:00:00.000Z");
  t.setMinutes(t.getMinutes() + minutesOffset);
  return {
    sha: `sha${suffix}`,
    committed_at: t.toISOString(),
    author_email: "[email protected]",
    message: "feat: add stuff",
    additions: 5,
    deletions: 1,
  };
}

describe("detectForkNoCommits", () => {
  it("fires with high confidence for a fork with 0 student commits", () => {
    const r = detectForkNoCommits({ ...forkRepo, student_commit_count: 0 });
    expect(r).not.toBeNull();
    expect(r!.signal).toBe("fork_no_commits");
    expect(r!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(r!.evidence.student_commit_count).toBe(0);
    expect(r!.evidence.is_fork).toBe(true);
  });

  it("returns null for a fork that has student commits", () => {
    const r = detectForkNoCommits({ ...forkRepo, student_commit_count: 5 });
    expect(r).toBeNull();
  });

  it("returns null for a non-fork repository", () => {
    const r = detectForkNoCommits({ ...baseRepo, student_commit_count: 0 });
    expect(r).toBeNull();
  });
});

describe("detectCommitClusterTime", () => {
  it("fires with high confidence when 10 commits land within 5 minutes", () => {
    const commits: GitHubCommitInput[] = [];
    for (let i = 0; i < 10; i++) {
      commits.push(makeCommit(i, i)); // 0..9 minutes
    }
    const r = detectCommitClusterTime(commits);
    expect(r).not.toBeNull();
    expect(r!.signal).toBe("commit_cluster_time");
    expect(r!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(r!.evidence.in_window_count).toBe(10);
    expect(r!.evidence.total_count).toBe(10);
    expect(r!.evidence.ratio).toBe(1);
  });

  it("returns null when 10 commits are spread across 30 days", () => {
    const commits: GitHubCommitInput[] = [];
    for (let i = 0; i < 10; i++) {
      commits.push(makeCommit(i, i * 30 * 24 * 60)); // every 30 days
    }
    const r = detectCommitClusterTime(commits);
    expect(r).toBeNull();
  });

  it("returns null for fewer than 3 commits (insufficient data)", () => {
    const commits = [makeCommit(0, 0), makeCommit(1, 1)];
    const r = detectCommitClusterTime(commits);
    expect(r).toBeNull();
  });
});

describe("detectAiGeneratedSuspect", () => {
  it("fires when commit messages and code match AI fingerprints", () => {
    const commits: GitHubCommitInput[] = [
      { ...makeCommit(0, 0), message: "Initial commit" },
      { ...makeCommit(1, 10), message: "feat: add new module" },
    ];
    const files: GitHubFileInput[] = [
      {
        path: "src/util.ts",
        loc: 5,
        content: [
          "// This function returns the user name",
          "export function name() { return 'a'; }",
        ].join("\n"),
      },
    ];
    const r = detectAiGeneratedSuspect(commits, files);
    expect(r).not.toBeNull();
    expect(r!.signal).toBe("ai_generated_suspect");
    expect(r!.confidence).toBeGreaterThanOrEqual(0.3);
    expect(r!.confidence).toBeLessThanOrEqual(0.9);
  });
});

describe("detectCopiedContentOverlap", () => {
  const studentFile: GitHubFileInput = {
    path: "src/server.js",
    loc: 10,
    content: [
      "const express = require('express');",
      "const app = express();",
      "app.get('/', (req, res) => res.send('hi'));",
      "app.listen(3000);",
    ].join("\n"),
  };
  const corpus = [
    {
      repo_url: "https://github.com/someone/express-starter",
      lines: [
        "const express = require('express');",
        "const app = express();",
        "app.get('/', (req, res) => res.send('hi'));",
        "app.listen(3000);",
        "console.log('started');",
      ],
    },
  ];

  it("fires when >= 70% of the student file appears in the corpus", () => {
    const r = detectCopiedContentOverlap([studentFile], corpus);
    expect(r).not.toBeNull();
    expect(r!.signal).toBe("copied_content_overlap");
    expect(r!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(r!.evidence.matched_repo_url).toBe(corpus[0]!.repo_url);
    expect(r!.evidence.overlap_ratio).toBeGreaterThanOrEqual(0.7);
  });

  it("returns null when no corpus entry has high overlap", () => {
    const r = detectCopiedContentOverlap([studentFile], [
      {
        repo_url: "https://github.com/other/different",
        lines: ["x = 1", "y = 2", "z = 3"],
      },
    ]);
    expect(r).toBeNull();
  });
});

describe("detectImpossibleVelocity", () => {
  it("fires when total_solved jumps from 100 to 200 in 1 day", () => {
    const history: DsaProfileSnapshot[] = [
      snapshot("2026-06-01T00:00:00Z", 100, 1200),
      snapshot("2026-06-02T00:00:00Z", 200, 1200),
    ];
    const r = detectImpossibleVelocity(history);
    expect(r).not.toBeNull();
    expect(r!.signal).toBe("impossible_velocity");
    expect(r!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("returns null when total_solved grows by only 10 in 1 day", () => {
    const history: DsaProfileSnapshot[] = [
      snapshot("2026-06-01T00:00:00Z", 100, 1200),
      snapshot("2026-06-02T00:00:00Z", 110, 1200),
    ];
    const r = detectImpossibleVelocity(history);
    expect(r).toBeNull();
  });

  it("returns null when only one snapshot is provided", () => {
    const r = detectImpossibleVelocity([snapshot("2026-06-01T00:00:00Z", 100, 1200)]);
    expect(r).toBeNull();
  });
});

describe("detectRatingDeltaAnomaly", () => {
  it("fires when contest_rating jumps from 1200 to 2000 in one cycle", () => {
    const history: DsaProfileSnapshot[] = [
      snapshot("2026-06-01T00:00:00Z", 100, 1200),
      snapshot("2026-06-08T00:00:00Z", 110, 2000),
    ];
    const r = detectRatingDeltaAnomaly(history);
    expect(r).not.toBeNull();
    expect(r!.signal).toBe("rating_delta_anomaly");
    expect(r!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(r!.evidence.delta).toBe(800);
  });

  it("returns null when contest_rating moves by a normal amount", () => {
    const history: DsaProfileSnapshot[] = [
      snapshot("2026-06-01T00:00:00Z", 100, 1500),
      snapshot("2026-06-08T00:00:00Z", 105, 1600),
    ];
    const r = detectRatingDeltaAnomaly(history);
    expect(r).toBeNull();
  });
});

describe("aggregateSignals", () => {
  it("returns score=0 and is_quarantined=false for three null signals", () => {
    const r: AggregateResult = aggregateSignals([null, null, null]);
    expect(r.score).toBe(0);
    expect(r.is_quarantined).toBe(false);
    expect(r.primary_signal).toBeNull();
    expect(r.all_signals).toEqual([]);
  });

  it("quarantines at the default threshold when one signal is 0.8", () => {
    const sig = makeSignal(0.8);
    const r = aggregateSignals([sig]);
    expect(r.score).toBe(0.8);
    expect(r.is_quarantined).toBe(true);
    expect(r.primary_signal).toBe(sig);
  });

  it("uses max (not sum): two 0.3 signals give score 0.3, not quarantined", () => {
    const a = makeSignal(0.3, "fork_no_commits");
    const b = makeSignal(0.3, "commit_cluster_time");
    const r = aggregateSignals([a, b]);
    expect(r.score).toBe(0.3);
    expect(r.is_quarantined).toBe(false);
    expect(r.all_signals).toHaveLength(2);
  });

  it("respects a custom threshold", () => {
    const sig = makeSignal(0.4);
    expect(aggregateSignals([sig], { threshold: 0.5 }).is_quarantined).toBe(true);
    expect(aggregateSignals([sig], { threshold: 0.3 }).is_quarantined).toBe(false);
  });
});

// ----- helpers -----

function snapshot(
  recorded_at: string,
  total_solved: number,
  contest_rating: number | null,
): DsaProfileSnapshot {
  return {
    platform: "leetcode",
    recorded_at,
    total_solved,
    contest_rating,
    easy_solved: 0,
    medium_solved: 0,
    hard_solved: 0,
  };
}

function makeSignal(confidence: number, signal: "fork_no_commits" | "commit_cluster_time" = "fork_no_commits") {
  return { signal, confidence, evidence: { test: true } };
}
