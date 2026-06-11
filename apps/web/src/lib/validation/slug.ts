// apps/web/src/lib/validation/slug.ts
// T009 — Slug validation + reserved list. Matches the regex in
// research.md D3 (3-40 chars, lowercase a-z, 0-9, dash, no leading/trailing
// dash). Server-side mirror of the client check.

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

const RESERVED = new Set<string>([
  "admin",
  "login",
  "signup",
  "dashboard",
  "college",
  "company",
  "verify",
  "settings",
  "api",
  "_next",
  "onboarding",
  "about",
  "pricing",
  "contact",
  "help",
  "legal",
  "privacy",
  "terms",
  "static",
  "public",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "u",
  "callback",
  "applications",
  "search",
  "results",
  "pipeline",
  "analytics",
  "ai-coach",
  "credential",
]);

export function isValidSlug(slug: string): boolean {
  if (!slug) return false;
  if (slug.length < 3 || slug.length > 40) return false;
  if (!SLUG_REGEX.test(slug)) return false;
  if (RESERVED.has(slug)) return false;
  return true;
}

export const SLUG_HINT =
  "3-40 characters, lowercase letters, digits, or dashes. Must start and end with a letter or digit.";
