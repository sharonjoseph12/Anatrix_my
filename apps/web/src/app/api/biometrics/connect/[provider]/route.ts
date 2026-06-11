// apps/web/src/app/api/biometrics/connect/[provider]/route.ts
// Spec: specs/006-deep-signal-capture/spec.md US2 (FR-BIO-001, FR-BIO-007)
//   contracts/api.md → POST /api/biometrics/connect/{provider}
// provider: "oura" or "whoop" (healthkit/google_fit are mobile-handled).
// Generates a PKCE state + code_verifier, stores them in HTTP-only
// cookies (10-min TTL), and 302-redirects the browser to the provider's
// authorize URL.

import { NextResponse } from "next/server";
import { OuraClient, generatePkceState, OURA_OAUTH_SCOPES } from "@/lib/biometrics/oura-client";
import { WhoopClient, generatePkceState as whoopPkceState, WHOOP_OAUTH_SCOPES } from "@/lib/biometrics/whoop-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type OAuthProvider = "oura" | "whoop";

function isOuraProvider(p: string): p is "oura" {
  return p === "oura";
}

function isWhoopProvider(p: string): p is "whoop" {
  return p === "whoop";
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isOuraProvider(provider) && !isWhoopProvider(provider)) {
    return err("invalid_input", "provider must be oura or whoop", 400);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in to connect a biometric provider", 401);

  const rl = rateLimit({ key: `biometric-connect:${user.id}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.resetAt);

  const pkce = isOuraProvider(provider) ? generatePkceState() : whoopPkceState();
  const statePayload = JSON.stringify({ uid: user.id, p: provider, jti: pkce.state });
  const state = Buffer.from(statePayload, "utf8").toString("base64url");

  const cookieTtl = 10 * 60;
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: cookieTtl,
  };
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set("biometric_oauth_state", state, cookieOptions);
  res.cookies.set("biometric_oauth_verifier", pkce.code_verifier, cookieOptions);
  res.cookies.set("biometric_oauth_provider", provider, cookieOptions);

  if (isOuraProvider(provider)) {
    const clientId = process.env.OURA_CLIENT_ID;
    const redirectUri = process.env.OURA_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return err("not_configured", "Oura OAuth is not configured", 503);
    }
    void new OuraClient({
      clientId,
      clientSecret: process.env.OURA_CLIENT_SECRET ?? "",
      redirectUri,
    });
    const url = new URL("https://cloud.ouraring.com/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", OURA_OAUTH_SCOPES.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", pkce.code_challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return NextResponse.redirect(url, { status: 302, headers: res.headers });
  }

  const clientId = process.env.WHOOP_CLIENT_ID;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return err("not_configured", "Whoop OAuth is not configured", 503);
  }
  void new WhoopClient({
    clientId,
    clientSecret: process.env.WHOOP_CLIENT_SECRET ?? "",
    redirectUri,
  });
  const url = new URL("https://api.prod.whoop.com/oauth/oauth2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", WHOOP_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkce.code_challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return NextResponse.redirect(url, { status: 302, headers: res.headers });
}
