// apps/web/src/app/api/api-keys/[id]/route.ts
// 11/10 — Revoke (soft-delete) a single API key. Sets revoked_at = now().
// Subsequent verifications will skip the row (see verify_api_key RPC).
// Idempotent: re-revoking a revoked key is a 204 with no further effect.
//
// Auth: subject_id = auth.uid().

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
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
      { error: { code: "unauthorized", message: "Sign in to revoke an API key." } },
      { status: 401 },
    );
  }

  // Look up first to differentiate 404 vs 403 (avoid leaking ownership).
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
    // Idempotent — already revoked.
    return new NextResponse(null, { status: 204 });
  }

  const { error: updateErr } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("subject_id", user.id);

  if (updateErr) {
    return NextResponse.json(
      { error: { code: "internal_error", message: updateErr.message } },
      { status: 500 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
