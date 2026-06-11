# Antarix — Verified Skill Proof Ecosystem

> Track. Prove. Hire. The verified skill proof ecosystem connecting students, colleges, and companies.

## Overview

Antarix is a multi-portal SaaS platform that creates a verified skill proof pipeline from learning to employment:

- **Students** track learning activity via Chrome extension + GitHub/Calendar sync
- **Colleges** manage placement readiness and match students with companies
- **Companies** search verified candidate profiles and hire based on data, not resumes

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend**: Supabase (Auth + PostgreSQL + Edge Functions + Realtime)
- **Extension**: Chrome MV3 + Vite
- **Testing**: Vitest (unit) + Playwright (e2e)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start Supabase (requires Docker)
npx supabase start

# Run web app
pnpm --filter web dev

# Build Chrome extension
pnpm --filter extension dev
```

See [specs/001-antarix-complete-workflow/quickstart.md](specs/001-antarix-complete-workflow/quickstart.md) for full setup guide.

## Project Structure

```
antarix/
├── apps/
│   ├── web/         # Next.js 15 — 3 portals via subdomain routing
│   └── extension/   # Chrome MV3 extension
├── packages/
│   ├── types/       # Shared TypeScript types
│   └── utils/       # Shared utilities
└── supabase/        # Database migrations + edge functions
```

## Documentation

- [Feature Spec](specs/001-antarix-complete-workflow/spec.md)
- [Implementation Plan](specs/001-antarix-complete-workflow/plan.md)
- [Data Model](specs/001-antarix-complete-workflow/data-model.md)
- [API Contracts](specs/001-antarix-complete-workflow/contracts/api.md)
- [Quickstart Guide](specs/001-antarix-complete-workflow/quickstart.md)

## License

Private — All rights reserved.
