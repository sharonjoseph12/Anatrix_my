import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const githubIdentity = user.identities?.find((i) => i.provider === "github");
  if (!githubIdentity) return NextResponse.json({ error: "Not linked in Supabase" }, { status: 400 });

  const githubIdStr =
    githubIdentity.identity_data?.provider_id ??
    githubIdentity.identity_data?.sub ??
    "0";
  const githubId = parseInt(String(githubIdStr), 10);
  const username =
    githubIdentity.identity_data?.user_name ??
    githubIdentity.identity_data?.preferred_username ??
    "unknown";

  if (!githubId) {
    return NextResponse.json({ error: "Invalid GitHub identity" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const { data: existing } = await service
    .from("github_accounts")
    .select("access_token_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  const providerToken = session?.provider_token;
  const upsertPayload: Record<string, unknown> = {
    user_id: user.id,
    github_id: githubId,
    username,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  if (providerToken) {
    upsertPayload.access_token_encrypted = providerToken;
    upsertPayload.refresh_token_encrypted = session?.provider_refresh_token ?? null;
    upsertPayload.scope = "read:user user:email repo";
  } else if (!existing?.access_token_encrypted) {
    return NextResponse.json(
      { error: "GitHub token missing — reconnect GitHub from settings" },
      { status: 400 },
    );
  }

  const { error } = await service
    .from("github_accounts")
    .upsert(upsertPayload, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await service.functions.invoke("github-sync-fast", {
      body: { user_id: user.id, mode: "day_one" },
    });
  } catch {
    // Non-fatal: row exists; background cron can retry.
  }

  return NextResponse.json({ success: true });
}
