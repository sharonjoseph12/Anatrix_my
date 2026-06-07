// apps/web/src/app/api/faculty/verify/route.ts
// POST /api/faculty/verify
// Auth: institution admin (role in institution_members in {admin, placement_officer})
// Body: { user_id, institution_id }
//
// Side effect: upserts faculty_verifications with verified=true.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { facultyVerifySchema, parseOrError } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(facultyVerifySchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { user_id, institution_id } = parsed.data;

  // Caller must be an admin / placement_officer at institution_id
  const { data: callerMembership } = await supabase
    .from("institution_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("institution_id", institution_id)
    .in("role", ["admin", "placement_officer"])
    .maybeSingle();
  if (!callerMembership) {
    return NextResponse.json(
      { error: "Only institution admins or placement officers can verify faculty" },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("faculty_verifications")
    .upsert(
      {
        user_id,
        institution_id,
        verified: true,
        verified_by: user.id,
        verified_at: now,
        revoked_at: null,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { verification_id: (data as { id: string }).id, verified: true },
    { status: 201 },
  );
}
