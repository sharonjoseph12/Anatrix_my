// tests/integration/next-best-skill.test.ts
// 11/10 — Vitest unit tests for the next-best-skill recommender
// (research D10, US3 / FR-NBS-001..005). Pure-function tests; no DB
// or network. Mirrors the spec scenarios end-to-end.

import { describe, it, expect } from "vitest";
import {
  computeRecommendations,
  type AlumniProfile,
  type StudentProfile,
} from "@/lib/algorithms/next-best-skill";

function makeAlumni(i: number, pre: string[], post: string[], company: string): AlumniProfile {
  return {
    id: `alumni-${i}`,
    pre_placement_skills: pre,
    post_placement_skills: post,
    placement_company: company,
  };
}

describe("computeRecommendations", () => {
  it("returns the top recommendations for a student with 12 similar alumni who all added kubernetes", () => {
    const student: StudentProfile = {
      id: "student-1",
      current_skills: ["python", "docker", "sql"],
    };
    const alumni: AlumniProfile[] = Array.from({ length: 12 }, (_, i) =>
      makeAlumni(
        i,
        ["python", "docker", "sql", "git"], // pre shares 3/4 with student → Jaccard 3/4 = 0.75
        ["python", "docker", "sql", "git", "kubernetes"], // all add kubernetes
        "Acme Corp",
      ),
    );

    const recs = computeRecommendations(student, alumni);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.skill).toBe("kubernetes");
    expect(recs[0]!.source_count).toBe(12);
    expect(recs[0]!.confidence).toBe(0.95); // capped
    expect(recs[0]!.reasoning).toContain("12 of 12");
    expect(recs[0]!.reasoning).toContain("Acme Corp");
    expect(recs[0]!.reasoning).toContain("kubernetes");
  });

  it("returns [] when source_count < minSourceCount (4 similar alumni, threshold 5)", () => {
    const student: StudentProfile = {
      id: "student-1",
      current_skills: ["python", "docker", "sql"],
    };
    const alumni: AlumniProfile[] = Array.from({ length: 4 }, (_, i) =>
      makeAlumni(
        i,
        ["python", "docker", "sql", "git"],
        ["python", "docker", "sql", "git", "kubernetes"],
        "Acme Corp",
      ),
    );

    const recs = computeRecommendations(student, alumni, { minSourceCount: 5 });
    expect(recs).toEqual([]);
  });

  it("returns [] when student has 0 current_skills", () => {
    const student: StudentProfile = { id: "student-1", current_skills: [] };
    const alumni: AlumniProfile[] = Array.from({ length: 20 }, (_, i) =>
      makeAlumni(
        i,
        ["a", "b", "c"],
        ["a", "b", "c", "x"],
        "Co",
      ),
    );

    const recs = computeRecommendations(student, alumni);
    expect(recs).toEqual([]);
  });

  it("returns [] when the Jaccard threshold filters out all alumni", () => {
    const student: StudentProfile = {
      id: "student-1",
      current_skills: ["rust", "wasm", "svelte"],
    };
    // Alumni have completely disjoint skill sets from the student.
    const alumni: AlumniProfile[] = Array.from({ length: 20 }, (_, i) =>
      makeAlumni(
        i,
        ["java", "spring", "hibernate"],
        ["java", "spring", "hibernate", "kafka"],
        "Mega Corp",
      ),
    );

    const recs = computeRecommendations(student, alumni);
    expect(recs).toEqual([]);
  });

  it("caps confidence at 0.95 even when every kept alumni learned the skill", () => {
    const student: StudentProfile = {
      id: "student-1",
      current_skills: ["python", "sql"],
    };
    const alumni: AlumniProfile[] = Array.from({ length: 10 }, (_, i) =>
      makeAlumni(
        i,
        ["python", "sql", "git"],
        ["python", "sql", "git", "kubernetes"],
        "Acme",
      ),
    );

    const recs = computeRecommendations(student, alumni);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.confidence).toBeLessThanOrEqual(0.95);
    expect(recs[0]!.confidence).toBe(0.95);
  });

  it("produces a reasoning string that includes count, total, company, and skill", () => {
    const student: StudentProfile = {
      id: "student-1",
      current_skills: ["python", "docker", "sql"],
    };
    const alumni: AlumniProfile[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeAlumni(
          i,
          ["python", "docker", "sql", "git"],
          ["python", "docker", "sql", "git", "kubernetes"],
          "Acme",
        ),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeAlumni(
          i + 5,
          ["python", "docker", "sql", "git"],
          ["python", "docker", "sql", "git", "kubernetes"],
          "Globex",
        ),
      ),
    ];

    const recs = computeRecommendations(student, alumni);
    expect(recs).toHaveLength(1);
    const r = recs[0]!;
    // "10 of 10 alumni placed at <most_common_company> added <skill> after your current stack"
    expect(r.reasoning).toMatch(/^10 of 10 alumni placed at /);
    expect(r.reasoning).toContain("kubernetes");
    expect(r.reasoning).toContain(" after your current stack");
    // Tie on the company (5 + 5) → mode is the lexically smallest company.
    expect(r.reasoning).toContain("Acme");
  });

  it("breaks ties stably: with two skills at the same count, the lexically smaller one ranks first", () => {
    const student: StudentProfile = {
      id: "student-1",
      current_skills: ["python", "docker", "sql"],
    };
    // 6 alumni, half learned "rust" and half learned "go" (3 each).
    // They all placed at the same company so the company mode is
    // identical; rank is then decided by skill lex order → "go" < "rust"
    // and the rec with "go" should come first.
    const alumni: AlumniProfile[] = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeAlumni(
          i,
          ["python", "docker", "sql", "git"],
          ["python", "docker", "sql", "git", "rust"],
          "Acme",
        ),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makeAlumni(
          i + 3,
          ["python", "docker", "sql", "git"],
          ["python", "docker", "sql", "git", "go"],
          "Acme",
        ),
      ),
    ];

    const recs = computeRecommendations(student, alumni);
    expect(recs).toHaveLength(2);
    // Same count for both → tie broken by skill lex order: "go" < "rust".
    expect(recs[0]!.skill).toBe("go");
    expect(recs[1]!.skill).toBe("rust");
    expect(recs[0]!.source_count).toBe(3);
    expect(recs[1]!.source_count).toBe(3);
  });

  it("respects the topK limit and returns only the requested number of recs", () => {
    const student: StudentProfile = {
      id: "student-1",
      current_skills: ["python", "docker", "sql"],
    };
    // 30 alumni; each added a different skill. All 30 skills are tied
    // on count, so the rank is decided lexically. With topK=2 we get
    // the first two in lex order. minSourceCount is lowered to 1 so
    // the per-skill count of 1 clears the D10 noise floor — the test
    // is exercising the topK gate, not the noise floor.
    const skills = [
      "aws",
      "azure",
      "bash",
      "c",
      "elixir",
      "erlang",
      "fsharp",
      "go",
      "haskell",
      "hadoop",
      "helm",
      "istio",
      "java",
      "javascript",
      "jenkins",
      "kafka",
      "kotlin",
      "kubernetes",
      "linux",
      "mongodb",
      "nginx",
      "node",
      "openapi",
      "postgres",
      "pytorch",
      "redis",
      "ruby",
      "rust",
      "spark",
      "terraform",
    ];
    const alumni: AlumniProfile[] = skills.map((s, i) =>
      makeAlumni(
        i,
        ["python", "docker", "sql", "git"],
        ["python", "docker", "sql", "git", s],
        "Acme",
      ),
    );

    const recs = computeRecommendations(student, alumni, { topK: 2, minSourceCount: 1 });
    expect(recs).toHaveLength(2);
    // First two in lex order among the skill list: "aws" then "azure".
    expect(recs[0]!.skill).toBe("aws");
    expect(recs[1]!.skill).toBe("azure");
    expect(recs[0]!.rank).toBe(1);
    expect(recs[1]!.rank).toBe(2);
  });
});
