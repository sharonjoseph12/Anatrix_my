# Antarix Web

Next.js 15 (App Router) web app hosting three portals via subdomain routing:

- **Student portal** — `antarix.app` / `localhost:3000` (root)
- **College portal** — `college.antarix.app` / `localhost:3000/college`
- **Company portal** — `recruiting.antarix.app` / `localhost:3000/company`

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build
pnpm type-check   # tsc --noEmit
pnpm lint         # next lint
```

## Tech

- Next.js 15 (App Router, Server Components, Server Actions)
- TypeScript 5.5+
- Tailwind CSS v4 (CSS-first config)
- shadcn/ui (Radix primitives)
- Supabase (auth, database, realtime)

## Structure

```
src/
├── app/
│   ├── (auth)/        # Shared auth: login, signup, callback
│   ├── (student)/     # Student portal: dashboard, onboarding, insights
│   ├── (college)/     # College portal: students, placement
│   ├── (company)/     # Recruiter portal: search, analytics
│   ├── api/           # Route handlers
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/            # shadcn/ui components
│   ├── charts/        # Data viz
│   └── dashboard/     # Portal-specific widgets
├── lib/
│   ├── supabase/      # Supabase client wrappers
│   ├── algorithms/    # Skill scoring, peak window, etc.
│   └── utils/
├── types/
└── middleware.ts      # Subdomain routing + auth refresh
```
