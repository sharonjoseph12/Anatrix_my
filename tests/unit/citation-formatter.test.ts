import { describe, it, expect } from "vitest";
import { formatCitations, buildMarkdownAnswer } from "../src/lib/talent-twin/citation-formatter";

describe("citation-formatter", () => {
  it("should format citations as markdown references", () => {
    const citations = [
      { number: 1, sourceUrl: "https://github.com/foo/bar/commit/abc", title: "Fix bug", chunkType: "commit" },
    ];
    const formatted = formatCitations(citations);
    expect(formatted).toContain("[1]");
    expect(formatted).toContain("Fix bug");
    expect(formatted).toContain("https://github.com/foo/bar/commit/abc");
  });

  it("should build markdown answer with citations", () => {
    const citations = [
      { number: 1, sourceUrl: "https://github.com/foo/bar/commit/abc", title: "Fix bug", chunkType: "commit" },
    ];
    const md = buildMarkdownAnswer("The candidate fixed a bug.", citations);
    expect(md).toContain("The candidate fixed a bug.");
    expect(md).toContain("[1]: https://github.com/foo/bar/commit/abc");
  });
});
