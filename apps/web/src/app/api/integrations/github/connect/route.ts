import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/dashboard/github";
  
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const options = {
    redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    scopes: "read:user user:email repo",
  };

  const { data, error } = user 
    ? await supabase.auth.linkIdentity({ provider: "github", options })
    : await supabase.auth.signInWithOAuth({ provider: "github", options });

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard/github?error=${encodeURIComponent(error.message)}`, url.origin));
  }

  if (data.url) {
    return NextResponse.redirect(data.url);
  }

  return NextResponse.redirect(new URL("/dashboard/github", url.origin));
}
