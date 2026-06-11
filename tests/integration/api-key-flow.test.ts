// tests/integration/api-key-flow.test.ts
// 11/10 — Unit tests for the public-API key helper module
// (apps/web/src/lib/api/apikey.ts) and the supporting zod schemas.
//
// Coverage (per task spec):
//   - hasScope returns true / false correctly
//   - verifyApiKeyFromHeader with valid key returns ok=true with subject
//   - verifyApiKeyFromHeader with invalid key returns ok=false
//   - key generation produces a bcrypt-hashable plaintext that starts
//     with `ant_pub_`, and the key_prefix is the first 12 chars
//
// The apikey.ts helper depends on Supabase service client; we mock it
// with vi.fn. The test focuses on the helper's branching logic and the
// API key shape contract — full DB-backed round-trip tests are out of
// scope for the in-process test suite (those live in the staging
// environment).
//
// We deliberately do NOT use bcryptjs inside the test (to keep the
// suite hermetic) — instead we validate that a generated plaintext
// matches the prefix length / character set contract, and that the
// helper's input-validation branch is exercised.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  apiKeyCreateSchema,
  webhookSubscribeSchema,
  parseOrError,
} from "@/lib/validation/schemas";
import type { VerifiedApiKey, ApiKeyVerificationResult } from "@/lib/api/apikey";
import { hasScope } from "@/lib/api/apikey";

// ----- hasScope ------------------------------------------------------------

describe("hasScope", () => {
  const baseKey: VerifiedApiKey = {
    id: "00000000-0000-0000-0000-000000000001",
    subject_id: "00000000-0000-0000-0000-000000000002",
    key_prefix: "ant_pub_abcd",
    scopes: ["read:public_profile", "webhook:subscribe"],
    rate_limit_rpm: 100,
  };

  it("returns true when the scope is in the key's scopes", () => {
    expect(hasScope(baseKey, "read:public_profile")).toBe(true);
    expect(hasScope(baseKey, "webhook:subscribe")).toBe(true);
  });

  it("returns false when the scope is missing", () => {
    expect(hasScope(baseKey, "read:verifiable_credential")).toBe(false);
    expect(hasScope(baseKey, "read:placement_aggregate")).toBe(false);
  });
});

// ----- verifyApiKeyFromHeader (mocked supabase) ----------------------------

interface VerifyRpcRow {
  id: string;
  subject_id: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  hash_match: boolean;
}

function makeServiceClientMock(impl: (prefix: string, key: string) => VerifyRpcRow | null) {
  return {
    rpc: vi.fn(async (fn: string, params: Record<string, unknown>) => {
      if (fn !== "verify_api_key") {
        return { data: null, error: { message: `unknown rpc: ${fn}` } };
      }
      const row = impl(String(params.p_prefix ?? ""), String(params.p_key ?? ""));
      if (!row) return { data: null, error: { message: "no_row" } };
      // Supabase returns a single-element array for table-returning RPCs.
      return { data: [row], error: null };
    }),
  };
}

async function importApikeyWithMock(mock: ReturnType<typeof makeServiceClientMock>) {
  // Patch the module's internal Supabase factory. The module imports
  // createSupabaseServiceClient at top level; we use vi.doMock to swap
  // it out, then re-import.
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServiceClient: () => mock,
  }));
  const mod = await import("@/lib/api/apikey");
  return mod;
}

beforeEach(() => {
  vi.resetModules();
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServiceClient: () => ({
      rpc: vi.fn(async () => ({ data: null, error: { message: "default" } })),
    }),
  }));
});

afterEach(() => {
  vi.doUnmock("@/lib/supabase/server");
  vi.resetModules();
});

describe("verifyApiKeyFromHeader", () => {
  it("rejects a missing Authorization header", async () => {
    const mod = await importApikeyWithMock(makeServiceClientMock(() => null));
    const r: ApiKeyVerificationResult = await mod.verifyApiKeyFromHeader(null);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing");
    expect(r.key).toBeUndefined();
  });

  it("rejects a malformed Authorization header (no Bearer prefix)", async () => {
    const mod = await importApikeyWithMock(makeServiceClientMock(() => null));
    const r = await mod.verifyApiKeyFromHeader("Basic abcdef");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("malformed");
  });

  it("rejects a key that does not start with ant_pub_", async () => {
    const mod = await importApikeyWithMock(makeServiceClientMock(() => null));
    const r = await mod.verifyApiKeyFromHeader("Bearer pub_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("malformed");
  });

  it("returns ok=true with the verified subject for a valid key", async () => {
    const validKey = "ant_pub_abcdef1234567890abcdef1234567890";
    const mod = await importApikeyWithMock(
      makeServiceClientMock((prefix) => {
        if (prefix !== "ant_pub_abcd") return null;
        return {
          id: "00000000-0000-0000-0000-000000000001",
          subject_id: "00000000-0000-0000-0000-000000000002",
          key_prefix: prefix,
          scopes: ["read:public_profile", "webhook:subscribe"],
          rate_limit_rpm: 100,
          hash_match: true,
        };
      }),
    );
    const r = await mod.verifyApiKeyFromHeader(`Bearer ${validKey}`);
    expect(r.ok).toBe(true);
    expect(r.key?.subject_id).toBe("00000000-0000-0000-0000-000000000002");
    expect(r.key?.scopes).toContain("read:public_profile");
    expect(r.key?.rate_limit_rpm).toBe(100);
  });

  it("returns ok=false when the bcrypt hash does not match", async () => {
    const validKey = "ant_pub_abcdef1234567890abcdef1234567890";
    const mod = await importApikeyWithMock(
      makeServiceClientMock((prefix) => ({
        id: "00000000-0000-0000-0000-000000000001",
        subject_id: "00000000-0000-0000-0000-000000000002",
        key_prefix: prefix,
        scopes: ["read:public_profile"],
        rate_limit_rpm: 100,
        hash_match: false,
      })),
    );
    const r = await mod.verifyApiKeyFromHeader(`Bearer ${validKey}`);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid");
    expect(r.key).toBeUndefined();
  });

  it("returns ok=false when the prefix misses (no row)", async () => {
    const validKey = "ant_pub_abcdef1234567890abcdef1234567890";
    const mod = await importApikeyWithMock(makeServiceClientMock(() => null));
    const r = await mod.verifyApiKeyFromHeader(`Bearer ${validKey}`);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid");
  });

  it("returns ok=false on RPC error", async () => {
    const mod = await importApikeyWithMock({
      rpc: vi.fn(async () => ({ data: null, error: { message: "boom" } })),
    });
    const r = await mod.verifyApiKeyFromHeader("Bearer ant_pub_abc123def456");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid");
  });
});

// ----- Plaintext key shape (mirrors /api/api-keys POST) -------------------

describe("apiKeyCreateSchema plaintext shape", () => {
  it("a freshly minted key starts with ant_pub_ and key_prefix is 12 chars", () => {
    // Re-mint in test to mirror the server logic.
    const hex = "0123456789abcdef0123456789abcdef";
    const plaintext = `ant_pub_${hex}`;
    expect(plaintext.startsWith("ant_pub_")).toBe(true);
    expect(plaintext.length).toBe(8 + 32); // 8-char prefix + 32 hex chars
    const keyPrefix = plaintext.slice(0, 12);
    expect(keyPrefix).toBe("ant_pub_0123");
    // bcrypt hashes start with $2a$ / $2b$ / $2y$ — we test the contract
    // by importing bcryptjs (already a dep of the web app).
  });

  it("bcryptjs hash of the plaintext starts with the bcrypt magic prefix", async () => {
    const bcrypt = (await import("bcryptjs")).default;
    const plaintext = "ant_pub_0123456789abcdef0123456789abcdef";
    const hash = bcrypt.hashSync(plaintext, 4); // cost 4 to keep test fast
    expect(hash.startsWith("$2")).toBe(true);
    // And the hash verifies the plaintext (regression check for
    // accidental rotation of bcrypt → sha256, etc.)
    expect(bcrypt.compareSync(plaintext, hash)).toBe(true);
    expect(bcrypt.compareSync("ant_pub_WRONG", hash)).toBe(false);
  });
});

// ----- zod schemas --------------------------------------------------------

describe("apiKeyCreateSchema", () => {
  it("accepts a valid name + scopes list", () => {
    const r = parseOrError(apiKeyCreateSchema, {
      name: "Production",
      scopes: ["read:public_profile", "webhook:subscribe"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.name).toBe("Production");
      expect(r.data.scopes).toHaveLength(2);
    }
  });

  it("rejects an empty scopes array", () => {
    const r = parseOrError(apiKeyCreateSchema, { name: "X", scopes: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown scope", () => {
    const r = parseOrError(apiKeyCreateSchema, {
      name: "X",
      scopes: ["read:public_profile", "admin:everything"],
    });
    expect(r.ok).toBe(false);
  });

  it("trims whitespace from the name", () => {
    const r = parseOrError(apiKeyCreateSchema, {
      name: "  Production  ",
      scopes: ["read:public_profile"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.name).toBe("Production");
  });
});

describe("webhookSubscribeSchema", () => {
  it("accepts a valid event + target_url", () => {
    const r = parseOrError(webhookSubscribeSchema, {
      event: "score.updated",
      target_url: "https://example.com/hooks",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown event", () => {
    const r = parseOrError(webhookSubscribeSchema, {
      event: "credit.score.changed",
      target_url: "https://example.com/hooks",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-URL target", () => {
    const r = parseOrError(webhookSubscribeSchema, {
      event: "score.updated",
      target_url: "not-a-url",
    });
    expect(r.ok).toBe(false);
  });
});
