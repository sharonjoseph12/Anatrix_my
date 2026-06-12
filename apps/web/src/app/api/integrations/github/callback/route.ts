import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

/**
 * GitHub OAuth callback — exchanges the code for an access token directly
 * with GitHub's API, then upserts into github_accounts.
 * 
 * This completely bypasses Supabase Auth identity linking.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const desc = url.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      new URL(`/dashboard/github?error=${encodeURIComponent(desc)}`, url.origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/github?error=missing_code_or_state", url.origin)
    );
  }

  // Verify state from cookie
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("github_oauth_state");
  if (!stateCookie) {
    return NextResponse.redirect(
      new URL("/dashboard/github?error=missing_state_cookie", url.origin)
    );
  }

  let savedState: { state: string; userId: string; next: string };
  try {
    savedState = JSON.parse(stateCookie.value);
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/github?error=invalid_state_cookie", url.origin)
    );
  }

  // Clear the cookie
  cookieStore.delete("github_oauth_state");

  if (savedState.state !== state) {
    return NextResponse.redirect(
      new URL("/dashboard/github?error=state_mismatch", url.origin)
    );
  }

  // Exchange code for access token directly with GitHub
  const clientId = process.env.GITHUB_CLIENT_ID!;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET!;

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL(`/dashboard/github?error=${encodeURIComponent("Failed to exchange code with GitHub")}`, url.origin)
    );
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    const errMsg = tokenData.error_description ?? tokenData.error ?? "no_access_token";
    return NextResponse.redirect(
      new URL(`/dashboard/github?error=${encodeURIComponent(errMsg)}`, url.origin)
    );
  }

  // Fetch GitHub user info
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(
      new URL(`/dashboard/github?error=${encodeURIComponent("Failed to fetch GitHub user")}`, url.origin)
    );
  }

  const ghUser = await userRes.json();

  // Upsert into github_accounts
  const service = createSupabaseServiceClient();
  const { error: upsertError } = await service
    .from("github_accounts")
    .upsert(
      {
        user_id: savedState.userId,
        github_id: ghUser.id,
        username: ghUser.login,
        access_token_encrypted: accessToken,
        refresh_token_encrypted: tokenData.refresh_token ?? null,
        scope: tokenData.scope ?? "read:user user:email repo",
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("github_accounts upsert failed:", upsertError);
    return NextResponse.redirect(
      new URL(`/dashboard/github?error=${encodeURIComponent(upsertError.message)}`, url.origin)
    );
  }

  // Fire-and-forget sync
  try {
    await service.functions.invoke("github-sync-fast", {
      body: { user_id: savedState.userId, mode: "day_one" },
    });
  } catch (e) {
    // Non-blocking
    console.error("github-sync-fast failed:", e);
  }

  return NextResponse.redirect(new URL(savedState.next, url.origin));
}
