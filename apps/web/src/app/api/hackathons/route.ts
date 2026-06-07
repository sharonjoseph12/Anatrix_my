import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { hackathonCreateSchema, parseOrError } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

// Recruiter creates a hackathon in `draft` state. The recruiter
// becomes the owner via `recruiter_id = auth.uid()`; the DB-level
// check constraint enforces the 24-168h window and the `ends_at >
// starts_at` rule, and RLS allows the row to be created when the JWT
// subject matches the recruiter_id.
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // The route is open to recruiters and admins. We don't gate on role
  // here; the RLS policy `hackathons_insert_owner` requires
  // `auth.uid() = recruiter_id`, and the recruiter must insert with
  // their own id. A non-recruiter will hit the RLS check and get a
  // permission-denied error.
  const rl = rateLimit({ key: `hackathon-create:${user.id}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(hackathonCreateSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { title, problem, test_cases_url, starts_at, ends_at, prize_structure } = parsed.data;

  const { data, error } = await supabase
    .from("hackathons")
    .insert({
      recruiter_id: user.id,
      title,
      problem,
      test_cases_url,
      starts_at,
      ends_at,
      prize_structure,
      status: "draft",
    })
    .select("id,status")
    .single();

  if (error) {
    const status = error.code === "23514" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(
    { hackathon_id: (data as { id: string }).id, status: (data as { status: string }).status },
    { status: 201 },
  );
}
