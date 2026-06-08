// supabase/functions/_shared/twin-helpers.ts
// Shared utilities for the 010 AI Talent Twin Edge Functions.

export const authorshipThreshold = 0.8;

export interface Chunk {
  chunkId: string;
  userId: string;
  chunkType: string;
  chunkText: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface BadgeClaims {
  sub: string;
  studentId: string;
  nonce: string;
  commits: string[];
  label: string;
  iat: number;
  exp: number;
  iss: string;
}

const EMBEDDING_MODEL = "text-embedding-3-small";
const JWT_ALG = "HS256";

function getServiceKey(): string {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function getOpenAIKey(): string {
  return Deno.env.get("OPENAI_API_KEY") ?? "";
}

export async function buildEmbedding(text: string): Promise<number[]> {
  const key = getOpenAIKey();
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embedding error ${res.status}: ${body}`);
  }
  const json = await res.json() as { data: Array<{ embedding: number[] }> };
  return json.data[0].embedding;
}

export function buildPrompt(question: string, chunks: Chunk[]): string {
  const context = chunks.map((c, i) => {
    const meta = c.metadata;
    const source = meta?.repo || meta?.file_path || "unknown source";
    const url = meta?.url || "";
    return `[${i + 1}] (${c.chunkType}) ${source}${url ? ` (${url})` : ""}:\n${c.chunkText}`;
  }).join("\n\n");

  return `You are an AI talent analyst helping a recruiter learn about a candidate. Answer the recruiter's question based ONLY on the context provided below. Each context item is labelled with its source type and URL.

**Rules:**
- Be concise and factual.
- If the context does not contain enough information to answer, say "I don't have enough information to answer that question."
- Cite sources using markdown links: [Source: <title>](<url>)
- Never fabricate information.

**Context:**
${context}

**Recruiter question:** ${question}

**Answer:**`;
}

export function parseChunks(
  dbRows: Array<{
    chunk_id: string;
    user_id: string;
    chunk_type: string;
    chunk_text: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>,
): Chunk[] {
  return dbRows.map((r) => ({
    chunkId: r.chunk_id,
    userId: r.user_id,
    chunkType: r.chunk_type,
    chunkText: r.chunk_text,
    metadata: r.metadata,
    similarity: r.similarity,
  }));
}

function base64UrlEncode(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return base64UrlEncode(sig);
}

export async function signBadge(claims: Omit<BadgeClaims, "iat" | "exp" | "iss"> & {
  expDays?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: BadgeClaims = {
    ...claims,
    iat: now,
    exp: now + (claims.expDays ?? 60) * 86400,
    iss: "antarix-talent-twin",
  };
  const header = { alg: JWT_ALG, typ: "JWT" };
  const encHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSha256(getServiceKey(), `${encHeader}.${encPayload}`);
  return `${encHeader}.${encPayload}.${sig}`;
}

export async function verifyBadge(jwt: string): Promise<BadgeClaims | { error: string }> {
  const parts = jwt.split(".");
  if (parts.length !== 3) return { error: "malformed_jwt" };
  const [encHeader, encPayload, sig] = parts;
  const expectedSig = await hmacSha256(getServiceKey(), `${encHeader}.${encPayload}`);
  if (sig !== expectedSig) return { error: "invalid_signature" };
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(encPayload.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
      ),
    ) as BadgeClaims;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { error: "expired" };
    }
    return payload;
  } catch {
    return { error: "malformed_payload" };
  }
}
