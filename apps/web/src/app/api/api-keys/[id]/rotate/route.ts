// apps/web/src/app/api/api-keys/[id]/rotate/route.ts
// 11/10 — Rotate a single API key. Generates a new plaintext, replaces the
// stored hash, and returns the new plaintext EXACTLY ONCE. The previous
// plaintext is invalidated immediately (the prefix row still exists; the
// old key will fail bcrypt verification on the next call).
//
// Auth: subject_id = auth.uid().

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const KEY_BODY_BYTES = 16;
const BCRYPT_COST = 10;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "id is required" } },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in to rotate an API key." } },
      { status: 401 },
    );
  }

  // Confirm ownership + not already revoked (revoked keys cannot be rotated;
  // the developer must create a new one).
  const { data: existing, error: existingErr } = await supabase
    .from("api_keys_safe")
    .select("id, subject_id, revoked_at")
    .eq("id", id)
    .maybeSingle();

  if (existingErr) {
    return NextResponse.json(
      { error: { code: "internal_error", message: existingErr.message } },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: { code: "not_found", message: "API key not found." } },
      { status: 404 },
    );
  }
  const row = existing as { id: string; subject_id: string; revoked_at: string | null };
  if (row.subject_id !== user.id) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "You do not own this API key." } },
      { status: 403 },
    );
  }
  if (row.revoked_at) {
    return NextResponse.json(
      { error: { code: "conflict", message: "Revoked keys cannot be rotated. Create a new key." } },
      { status: 409 },
    );
  }

  const body = randomBytes(KEY_BODY_BYTES).toString("hex");
  const plaintext = `ant_pub_${body}`;
  const keyPrefix = plaintext.slice(0, 12);
  const keyHash = bcrypt.hashSync(plaintext, BCRYPT_COST);

  const { data: updated, error: updateErr } = await supabase
    .from("api_keys")
    .update({ key_prefix: keyPrefix, key_hash: keyHash })
    .eq("id", id)
    .eq("subject_id", user.id)
    .select("id, key_prefix")
    .single();

  if (updateErr) {
    return NextResponse.json(
      { error: { code: "internal_error", message: updateErr.message } },
      { status: 500 },
    );
  }

  const out = updated as { id: string; key_prefix: string };

  return NextResponse.json({
    api_key_id: out.id,
    key: plaintext,
    key_prefix: out.key_prefix,
  });
}
