import { describe, it, expect } from "vitest";
import { chunkCommit, chunkCollaboration, chunkCode } from "../src/lib/talent-twin/chunker";

describe("chunker", () => {
  describe("chunkCommit", () => {
    it("should create a single chunk per commit", () => {
      const chunk = chunkCommit("abc123", "Fix login bug", "antarix/web", 42, "2026-03-12");
      expect(chunk.content).toContain("Fix login bug");
      expect(chunk.content).toContain("antarix/web");
      expect(chunk.metadata.sha).toBe("abc123");
      expect(chunk.metadata.linesAdded).toBe(42);
    });
  });

  describe("chunkCollaboration", () => {
    it("should create a chunk with collaboration details", () => {
      const chunk = chunkCollaboration("art-1", "PR Review", "Reviewed the auth module", "reviewer");
      expect(chunk.content).toContain("PR Review");
      expect(chunk.metadata.role).toBe("reviewer");
    });
  });

  describe("chunkCode", () => {
    it("should chunk code into segments", () => {
      const code = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`).join("\n");
      const chunks = chunkCode(code, "src/index.ts", "typescript", "antarix/web");
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].content).toContain("src/index.ts");
      expect(chunks[0].metadata.language).toBe("typescript");
    });

    it("should return one chunk for small files", () => {
      const chunks = chunkCode("const x = 1;", "small.ts", "typescript", "antarix/web");
      expect(chunks).toHaveLength(1);
    });
  });
});
