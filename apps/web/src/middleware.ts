import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SUBDOMAIN_HEADER = "x-antarix-subdomain";

const SUBDOMAIN_MAP: Record<string, string> = {
  "": "/",
  "www": "/",
  "college": "/college",
  "recruiting": "/company",
  "app": "/dashboard",
};

// System prefixes that must NEVER be treated as public-profile slugs.
const SYSTEM_PREFIXES = [
  "/_next",
  "/api",
  "/favicon",
  "/robots",
  "/sitemap",
  "/assets",
  "/static",
  "/dashboard",
  "/onboarding",
  "/settings",
  "/college",
  "/company",
  "/verify",
  "/login",
  "/signup",
  "/callback",
  "/u",          // canonical public-profile path
  "/about",
  "/pricing",
  "/contact",
  "/help",
  "/legal",
  "/privacy",
  "/terms",
  "/college-signup",
  "/company-signup",
  "/applications",
  "/search",
  "/pipeline",
  "/analytics",
  "/ai-coach",
  "/credential",
  "/talent-twin",
];

function getSubdomain(host: string | null): string {
  if (!host) return "";
  const hostname = host.split(":")[0] ?? "";
  if (hostname === "localhost" || /^127\.0\.0\.1$/.test(hostname)) return "";
  const parts = hostname.split(".");
  if (parts.length < 2) return "";
  return parts[0] ?? "";
}

/** Slug pattern: 3-40 chars, lowercase, alphanumeric + dash, no leading/trailing dash. */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host");
  const subdomain = getSubdomain(host);
  const target = SUBDOMAIN_MAP[subdomain];

  const requestHeaders = new Headers(request.headers);
  if (target !== undefined) {
    requestHeaders.set(SUBDOMAIN_HEADER, target);
  }

  // Public profile rewrite: /<slug> → /u/<slug>
  // Only fires on top-level paths (no slashes) that look like a slug.
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 1) {
    const candidate = segments[0]!;
    if (SLUG_PATTERN.test(candidate) && !SYSTEM_PREFIXES.includes(`/${candidate}`)) {
      const rewrite = url.clone();
      rewrite.pathname = `/u/${candidate}`;
      return NextResponse.rewrite(rewrite, { request: { headers: requestHeaders } });
    }
  }

  const response: NextResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options as never);
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const protectedPaths = ["/dashboard", "/onboarding", "/settings", "/college", "/company"];
  const isProtected = protectedPaths.some((path) => url.pathname.startsWith(path));

  if (isProtected && !user) {
    const redirect = url.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", url.pathname);
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
