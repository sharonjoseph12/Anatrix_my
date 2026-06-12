import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const Body = z.object({
  provider: z.enum(["github", "google_calendar"]),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit({ key: `integration-sync:${user.id}`, limit: 6, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const fnName = parsed.data.provider === "github" ? "github-sync" : "calendar-sync";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "Edge function URL not configured" }, { status: 500 });
  }

  let authHeader = serviceKey ? `Bearer ${serviceKey}` : null;
  if (!authHeader) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    authHeader = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...(anonKey ? { apikey: anonKey } : {}),
    },
    body: JSON.stringify({ user_id: user.id, full_sync: false }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Edge function failed: ${res.status} ${text}` },
      { status: 502 },
    );
  }

  const data = (await res.json().catch(() => ({}))) as { synced?: number };
  return NextResponse.json({ synced: data.synced ?? 0 });
}
