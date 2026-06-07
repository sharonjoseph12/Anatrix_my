# Feature Specification: Engage & Showcase — DSA Sync, Public Profile, and Free Channels

**Feature Branch**: `003-engage-and-showcase`  
**Created**: 2026-06-04  
**Status**: Draft  
**Input**: User description: "Add LeetCode/HackerRank sync (passive DSA layer), a public profile URL (anti-resume) at `antarix.app/<slug>` showing live skill scores, GitHub heat map, verified credentials, and a Discord/Telegram nudge channel to avoid WhatsApp message costs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Connect LeetCode / HackerRank (Priority: P1)

A student links their LeetCode username during onboarding (Step 1 of 4, alongside GitHub and Calendar). Antarix passively pulls their solved-problem counts by difficulty, contest rating, recent submissions, and current streak on a recurring schedule. DSA progress appears on the skills dashboard next to GitHub activity so colleges and recruiters can see the *complete* picture: shipped code (GitHub) + problem-solving skill (DSA).

**Why this priority**: DSA is the single most-filtered signal in Indian campus placements. Without it, the Skill Proof Score is gappy and the placement-ready flag fires on weaker evidence. This story closes the "evidence loop" that drives the product's credibility with college placement cells.

**Independent Test**: Can be fully tested by completing onboarding with a valid LeetCode username, waiting for one sync cycle, and verifying that the skills dashboard now shows a DSA category card with solved counts and a contribution to the overall score.

**Acceptance Scenarios**:

1. **Given** a new student reaches onboarding Step 1, **When** they paste a valid LeetCode username and finish onboarding, **Then** a "Connecting DSA" status appears in the integrations card, and a sync job is queued.
2. **Given** a LeetCode username is connected, **When** the sync job runs (cron), **Then** solved problems by difficulty (Easy/Medium/Hard), total submissions, contest rating, and last-active date are stored and visible on `/dashboard/skills` within 30 seconds of completion.
3. **Given** a student's LeetCode account is private or the username does not exist, **When** the sync job runs, **Then** the integration shows a `disconnected` state with a "Reconnect" link, no score is fabricated, and the rest of the dashboard still renders normally.
4. **Given** a HackerRank username is provided, **When** the sync job runs, **Then** badges, stars, and verified-certificate count are stored and surface in a DSA category card.

---

### User Story 2 — Public Profile (the "Anti-Resume") (Priority: P1)

A student with a verified Skill Proof Score gets a public URL at `antarix.app/<slug>` (where `<slug>` is a custom handle they pick). The page is unauthenticated, indexable, and shows live skill scores, a GitHub-style heat map of recent activity, verified credentials, top specialization, and a "verified by Antarix" badge. Students paste this URL in their Twitter, LinkedIn, and resume bios; it works as their public skill identity and drives organic traffic back to Antarix.

**Why this priority**: This is the *pull* mechanism that turns every student into a distribution channel. Without a public profile, students have nothing to share externally, and Antarix misses the FOMO / network-effect loop that makes the product viral.

**Independent Test**: Can be fully tested by a student setting a custom slug in `/settings/profile-visibility`, marking the profile `public`, then opening `antarix.app/<slug>` in an incognito browser to see the verified profile.

**Acceptance Scenarios**:

1. **Given** a student with profile visibility set to `public` and a unique slug, **When** a recruiter or peer visits `antarix.app/<slug>`, **Then** they see the student's display name, avatar, verified score, top 5 skills, GitHub heat map, and issued credentials without needing to sign in.
2. **Given** a student with profile visibility set to `private`, **When** anyone visits `antarix.app/<slug>`, **Then** they see a "This profile is private" page (no score leakage).
3. **Given** a slug is already taken, **When** the student tries to claim it, **Then** they receive a real-time "this handle is taken — try another" message and the slug is not saved.
4. **Given** a public profile is visited, **When** the page is rendered, **Then** the page contains Open Graph + Twitter card meta tags so link previews show the score and a "verified by Antarix" badge.
5. **Given** a public profile, **When** a recruiter clicks "Schedule an interview", **Then** they are routed to the recruiter signup or pre-filled schedule form (only if the student is `is_open_to_opportunities`).

---

### User Story 3 — Discord / Telegram Nudge Channels (Priority: P2)

A student opts into a free daily morning check-in via Discord DM or Telegram DM instead of (or in addition to) WhatsApp. Nudges are sent on a 6-hour cron, batched into one morning brief, and respect quiet hours + exam-week suppression. Discord and Telegram are the default free channel; WhatsApp is repositioned as a premium add-on (or a college-paid feature) to keep unit economics healthy at scale.

**Why this priority**: WhatsApp Business API in India costs roughly ₹0.50–₹1.00 per message. With daily nudges and weekly summaries, message cost is the single largest variable cost in the unit economics. Free channels preserve margin while keeping engagement high; this is the difference between a venture-funded business and a self-sustaining one.

**Independent Test**: Can be fully tested by a student connecting a Discord handle in `/settings/notifications`, waiting for the next morning-brief cron tick, and verifying the DM arrives in Discord with the same content shape as the WhatsApp brief.

**Acceptance Scenarios**:

1. **Given** a student has no channel connected, **When** they open `/settings/notifications`, **Then** Discord and Telegram appear as the default free options, and WhatsApp shows a "Premium — ask your college to enable" hint.
2. **Given** a student connects a Discord handle, **When** the morning brief cron runs, **Then** a Discord DM arrives with the day's recommended focus window, recent streak, and one recommended experiment.
3. **Given** a student is in quiet hours (configured in `/settings/notifications`), **When** a nudge would be sent, **Then** the dispatcher holds the nudge and releases it after the quiet window ends.
4. **Given** a college officer has bulk-enabled Telegram for their institution, **When** any of their students visit `/settings/notifications`, **Then** Telegram is shown as already connected (institution-paid).
5. **Given** a student has multiple channels enabled, **When** a nudge is sent, **Then** only one channel receives it (priority: in-app toast > Telegram > Discord > WhatsApp) so the user isn't spammed across four channels.

---

### Edge Cases

- A LeetCode / HackerRate rate-limit response must surface a `rate_limited` status on the integration card and retry with exponential backoff.
- A student who changes their slug must have the old URL 301-redirect to the new one for 90 days.
- A public profile with `placement_ready=false` and `is_open_to_opportunities=false` must still be public (it's a portfolio, not a job listing) — recruiters can view but the "Schedule" CTA is hidden.
- A Discord/Telegram handle that has never accepted the bot's friend/follow request must show `pending` in the integrations card and never receive nudges.
- A LeetCode username that is valid but the user has zero submissions must still create a `user_dsa_profiles` row with zero counts (so the UI shows a clear "no activity yet" state, not a "missing" state).
- A student who disables all channels must still receive in-app toast notifications (in-app is always on, opt-out only suppresses external channels).
- A webhook from Discord/Telegram reporting an invalid handle (e.g., user revoked the bot) must clear the connection and surface a re-connect prompt on the student's next visit.

## Requirements *(mandatory)*

### Functional Requirements

#### LeetCode / HackerRank sync

- **FR-001**: System MUST allow students to optionally provide a LeetCode username and a HackerRank username during onboarding Step 1.
- **FR-002**: System MUST validate the username format (LeetCode: 3-30 chars, alphanumeric + `_-`; HackerRank: 2-30 chars, alphanumeric + `_-`).
- **FR-003**: System MUST store DSA profile data in a new `user_dsa_profiles` table keyed by `user_id` + `platform` (`leetcode` | `hackerrank`).
- **FR-004**: System MUST run a `dsa-sync` edge function on a 6-hour cron to refresh solved counts, contest rating, streak, and last-active date.
- **FR-005**: System MUST display a DSA category card on `/dashboard/skills` next to GitHub activity, with platform-specific metrics.
- **FR-006**: System MUST surface a "Reconnect" CTA on the integrations card when a sync returns 404 or `private_profile`.
- **FR-007**: System MUST score DSA contribution to the Skill Proof Score using a deterministic algorithm: easy/medium/hard weight = 1/3/8, with a streak bonus capped at 10 points.
- **FR-008**: System MUST rate-limit outbound calls to the LeetCode / HackerRank public APIs and fall back to a 1-hour cache on `429` responses.

#### Public profile

- **FR-009**: System MUST allow a student to claim a unique slug (3-40 chars, `^[a-z0-9-]$`) in `/settings/profile-visibility`.
- **FR-010**: System MUST reserve slugs matching reserved words (`admin`, `login`, `signup`, `dashboard`, `college`, `company`, `verify`, `settings`, `api`, `_next`).
- **FR-011**: System MUST render a public profile page at `/[slug]` for any student whose profile is `public` and has a slug set.
- **FR-012**: System MUST serve a public profile that includes: display name, avatar, verified score, top 5 skills with proficiency, GitHub activity heat map (last 365 days), issued credentials list, and a "verified by Antarix" badge.
- **FR-013**: System MUST serve a 404 page for unknown slugs and a "this profile is private" page for slugs whose owner has visibility = `private`.
- **FR-014**: System MUST emit Open Graph + Twitter card meta tags on every public profile page so link previews show the score and badge.
- **FR-015**: System MUST 301-redirect a slug to its new owner for 90 days when the student changes their handle.
- **FR-016**: System MUST include a "Schedule an interview" CTA on the public profile only if the student is `is_open_to_opportunities = true`.
- **FR-017**: System MUST index public profile pages with `<meta name="robots" content="index, follow">` and a sitemap entry; private pages MUST be `noindex`.

#### Discord / Telegram channels

- **FR-018**: System MUST allow students to connect a Discord handle (username + discriminator, or new `@username`) and a Telegram handle (`@username` or numeric `chat_id`).
- **FR-019**: System MUST store the channel choice in `nudge_preferences` (already exists from 002) under new columns: `discord_handle`, `telegram_handle`, `channel_priority` (enum: `in_app | telegram | discord | whatsapp`).
- **FR-020**: System MUST default new sign-ups to `in_app + discord` (free) and present WhatsApp as a premium add-on.
- **FR-021**: System MUST render a Discord/Telegram configuration section in `/settings/notifications` with test-message button.
- **FR-022**: System MUST run a `nudge-dispatch` edge function (or extend the existing AI Coach pipeline) that, for each scheduled nudge, picks the highest-priority enabled channel and dispatches.
- **FR-023**: System MUST respect quiet hours and exam-week suppression at the dispatch layer (already a 002 constraint, no new logic, but applies to the new channels).
- **FR-024**: System MUST allow a college officer (institution role) to bulk-enable Telegram for all their students via a `institution_nudge_settings` row, and show those students a "Connected by <institution>" badge.
- **FR-025**: System MUST send a webhook-driven opt-in confirmation when a Discord/Telegram handle is added (deep link to the bot's `add` command) before the first nudge is dispatched.
- **FR-026**: System MUST auto-disconnect a channel and surface a re-connect prompt when the bot receives a 4xx from the platform (handle revoked, user blocked the bot, chat not found).

### Key Entities

- **`user_dsa_profiles`**: per-user, per-platform DSA data — `user_id`, `platform` (`leetcode` | `hackerrank`), `username`, `total_solved`, `easy_solved`, `medium_solved`, `hard_solved`, `contest_rating`, `streak_days`, `last_active_at`, `last_synced_at`, `sync_status` (`active` | `rate_limited` | `private` | `not_found`).
- **`slug_redirects`**: history of public-profile slugs — `old_slug`, `new_slug`, `user_id`, `expires_at` (90 days).
- **`nudge_preferences` (extended)**: adds `discord_handle`, `telegram_handle`, `channel_priority`, `whatsapp_premium_opt_in`.
- **`institution_nudge_settings`**: college-paid channel enablement — `institution_id`, `channel` (`telegram` | `discord` | `whatsapp`), `enabled_at`, `expires_at`.
- **`external_channel_handles`**: per-user, per-channel handle + verification state — `user_id`, `channel` (`discord` | `telegram` | `whatsapp`), `handle`, `verified_at`, `disconnected_reason` (nullable), `created_at`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 60% of new sign-ups connect at least one external integration (GitHub, Calendar, LeetCode, or HackerRank) within their first session.
- **SC-002**: Students with a connected DSA platform see a DSA category card on `/dashboard/skills` within 5 minutes of onboarding completion.
- **SC-003**: Public profile pages load in under 2 seconds p95 from a cold cache and pass Core Web Vitals (LCP < 2.5s, CLS < 0.1).
- **SC-004**: 20% of new students publish a public profile (visibility = public + slug set) within 7 days of signup.
- **SC-005**: Public profile pages receive 1,500 unique external visits per 1,000 active students per month (organic social + recruiter).
- **SC-006**: Discord / Telegram become the primary nudge channel for at least 50% of active students within 90 days of release, reducing WhatsApp message volume by at least 40%.
- **SC-007**: Nudge delivery success rate (delivered / scheduled) is ≥ 95% across all channels after retry logic.
- **SC-008**: Zero nudges are delivered during quiet hours or exam weeks, verified by audit log.
- **SC-009**: Slug collisions resolve in real time (sub-second) and never save a duplicate.
- **SC-010**: The DSA contribution to the overall Skill Proof Score is documented on `/dashboard/skills` and changes the placement-ready flag for at least 5% of students who connect it.

## Assumptions

- LeetCode and HackerRank public APIs continue to be accessible without OAuth for read-only data; if either requires auth in the future, the integration prompts the student for an API key (deferred — out of scope for v1).
- Discord and Telegram both expose a free Bot API with a generous daily message quota. We assume no per-message cost on these channels.
- WhatsApp remains a paid channel; the product does not commit to a free WhatsApp tier in any market.
- Public profile pages are static-rendered (ISR) with a 5-minute revalidation, not per-request SSR.
- Slug uniqueness is global across the entire Antarix product, not per-institution or per-company.
- The 001 + 002 schema, RLS, and auth are reused as-is; this feature adds 3 new tables (`user_dsa_profiles`, `slug_redirects`, `external_channel_handles`, `institution_nudge_settings`) and extends `nudge_preferences` with 4 columns.
- Cron job infrastructure (pg_cron + Edge Functions) is already wired in 001/002; new edge functions follow the same pattern.
- The `antarix.app/<slug>` URL pattern is at the root of the marketing domain; it does not collide with the `/verify/[slug]` path that already exists for credential verification.
