// apps/web/src/lib/api/apikey.ts
// Public API key verification helper.
//
// Header format (per specs/004-eleven-of-ten/contracts/api.md):
//   Authorization: Bearer ant_pub_<random-32-hex>
//
// Key shape: `ant_pub_` prefix (8 chars) + 32 hex chars = 40 chars total.
// The first 12 characters (e.g. "ant_pub_a1b2") are stored as key_prefix in
// public.api_keys and are safe to log. The full key is bcrypt-hashed via
// pgcrypto's `crypt(key, gen_salt('bf'))` (see migration 037).
//
// Verification flow:
//   1. Parse `Bearer <key>` from the header.
//   2. Extract key_prefix = first 12 chars.
//   3. Look up the active (revoked_at IS NULL) row by prefix via the service
//      role client.
//   4. Compare the full key against the stored hash using pgcrypto's
//      `crypt($1, $2) = $2` — the comparison happens server-side in
//      Postgres, so the bcrypt cost is paid by the DB and no Node-side
//      `bcrypt` package is required.
//   5. On any failure (parse error, prefix miss, hash mismatch, revoked),
//      return {ok:false, error:<reason>}. The full key is NEVER logged,
//      even on failure.

import "server-only";
import type { ApiKeyScope } from "@antarix/types";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export interface VerifiedApiKey {
  id: string;
  subject_id: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
  rate_limit_rpm: number;
}

export interface ApiKeyVerificationResult {
  ok: boolean;
  key?: VerifiedApiKey;
  error?: "missing" | "malformed" | "invalid" | "revoked";
}

const BEARER_PREFIX = "Bearer ";
const KEY_PREFIX_LENGTH = 12;
const ALLOWED_SCOPES: ReadonlySet<ApiKeyScope> = new Set<ApiKeyScope>([
  "read:public_profile",
  "read:verifiable_credential",
  "webhook:subscribe",
  "read:placement_aggregate",
]);

function isApiKeyScope(value: string): value is ApiKeyScope {
  return ALLOWED_SCOPES.has(value as ApiKeyScope);
}

export async function verifyApiKeyFromHeader(
  authHeader: string | null,
): Promise<ApiKeyVerificationResult> {
  if (!authHeader) return { ok: false, error: "missing" };
  if (!authHeader.startsWith(BEARER_PREFIX)) return { ok: false, error: "malformed" };

  const fullKey = authHeader.slice(BEARER_PREFIX.length).trim();
  if (fullKey.length < KEY_PREFIX_LENGTH) return { ok: false, error: "malformed" };
  if (!/^ant_pub_/.test(fullKey)) return { ok: false, error: "malformed" };

  const keyPrefix = fullKey.slice(0, KEY_PREFIX_LENGTH);

  const supabase = createSupabaseServiceClient();
  // Use the SECURITY INVOKER view (public.api_keys_safe) so key_hash is
  // never SELECTed; the bcrypt comparison is performed by the verify_api_key
  // RPC. (Both the view and the RPC are added in migration 037.)
  const { data, error } = await supabase.rpc("verify_api_key", {
    p_prefix: keyPrefix,
    p_key: fullKey,
  });

  if (error) {
    return { ok: false, error: "invalid" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: false, error: "invalid" };
  }

  // Row shape returned by the verify_api_key RPC:
  //   { id, subject_id, key_prefix, scopes: string[], rate_limit_rpm, hash_match: boolean }
  const candidate = row as {
    id?: string;
    subject_id?: string;
    key_prefix?: string;
    scopes?: unknown;
    rate_limit_rpm?: number;
    hash_match?: boolean;
  };

  if (!candidate.hash_match) {
    return { ok: false, error: "invalid" };
  }

  if (
    typeof candidate.id !== "string"
    || typeof candidate.subject_id !== "string"
    || typeof candidate.key_prefix !== "string"
    || typeof candidate.rate_limit_rpm !== "number"
    || !Array.isArray(candidate.scopes)
  ) {
    return { ok: false, error: "invalid" };
  }

  const scopes: ApiKeyScope[] = [];
  for (const raw of candidate.scopes) {
    if (typeof raw === "string" && isApiKeyScope(raw)) {
      scopes.push(raw);
    }
  }

  return {
    ok: true,
    key: {
      id: candidate.id,
      subject_id: candidate.subject_id,
      key_prefix: candidate.key_prefix,
      scopes,
      rate_limit_rpm: candidate.rate_limit_rpm,
    },
  };
}

export function hasScope(key: VerifiedApiKey, scope: ApiKeyScope): boolean {
  return key.scopes.includes(scope);
}
