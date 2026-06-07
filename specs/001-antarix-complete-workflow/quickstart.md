# Quickstart: Antarix Development

**Branch**: `001-antarix-complete-workflow` | **Date**: 2026-06-04

## Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase CLI (`npx supabase`)
- Docker (for Supabase local)
- Chrome browser (for extension testing)

## Setup

```bash
# Clone and install
git clone <repo-url> antarix
cd antarix
pnpm install

# Start Supabase local
npx supabase start
# This starts: PostgreSQL (port 54322), Auth (port 54321), Storage, Edge Functions

# Apply database migrations
npx supabase db push

# Seed initial data (skills catalog)
npx supabase db seed

# Start Next.js dev server
pnpm --filter web dev
# → http://localhost:3000 (student portal)
# → Subdomain routing works via middleware

# Start extension in dev mode
pnpm --filter extension dev
# → Load unpacked extension from apps/extension/dist in Chrome

# Run tests
pnpm test           # All workspaces
pnpm test:e2e       # Playwright e2e tests
```

## Project Structure

```
antarix/
├── apps/
│   ├── web/                    # Next.js 15 (App Router)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (student)/  # Student portal routes
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   │   ├── page.tsx        # Brief dashboard
│   │   │   │   │   │   ├── skills/
│   │   │   │   │   │   ├── peak-self/
│   │   │   │   │   │   ├── insights/
│   │   │   │   │   │   ├── cohorts/[id]/
│   │   │   │   │   │   ├── github/
│   │   │   │   │   │   └── sessions/
│   │   │   │   │   ├── onboarding/{profile,github,calendar,complete}/
│   │   │   │   │   ├── settings/{profile,profile-visibility,notifications,sources,ai-coach}/
│   │   │   │   │   ├── ai-coach/
│   │   │   │   │   ├── credential/
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── college/    # College portal — literal route (no group)
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── students/
│   │   │   │   │   ├── students/[id]/
│   │   │   │   │   ├── students/import/
│   │   │   │   │   ├── companies/
│   │   │   │   │   ├── settings/
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── company/    # Company portal — literal route
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── search/
│   │   │   │   │   ├── pipeline/
│   │   │   │   │   ├── pipeline/schedule/
│   │   │   │   │   ├── analytics/
│   │   │   │   │   ├── settings/
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── college-signup/  # Public — officer signup
│   │   │   │   ├── company-signup/  # Public — recruiter signup
│   │   │   │   ├── (auth)/     # Shared auth routes
│   │   │   │   │   ├── login/
│   │   │   │   │   ├── signup/
│   │   │   │   │   └── callback/
│   │   │   │   ├── verify/[slug]/    # Public — credential verification
│   │   │   │   ├── error.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── not-found.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx           # Landing
│   │   │   │   └── middleware.ts
│   │   │   ├── components/
│   │   │   │   ├── ui/           # shadcn/ui components
│   │   │   │   ├── charts/       # Data visualization
│   │   │   │   ├── dashboard/    # Shared dashboard widgets
│   │   │   │   ├── onboarding/   # Onboarding flow components
│   │   │   │   ├── notifications/# Realtime toasts
│   │   │   │   └── theme-provider.tsx
│   │   │   ├── lib/
│   │   │   │   ├── supabase/
│   │   │   │   │   ├── client.ts     # Browser client
│   │   │   │   │   ├── server.ts     # Server client
│   │   │   │   │   └── middleware.ts  # Auth middleware
│   │   │   │   ├── algorithms/        # Skill scoring + insights
│   │   │   │   ├── validation/        # Zod schemas
│   │   │   │   ├── rate-limit.ts      # In-memory token bucket
│   │   │   │   └── utils/
│   │   │   └── types/
│   │   ├── tailwind.config.ts
│   │   └── next.config.ts
│   │
│   └── extension/              # Chrome Extension (MV3)
│       ├── src/
│       │   ├── manifest.json
│       │   ├── popup/{App.tsx, popup.css, components/}
│       │   ├── background/{service-worker, focus-monitor}.ts
│       │   ├── storage/session-store.ts
│       │   └── lib/supabase.ts
│       └── vite.config.ts
│
├── packages/
│   ├── types/                  # Shared TypeScript types
│   │   ├── database.ts         # Supabase generated types
│   │   ├── api.ts              # API request/response types
│   │   └── index.ts
│   └── utils/                  # Shared utilities
│       ├── date.ts
│       ├── format.ts
│       └── index.ts
│
├── supabase/
│   ├── migrations/             # Database migrations
│   │   ├── 001_users.sql
│   │   ├── 002_sessions.sql
│   │   ├── 003_github.sql
│   │   ├── 004_skills.sql
│   │   ├── 005_insights.sql
│   │   ├── 006_cohorts.sql
│   │   ├── 007_institutions.sql
│   │   ├── 008_companies.sql
│   │   ├── 009_candidate_profiles.sql
│   │   ├── 010_rls_policies.sql
│   │   ├── 011_functions.sql
│   │   ├── 012_cron_jobs.sql
│   │   ├── 013_cohort_functions.sql
│   │   ├── 014_company_intake.sql
│   │   ├── 015_notifications.sql        # Realtime + RLS
│   │   └── 016_performance_indexes.sql
│   ├── functions/              # Edge Functions
│   │   ├── _shared/            # Deno shared module
│   │   ├── github-sync/
│   │   ├── github-callback/
│   │   ├── calendar-sync/
│   │   ├── generate-insights/
│   │   ├── update-profiles/
│   │   └── session-upload/
│   ├── seed.sql                # Skills catalog + test data
│   └── config.toml
│
├── tests/
│   ├── e2e/                    # Playwright tests
│   │   ├── student-onboarding.spec.ts
│   │   ├── session-tracking.spec.ts
│   │   ├── college-dashboard.spec.ts
│   │   └── company-search.spec.ts
│   └── integration/
│       ├── insight-generation.test.ts
│       └── skill-proof-score.test.ts
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .env.local.example
```

## Portals at a glance

| Portal | Path | Audience | Guard |
| --- | --- | --- | --- |
| Student | `/dashboard/*` | Authenticated student with `onboarding_completed_at IS NOT NULL` | `(student)/layout.tsx` |
| Public profile | `/<slug>` (rewrites to `/u/<slug>`) | Anyone; shows verified score, top skills, heat map, credentials. 90-day redirect for old handles. | `apps/web/src/middleware.ts` |
| College | `/college/*` | Authenticated user with `institution_members.role IN ('placement_officer','admin')` | `college/layout.tsx` |
| Company | `/company/*` | Authenticated user with `company_members.role IN ('recruiter','admin','hiring_manager')` | `company/layout.tsx` |

## Useful commands

```bash
# Lint + type-check + build (one shot)
pnpm --filter web type-check && pnpm --filter web build

# Serve edge functions locally
npx supabase functions serve

# Run a single migration replay against local DB
npx supabase db reset

# Generate types from the local schema
npx supabase gen types typescript --local > packages/types/database.ts
```

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-key>

# GitHub OAuth
GITHUB_CLIENT_ID=<github-app-client-id>
GITHUB_CLIENT_SECRET=<github-app-client-secret>

# Google OAuth (Calendar)
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>

# Extension
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key>
```

## Development Workflow

1. `pnpm --filter web dev` — Start web app
2. `pnpm --filter extension dev` — Build extension in watch mode
3. Load extension in Chrome → `chrome://extensions` → "Load unpacked" → `apps/extension/dist`
4. `npx supabase functions serve` — Start Edge Functions locally
5. `pnpm test` — Run all tests
