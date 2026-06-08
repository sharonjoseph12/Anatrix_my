// apps/web/src/app/api/api-keys/route.ts
// 11/10 — Developer console: list + create programmatic API keys.
//
// Auth: any authenticated user (developer self-serve). See FR-API-001/002.
//
// POST: validates { name, scopes }, mints a plaintext key, stores its bcrypt
//       hash, returns the plaintext EXACTLY ONCE. The plaintext is never
//       persisted server-side and cannot be retrieved later — only the
//       rotating/regenerating endpoints can issue a new plaintext.
//
// GET:  reads from public.api_keys_safe (the SECURITY INVOKER view that omits
//       key_hash) for the calling user.

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiKeyCreateSchema, parseOrError } from "@/lib/validation/schemas";
import type { ApiKey, ApiKeyScope } from "@antarix/types";

export const runtime = "nodejs";

const KEY_BODY_BYTES = 16; // -> 32 hex chars
const BCRYPT_COST = 10;

function generateApiKey(): { plaintext: string; keyPrefix: string; keyHash: string } {
  const body = randomBytes(KEY_BODY_BYTES).toString("hex");
  const plaintext = `ant_pub_${body}`;
  const keyPrefix = plaintext.slice(0, 12);
  const keyHash = bcrypt.hashSync(plaintext, BCRYPT_COST);
  return { plaintext, keyPrefix, keyHash };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in to list API keys." } },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("api_keys_safe")
    .select("id, subject_id, name, key_prefix, scopes, rate_limit_rpm, last_used_at, revoked_at, created_at")
    .eq("subject_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: "internal_error", message: error.message } },
      { status: 500 },
    );
  }

  const keys: ApiKey[] = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      subject_id: string;
      name: string;
      key_prefix: string;
      scopes: string[];
      rate_limit_rpm: number;
      last_used_at: string | null;
      revoked_at: string | null;
      created_at: string;
    };
    return {
      id: r.id,
      subject_id: r.subject_id,
      name: r.name,
      key_prefix: r.key_prefix,
      scopes: r.scopes.filter((s): s is ApiKeyScope =>
        ["read:public_profile", "read:verifiable_credential", "webhook:subscribe", "read:placement_aggregate"].includes(s),
      ),
      rate_limit_rpm: r.rate_limit_rpm,
      last_used_at: r.last_used_at,
      revoked_at: r.revoked_at,
      created_at: r.created_at,
    };
  });

  return NextResponse.json({ api_keys: keys });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in to create an API key." } },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = parseOrError(apiKeyCreateSchema, body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: parsed.error, details: { issues: parsed.issues } } },
      { status: 400 },
    );
  }

  const { plaintext, keyPrefix, keyHash } = generateApiKey();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      subject_id: user.id,
      name: parsed.data.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: parsed.data.scopes,
    })
    .select("id, rate_limit_rpm")
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "internal_error", message: error.message } },
      { status: 500 },
    );
  }

  const inserted = data as { id: string; rate_limit_rpm: number };

  // Plaintext is returned EXACTLY ONCE; the client must store it.
  return NextResponse.json(
    {
      api_key_id: inserted.id,
      key: plaintext,
      key_prefix: keyPrefix,
      scopes: parsed.data.scopes,
      rate_limit_rpm: inserted.rate_limit_rpm,
    },
    { status: 201 },
  );
}
