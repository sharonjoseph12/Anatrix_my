import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SOURCE_MAP = {
  github: "github",
  google_calendar: "calendar",
} as const;

type Provider = keyof typeof SOURCE_MAP;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const form = await request.formData();
  const provider = form.get("provider") as Provider | null;
  const source = provider ? SOURCE_MAP[provider] : null;

  if (!source) {
    return NextResponse.redirect(new URL("/dashboard?error=invalid_provider", request.url));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.redirect(new URL("/dashboard?error=disconnect_failed", request.url));
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/sources-disconnect/${source}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    },
  });

  const referer = request.headers.get("referer");
  const fallback = provider === "github" ? "/dashboard/github" : "/dashboard";
  const redirectTo = referer && new URL(referer).pathname.startsWith("/") ? new URL(referer).pathname : fallback;

  if (!res.ok) {
    return NextResponse.redirect(new URL(`${redirectTo}?error=disconnect_failed`, request.url));
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
