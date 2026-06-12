import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Direct GitHub OAuth flow — bypasses Supabase linkIdentity entirely.
 * This avoids the "identity_already_exists" loop that linkIdentity causes
 * when the identity row exists but github_accounts was never populated.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/dashboard/github";

  // Ensure user is logged in
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL(`/dashboard/github?error=${encodeURIComponent("GITHUB_CLIENT_ID not configured")}`, url.origin)
    );
  }

  // Generate a random state param to prevent CSRF
  const state = crypto.randomBytes(16).toString("hex");

  // Store state + user_id + next in a cookie so the callback can verify
  const cookieStore = await cookies();
  cookieStore.set("github_oauth_state", JSON.stringify({ state, userId: user.id, next }), {
    httpOnly: true,
    secure: false, // local dev
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  const redirectUri = `${url.origin}/api/integrations/github/callback`;
  const scopes = "read:user user:email repo";

  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
  githubAuthUrl.searchParams.set("client_id", clientId);
  githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
  githubAuthUrl.searchParams.set("scope", scopes);
  githubAuthUrl.searchParams.set("state", state);

  return NextResponse.redirect(githubAuthUrl.toString());
}
