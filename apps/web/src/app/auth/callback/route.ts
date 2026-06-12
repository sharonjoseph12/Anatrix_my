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
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorParam)}`, url.origin));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // T026 — Day-1 value: if the user just connected GitHub, immediately enqueue
      // a fast GitHub sync so the dashboard lands populated, not empty.
      // Detection: Supabase puts the provider in the session's user.app_metadata.provider.
      const { data: userData } = await supabase.auth.getUser();
      const provider = (userData?.user?.app_metadata as { provider?: string } | undefined)?.provider;
      if (provider === "github") {
        try {
          const service = createSupabaseServiceClient();
          const userId = userData?.user?.id;
          if (userId) {
            const { data: gh } = await service
              .from("github_accounts")
              .select("id")
              .eq("user_id", userId)
              .maybeSingle();
            if (gh) {
              // Fire-and-forget; the dashboard reads whatever has landed by render time.
              await service.functions.invoke("github-sync-fast", {
                body: { user_id: userId, mode: "day_one" },
              });
            }
          }
        } catch (e) {
          // Non-blocking: the recurring github-sync cron will pick this up within 2h.
          console.error("github-sync-fast enqueue failed", e);
        }
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  return NextResponse.redirect(new URL("/login", url.origin));
}
