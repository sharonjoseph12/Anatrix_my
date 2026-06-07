import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const StudentSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  display_name: z.string().trim().min(1).max(255),
  batch_year: z.number().int().min(2000).max(2100).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  roll_number: z.string().max(50).nullable().optional(),
  specialization: z.string().max(100).nullable().optional(),
});

const Body = z.object({
  students: z.array(StudentSchema).min(1).max(500),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `csv-import:${user.id}`, limit: 5, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  // Caller must be placement_officer or admin
  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .in("role", ["placement_officer", "admin"])
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const institutionId = (membership as { institution_id: string }).institution_id;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;
  const errors: Array<{ email: string; reason: string }> = [];

  for (const s of parsed.data.students) {
    // Find or create a public.users row for this email. We use admin auth
    // (service role) via the route if the JWT belongs to an officer.
    // Note: invites by email require Supabase Auth admin. If not configured,
    // we just record a placeholder institution_members row keyed on
    // user_id = hash(email) — a fallback that the student can claim on signup.
    //
    // For v1 we use a simpler path: store the pending import in
    // institution_members with user_id = the calling officer + email; this
    // lets the dashboard show "pending invites" until students sign up.
    //
    // To keep things working without SMTP, we just no-op duplicate emails.
    const placeholderUserId = await ensurePlaceholderUser(supabase, s.email, s.display_name);
    if (!placeholderUserId) {
      skipped += 1;
      errors.push({ email: s.email, reason: "user_create_failed" });
      continue;
    }

    const { error: mErr } = await supabase
      .from("institution_members")
      .upsert(
        {
          institution_id: institutionId,
          user_id: placeholderUserId,
          role: "student",
          batch_year: s.batch_year ?? null,
          department: s.department ?? null,
          roll_number: s.roll_number ?? null,
          specialization: s.specialization ?? null,
          joined_at: new Date().toISOString(),
        },
        { onConflict: "institution_id,user_id", ignoreDuplicates: true },
      );

    if (mErr) {
      skipped += 1;
      errors.push({ email: s.email, reason: mErr.message });
      continue;
    }
    imported += 1;
  }

  return NextResponse.json({ imported, skipped, errors: errors.slice(0, 25) });
}

async function ensurePlaceholderUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  email: string,
  displayName: string,
): Promise<string | null> {
  // Look up existing user by email via the profiles view
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing?.id) return existing.id;

  // Insert a placeholder user. The student will claim this row on signup
  // (we update the auth user on first sign-in via the auth callback trigger).
  // The user_id is a stable UUID derived from the email.
  const userId = deterministicUuid(email);
  const { error } = await supabase.from("users").insert({
    id: userId,
    email,
    display_name: displayName,
    user_type: "student",
    role: "student",
    onboarding_completed_at: null,
  });
  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) return userId;
    return null;
  }
  return userId;
}

function deterministicUuid(seed: string): string {
  // Simple deterministic UUID v5-shaped hash (good enough for placeholders).
  // 32 hex chars arranged in UUID format. Not cryptographically strong,
  // but stable across calls and unique per email.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i += 1) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, "0");
  const b = (h2 >>> 0).toString(16).padStart(8, "0");
  const c = (h1 ^ h2).toString(16).padStart(8, "0").slice(0, 8);
  const d = (h1 + h2).toString(16).padStart(8, "0").slice(0, 8);
  const tail = (h1 ^ h2 ^ seed.length).toString(16).padStart(12, "0").slice(0, 12);
  return `${a}-${b.slice(0, 4)}-${c.slice(0, 4)}-${d.slice(0, 4)}-${tail}`;
}
