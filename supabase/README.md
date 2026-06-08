# Supabase Local Development

Database migrations, edge functions, and seed data for Antarix.

## Prerequisites

- Docker (for `supabase start`)
- Supabase CLI: `npx supabase`

## Commands

```bash
# Start local stack (Postgres, Auth, Edge Functions, Studio)
npx supabase start

# Apply migrations
npx supabase db push

# Seed initial data (skills catalog)
npx supabase db seed

# Reset database (drops all data, re-runs migrations + seed)
npx supabase db reset

# Serve edge functions locally
npx supabase functions serve

# Deploy edge function to production
npx supabase functions deploy <function-name>
```

## Structure

```
supabase/
├── config.toml            # Local stack config
├── migrations/            # Numbered SQL migrations (run in order)
├── functions/             # Edge functions (Deno runtime)
│   ├── session-upload/
│   ├── github-sync/
│   ├── calendar-sync/
│   ├── generate-insights/
│   └── update-profiles/
└── seed.sql               # Initial data: skills catalog, test users
```

## Auth Providers

Configured in `config.toml`:
- **Email/password** — enabled by default
- **GitHub OAuth** — set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`
- **Google OAuth** — set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

## Migrations Order

Migrations are applied in lexicographic order. The naming convention is:

```
NNN_description.sql
```

Example: `001_users.sql`, `002_sessions.sql`.

## Edge Functions

Each function lives in its own directory with an `index.ts` entrypoint:

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  // ...
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

## Local URLs

| Service  | URL                          |
|----------|------------------------------|
| API      | http://127.0.0.1:54321        |
| Database | postgresql://postgres:54322  |
| Studio   | http://127.0.0.1:54323        |
| Inbucket | http://127.0.0.1:54324        |
