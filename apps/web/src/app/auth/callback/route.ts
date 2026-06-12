import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const errorParam = url.searchParams.get("error_description");

  if (errorParam) {
    if (errorParam.includes("already linked")) {
      // Identity is linked, but github_accounts might be missing. Redirect back to github page to trigger sync.
      return NextResponse.redirect(new URL("/dashboard/github?sync=true", url.origin));
    }
    if (next && next.includes("github")) {
      return NextResponse.redirect(new URL(`${next}?error=${encodeURIComponent(errorParam)}`, url.origin));
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorParam)}`, url.origin));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const githubIdentity = sessionData?.user?.identities?.find((i) => i.provider === "github");
      const providerToken = sessionData?.session?.provider_token;
      
      if (githubIdentity && providerToken) {
        try {
          const service = createSupabaseServiceClient();
          const userId = sessionData.user.id;
          
          const githubIdStr = githubIdentity.identity_data?.provider_id || githubIdentity.identity_data?.sub || "0";
          const githubId = parseInt(githubIdStr, 10);
          const username = githubIdentity.identity_data?.user_name || githubIdentity.identity_data?.preferred_username || "github_user";

          if (githubId) {
            const { error: upsertError } = await service
              .from("github_accounts")
              .upsert({
                user_id: userId,
                github_id: githubId,
                username: username,
                access_token_encrypted: providerToken,
                refresh_token_encrypted: sessionData.session?.provider_refresh_token || null,
                scope: "read:user user:email repo",
                status: "active",
                updated_at: new Date().toISOString(),
              }, { onConflict: "user_id" });

            if (!upsertError) {
              await service.functions.invoke("github-sync-fast", {
                body: { user_id: userId, mode: "day_one" },
              });
            } else {
              console.error("github_accounts upsert failed:", upsertError);
            }
          }
        } catch (e) {
          console.error("github-sync-fast enqueue failed", e);
        }
      } else if (!providerToken && githubIdentity) {
        // If providerToken is missing but identity exists, the user might be re-authenticating.
        // Try triggering sync just in case.
        try {
          const service = createSupabaseServiceClient();
          const userId = sessionData.user.id;
          const { data: gh } = await service.from("github_accounts").select("id").eq("user_id", userId).maybeSingle();
          if (gh) {
            await service.functions.invoke("github-sync-fast", {
              body: { user_id: userId, mode: "day_one" },
            });
          }
        } catch (e) {}
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  return NextResponse.redirect(new URL("/login", url.origin));
}
