# Antarix SEO infrastructure

> **What this covers.** The four SEO surfaces we own (`sitemap.xml`,
> `robots.txt`, page-level meta tags, and per-page JSON-LD structured
> data), the JSON-LD snippets every public page should emit, the
> canonicalization and `hreflang` rules, the five-tier URL priority
> scale, the maintenance plan, the explicit list of things we
> deliberately do NOT do, and the open items we are deferring to v2.
> This is the source of truth for SEO so marketing, front-end, and
> infrastructure all work off the same playbook.

## 1. The 4 SEO surfaces

Antarix has exactly four surfaces that the rest of the SEO strategy
hangs off. They have separate owners and update cadences.

| # | Surface | File | Owner | Cadence |
|---|---|---|---|---|
| 1 | `sitemap.xml` | `apps/web/public/sitemap.xml` | marketing | weekly hand-edit, daily in v2 |
| 2 | `robots.txt` | `apps/web/public/robots.txt` | platform | per-need; tied to a route being added/removed |
| 3 | Page-level meta tags (title, description, OG, Twitter) | inside each `app/<route>/page.tsx` | front-end | per-page PR |
| 4 | Structured data / JSON-LD | inside each page's React tree, or in a shared `<SeoJsonLd>` component | front-end | per-page PR |

Surfaces 1 and 2 are static files in the Next.js public root, served
at `https://antarix.app/sitemap.xml` and `https://antarix.app/robots.txt`
with zero build step. Surfaces 3 and 4 are owned per-page because the
copy is page-specific — the goal of this doc is to make those per-page
choices uniform, not to centralize the data.

## 2. `robots.txt` policy

The full file is at `apps/web/public/robots.txt`. The policy in one
paragraph: **allow all crawlers by default, and disallow four classes
of paths** that are either authed, internal, or noise. The disallowed
classes are Next.js API routes (`/api/`), Supabase Edge Functions
(`/functions/v1/`), every authed surface (`/dashboard/`, `/admin/`,
`/settings/`), the slug-based credential pages under `/u/*` (recruiters
arrive at credentials via the explicit `/verify/<slug>` route; the
`/u/*` shortlinks are noise in a SERP), and Next.js build artifacts
(`*.json$`). Everything else — including the public marketing pages,
help center, security pages, API docs, status page, and verify pages —
is allowed. The `Sitemap:` and `Host:` directives are present so
search engines can find the sitemap and confirm the canonical host.

## 3. The 4 JSON-LD snippets every public page should emit

We standardize on four JSON-LD types. Page authors should pick the
one(s) that match the page and emit them inside a single
`<script type="application/ld+json">` block at the top of the React
tree so Google's Rich Results Test can find them.

### 3.1 `Organization` — on the home page

The canonical "this is who we are" block. Includes a `sameAs` array
for the social profiles we actually run, and a `contactPoint` for
sales (not support, not security — those have their own inboxes).

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Antarix",
  "url": "https://antarix.app",
  "logo": "https://antarix.app/logo.png",
  "sameAs": [
    "https://github.com/antarix",
    "https://www.linkedin.com/company/antarix",
    "https://x.com/antarix"
  ],
  "contactPoint": [{
    "@type": "ContactPoint",
    "contactType": "sales",
    "email": "sales@antarix.app",
    "availableLanguage": ["English", "Hindi"]
  }]
}
```

### 3.2 `SoftwareApplication` — on the home page, after `Organization`

Tells Google the home page is a software product, not a content page.
This unloves rich results like the "Software Application" badge in
search snippets. v1 is free for students, so the `offers` price is `0`.

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Antarix",
  "applicationCategory": "EducationalApplication",
  "operatingSystem": "Web, Chrome, iOS, Android",
  "offers": { "price": "0", "priceCurrency": "USD" }
}
```

### 3.3 `FAQPage` — on the public FAQ page

Auto-generated at build time from `docs/marketing/faq.md` (24
questions: 8 students, 8 recruiters, 8 colleges, 3 general). The
generator reads the H3 question lines and the first paragraph of each
answer and emits one `Question`/`AcceptedAnswer` pair per item. The
generator is a small Node script under `scripts/build-faq-jsonld.ts`
(not yet committed — out of scope v1 docs-only work, but the
contract is stable).

### 3.4 `Course` — on credential public pages

The public `/verify/<slug>` page emits a `Course` schema. We picked
`Course` (a CreativeWork subtype) over the newer
`EducationalOccupationalCredential` type because the latter is still
in draft at the W3C Schema.org Community Group and not yet in
Google's supported rich-results set. We will migrate when it
stabilizes. v2.

```json
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "Antarix Skill Proof",
  "provider": { "@type": "Organization", "name": "Antarix" },
  "hasCourseInstance": {
    "@type": "CourseInstance",
    "courseMode": "online",
    "instructor": { "@type": "Organization", "name": "Antarix" }
  }
}
```

## 4. Page-level meta tag template

Every public page should use this block of JSX inside the page
component, in the order shown. Title ≤60 chars, description ≤155
chars, canonical URL, OpenGraph, Twitter Card. The same template
applies to the legal pages, help center, security pages, pricing, and
signup.

```tsx
export const metadata: Metadata = {
  title: "<Page title — ≤60 chars>",        // e.g. "Antarix pricing"
  description: "<≤155-char description>",  // e.g. "Free for students. ..."
  alternates: {
    canonical: "https://antarix.app/<path>",       // no trailing slash
    languages: {
      en: "https://antarix.app/en<path>",
      hi: "https://antarix.app/hi<path>",
    },
  },
  openGraph: {
    title: "<≤60 chars>",
    description: "<≤155 chars>",
    url: "https://antarix.app/<path>",
    siteName: "Antarix",
    images: [{ url: "https://antarix.app/og/<page>.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "<≤60 chars>",
    description: "<≤155 chars>",
    images: ["https://antarix.app/og/<page>.png"],
  },
};
```

Front-end engineers should keep titles to ≤60 characters and
descriptions to ≤155 because that is the truncation point in both
Google SERPs and the OpenGraph preview in Slack/LinkedIn. Going over
does not hurt ranking, but the truncation looks sloppy.

## 5. Image strategy

Every public page gets an OpenGraph image at `/og/<page>.png` (1200×630
PNG, ≤200 KB, sRGB). The image is generated by a future Edge Function
`og-image-generator` (out of scope v1) that takes the page slug, pulls
the title/description from the i18n catalog, and renders a brand-on
template. Until that ships, the home page reuses `/og/home.png` and
the other pages reuse a single fallback at `/og/default.png` — both
of which are committed under `apps/web/public/og/` and sized to the
1200×630 spec.

OG images matter for the credibility of shared links in Slack,
LinkedIn, and X. Recruiters and college placement officers are the
ones who will click a shared credential link, and the snippet is
their first impression.

## 6. Canonicalization rules

Four rules. They are applied by the edge (Vercel rewrites) before
any HTML is served, so a user typing `https://Antarix.app/Pricing`
gets a 301 to `https://antarix.app/pricing`.

1. **Trailing slash: no slash.** `/pricing` not `/pricing/`. The
   Next.js `trailingSlash: false` config enforces this.
2. **Lowercase.** Every URL segment is lowercased before comparison.
3. **No query params in the canonical.** Tracking params (`utm_*`,
   `fbclid`, `gclid`) are stripped from the canonical link but kept on
   the inbound request for analytics attribution. The
   `searchParams.get` filter is in `apps/web/src/middleware.ts`.
4. **No hash fragments in the canonical.** Hashes are for in-page
   anchors only; the canonical points at the document.

## 7. `hreflang` for the 2 launch locales

We ship two locales at launch: `en` (default) and `hi`. The default
URL has no prefix; the localized URLs are prefixed `/en` and `/hi`.
Every public page emits the three `hreflang` links in its
`alternates.languages` block (see §4).

```html
<link rel="alternate" hreflang="en" href="https://antarix.app/en<path>">
<link rel="alternate" hreflang="hi" href="https://antarix.app/hi<path>">
<link rel="alternate" hreflang="x-default" href="https://antarix.app<path>">
```

The `x-default` is the unprefixed URL — it tells Google "this is the
canonical English fallback if the user's locale does not match any
explicit entry." Future locales (`bn`, `ta`, `te`, `mr`, `es`, `pt-BR`,
`fr`) are queued for v2; see the open-items list at the end.

## 8. The 5-tier indexable URL priority

Every public URL gets a priority between 0.0 and 1.0, and a
`changefreq` value. The values are tuned so Googlebot visits the
high-traffic, high-change pages (home, pricing, signup) aggressively
and the low-change, low-traffic pages (status, threat model) on a
sane cadence. The full table is in the sitemap; the gist is:

| Priority | Examples | Why |
|---|---|---|
| 1.0 | `/` | Home page, the SERP entry. Crawl daily. |
| 0.9 | `/pricing` | Highest commercial intent; weekly is fine because prices change ~quarterly. |
| 0.8 | `/signup`, `/company/signup`, `/institution/signup` | Conversion surface; weekly is correct (page copy is stable). |
| 0.7 | `/help/*`, `/api-docs` | Discovery surfaces; weekly. |
| 0.5 | `/legal/*`, `/security/vdp`, `/help/glossary` | Low-traffic, low-change. Monthly. |
| 0.4 | `/security/threat-model`, `/status` | Quarterly / hourly. The status page is `hourly` only so SEO bots see it exists — the body does not actually change on a fast cycle (the data endpoint has its own 60s cache). |

`0.0` is reserved for deliberately hidden pages and is not used in
the sitemap; if a page should not be indexed, the right tool is
`robots.txt` (`Disallow:`) or a `<meta name="robots" content="noindex">`
on the page itself, not a 0.0 priority.

## 9. Maintenance

The sitemap is **hand-edited today**. When a new public route ships,
the engineer adds a `<url>` block to `apps/web/public/sitemap.xml`
with the route, a `lastmod` of "today," the correct `changefreq`, and
the correct `priority` per the table in §8. The PR review is the
quality gate.

In v2, an Edge Function `sitemap-generator` will regenerate the
sitemap daily by querying a `public_routes` table. The table is
populated by a one-line trigger on every new `pages` insert, and the
sitemaps generated are written back to `apps/web/public/sitemap.xml`
by a nightly cron at 03:00 UTC. Until that ships, the hand-edit
process is fine — there are 48 URLs and the rate of change is
roughly one new URL per week.

`robots.txt` is updated per-need. It does not get regenerated.

## 10. What NOT to do

- **Don't `noindex` the public dashboard pages.** They are behind
  auth, so Googlebot cannot reach them anyway; adding a `noindex`
  meta tag is a code smell that hides the fact that auth is doing
  the work. Same for `/admin/`, `/settings/`, `/api/`,
  `/functions/v1/` — they are disavowed in `robots.txt` for the same
  reason: deny at the edge, do not tag the page.
- **Don't `noindex` the verify pages.** Recruiters find credentials
  via shared links (LinkedIn, email, WhatsApp). We want those pages
  crawlable, with the `Course` JSON-LD, so they show up in brand and
  name searches.
- **Don't add `noarchive`.** We want Google's cache links to work —
  they are a credibility signal for someone evaluating a credential.
- **Don't submit the sitemap to Google until production.** The home
  page should be `production-only`; staging (`staging.antarix.app`)
  carries `<meta name="robots" content="noindex,nofollow">` on every
  page via a Next.js environment-conditional in the root layout.
  Submitting a staging sitemap to Google gets us soft-404'd on every
  URL and is hard to recover from.
- **Don't put per-engineer or per-UA overrides in `robots.txt`.** A
  long `User-agent: Googlebot-Image` block or a `Crawl-delay:` is a
  smell. If we need to throttle a particular bot, it is a WAF rule
  on the edge, not a robots.txt directive.

## 11. Open items

These are tracked but explicitly out of scope for v1.

- **Image sitemap.** A second sitemap at `/sitemap-image.xml`
  listing every public OG image. Useful when we have 50+ public OG
  images, not before.
- **News sitemap.** Useful if/when we have a blog with time-sensitive
  posts. Not in v1.
- **More `hreflang` locales.** The 7-locale queue is `bn`, `ta`, `te`,
  `mr`, `es`, `pt-BR`, `fr` — roughly ordered by traffic expectation
  and Hindi-speaking market adjacency. The 8th locale `x-default` is
  already wired.
- **Core Web Vitals budget.** The marketing site is a separate
  performance concern from the app. The budget is LCP ≤ 2.5s, FID
  ≤ 100ms, CLS ≤ 0.1 — measured via the Chrome User Experience
  report once we have enough traffic to be in the cohort.
- **`og-image-generator` Edge Function.** Already in §5. Deno, not
  yet implemented. Until it ships, the fallback `/og/default.png`
  pattern works.
- **`sitemap-generator` Edge Function.** Already in §9. Same status.
- **`<SeoJsonLd>` shared component.** A small wrapper that takes a
  `type` prop and serializes the right JSON-LD block. Reduces the
  per-page boilerplate from 4 snippets to 1 import + 1 tag.
