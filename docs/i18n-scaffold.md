# i18n Scaffold (next-intl) — Design Doc

Status: v1 (scaffold only — no page/component adoption yet).
Owner: Agent A-2. Branch: `002-antarix-definitive-vision`.
Adopting agent: owns `apps/web/src/app/**/page.tsx` and `apps/web/src/app/**/layout.tsx` — see §2 below.

---

## 1. What this scaffold is

A *non-breaking* internationalization scaffold for the Antarix web app
(`apps/web/`, Next.js 15 App Router, React 19, TypeScript). It introduces:

- Two initial locales: **English (`en`)** and **Hindi (`hi`)**.
- A flat-dotted message catalog per locale under `apps/web/messages/`.
- A small `src/i18n/` module (config, request, locale switcher).
- A `next-intl` middleware that prefixes every URL with the locale.
- A surgical wiring change in `apps/web/next.config.ts` (additive only).

No existing `page.tsx`, `layout.tsx`, or component is modified. Adoption is a
follow-up step owned by the agent that owns the page files.

---

## 2. Locale list and how to add more

Locales live in **one place**: `apps/web/src/i18n/config.ts`.

```ts
export const locales = ['en', 'hi'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const localeLabels: Record<Locale, string> = { en: 'English', hi: 'हिन्दी' };
```

To add a locale (e.g. Bengali):

1. Add `'bn'` to the `locales` array in `src/i18n/config.ts`.
2. Add a label: `bn: 'বাংলা'`.
3. Create `apps/web/messages/bn.json` with the same flat-dotted key shape as
   `en.json` / `hi.json`.

The middleware, request config, and switcher all iterate `locales` — nothing
else needs to change. If you need the new locale to be the default, also flip
`defaultLocale`. If you need RTL (Arabic, Hebrew), see §6.

---

## 3. Adopting translations in a page

Once a page is yours to edit, adoption is three lines:

```tsx
// apps/web/src/app/(student)/dashboard/page.tsx
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  return (
    <main>
      <h1>{t('welcome', { name: 'Aarav' })}</h1>
      <p>{t('skill_proof_score')}</p>
    </main>
  );
}
```

For **server components** (the App Router default), use
`getTranslations` from `next-intl/server` instead of `useTranslations` — same
namespace/key signature, no hooks needed.

Pluralization and interpolation work out of the box via ICU MessageFormat:

```ts
t('streak', { count: 3 }); // → "3 day streaks" (en) / "3 दिनों की स्ट्रीक" (hi)
t('welcome', { name: 'Aarav' }); // → "Welcome back, Aarav"
```

---

## 4. The locale switcher

`apps/web/src/i18n/locale-switcher.tsx` is a `'use client'` component
rendering a `<select>`. It uses three next-intl hooks that are all
locale-aware:

| Hook | Source | Why |
|---|---|---|
| `useRouter` | `next-intl` | Wraps `next/navigation`; automatically re-prefixes routes. |
| `usePathname` | `next-intl` | Returns the path **with the locale prefix stripped**, so we can re-prefix under the new locale. |
| `useLocale` | `next-intl` | The currently-active locale (for the `value` of the select). |

To adopt: drop `<LocaleSwitcher />` anywhere a user-visible control is
welcome (top nav, settings, footer). The component is unstyled beyond
minimal Tailwind utilities so it inherits the host's design system.

---

## 5. How the middleware handles `/dashboard` → `/en/dashboard`

`apps/web/middleware.ts` exports the standard `next-intl` middleware
created by `createMiddleware({...})`:

```ts
export default createMiddleware({
  locales,         // ['en', 'hi']
  defaultLocale,   // 'en'
  localePrefix: 'always',
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

Behavior:

- `GET /dashboard` → `307` redirect to `/en/dashboard` (default locale, since
  `localePrefix: 'always'` and no cookie / `Accept-Language` match for `hi`).
- `GET /hi/dashboard` → renders under Hindi.
- The matcher excludes `/api/*`, `/_next/*`, and any path with a file
  extension (so static assets, images, and API routes pass through
  untouched).
- The `NEXT_LOCALE` cookie is set on the first visit; subsequent visits
  honor it.

The middleware itself does **not** call into the existing
`apps/web/src/middleware.ts` (subdomain + Supabase auth). See §7.

---

## 6. Why `next-intl` over `react-i18next` and `@lingui/react`

| Criterion | `next-intl` | `react-i18next` | `@lingui/react` |
|---|---|---|---|
| App Router native (RSC) | **Yes** — `getTranslations` for server components | No (CSR-first; needs a wrapper per route) | Partial (needs extra wiring) |
| Middleware / locale routing | **Built-in** (`next-intl/middleware`) | None (roll your own) | None (roll your own) |
| Bundle size (gzip, gzipped+min) | **~3 kB** runtime | ~10 kB + i18next | ~6 kB + macro runtime |
| ICU MessageFormat (plurals, select) | **Yes** (default) | Via i18next-fluent plugin | Yes (core) |
| TypeScript strict types | **Yes** (`@antarix/i18n`-style type augmentation) | Loose | Loose |
| Maintenance signal | Active, ships with Next.js 15 docs | Active but legacy App Router story | Active, smaller community |

We picked **`next-intl`** because it is the only library that is
*App-Router-native* (server-component-friendly, ships an official
middleware, small bundle) and is the library the Next.js team itself
references in the official i18n guide.

---

## 7. Known gaps and follow-ups

These are **deliberately not** addressed in this scaffold, by design or by
constraint. They are listed here for the adopting agent.

### 7.1 Middleware merge with existing `src/middleware.ts`

There is a real, blocking conflict:

- `apps/web/src/middleware.ts` (root) — the new next-intl middleware, this
  scaffold.
- `apps/web/src/middleware.ts` → actually `apps/web/src/middleware.ts`
  (existing) — the subdomain / Supabase auth middleware
  (`SUBDOMAIN_MAP`, `/u/<slug>` rewrite, protected-path guard).

Next.js does not allow both. The existing middleware already lives at
`src/middleware.ts`, which is the canonical location when a project uses
`src/`, and is the one that will run.

**Resolution path for the adopting agent (no constraint-violation required
once they own the page/layout files):**

1. Delete the new `apps/web/middleware.ts` (root).
2. In `apps/web/src/middleware.ts`, import and call
   `createMiddleware({...})` from `next-intl/middleware` *first*, then
   chain the existing subdomain/auth logic. The next-intl middleware
   short-circuits on non-matches so the existing logic still runs for
   `/u/<slug>`, `/login`, etc.
3. Confirm the matcher in `src/middleware.ts` is updated to also accept
   locale-prefixed paths (`/(en|hi)/...`).

This is flagged in the agent coordination log as a blocker for any agent
that wants the locale prefix to actually take effect.

### 7.2 `<IntlProvider>` for `Intl.DateTimeFormat` / `Intl.NumberFormat`

`next-intl` ships an `<IntlProvider>` (and `useFormatter`) for proper
locale-aware date, time, and number formatting. We have not wired it yet —
the scaffold only includes message *string* translation.

Adoption: wrap the body of the root layout (or any subtree) in
`<NextIntlClientProvider messages={...}>` once the page-adoption agent
adds the i18n provider tree. Until then, dates and numbers will render in
the browser's default locale, not the user's selected UI locale.

### 7.3 RTL locales (Arabic, Hebrew, Urdu)

When we add Arabic (`ar`), Hebrew (`he`), or Urdu (`ur`):

1. Add the locale to `locales` and add the label.
2. Set the `<html dir="rtl">` attribute dynamically in the root layout
   (e.g. `dir={dirForLocale(locale)}` where `dirForLocale` checks against
   a small RTL set).
3. Audit Tailwind utilities — `ms-*` / `me-*` are preferred over
   `ml-*` / `mr-*` in the codebase. (Spot-check the
   `apps/web/src/components/ui/` primitives.)
4. The next-intl middleware has an `localePrefix: 'always'` setting that
   we keep; the locale itself does not affect the prefix strategy.

### 7.4 `next-intl` package is in `package.json` but not yet installed

`apps/web/package.json` lists `next-intl: ^3.26.0` in `dependencies`
(additive). The actual `pnpm install` / `npm install` must be run by the
adopting agent before `pnpm dev`. We do not run installs from this
scaffold step to avoid touching the lockfile.

### 7.5 No `en.json` / `hi.json` key parity CI

A future improvement: a tiny script that diffs the keys in
`messages/en.json` (the source of truth) against every other locale file
and fails the build on missing keys. Out of scope here.

---

## 8. Files added or modified by this scaffold

**New files (all additive):**

- `apps/web/messages/en.json`
- `apps/web/messages/hi.json`
- `apps/web/src/i18n/config.ts`
- `apps/web/src/i18n/request.ts`
- `apps/web/src/i18n/locale-switcher.tsx`
- `apps/web/middleware.ts`
- `docs/i18n-scaffold.md` (this file)

**Modified (additive only):**

- `apps/web/next.config.ts` — added two lines: `import createNextIntlPlugin
  from "next-intl/plugin";` and `const withNextIntl =
  createNextIntlPlugin("./src/i18n/request.ts");`, plus the final export is
  `withNextIntl(nextConfig)` instead of `nextConfig`.
- `apps/web/package.json` — added `"next-intl": "^3.26.0"` to
  `dependencies` (alphabetically positioned, additive).

**Not touched:** every `apps/web/src/app/**/page.tsx`,
`apps/web/src/app/**/layout.tsx`, `apps/web/src/components/**/*.tsx`,
`apps/web/src/middleware.ts` (the existing one), and
`apps/web/src/lib/**`.
