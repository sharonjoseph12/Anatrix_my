// apps/web/src/app/api/sso/workos/callback/route.ts
// GET /api/sso/workos/callback?code=<code>&state=<state>
//
// SESSION CREATION APPROACH (v1):
// -------------------------------
// WorkOS does not issue Supabase-compatible JWTs natively (see research D4).
// We use the documented Supabase pattern:
//
//   1. supabase.auth.admin.generateLink({ type: "magiclink", email, options })
//      -> creates the auth.users row if missing, returns an action_link whose
//         query string contains a `token` (= token_hash) and a `type`.
//   2. Upsert public.users (display_name, role) and institution_members
//      using the service-role client.
//   3. Parse the token_hash from the action_link and call
//      supabase.auth.verifyOtp({ token_hash, type: "magiclink" }) on the
//      cookie-aware server client. The @supabase/ssr `setAll` callback
//      writes the session cookies into next/headers cookies() — these
//      cookies are attached to the 302 redirect that follows.
//   4. 302 redirect to the role-appropriate dashboard.
//
// This is the simplest path that works with the existing Supabase SSR
// setup, produces a real Supabase auth session, and avoids the browser
// ever having to hit the *.supabase.co domain. We never auto-create
// accounts without a resolvable role; if deriveRoleAndInstitution returns
// a value outside the allowlist, we 401 (FAIL CLOSED per spec FR-SSO-006).

import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import {
  deriveRoleAndInstitution,
  exchangeCode,
  type WorkOsProfile,
  type DerivedRole,
} from "@/lib/sso/workos";

const KNOWN_ROLES: ReadonlySet<DerivedRole> = new Set<DerivedRole>([
  "student",
  "faculty",
  "placement_officer",
  "admin",
]);

const KNOWN_PLATFORM_ROLES: ReadonlySet<"student" | "placement_officer" | "recruiter" | "admin"> =
  new Set(["student", "placement_officer", "recruiter", "admin"]);

function dashboardForRole(role: DerivedRole): string {
  switch (role) {
    case "student":
      return "/dashboard";
    case "admin":
    case "placement_officer":
      return "/college/dashboard";
    case "faculty":
      return "/college/dashboard";
    default:
      return "/";
  }
}

function platformRoleFor(role: DerivedRole): "student" | "placement_officer" | "recruiter" | "admin" {
  // platform_role enum (001_users.sql): student, placement_officer, recruiter, admin.
  // Faculty aren't in the enum; we collapse them to "student" for the public.users
  // row. Their institution_members row still carries role="faculty".
  if (role === "faculty") return "student";
  if (role === "placement_officer" || role === "admin") return role;
  return "student";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return NextResponse.json(
      { error: "sso_error", detail: oauthError },
      { status: 400 },
    );
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  // state = institution_slug (set by getAuthorizationUrl). It is not
  // cryptographic — the real protection is the single-use WorkOS code.
  const slug = state;

  const admin = createSupabaseServiceClient();

  const { data: institution } = await admin
    .from("institutions")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!institution) {
    return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  }
  const institutionId = (institution as { id: string }).id;

  const { data: sso } = await admin
    .from("sso_connections")
    .select("institution_id,idp_type,status")
    .eq("institution_id", institutionId)
    .eq("status", "active")
    .maybeSingle();
  if (!sso) {
    return NextResponse.json({ error: "SSO not configured" }, { status: 404 });
  }
  const ssoRow = sso as { institution_id: string; idp_type: string | null; status: string };

  let exchange: { profile: WorkOsProfile; access_token: string };
  try {
    exchange = await exchangeCode(code);
  } catch (err) {
    return NextResponse.json(
      { error: "WorkOS exchange failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }

  const { profile } = exchange;
  if (!profile.email) {
    return NextResponse.json({ error: "Profile missing email" }, { status: 400 });
  }

  const derived = deriveRoleAndInstitution(profile, ssoRow);
  if (!derived.role || !KNOWN_ROLES.has(derived.role)) {
    // FAIL CLOSED (FR-SSO-006)
    return NextResponse.json(
      { error: "Role attribute missing or invalid" },
      { status: 401 },
    );
  }
  const role: DerivedRole = derived.role;
  const platformRole = platformRoleFor(role);
  if (!KNOWN_PLATFORM_ROLES.has(platformRole)) {
    return NextResponse.json({ error: "Role mapping failed" }, { status: 401 });
  }

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
    profile.email.split("@")[0] ||
    "SSO User";

  // 1) Ensure the auth.users row exists and obtain a token_hash.
  //    generateLink auto-creates the user with email_confirm: true.
  const doneUrl = new URL("/sso/done", url.origin).toString();
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
    options: {
      redirectTo: doneUrl,
      data: { display_name: displayName, role, institution_id: institutionId },
    },
  });
  if (linkErr || !link?.properties?.action_link) {
    return NextResponse.json(
      { error: "Failed to issue session", detail: linkErr?.message ?? "no_action_link" },
      { status: 500 },
    );
  }

  // 2) Resolve the auth user id and upsert public.users + institution_members.
  //    generateLink() is documented to create the auth.users row if missing,
  //    so by this point the user exists; we look it up via listUsers (Supabase
  //    JS v2 doesn't expose getUserByEmail directly).
  const { data: userList, error: lookupErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (lookupErr) {
    return NextResponse.json(
      { error: "Failed to resolve auth user", detail: lookupErr.message },
      { status: 500 },
    );
  }
  const authUser = userList?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === profile.email.toLowerCase(),
  );
  if (!authUser) {
    return NextResponse.json(
      { error: "Auth user not found after generateLink" },
      { status: 500 },
    );
  }
  const authUserId = authUser.id;

  const { error: usersErr } = await admin
    .from("users")
    .upsert(
      {
        id: authUserId,
        email: profile.email,
        display_name: displayName,
        role: platformRole,
      },
      { onConflict: "id" },
    );
  if (usersErr) {
    return NextResponse.json({ error: "User upsert failed", detail: usersErr.message }, { status: 500 });
  }

  const { error: memberErr } = await admin
    .from("institution_members")
    .upsert(
      {
        institution_id: institutionId,
        user_id: authUserId,
        role,
      },
      { onConflict: "institution_id,user_id" },
    );
  if (memberErr) {
    return NextResponse.json(
      { error: "Institution member upsert failed", detail: memberErr.message },
      { status: 500 },
    );
  }

  // 3) Verify the magic link server-side and set session cookies.
  let actionUrl: URL;
  try {
    actionUrl = new URL(link.properties.action_link);
  } catch {
    return NextResponse.json({ error: "Invalid action_link" }, { status: 500 });
  }
  const tokenHash = actionUrl.searchParams.get("token");
  if (!tokenHash) {
    return NextResponse.json({ error: "Missing token_hash" }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (verifyErr) {
    return NextResponse.json(
      { error: "Session verify failed", detail: verifyErr.message },
      { status: 500 },
    );
  }

  // 4) Redirect to the role-appropriate dashboard.
  return NextResponse.redirect(new URL(dashboardForRole(role), url.origin), 302);
}
