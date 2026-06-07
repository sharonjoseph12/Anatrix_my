import "server-only";

// apps/web/src/lib/sso/workos.ts
// T-SSO-001..006 — WorkOS SAML broker wrapper.
//
// D4 (research): WorkOS is the SAML 2.0 IdP broker. The @workos-inc/node
// SDK is added to apps/web/package.json. We keep the import lazy so a
// missing SDK produces a clear runtime error rather than a compile-time
// one (handy for environments where the SDK hasn't been installed yet).

export interface WorkOsProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  organization_id?: string;
  raw_attributes?: Record<string, unknown>;
}

let workosClient: unknown = null;

async function getClient(): Promise<unknown> {
  if (workosClient) return workosClient;
  if (!process.env.WORKOS_API_KEY) {
    throw new Error("WORKOS_API_KEY is not set");
  }
  try {
    const mod = (await import("@workos-inc/node")) as unknown as {
      WorkOS: new (apiKey?: string) => unknown;
    };
    workosClient = new mod.WorkOS(process.env.WORKOS_API_KEY);
  } catch {
    throw new Error(
      "WorkOS SDK is not installed. Run `pnpm install` in apps/web to add @workos-inc/node.",
    );
  }
  return workosClient;
}

export async function getAuthorizationUrl(
  institutionSlug: string,
  connectionId: string,
): Promise<string> {
  if (!process.env.WORKOS_CLIENT_ID) throw new Error("WORKOS_CLIENT_ID is not set");
  if (!process.env.WORKOS_REDIRECT_URI) throw new Error("WORKOS_REDIRECT_URI is not set");
  const client = (await getClient()) as {
    sso: {
      getAuthorizationUrl: (opts: {
        connection: string;
        clientId: string;
        redirectUri: string;
        state: string;
      }) => Promise<string> | string;
    };
  };
  return client.sso.getAuthorizationUrl({
    connection: connectionId,
    clientId: process.env.WORKOS_CLIENT_ID,
    redirectUri: process.env.WORKOS_REDIRECT_URI,
    state: institutionSlug,
  });
}

export async function exchangeCode(
  code: string,
): Promise<{ profile: WorkOsProfile; access_token: string }> {
  if (!process.env.WORKOS_CLIENT_ID) throw new Error("WORKOS_CLIENT_ID is not set");
  const client = (await getClient()) as {
    sso: {
      authenticateWithCode: (opts: {
        clientId: string;
        code: string;
      }) => Promise<unknown>;
    };
  };
  const result = (await client.sso.authenticateWithCode({
    clientId: process.env.WORKOS_CLIENT_ID,
    code,
  })) as {
    user?: {
      id?: string;
      email?: string;
      firstName?: string;
      first_name?: string;
      lastName?: string;
      last_name?: string;
      organizationId?: string;
      organization_id?: string;
      rawAttributes?: Record<string, unknown>;
      raw_attributes?: Record<string, unknown>;
    };
    accessToken?: string;
    access_token?: string;
  };
  const u = result?.user ?? {};
  return {
    profile: {
      id: u.id ?? "",
      email: u.email ?? "",
      first_name: u.firstName ?? u.first_name,
      last_name: u.lastName ?? u.last_name,
      organization_id: u.organizationId ?? u.organization_id,
      raw_attributes: (u.rawAttributes ?? u.raw_attributes) as Record<string, unknown> | undefined,
    },
    access_token: result?.accessToken ?? result?.access_token ?? "",
  };
}

export type DerivedRole = "student" | "faculty" | "placement_officer" | "admin";

const ALLOWED_ROLES: ReadonlySet<DerivedRole> = new Set<DerivedRole>([
  "student",
  "faculty",
  "placement_officer",
  "admin",
]);

/**
 * Map a WorkOS profile to an Antarix role + institution_id.
 *
 * 1. If the IdP sends a `role` attribute, use it (allowlist of student /
 *    faculty / placement_officer / admin).
 * 2. Otherwise fall back to a default derived from the email domain:
 *      .edu or .ac.in -> student
 *      anything else  -> admin (treated as a college admin / placement officer)
 *
 * The result is always a valid role string; the route handler does an
 * additional defence-in-depth check and fails closed (401) if the value
 * is somehow not in the allowlist (which should be impossible given the
 * logic above, but we keep the check for safety).
 */
export function deriveRoleAndInstitution(
  profile: WorkOsProfile,
  ssoConnection: { institution_id: string; idp_type: string | null },
): { role: DerivedRole; institution_id: string } {
  const attrRole = (profile.raw_attributes as Record<string, unknown> | undefined)?.role;
  let role: DerivedRole | null = null;
  if (typeof attrRole === "string" && ALLOWED_ROLES.has(attrRole as DerivedRole)) {
    role = attrRole as DerivedRole;
  } else {
    const email = (profile.email ?? "").toLowerCase();
    if (email.endsWith(".edu") || email.endsWith(".ac.in")) {
      role = "student";
    } else {
      role = "admin";
    }
  }
  return { role: ALLOWED_ROLES.has(role) ? role : "admin", institution_id: ssoConnection.institution_id };
}
