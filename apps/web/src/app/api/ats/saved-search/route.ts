import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { atsSavedSearchSchema, parseOrError } from "@/lib/validation/schemas";

// POST /api/ats/saved-search — create a saved search on a connection.
//
// Spec: specs/004-eleven-of-ten/contracts/api.md → POST /api/ats/saved-search

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `ats-saved-search:${user.id}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(atsSavedSearchSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { connection_id, name, query_json, min_score } = parsed.data;

  // Verify the connection belongs to the user. The SELECT policy on
  // ats_connections already restricts to the owning recruiter, so a
  // null result here means "either doesn't exist or isn't ours" —
  // 403 keeps the existence indistinguishable.
  const { data: conn } = await supabase
    .from("ats_connections")
    .select("id,recruiter_id,status")
    .eq("id", connection_id)
    .maybeSingle();
  if (!conn) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const c = conn as { id: string; recruiter_id: string; status: string };
  if (c.recruiter_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (c.status === "revoked") {
    return NextResponse.json(
      { error: "Cannot add saved search to a revoked connection" },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("ats_saved_searches")
    .insert({
      connection_id,
      name,
      query_json,
      min_score: min_score ?? 75,
      active: true,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = data as { id: string };

  return NextResponse.json({ saved_search_id: row.id }, { status: 201 });
}
