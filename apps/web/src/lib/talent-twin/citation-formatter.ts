export interface Citation {
  number: number;
  sourceUrl: string;
  title: string;
  chunkType: string;
}

export function formatCitations(citations: Citation[]): string {
  return citations
    .map(
      (c) =>
        `[${c.number}] ${c.title}${c.sourceUrl ? ` — ${c.sourceUrl}` : ""} (${c.chunkType})`,
    )
    .join("\n");
}

export function buildMarkdownAnswer(answer: string, citations: Citation[]): string {
  const citationLines = citations.map(
    (c) => `[${c.number}]: ${c.sourceUrl}`,
  );
  return `${answer}\n\n---\n\n${citationLines.join("\n")}`;
}
