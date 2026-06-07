# Research: Antarix Verified Skill Proof Ecosystem

**Branch**: `001-antarix-complete-workflow` | **Date**: 2026-06-04

## Technology Stack Decisions

### Decision 1: Frontend Framework

**Decision**: Next.js 15 (App Router) with TypeScript
**Rationale**: Three distinct portals (student `antarix.app`, college `college.antarix.app`, recruiter `recruiting.antarix.app`) share common UI components but need separate routing and layouts. Next.js App Router supports route groups and middleware-based subdomain routing natively. SSR for SEO on landing pages, CSR for dashboard interactivity.
**Alternatives considered**:
- Vite + React SPA — no SSR, poor SEO for landing/marketing pages
- Separate Vite apps per portal — code duplication, harder to share components
- Remix — smaller ecosystem, less community support for subdomain routing

### Decision 2: Backend / BaaS

**Decision**: Supabase (Auth + PostgreSQL + Edge Functions + Realtime + Storage)
**Rationale**: User already has Supabase MCP server installed. Supabase provides: Auth (email/password + OAuth with GitHub, Google), PostgreSQL with Row Level Security, Edge Functions for background jobs (insight generation, sync), Realtime for live dashboard updates, and Storage for profile exports. Eliminates building auth, DB infra, and file storage from scratch.
**Alternatives considered**:
- Firebase — NoSQL (Firestore) doesn't map well to the relational data model (12 entities with joins)
- Custom Express + PostgreSQL — more control but 3x development time for auth/middleware
- PlanetScale + Clerk — good but two vendors vs. one integrated platform

### Decision 3: Chrome Extension

**Decision**: Manifest V3 Chrome Extension with TypeScript
**Rationale**: MV3 is required by Chrome Web Store (MV2 deprecated). Service workers replace background pages. Chrome Storage API for local data persistence. Alarms API for periodic sync. The extension is a separate project within the monorepo.
**Alternatives considered**:
- Firefox/cross-browser extension — out of scope per v1 assumptions (Chrome-only)
- Desktop app (Electron) — overkill for session tracking, higher barrier to install

### Decision 4: Styling

**Decision**: Tailwind CSS v4 + shadcn/ui
**Rationale**: Rapid UI development with consistent design tokens. shadcn/ui provides accessible, composable components (dialogs, forms, data tables, charts) that match the dashboard-heavy UI. Dark mode built-in. Premium feel with minimal custom CSS.
**Alternatives considered**:
- Vanilla CSS — too slow for 50+ screens across 3 portals
- Material UI — opinionated styling, harder to customize to Antarix brand
- Chakra UI — good but fewer pre-built data visualization components

### Decision 5: Background Jobs

**Decision**: Supabase Edge Functions + pg_cron (PostgreSQL)
**Rationale**: pg_cron runs inside PostgreSQL for scheduled tasks (daily GitHub sync, weekly insight generation, daily profile updates). Edge Functions handle webhook-triggered and on-demand jobs. No separate job queue infrastructure needed.
**Alternatives considered**:
- BullMQ + Redis — separate infrastructure to manage
- Vercel Cron — limited to 1/day on free tier, vendor lock-in
- AWS Lambda — over-engineering for v1 scale

### Decision 6: Monorepo Structure

**Decision**: Turborepo monorepo with pnpm workspaces
**Rationale**: Three apps (web, extension, docs) share types, utilities, and Supabase client. Turborepo handles build caching and dependency graph. pnpm is faster and more disk-efficient than npm/yarn.
**Alternatives considered**:
- Nx — heavier setup, more config overhead for a small team
- Separate repos — painful to share types and Supabase schema
- Single Next.js app only — extension needs separate build pipeline

### Decision 7: Testing

**Decision**: Vitest (unit) + Playwright (e2e) + Supabase local (integration)
**Rationale**: Vitest is fast, ESM-native, compatible with TypeScript. Playwright covers cross-browser e2e testing for the 3 portals. Supabase CLI provides local PostgreSQL + Auth for integration testing without cloud dependency.
**Alternatives considered**:
- Jest — slower, CJS-first, worse TypeScript DX
- Cypress — heavier, slower for e2e than Playwright

## Key Technical Patterns

### Authentication Flow
- Supabase Auth handles email/password signup, email verification, OAuth (GitHub, Google)
- JWT tokens stored in httpOnly cookies (Next.js middleware validates)
- Role-based access via Supabase RLS policies: `student`, `placement_officer`, `recruiter`, `admin`

### Multi-Portal Architecture
- Single Next.js app with route groups: `(student)`, `(college)`, `(company)`
- Middleware detects subdomain and rewrites to appropriate route group
- Shared layout components, separate navigation per portal

### Extension ↔ Backend Sync
- Extension authenticates via Supabase Auth token (stored in chrome.storage)
- Sessions stored locally in IndexedDB (via chrome.storage)
- Sync via `chrome.alarms` (hourly) → POST to Supabase Edge Function
- Conflict resolution: server wins (extension data is append-only)

### Insight Generation Pipeline
- pg_cron triggers weekly: `SELECT generate_insights(user_id)` for each qualifying user
- PostgreSQL functions calculate: peak windows (time bucketing), workflow patterns (sequence analysis), skill detection (language aggregation)
- Results written to `insights` table, push notification sent via Supabase Realtime

## Unresolved Items

None. All technical decisions resolved.
