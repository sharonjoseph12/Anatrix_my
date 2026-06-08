import { describe, it, expect } from "vitest";
import { buildPrompt, parseChunks, authorshipThreshold } from "./twin-helpers";

describe("twin-helpers", () => {
  describe("authorshipThreshold", () => {
    it("should be 0.8", () => {
      expect(authorshipThreshold).toBe(0.8);
    });
  });

  describe("parseChunks", () => {
    it("should convert db rows to Chunk array", () => {
      const rows = [
        {
          id: "1",
          userId: "u1",
          chunkType: "commit",
          sourceUrl: "https://github.com/foo/bar/commit/abc",
          title: "Fix bug",
          content: "Fixed a critical bug",
          metadata: { repo: "foo/bar" },
          similarity: 0.95,
        },
      ];
      const chunks = parseChunks(rows);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].title).toBe("Fix bug");
      expect(chunks[0].similarity).toBe(0.95);
    });

    it("should handle null sourceUrl and title", () => {
      const rows = [
        {
          id: "2",
          userId: "u1",
          chunkType: "ide_session",
          sourceUrl: null,
          title: null,
          content: "IDE session data",
          metadata: {},
          similarity: 0.8,
        },
      ];
      const chunks = parseChunks(rows);
      expect(chunks[0].sourceUrl).toBeNull();
      expect(chunks[0].title).toBeNull();
    });
  });

  describe("buildPrompt", () => {
    it("should build a prompt with context and question", () => {
      const chunks = [
        {
          id: "1",
          userId: "u1",
          chunkType: "commit",
          sourceUrl: "https://github.com/foo/bar/commit/abc",
          title: "Fix bug",
          content: "Fixed a critical bug",
          metadata: {},
          similarity: 0.95,
        },
      ];
      const prompt = buildPrompt("What work has this candidate done?", chunks);
      expect(prompt).toContain("Fix bug");
      expect(prompt).toContain("What work has this candidate done?");
      expect(prompt).toContain("[1]");
    });
  });
});
