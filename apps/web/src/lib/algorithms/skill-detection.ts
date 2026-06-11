// Skill detection from GitHub commit activity
// Aggregates commits by primary_language and maps each language to the most
// likely skills in our catalog (manual mapping, easy to extend).
//
// Pure data → output: ranked candidate skills with a confidence value
// (relative to the user's top language). Caller resolves canonical skill
// metadata (name, slug) from the skills table.

export interface CommitForSkillDetection {
  primary_language: string | null;
  committed_at: string;
  repo_full_name?: string | null;
}

export interface DetectedSkill {
  /** Canonical-ish identifier derived from language. */
  language: string;
  commitCount: number;
  percentOfTotal: number;
  /** First (oldest) and last (most recent) commit timestamps. */
  firstCommitAt: string | null;
  lastCommitAt: string | null;
  /** Estimated proficiency inferred from commit volume and recency. */
  estimatedProficiency: "novice" | "developing" | "proficient" | "advanced" | "expert";
  /** Optional repo domain hints extracted from repo names (e.g. "ml", "ios"). */
  domains: string[];
}

const LANGUAGE_NORMALIZE: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  "c++": "C++",
  c: "C",
  "c#": "C#",
  go: "Go",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  scala: "Scala",
  dart: "Dart",
  html: "HTML",
  css: "CSS",
  shell: "Shell",
  bash: "Shell",
  sql: "SQL",
  r: "R",
  matlab: "MATLAB",
  lua: "Lua",
  elixir: "Elixir",
  haskell: "Haskell",
};

const DOMAIN_HINTS: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /\bml\b|machine[\-_ ]?learning|deep[\-_ ]?learning|nlp|computer[\-_ ]?vision|torch|tensorflow|pytorch|scikit|sklearn/i, domain: "ml" },
  { pattern: /\bios\b|swift|swiftui|uikit|combine|coreml/i, domain: "ios" },
  { pattern: /\bandroid\b|kotlin|jetpack|compose\b|gradle/i, domain: "android" },
  { pattern: /\breact\b|next|remix|gatsby|vue\b|svelte|nuxt/i, domain: "web-frontend" },
  { pattern: /\bnode\b|express|fastify|nestjs|deno|bun\b/i, domain: "web-backend" },
  { pattern: /\bdjango\b|flask|fastapi\b|spring|rails\b|laravel|gin\b|echo\b|fiber\b/i, domain: "web-backend" },
  { pattern: /\bdevops\b|kubernetes|terraform|ansible|helm\b|argocd/i, domain: "devops" },
  { pattern: /\baws\b|gcp|azure\b|lambda\b|cloudformation/i, domain: "cloud" },
  { pattern: /\bblockchain\b|web3|solidity|ethers\b|hardhat\b/i, domain: "blockchain" },
  { pattern: /\bgame\b|unity\b|unreal|godot\b/i, domain: "game-dev" },
  { pattern: /\bdata\b|etl|spark\b|hadoop|airflow|dbt\b/i, domain: "data-eng" },
];

function normalize(lang: string | null | undefined): string {
  if (!lang) return "Other";
  const key = lang.trim().toLowerCase();
  return LANGUAGE_NORMALIZE[key] ?? lang.trim();
}

function detectDomains(repos: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const r of repos) {
    if (!r) continue;
    for (const hint of DOMAIN_HINTS) {
      if (hint.pattern.test(r)) set.add(hint.domain);
    }
  }
  return Array.from(set);
}

function proficiencyFromCount(commits: number, total: number, ageDays: number): DetectedSkill["estimatedProficiency"] {
  // Heuristic: 50%+ of total commits in this language is "expert" territory;
  // <5 commits is novice.
  const share = total > 0 ? commits / total : 0;
  if (share >= 0.4 && commits >= 50 && ageDays >= 60) return "expert";
  if (share >= 0.2 && commits >= 20) return "advanced";
  if (commits >= 8) return "proficient";
  if (commits >= 3) return "developing";
  return "novice";
}

export function detectSkillsFromCommits(commits: CommitForSkillDetection[]): DetectedSkill[] {
  if (commits.length === 0) return [];

  const grouped = new Map<string, { commits: CommitForSkillDetection[]; repos: Set<string> }>();
  for (const c of commits) {
    const lang = normalize(c.primary_language);
    const entry = grouped.get(lang) ?? { commits: [], repos: new Set() };
    entry.commits.push(c);
    if (c.repo_full_name) entry.repos.add(c.repo_full_name);
    grouped.set(lang, entry);
  }

  const total = commits.length;
  const now = Date.now();
  const out: DetectedSkill[] = [];

  for (const [lang, group] of grouped.entries()) {
    if (lang === "Other") continue;
    const sorted = [...group.commits].sort((a, b) =>
      a.committed_at.localeCompare(b.committed_at),
    );
    const first = sorted[0]?.committed_at ?? null;
    const last = sorted[sorted.length - 1]?.committed_at ?? null;
    const ageDays = first ? (now - new Date(first).getTime()) / 86_400_000 : 0;
    out.push({
      language: lang,
      commitCount: group.commits.length,
      percentOfTotal: Math.round((group.commits.length / total) * 100),
      firstCommitAt: first,
      lastCommitAt: last,
      estimatedProficiency: proficiencyFromCount(group.commits.length, total, ageDays),
      domains: detectDomains(Array.from(group.repos)),
    });
  }

  return out.sort((a, b) => b.commitCount - a.commitCount);
}
