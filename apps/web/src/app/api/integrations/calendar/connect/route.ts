import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/dashboard";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const options = {
    redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    scopes:
      "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email",
    queryParams: { access_type: "offline", prompt: "consent" },
  };

  const { data, error } = user
    ? await supabase.auth.linkIdentity({ provider: "google", options })
    : await supabase.auth.signInWithOAuth({ provider: "google", options });

  if (error) {
    return NextResponse.redirect(
      new URL(`${next}?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  if (data.url) {
    return NextResponse.redirect(data.url);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
