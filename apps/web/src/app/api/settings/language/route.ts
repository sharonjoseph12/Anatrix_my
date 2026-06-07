// apps/web/src/app/api/settings/language/route.ts
//
// POST /api/settings/language
//   Body: { locale: "en" | "hi" | "ta" | "te" | "mr" }
//   Auth: authenticated user (any role).
//   Effect: updates public.users.locale for auth.uid().
//   Response: 200 { locale }
//
// Locale is per FR-I18N-005. The next nudge cycle picks up the new locale
// because users.locale is read on every render (see src/i18n/request.ts).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { localeUpdateSchema, parseOrError } from "@/lib/validation/schemas";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `settings-language:${user.id}`, limit: 20, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseOrError(localeUpdateSchema, json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const { locale } = parsed.data;

  const { error } = await supabase
    .from("users")
    .update({ locale })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ locale });
}
