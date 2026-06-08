// supabase/functions/_shared/twin-helpers.ts
// Shared utilities for the 010 AI Talent Twin edge functions.

export const authorshipThreshold = 0.8;

export interface Chunk {
  id: string;
  userId: string;
  chunkType: string;
  sourceUrl: string | null;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface BadgeClaims {
  sub: string;
  badgeNonce: string;
  commits: Array<{
    sha: string;
    repo: string;
    lines: number;
    date: string;
    messageSha256: string;
  }>;
  iat: number;
  exp: number;
}

export function parseChunks(dbRows: unknown[]): Chunk[] {
  return (dbRows as Chunk[]).map((r) => ({
    id: r.id,
    userId: r.userId,
    chunkType: r.chunkType,
    sourceUrl: r.sourceUrl ?? null,
    title: r.title ?? null,
    content: r.content,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    similarity: r.similarity,
  }));
}

export function buildPrompt(question: string, chunks: Chunk[]): string {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] Source: ${c.chunkType}${c.title ? ` — ${c.title}` : ""}\n${c.sourceUrl ? `URL: ${c.sourceUrl}\n` : ""}${c.content}`
    )
    .join("\n\n");

  return (
    `You are an AI Talent Twin answering a recruiter's question based on a candidate's actual work.\n\n` +
    `Instructions:\n` +
    `- Answer concisely in 2-4 sentences.\n` +
    `- Reference specific sources using numbered citations like [1], [2].\n` +
    `- If the context doesn't contain enough information, say so — don't make things up.\n` +
    `- Never reveal raw source text that wasn't provided in the context.\n` +
    `- Never speculate about the candidate's personal life, demographics, or protected characteristics.\n\n` +
    `Context:\n${context}\n\n` +
    `Recruiter question: ${question}\n\nAnswer:`
  );
}

export async function buildEmbedding(text: string): Promise<number[]> {
  const resp = await fetch(
    "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text, normalize: true }),
    }
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`embedding service error ${resp.status}: ${body}`);
  }
  const result: number[][] = await resp.json();
  return result[0];
}

export function signBadge(claims: Omit<BadgeClaims, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: BadgeClaims = {
    ...claims,
    iat: now,
    exp: now + 31536000, // 12 months
  };
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const secret = Deno.env.get("TALENT_TWIN_BADGE_SECRET") ?? "insecure-dev-secret";
  const keyBytes = new TextEncoder().encode(secret);
  const msgBytes = new TextEncoder().encode(`${header}.${body}`);
  const sigBytes = crypto.subtle.signSync("HMAC", keyBytes, msgBytes);
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  return `${header}.${body}.${sig}`;
}

export function verifyBadge(jwt: string): BadgeClaims | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(atob(parts[0]));
    if (header.alg !== "HS256") return null;
    const secret = Deno.env.get("TALENT_TWIN_BADGE_SECRET") ?? "insecure-dev-secret";
    const keyBytes = new TextEncoder().encode(secret);
    const msgBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const expectedSigBytes = crypto.subtle.signSync("HMAC", keyBytes, msgBytes);
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(expectedSigBytes)));
    if (parts[2] !== expectedSig) return null;
    return JSON.parse(atob(parts[1])) as BadgeClaims;
  } catch {
    return null;
  }
}
