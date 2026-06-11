# Phase 0 Research: 005 — Mobile, Auto-Apply, Leaderboard

**Date**: 2026-06-07
**Status**: Decisions ratified; ready for Phase 1
**Brief**: 9 architectural decisions for feature 005. Each captures the choice, the rejected alternatives, and the rationale.

---

## D1. Mobile shell: Expo SDK 51+ (managed workflow) vs. bare React Native vs. Flutter

**Decision**: Expo SDK 51+ with the **managed workflow** (no `expo prebuild` for v1; native modules are limited to the Expo-curated set + a small number of config plugins). React Native New Architecture (Fabric + TurboModules) enabled on iOS 14+ and Android API 28+; legacy bridge fallback on older devices. Expo Router (file-based) for navigation.

**Alternatives considered**:
- **Bare React Native** (rejected — operational complexity; we have no mobile dev in the team; the 003 web-push + the 006 biometric bridge both have Expo modules that "just work" in managed).
- **Flutter** (rejected — different language; no Supabase-typed bindings parity; would have to re-implement the entire `packages/types/` layer in Dart).
- **React Native + Expo "prebuild" for full custom native control** (deferred to v2; v1 is fully managed).

**Rationale**: Expo is the lowest-friction path to a real App Store + Play Store binary in 2026. The team has no dedicated mobile engineer; managed workflow means EAS Build handles all native compilation. EAS Submit handles the store submission. The 003 web-push + 006 biometric ingestion + 007 mentor video are all reachable via `WebView` deep links in v1, so we do not need bare-RN custom native modules in the critical path.

**New Architecture rationale**: Fabric + TurboModules ship in RN 0.74+ stable; they give us synchronous bridge calls (Reanimated 3 worklets, react-native-skia) which are required for the streak-fire + confetti animations. Older devices fall back to the legacy bridge, which is fine for the read-only v1 surface.

**Expo Router rationale**: File-based routing matches the Next.js App Router convention we already use in `apps/web`. Onboarding / tabs / settings / jobs sub-trees mirror the web tree. Less context-switching for the team.

**EAS profile plan** (detailed in `quickstart.md` §3):
- `development` — internal distribution, hot reload, no app-store submission
- `preview` — TestFlight / Play Internal distribution, signed
- `production` — App Store / Play Store, signed + notarized

---

## D2. Auto-apply form filler: Playwright (Node) vs. Puppeteer vs. a managed service (Browserless, Steel)

**Decision**: **Playwright** (Node, headless Chromium + Firefox + WebKit), deployed as a standalone hardened Node service in the monorepo (`apps/auto-apply/`). Not a Supabase Edge Function (Playwright is too heavy for Deno). Embedded in the mobile app via `WKWebView` / Android `Chrome Custom Tab`.

**Alternatives considered**:
- **Puppeteer** (rejected — Chromium-only; Playwright's cross-engine support is materially better for ATS forms that may render differently across browsers).
- **Browserless / Steel / Anchor** (managed headless services — rejected for vendor lock-in, per-second billing, and the user's "no third-party data processors" privacy stance).
- **Supabase Edge Function with Puppeteer** (rejected — Deno has no native Puppeteer; bundle size is 250MB+; cold start is 10s+).

**Rationale**: Playwright gives us first-class headless support, a hardened sandbox via the `playwright-extra` stealth plugin, and a Node service that can deploy to Fly.io / Railway / Vercel long-running tier. The standalone Node service model also gives us per-tenant concurrency control (a hard cap of 5 sessions per tenant), which a serverless function cannot enforce cleanly.

**Hardening**:
- Per-tenant concurrency cap (default 5, configurable via `AUTO_APPLY_TENANT_CONCURRENCY`)
- Per-session 5-minute idle timeout
- Sandbox: no outbound network outside the target ATS domain; no file system access outside `/workspace`
- Per-step screenshot + `auto_apply_log` row (for audit + CAPTCHA/SSO detection)
- CAPTCHA detection: Playwright `page.on('framenavigated')` heuristic for `hcaptcha` / `recaptcha` iframes
- SSO detection: redirect URL pattern match for `okta.com`, `auth0.com`, `duo.com`, `microsoftonline.com`
- Pause + resume: the agent emits `auto_apply_log.step='captcha_detected' | 'sso_required'`; the embed view shows "please solve this — the agent is paused"; the agent's `page.waitForFunction` listens for the CAPTCHA to clear

**Hard rule**: NEVER auto-submit. The agent fills, but the final "Submit" is the student's, executed in the embedded browser view. The submit endpoint `/api/auto-apply/session/{id}/submit` is the only path that posts the form; it is invoked by the embed view's `onClick` handler, not by the agent's main code path.

---

## D3. Share-card image: `@vercel/og` (web) + `react-native-view-shot` (mobile) vs. Puppeteer screenshot

**Decision**: **`@vercel/og`** for web share cards and **`react-native-view-shot`** for the in-app share-sheet path. Two separate paths because they have different rendering targets (server-side JSX for the web PNG, native view-to-PNG for the in-app share).

**Alternatives considered**:
- **Puppeteer screenshot** (rejected — requires headless browser; 3s p95 is achievable but the infra is heavy; @vercel/og uses satori which is a pure-React-to-SVG renderer, < 100ms p95).
- **`canvas` + server-side HTML2Canvas** (rejected — slow; produces lower-quality output).
- **Single path: react-native-view-shot only** (rejected — the share card needs to render on web for OG metadata; the view-shot approach doesn't work server-side).

**Rationale**: `@vercel/og` is the standard for Vercel-deployed Next.js apps. It renders JSX to a PNG using `satori` + `@resvg/resvg-js`; cold-start is < 50ms; bundle is < 1MB. The same React component is used to render the card and to produce the OG metadata (the `og:image` URL is the rendered PNG, the `og:title` is the student's rank + score, the `og:description` is the student's handle + college + year).

**`react-native-view-shot`** captures the in-app share card as a PNG and attaches it to the OS share-sheet via `Share.share({url})` on iOS and `Share.share({message})` on Android. The card is rendered as a hidden `View` (off-screen `position: 'absolute'`, `left: -10000`) and snapshotted on demand.

**Caching**: rendered PNGs are cached on `leaderboard_share_cards` with `expires_at` = 1 hour; the cache key is `(rank_id, period)`; the cron re-renders the top-100 share cards at the time of the MV refresh.

---

## D4. Cover-letter LLM: Groq primary, OpenAI fallback (inherited from 004) vs. local Llama

**Decision**: **Groq primary + OpenAI fallback**, inherited from 004's `MOCK_INTERVIEW_PROVIDER=groq` pattern. A new env `COVER_LETTER_PROVIDER` is added but defaults to `groq` for parity.

**Alternatives considered**:
- **Local Llama** (rejected — GPU ops complexity; 004 already deferred this).
- **A single provider (no fallback)** (rejected — provider pricing changes; want portability; 004 already set the precedent).

**Rationale**: 004 ships a `LLM_FALLBACK_PROVIDER` mechanism. Cover letters extend the same gate. The new env `COVER_LETTER_WEEKLY_TOKEN_CAP=20000` is layered on top of the 004 weekly cap; the new env `COVER_LETTER_MONTHLY_TENANT_TOKEN_CAP=2000000` is **shared** with the 004 monthly cap (we do not add a second cap; we just spend from the same bucket).

**Prompt structure** (≤ 4K input tokens, ≤ 500 output tokens):
- System: "You are a cover-letter drafter for a verified Indian tech student. ≤ 400 words. Tone: warm, concrete, no buzzword bingo. Output: JSON `{ "salutation": "...", "body": "..." }`."
- User: `{ "verified_skills": [...], "verified_credentials": [...], "github_highlights": [...], "target_role": "SDE-1", "target_company": "Razorpay", "job_description": "..." }`
- Validation: body must be ≤ 400 words; if LLM exceeds, the parser truncates and writes a `cover_letter_parser_truncated` log row.

---

## D5. Materialized view refresh: nightly cron vs. incremental on-commit vs. `pg_cron` every-15-min

**Decision**: **Nightly cron** at `LEADERBOARD_CRON_HOUR_UTC=2` (configurable). Uses `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cross_college_leaderboard` to allow reads during the refresh. On lock failure, the API returns the previous refresh's data with an `X-Leaderboard-Staleness` header.

**Alternatives considered**:
- **Incremental on-commit** (rejected — the leaderboard is built from 5 different signals (skill_proof_score, streak, mock_interview, mentor_session, collab_teamwork); incremental is a partial-index nightmare).
- **15-min pg_cron** (rejected — nightly is sufficient; the SLO is "stale by ≤ 24h"; 15-min adds infra cost without SLO value).
- **Real-time via a denormalized counter** (rejected — same complexity as incremental; same denial of SLO value).

**Rationale**: A leaderboard is inherently a snapshot. Nightly is the right cadence. The SLO is "the top-100 you see is at most 24h stale" — met by a 02:00 UTC cron. The 60s opt-out propagation SLO is met by the **API layer** re-checking `leaderboard_opt_outs` against the result set; the MV is the source of "rank," the API is the source of "visible."

**Tier-band recompute**: weekly (Sunday 03:00 UTC), so the percentile bands reflect the most recent week's distribution. Cached on `leaderboard_share_cards.tier_band`.

**Opt-out propagation**: a `leaderboard_opt_outs` row write triggers a `notify` event on a `pg_notify` channel; the API layer subscribes and updates an in-memory denormalized cache with a 60s TTL. The MV is the source of rank; the cache is the source of visibility.

---

## D6. RLS pattern for public leaderboard: opt-out JOIN at the API + MV-level filter

**Decision**: Two layers of opt-out enforcement:
1. **MV level**: the `mv_cross_college_leaderboard` has an `opted_out` column (denormalized from `leaderboard_opt_outs.opted_out`); the MV's SELECT policy is a `WHERE opted_out = false` (so even service-role reads of the MV exclude opted-out students).
2. **API level**: every leaderboard route re-checks `leaderboard_opt_outs` against the result set; if a row is in the MV but the user has opted out, it is dropped in memory. This catches the 0-60s opt-out window between MV refreshes.

**Alternatives considered**:
- **MV-level only** (rejected — up to 24h opt-out latency).
- **API-level only** (rejected — MV is queried by 5+ surfaces; would need to re-check everywhere).
- **MV + RLS + API** (chosen — defense in depth; 3 layers; no single point of failure).

**Rationale**: Defense in depth. Even if a developer accidentally writes a query that bypasses the API layer, the MV's RLS policy still excludes opted-out students. Even if the MV is stale, the API layer re-checks. The cost is one extra JOIN per query; this is negligible at top-100 result size.

**Recruiter view**: separate route `GET /api/leaderboards/global?college_id=...` with RLS filter `recruiter.company_id IN (SELECT company_id FROM company_college_partnerships WHERE college_id = ?)`. Recruiters from Company A cannot see College Y's students without an explicit partnership.

---

## D7. Cover-letter daily draft cap: 5 per student per local day, `users.timezone`-based reset

**Decision**: 5 drafts per student per `users.timezone` local day. Reset at the user's local midnight. Enforced server-side at the LLM-call gate in `cover-letter/route.ts`. The cap is layered on top of the 004 weekly + monthly caps (5/day is the hard outer cap).

**Alternatives considered**:
- **Per UTC day** (rejected — unfair to IST students who would lose 5.5h of "day" each day).
- **Weekly only** (rejected — students can mass-apply in a single day; weekly is too coarse).
- **No cap** (rejected — LLM cost runaway).

**Rationale**: The user's brief says "5 drafts per student per day." The brief is ambiguous on timezone; we default to `users.timezone` for fairness. The cap is enforced by:
1. `users.cover_letter_drafts_today` denormalized counter (incremented atomically before the LLM call; decremented on parse failure).
2. A nightly cron at `LEADERBOARD_CRON_HOUR_UTC=2` (or a `pg_cron` job) that resets the counter for all users whose local day has rolled over.
3. The API checks the counter before the LLM call; if at cap, returns 429 with `code='daily_draft_cap_exceeded'`.

**UI**: a "5/5 drafts today — try again at 00:00 local" indicator on the job card.

---

## D8. Push channel priority: APNs > FCM > web-push fallback

**Decision**: A single `mobile_device_tokens` table with `kind` enum (`apns`, `fcm`, `web_push_legacy`). The push dispatcher (`apps/web/src/lib/push/dispatcher.ts`) selects the highest-priority token per `(user_id)` and dispatches. Default priority: `apns` for iOS, `fcm` for Android, `web_push_legacy` for desktop / Huawei. If the primary channel fails, the dispatcher falls back to the next available.

**Alternatives considered**:
- **Channel-per-message** (rejected — increases infra; 003 already has web-push).
- **Single channel** (rejected — APNs is iOS-only; FCM is GMS-only; web-push is fallback).

**Rationale**: 003 ships a working web-push dispatcher. APNs and FCM are added as new channels that take priority when available. The dispatcher reads from `mobile_device_tokens` and dispatches to the highest-priority token. If the dispatch fails (e.g. APNs returns `BadDeviceToken`), the token is soft-deleted; the next call falls through to the next priority.

**Token rotation**: the mobile app re-registers the device token on every cold start; the `mobile_device_tokens` table enforces `UNIQUE(user_id, device_id, kind)`; old tokens (no `last_seen_at` in 30 days) are soft-deleted by a nightly cron.

**Fallback semantics**: a Huawei device without GMS registers a `kind='web_push_legacy'` token at install; the web-push fallback is the only channel. The dispatcher handles this transparently.

---

## D9. Mobile app onboarding: deep-link from web → Expo Go detection → install

**Decision**: A web page at `https://antarix.app/launch?resume=<token>` (added in the 004 PWA; enhanced in 005). The page:
1. Detects Expo Go via a custom universal-link handler (`Linking.getInitialURL()` + the iOS associated-domains entitlement / Android intent-filter).
2. If Expo Go is installed, deep-links the user into the app with the `resume_token` parameter.
3. If not, the page shows the App Store / Play Store CTA and copies the `resume_token` to the clipboard.
4. On first launch, the mobile app reads the `resume_token` from `Linking.getInitialURL()` and resumes onboarding from the saved step.

**Alternatives considered**:
- **Web-only onboarding** (rejected — we want the user in the app for retention; the resume token is the bridge).
- **Native app only** (rejected — students who do not have the app yet still need a web path; the 003 onboarding flow continues to work for web-only).
- **QR code** (deferred — useful for desktop-to-mobile handoff; not in v1).

**Rationale**: The 003 onboarding flow is the source of truth. The 005 mobile app extends it via the resume token. The token is opaque, single-use, and TTL'd (24h); the `mobile_deep_link` table (inside `mobile_device_tokens` namespace) records issued tokens.

**Universal-link setup**:
- iOS: `apple-app-site-association` file at `https://antarix.app/.well-known/apple-app-site-association` (added in 004 PWA; the mobile bundle ID is added in 005)
- Android: `assetlinks.json` at `https://antarix.app/.well-known/assetlinks.json` (added in 004 PWA; the mobile package name + SHA-256 are added in 005)

---

## Cross-cutting decisions

- **Migrations land additive (051 + 052).** No destructive changes. Each migration is independently reversible.
- **All new edge functions emit structured logs to `supabase.functions.invoke_log`** for the existing observability stack.
- **All new external dispatches (auto-apply, push, cover-letter, share-card) log to a feature-scoped audit table** with `actor`, `subject`, `action`, `payload_hash`, `created_at`.
- **Feature flags via existing `feature_flags` table** (added in 002): every 005 capability ships behind a flag for cohort rollout.
- **All P2 features (e-sports UI) are explicitly behind a flag from day 1** so they can be rolled out to small cohorts first.
- **Auto-apply service is a sibling in the monorepo** (`apps/auto-apply/`) — not a Supabase Edge Function (Playwright is too heavy for Deno).
- **Leaderboard materialized view is `REFRESH MATERIALIZED VIEW CONCURRENTLY`** — allows reads during refresh; on lock failure the API returns previous data with `X-Leaderboard-Staleness`.
- **Opt-out is 3-layer enforced** (MV-level + RLS + API-level) — defense in depth.
- **PWA is not deprecated** — the existing 004 service worker continues to power both web and the mobile app's webview fallback.
- **ClickHouse permanently deferred** — Postgres materialized view + nightly cron handles current scale.
