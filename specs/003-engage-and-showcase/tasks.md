# Tasks: Engage & Showcase — DSA Sync, Public Profile, Free Channels

**Input**: Design documents from `/specs/003-engage-and-showcase/`
- spec.md (3 user stories: US1 DSA, US2 Public profile, US3 Channels)
- research.md (D1–D9 decisions on data sources, routing, channel resolver)
- data-model.md (3 new tables, 1 column extension)
- contracts/api.md (9 new HTTP endpoints + 3 edge functions)
- quickstart.md (env vars, migrations 017–019, edge functions, smoke test)

**Prerequisites**: 001 + 002 already complete (auth, schema, AI Coach pipeline, cron infrastructure, notification host)

**Tests**: Tests are NOT requested in this spec (TDD is project-default but opt-in per phase). Test tasks are omitted to keep the slice shippable.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm environment and add shared infrastructure that all three stories will use.

- [x] T001 Verify env vars for LeetCode/HackerRank/Discord/Telegram in `.env.local.example`
- [x] T002 [P] Add `next-themes` is already wired (001) — no new shared UI dep needed beyond `discord.js` types and `grammY` (optional). Skip if pure REST is sufficient.
- [x] T003 [P] Add activity-heatmap SVG component shell `apps/web/src/components/charts/activity-heatmap.tsx` (7-row × 53-col grid, no recharts dep)
- [x] T004 Confirm cron entry point `012_cron_jobs.sql` is accessible to new 6h DSA job

**Checkpoint**: Setup ready — schema work can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New schema + RLS that all three user stories depend on. **No user story work can begin until this phase is complete.**

- [x] T005 [P] Create migration `supabase/migrations/017_dsa_profiles.sql` — `user_dsa_profiles` table with check constraints, RLS, partial index for sync-due
- [x] T006 [P] Create migration `supabase/migrations/017_dsa_profiles.sql` — `slug_redirects` table + `before update` trigger on `public_profiles.slug` to write history
- [x] T007 [P] Create migration `supabase/migrations/018_external_channels.sql` — `external_channel_handles` + `institution_nudge_settings` tables with RLS
- [x] T008 Create migration `supabase/migrations/019_nudge_preferences_ext.sql` — add `channel_priority` and `whatsapp_premium_opt_in` to `nudge_preferences`
- [x] T009 [P] Add slug reservation list + validation helper `apps/web/src/lib/validation/slug.ts` (regex + reserved-word check)
- [x] T010 [P] Add DSA score algorithm `apps/web/src/lib/algorithms/dsa-score.ts` (deterministic weighted-sum, matches research D8)
- [x] T011 [P] Add channel-priority resolver `apps/web/src/lib/algorithms/channel-resolver.ts` (pure function, matches research D5)
- [x] T012 Update middleware rewrite in `apps/web/src/middleware.ts` to map `/<slug-pattern>` → `/u/<slug>` (skipping known system prefixes)
- [x] T013 [P] Add `next/image`-safe OG defaults in root layout metadata; centralise OG image generation in `apps/web/src/app/u/[slug]/opengraph-image.tsx`

**Checkpoint**: Schema + resolver helpers ready. All three user stories can now proceed in parallel.

---

## Phase 3: User Story 1 — DSA Sync (Priority: P1) 🎯 MVP

**Goal**: Students connect LeetCode and/or HackerRank during onboarding; a 6-hour cron pulls solved counts, contest rating, and streak; DSA category card surfaces on `/dashboard/skills`.

**Independent Test**: Complete onboarding with a valid LeetCode username → wait one cron cycle → see DSA card on `/dashboard/skills` with solved counts and a contribution to the overall score.

### Implementation for User Story 1

- [x] T014 [P] [US1] Add LeetCode + HackerRank username fields to onboarding Step 1 in `apps/web/src/app/(student)/onboarding/profile/page.tsx` (or a new `integrations` step)
- [x] T015 [P] [US1] Create `apps/web/src/app/api/dsa/connect/route.ts` — validates `platform` + `username`, upserts `user_dsa_profiles`, queues sync
- [x] T016 [P] [US1] Create `apps/web/src/app/api/dsa/sync/route.ts` — rate-limited (1/min/user) manual sync trigger
- [x] T017 [US1] Create `supabase/functions/dsa-sync/index.ts` — pulls LeetCode via `POST /graphql` and HackerRank via `GET /rest/hackers/<u>/scores`; upserts with exponential-backoff retry on 4xx/5xx
- [x] T018 [P] [US1] Add 6h cron entry to `supabase/migrations/012_cron_jobs.sql` for `dsa-sync` (append-only)
- [x] T019 [P] [US1] Create DSA category card `apps/web/src/components/dsa/dsa-card.tsx` (solved counts by difficulty, contest rating, streak)
- [x] T020 [US1] Integrate DSA card into `apps/web/src/app/(student)/dashboard/skills/page.tsx` (next to GitHub activity)
- [x] T021 [US1] Wire `dsaScore()` into the Skill Proof Score formula in `apps/web/src/lib/algorithms/skill-proof-score.ts` (additive 15% weight, matches research D8)
- [x] T022 [P] [US1] Add "Reconnect" CTA in `apps/web/src/components/dashboard/integration-status.tsx` for `sync_status ∈ {not_found, private, error}`
- [x] T023 [US1] Add Zod schema `dsaConnectSchema` + `dsaSyncSchema` in `apps/web/src/lib/validation/schemas.ts` and apply rate limit (1/min) in connect/sync routes

**Checkpoint**: DSA sync is end-to-end functional; placement-ready flag updates when DSA data crosses the threshold.

---

## Phase 4: User Story 2 — Public Profile (Priority: P1) 🎯 MVP

**Goal**: Students claim a unique slug and get a public `antarix.app/<slug>` URL showing verified score, top skills, GitHub heat map, and credentials. SEO + Open Graph first-class.

**Independent Test**: Set a slug in `/settings/profile-visibility`, mark profile `public`, open `antarix.app/<slug>` in incognito → see verified profile with score, top skills, heat map, credentials, and Open Graph preview.

### Implementation for User Story 2

- [x] T024 [P] [US2] Add slug claim field + availability check to `apps/web/src/app/(student)/settings/profile-visibility/visibility-client.tsx` (debounced live check via `checkSlugAvailability`)
- [x] T025 [P] [US2] Create `apps/web/src/app/api/public-profile/[slug]/route.ts` — returns JSON shape per contracts/api.md (used by OG generators and verification widgets)
- [x] T026 [P] [US2] Create public profile page `apps/web/src/app/u/[slug]/page.tsx` (ISR, `revalidate = 300`, `generateStaticParams` for top 100)
- [x] T027 [P] [US2] Create profile header `apps/web/src/components/public-profile/profile-header.tsx` (avatar, name, "verified by Antarix" badge, top specialization)
- [x] T028 [P] [US2] Create top-skills list `apps/web/src/components/public-profile/skill-list.tsx` (top 5 skills, proficiency bars)
- [x] T029 [P] [US2] Create GitHub heat map `apps/web/src/components/public-profile/github-heatmap.tsx` (uses `activity-heatmap.tsx` from T003)
- [x] T030 [P] [US2] Create credentials list `apps/web/src/components/public-profile/credentials-list.tsx`
- [x] T031 [P] [US2] Create verified badge `apps/web/src/components/public-profile/verified-badge.tsx`
- [x] T032 [US2] Add `generateMetadata` to `apps/web/src/app/u/[slug]/page.tsx` (Open Graph + Twitter card meta tags per FR-014)
- [x] T033 [US2] Add "Schedule an interview" CTA on the public profile (visible only if `is_open_to_opportunities = true`)
- [x] T034 [P] [US2] Add 90-day slug-redirect lookup in `apps/web/src/middleware.ts` (resolves old slugs to new owners before falling through)
- [x] T035 [P] [US2] Add "this profile is private" + 404 pages (separate components; 404 is noindex, private is noindex, public is indexable)
- [x] T036 [US2] Add Zod schema `slugClaimSchema` in `apps/web/src/lib/validation/schemas.ts` and apply rate limit (5/min) in slug-claim route

**Checkpoint**: Public profile is end-to-end functional; OG previews work in Slack/Twitter/LinkedIn.

---

## Phase 5: User Story 3 — Discord / Telegram Channels (Priority: P2)

**Goal**: Students opt into a free Discord or Telegram channel for nudges; the AI Coach dispatcher uses the priority resolver; WhatsApp becomes premium; colleges can bulk-enable Telegram for their students.

**Independent Test**: Connect a Discord handle in `/settings/notifications` → wait one morning-brief cron → receive DM in Discord with the same content shape as the WhatsApp brief.

### Implementation for User Story 3

- [x] T037 [P] [US3] Create `apps/web/src/app/api/channels/connect/route.ts` — returns either OAuth URL (Discord) or deep link + one-time token (Telegram)
- [x] T038 [P] [US3] Create Discord OAuth callback `apps/web/src/app/api/channels/discord/callback/route.ts` (exchanges code, stores `platform_id` + `dm_channel_id`, marks verified)
- [x] T039 [P] [US3] Create test-message endpoint `apps/web/src/app/api/channels/verify/route.ts` (sends a hello, confirms delivery)
- [x] T040 [P] [US3] Create disconnect endpoint `apps/web/src/app/api/channels/disconnect/route.ts` (sets `disconnected_reason`)
- [x] T041 [US3] Create webhook handler `apps/web/src/app/api/webhooks/discord/route.ts` (verifies `X-Signature-Ed25519`, handles `MESSAGE_CREATE` and interaction pings)
- [x] T042 [P] [US3] Create webhook handler `apps/web/src/app/api/webhooks/telegram/route.ts` (verifies `X-Telegram-Bot-Api-Secret-Token`, handles `/start <token>` and `/stop`)
- [x] T043 [P] [US3] Create Edge Function `supabase/functions/dsa-sync/...` is done; create `supabase/functions/nudge-dispatch-extended/index.ts` (calls `pickChannel()`, dispatches, respects quiet hours + exam window)
- [x] T044 [US3] Wire the dispatch extension into the existing 6h cron in `supabase/migrations/012_cron_jobs.sql` (replace or extend `nudge-dispatch`)
- [x] T045 [P] [US3] Add channel chooser to `apps/web/src/app/(student)/settings/notifications/page.tsx` (Discord + Telegram as default, WhatsApp behind premium opt-in)
- [x] T046 [P] [US3] Add Discord card `apps/web/src/components/channels/discord-card.tsx` (connect, verify, disconnect buttons; "Reconnect" CTA on 4xx)
- [x] T047 [P] [US3] Add Telegram card `apps/web/src/components/channels/telegram-card.tsx` (deep link button, pending state)
- [x] T048 [US3] Add institution bulk-enable endpoint `apps/web/src/app/api/institution-nudges/route.ts` (officer-only, writes `institution_nudge_settings`)
- [x] T049 [US3] Add "Connected by <institution>" badge to Telegram/Discord card when `institution_nudge_settings` row exists
- [x] T050 [US3] Add Zod schemas for connect/verify/disconnect payloads in `apps/web/src/lib/validation/schemas.ts` and rate limit each (10/min, 5/min, 10/min)

**Checkpoint**: Channel selection is end-to-end functional; quiet hours + exam-window suppression applies to free channels identically to WhatsApp.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting improvements that touch all three stories.

- [x] T051 [P] Update `apps/web/src/app/(student)/dashboard/page.tsx` to surface a "DSA connected" + "Public profile live" status pill (small wins for the user)
- [x] T052 [P] Add real-time notification `interview_scheduled` and `hiring_outcome` to the existing `NotificationHost` (already wired, just verify the `kind` enum covers the new kinds)
- [x] T053 [P] Add performance indexes in `supabase/migrations/020_engage_showcase_indexes.sql` — `user_dsa_profiles (last_synced_at)` partial where `sync_status = 'active'`, `external_channel_handles (user_id)` where verified, `slug_redirects (old_slug)` where not expired
- [x] T054 [P] Add sitemap entry for public profiles in `apps/web/src/app/sitemap.ts` (top 500 slugs, revalidate hourly)
- [x] T055 Update `specs/001-antarix-complete-workflow/quickstart.md` portals table to add the new public profile route `/<slug>`
- [x] T056 Run `pnpm --filter web type-check` + `pnpm --filter web build` and fix any breakage
- [x] T057 [P] Add 3 quickstart scripts to `supabase/functions/dsa-sync/README.md` for local testing (curl examples)
- [x] T058 [P] Add Open Graph image to `apps/web/src/app/u/[slug]/opengraph-image.tsx` (1200×630, includes score + verified badge)

**Checkpoint**: Phase complete — feature is production-ready.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 / US2 / US3 (Phases 3-5)**: Depend on Foundational — can run in parallel
- **Polish (Phase 6)**: Depends on all desired stories

### User Story Dependencies

- **US1 (DSA Sync)**: Independent. Uses `user_dsa_profiles` table from T005.
- **US2 (Public Profile)**: Independent. Uses `slug_redirects` from T006 + middleware from T012.
- **US3 (Channels)**: Independent. Uses `external_channel_handles` + `institution_nudge_settings` from T007.

### Within Each User Story

- Schema → API routes → Edge function → UI components → integration
- Zod schemas added alongside the first route in each story

### Parallel Opportunities

- T005–T011 (all schema + helper tasks) can run in parallel
- Within US1: T014–T016, T019, T022 can run in parallel after T017
- Within US2: T024, T025, T027–T031, T034, T035 can run in parallel
- Within US3: T037–T042, T045–T047, T050 can run in parallel
- US1, US2, US3 can be worked on in parallel by different team members once Phase 2 is done

---

## Parallel Example: User Story 1

```bash
# Launch all foundational schema work together (Phase 2):
Task: "Create migration 017 — user_dsa_profiles"
Task: "Create migration 017 — slug_redirects + trigger"
Task: "Create migration 018 — external channels + institution settings"
Task: "Add slug validation helper"
Task: "Add DSA score algorithm"
Task: "Add channel resolver"
```

```bash
# Launch US1 frontend + routes in parallel after edge function is done:
Task: "Add LeetCode/HackerRank fields to onboarding"
Task: "Create /api/dsa/connect"
Task: "Create /api/dsa/sync"
Task: "Create DSA category card"
Task: "Add Zod schema for DSA payloads"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1 (DSA)
4. Complete Phase 4: US2 (Public profile)
5. **STOP and VALIDATE**: A student can connect LeetCode, see the DSA card, claim a slug, and share `antarix.app/<slug>`.
6. Deploy as MVP.

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (DSA) → Demo: students with verified DSA scores surface on the leaderboard → Deploy
3. US2 (Public profile) → Demo: students paste their public URLs in Twitter/LinkedIn → Deploy
4. US3 (Channels) → Demo: students receive nudges on Discord/Telegram at zero marginal cost → Deploy
5. Polish → Production-ready

### Parallel Team Strategy

With 3 developers:

1. All three collaborate on Phase 1 + Phase 2 (1 day)
2. Then:
   - Developer A: US1 (DSA sync)
   - Developer B: US2 (Public profile)
   - Developer C: US3 (Channels)
3. Stories integrate independently; no shared files between them.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability (US1, US2, US3)
- Each user story is independently completable and testable
- Test tasks are intentionally omitted (TDD is opt-in per the spec)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: same-file conflicts, cross-story dependencies that break independence
