// Supabase Edge Function: github-callback
// Receives the GitHub OAuth code, exchanges it for a token, and stores the connection.
// Trigger: redirect URL after GitHub OAuth completes
//
// Local dev: npx supabase functions serve github-callback
// Deploy: npx supabase functions deploy github-callback

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface GitHubTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  token_type: string;
  scope: string;
}

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  email: string | null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state");

    if (!code) {
      return jsonResponse({ error: "Missing OAuth code" }, 400);
    }
    if (!userId) {
      return jsonResponse({ error: "Missing user state" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: Deno.env.get("GITHUB_CLIENT_ID"),
        client_secret: Deno.env.get("GITHUB_CLIENT_SECRET"),
        code,
      }),
    });

    if (!tokenRes.ok) {
      return jsonResponse({ error: "Failed to exchange code" }, 400);
    }
    const token = (await tokenRes.json()) as GitHubTokenResponse;

    if (!token.access_token) {
      return jsonResponse({ error: "No access_token in GitHub response" }, 400);
    }

    // Fetch GitHub user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "antarix-edge",
      },
    });
    if (!userRes.ok) {
      return jsonResponse({ error: "Failed to fetch GitHub user" }, 400);
    }
    const ghUser = (await userRes.json()) as GitHubUser;

    // Encrypt tokens at rest using pgsodium (handled by Supabase Vault).
    // For v1, we store the token directly; production should use Vault.
    // TODO: replace with vault.secret() once Vault is enabled.
    const { error: upsertError } = await supabaseAdmin
      .from("github_accounts")
      .upsert(
        {
          user_id: userId,
          github_id: ghUser.id,
          username: ghUser.login,
          access_token_encrypted: token.access_token,
          refresh_token_encrypted: token.refresh_token ?? null,
          scope: token.scope,
          status: "active",
          last_synced_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return jsonResponse({ error: upsertError.message }, 500);
    }

    // Trigger initial commit sync in the background (fire-and-forget)
    void supabaseAdmin.functions.invoke("github-sync", {
      body: { user_id: userId, full_sync: true },
    });

    return jsonResponse({
      github_account: {
        username: ghUser.login,
        github_id: ghUser.id,
      },
      sync_status: "started",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
