# Research: Engage & Showcase

**Phase 0 output** for `003-engage-and-showcase`. Decisions made before any code is written.

## D1 — LeetCode data source

**Decision**: Use `POST https://leetcode.com/graphql` with the `matchedUser` query (public, no auth required as of 2026-06).

**Rationale**:
- No OAuth dance for the student; the only input is a username.
- Returns the fields we need: `submitStats: { acSubmissionNum { difficulty, count } }`, `contestRating`, `contestAttend`, `userCalendar { streak, totalActiveDays }`.
- Single round-trip; we can rate-limit to 1 req per 6 hours per user (matches our cron).

**Alternatives considered**:
- `https://leetcode-stats-api.herokuapp.com/<u>` — convenient, but a third-party proxy on free Heroku dynos. Rejected because SLA is unknown and the underlying endpoint is the same.
- Official LeetCode API (`https://api.leetcode.com/...`) — requires an API key that the student must provision. Rejected for v1 (out of scope per spec assumption).

**Failure modes**:
- `404` on `matchedUser` → user is private or doesn't exist → `sync_status = 'not_found'`, no score contribution, "Reconnect" CTA.
- HTTP 4xx/5xx → exponential backoff (1m, 5m, 30m), capped at 3 retries per cron tick; otherwise leave `last_synced_at` unchanged.
- Rate limit (currently undocumented but observed) → 1-hour cache on the integration card.

## D2 — HackerRank data source

**Decision**: Use `GET https://www.hackerrank.com/rest/hackers/<username>/scores` (public REST endpoint).

**Rationale**:
- Returns badges, stars, and verified-certificate counts.
- No auth; same cron cadence as LeetCode.
- Different metric shape from LeetCode (badges + certificates) — we store them in a flexible jsonb column rather than over-normalize.

**Alternatives considered**:
- HackerRank's official API (requires partner agreement). Rejected.
- Headless scraping of the public profile page. Rejected as brittle.

**Failure modes**:
- `404` → `sync_status = 'not_found'`, no score contribution.
- `403` → user has set their profile to private → `sync_status = 'private'`, "Reconnect" CTA.

## D3 — Public profile URL routing

**Decision**: Serve at `/u/[slug]` (dynamic route), with a Next.js `middleware.ts` rewrite from `/(slug-pattern)` to `/u/[slug]`.

**Rationale**:
- `/<slug>` is at the root and would collide with the system routes (`/dashboard`, `/college`, `/company`, `/onboarding`, `/settings`, `/verify`, `/api`, etc.).
- A middleware rewrite gives us a clean `antarix.app/<slug>` UX without changing the actual route name.
- The rewrite matcher only fires for paths that don't match any known system prefix; the middleware is fast (single in-memory slug lookup per request on cold cache, then ISR handles the rest).
- Static rendering (ISR with `revalidate = 300`) keeps p95 < 2s.

**Alternatives considered**:
- Subdomain `prf.antarix.app` — cleaner separation, but requires DNS + cert provisioning and changes the shareable URL shape.
- A `pages/[slug].tsx` under a route group `(public)/` — Next.js disallows dynamic segments in route groups that already have static children. The middleware approach is simpler.

**Slug validation** (mirrors the spec's reserved list and adds a regex):
- `^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$` — must start and end alphanumeric, dashes allowed in the middle.
- Reserved slugs: `admin`, `login`, `signup`, `dashboard`, `college`, `company`, `verify`, `settings`, `api`, `_next`, `onboarding`, `about`, `pricing`, `contact`, `help`, `legal`, `privacy`, `terms`, `static`, `public`, `assets`, `favicon.ico`, `robots.txt`, `sitemap.xml`.

## D4 — Public profile rendering strategy

**Decision**: Server-rendered with `revalidate = 300` (5 minutes) and `dynamic = "force-static"` for known slugs via `generateStaticParams`.

**Rationale**:
- 5-minute staleness is acceptable for a portfolio page (DSA/GitHub data syncs every 6 hours anyway).
- ISR keeps first-byte latency low and avoids per-request DB hits.
- `generateStaticParams` pre-warms the top 100 slugs (most-visited public profiles); the rest are generated on first request.

**What the page renders** (in order):
1. Profile header (avatar, name, "verified by Antarix" badge, top specialization).
2. Overall score + 5-bullet skill proof breakdown.
3. Top 5 skills (proficiency bars).
4. GitHub activity heat map (last 365 days) — a 7-row × 53-col SVG component.
5. Issued credentials list.
6. "Schedule an interview" CTA (only if `is_open_to_opportunities`).
7. Open Graph + Twitter card meta tags (generated in `generateMetadata`).

## D5 — Channel priority resolver

**Decision**: A pure function `pickChannel(prefs, quietHours, examWindow): Channel` is called by the AI Coach dispatcher (the 002 `nudge-dispatch` edge function extended to use the new resolver).

```ts
type Channel = "in_app" | "telegram" | "discord" | "whatsapp";

const PRIORITY: Record<Channel, number> = {
  in_app: 100,   // always available, opt-out doesn't suppress toasts
  telegram: 75,
  discord: 50,
  whatsapp: 25,  // paid
};

function pickChannel(
  prefs: NudgePreferences,
  quiet: boolean,
  exam: boolean,
): Channel | null {
  if (quiet || exam) return null;          // suppressed
  if (prefs.whatsapp_premium_opt_in && prefs.whatsapp_handle) return "whatsapp";
  if (prefs.telegram_handle && prefs.telegram_verified) return "telegram";
  if (prefs.discord_handle && prefs.discord_verified) return "discord";
  return "in_app";
}
```

**Rationale**:
- Pure function → easy to unit-test.
- In-app is the implicit fallback (the notification host always listens on Realtime regardless of channel prefs).
- Premium opt-in flips WhatsApp to the top of the chain.

## D6 — Discord opt-in flow

**Decision**: "Add to Discord" button on the channel card opens `https://discord.com/oauth2/authorize?client_id=<id>&scope=bot+dm_channels.read&state=<user_id_jwt>`; the OAuth callback stores the user's Discord ID and a `dm_channel_id` (obtained via `POST /users/@me/channels` after token exchange). The `state` is a short-lived JWT (5 min TTL) signed with the Supabase service-role key to prevent CSRF.

**Rationale**:
- The official Discord Bot OAuth flow is the only sanctioned way to get a user's DM channel ID without the user having to DM the bot first.
- `dm_channels.read` is the minimum scope to read DM channel metadata.
- Storing `dm_channel_id` lets the dispatcher send via `POST /channels/{id}/messages` with the bot token (no per-user OAuth token needed for sending).

**Failure modes**:
- OAuth denied → user remains disconnected, no error, no nudge attempts.
- OAuth callback returns 4xx → `external_channel_handles.disconnected_reason = 'oauth_failed'`, surface "Reconnect" CTA.
- DM send returns 403 (user blocked the bot) → auto-disconnect, surface "Reconnect" CTA on next visit.

## D7 — Telegram opt-in flow

**Decision**: "Connect Telegram" button on the channel card opens a deep link `https://t.me/<bot_username>?start=<token>` where `<token>` is a one-time JWT containing the Antarix `user_id` (10 min TTL). The user taps the link, opens the bot, taps `/start`, and the bot sends a confirmation message. The webhook handler reads the inbound `message.chat.id` and stores it in `external_channel_handles` with `verified_at = now()`.

**Rationale**:
- Industry-standard pattern: deep link → user opens the bot → bot stores the chat_id.
- One-time token prevents abuse (a malicious user can't spoof someone else's user_id).
- No need to exchange OAuth tokens; Telegram's bot API is free for read/write with a single bot token.

**Failure modes**:
- Token expired (> 10 min) → user is prompted to retry.
- Webhook returns the bot was blocked → `disconnected_reason = 'bot_blocked'`, auto-disconnect on next sync tick.

## D8 — Score contribution algorithm (DSA)

**Decision**: Add a `dsaScore` function to `lib/algorithms/dsa-score.ts` that combines LeetCode + HackerRank data into a 0–100 score with a 10-point streak bonus cap.

```ts
function dsaScore(profiles: DsaProfile[]): {
  score: number;
  components: { problem: number; contest: number; streak: number };
} {
  const problem = profiles.reduce((s, p) =>
    s + (p.easy_solved * 1 + p.medium_solved * 3 + p.hard_solved * 8), 0);
  const problemComponent = Math.min(100, problem / 50);  // 50 weighted solves = full
  const contestComponent = profiles
    .map((p) => p.contest_rating ?? 0)
    .reduce((a, b) => Math.max(a, b), 0) / 30;  // 3000 rating = full
  const streak = Math.min(10, Math.max(...profiles.map((p) => p.streak_days ?? 0)) / 7);
  return {
    score: Math.round(problemComponent * 0.6 + contestComponent * 0.3 + streak * 0.1),
    components: { problem: problemComponent, contest: contestComponent, streak },
  };
}
```

The `dsaScore` output becomes a new input to the Skill Proof Score formula: `0.85 * (existing) + 0.15 * dsa_score`. This keeps DSA additive without overriding the existing weight profile.

## D9 — Local dev for bot webhooks

**Decision**: Document `ngrok http 54321` (or `cloudflared tunnel`) as the local-dev recipe; the bot webhook handler verifies signatures using platform-issued secrets, so a tunneled URL is safe.

**Rationale**:
- Both Discord and Telegram issue signing secrets at bot creation time.
- The webhook handler verifies `X-Signature-Ed25519` (Discord) or `X-Telegram-Bot-Api-Secret-Token` (Telegram) before processing.
- A tunneled localhost URL is therefore production-equivalent for dev purposes.
