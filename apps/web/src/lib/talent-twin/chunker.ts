export interface ChunkInput {
  content: string;
  metadata: Record<string, unknown>;
}

export function chunkCommit(
  sha: string,
  message: string,
  repo: string,
  linesAdded: number,
  date: string,
): ChunkInput {
  return {
    content: `Commit: ${message}\n\nRepository: ${repo}\nLines added: ${linesAdded}\nDate: ${date}`,
    metadata: { sha, repo, linesAdded, date, type: "commit" },
  };
}

export function chunkCollaboration(
  artifactId: string,
  title: string,
  description: string,
  role: string,
): ChunkInput {
  return {
    content: `Collaboration: ${title}\n\nDescription: ${description}\nRole: ${role}`,
    metadata: { artifactId, title, role, type: "collab" },
  };
}

export function chunkCode(
  code: string,
  filePath: string,
  language: string,
  repo: string,
): ChunkInput[] {
  const lines = code.split("\n");
  const chunkSize = 200;
  const overlap = 10;
  const chunks: ChunkInput[] = [];

  for (let i = 0; i < lines.length; i += chunkSize - overlap) {
    const slice = lines.slice(i, i + chunkSize);
    chunks.push({
      content: `File: ${filePath}\nLanguage: ${language}\n\n${slice.join("\n")}`,
      metadata: { filePath, language, repo, type: "code", startLine: i + 1, endLine: i + slice.length },
    });
  }

  return chunks;
}
