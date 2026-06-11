# Quickstart: 005 — Mobile, Auto-Apply, Leaderboard

**Date**: 2026-06-07
**Prereqs**: 001 + 002 + 003 + 004 + 006 + 007 + 008 quickstarts already executed.

## 1. New environment variables

Add to `.env.local` (and document in `.env.local.example`):

```env
# ─── Mobile app ─────────────────────────────────────────────────────────────────
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_SUPABASE_URL=<supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
EXPO_PUBLIC_DEEP_LINK_SCHEME=antarix
EXPO_PUBLIC_UNIVERSAL_LINK_HOST=antarix.app
EAS_PROJECT_ID=<eas-project-id>
EAS_TOKEN=<eas-token>
EXPO_PUBLIC_APP_VERSION=1.0.0

# ─── Push channels ──────────────────────────────────────────────────────────────
# APNs (iOS)
APNS_KEY_ID=<apns-key-id>
APNS_TEAM_ID=<apple-team-id>
APNS_BUNDLE_ID=app.antarix.mobile
APNS_KEY_PATH=/run/secrets/apns_auth_key.p8
APNS_PRODUCTION=false  # set true for production builds

# FCM (Android)
FCM_PROJECT_ID=<fcm-project-id>
FCM_SERVICE_ACCOUNT_JSON_PATH=/run/secrets/fcm_service_account.json

# Web-push fallback (inherited from 003)
# (VAPID keys already set in 003 quickstart)

# ─── Auto-apply ─────────────────────────────────────────────────────────────────
AUTO_APPLY_SERVICE_URL=http://localhost:3001
AUTO_APPLY_TENANT_CONCURRENCY=5
AUTO_APPLY_SESSION_IDLE_TIMEOUT_SECONDS=300
AUTO_APPLY_BROWSERS_PATH=/usr/local/share/playwright-browsers
COVER_LETTER_PROVIDER=groq                    # or openai
COVER_LETTER_API_KEY=<provider-api-key>
COVER_LETTER_MODEL=llama-3.1-70b-versatile
COVER_LETTER_DAILY_DRAFT_CAP=5
COVER_LETTER_WEEKLY_TOKEN_CAP=20000
COVER_LETTER_MONTHLY_TENANT_TOKEN_CAP=2000000
COVER_LETTER_MAX_WORDS=400
PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright-browsers

# ─── Leaderboard ────────────────────────────────────────────────────────────────
LEADERBOARD_CRON_HOUR_UTC=2
LEADERBOARD_TIER_RECOMPUTE_DAY=0                # 0=Sunday
LEADERBOARD_TIER_RECOMPUTE_HOUR_UTC=3
LEADERBOARD_TIER_BANDS=bronze:0-50,silver:50-75,gold:75-90,platinum:90-97,diamond:97-100
LEADERBOARD_PUBLIC_API_RATE_LIMIT_RPM=60
LEADERBOARD_RECRUITER_VIEW_DEFAULT_LIMIT=100
LEADERBOARD_SHARE_CARD_TTL_HOURS=1
LEADERBOARD_STALENESS_HEADER=true
LEADERBOARD_REFRESH_MAX_RETRIES=3

# ─── Mobile session ────────────────────────────────────────────────────────────
MOBILE_SESSION_HEARTBEAT_SECONDS=60
MOBILE_SESSION_IDLE_TIMEOUT_MINUTES=30
MOBILE_TOKEN_RETENTION_DAYS=30
```

## 2. Migrations (run in order)

```bash
pnpm supabase db push       # applies 051, 052 in sequence
```

Migration order:
1. `051_mobile_autoapply.sql` — 6 tables + 1 materialized view + 2 column additions to `users`, 2 column additions to `student_applications`
2. `052_cron_005.sql` — 5 cron jobs (`leaderboard-refresh`, `leaderboard-tier-recompute`, `mobile-token-cleanup`, `auto-apply-daily-cap-reset`, `leaderboard-opt-out-propagator`)

## 3. New Edge Functions to deploy

```bash
pnpm supabase functions deploy leaderboard-refresh
pnpm supabase functions deploy leaderboard-tier-recompute
pnpm supabase functions deploy mobile-token-cleanup
pnpm supabase functions deploy auto-apply-daily-cap-reset
pnpm supabase functions deploy leaderboard-opt-out-propagator
```

## 4. New workspaces to register

The brief asked for the `pnpm-workspace.yaml` addition. The existing `pnpm-workspace.yaml` globs `apps/*` and `packages/*`; no YAML change is required. The new workspaces are:

```text
apps/mobile/        # @antarix/mobile  — Expo SDK 51+, Expo Router
apps/auto-apply/    # @antarix/auto-apply  — hardened Node service (Playwright)
```

Each has its own `package.json` declaring its workspace name. `turbo.json` `pipeline` is extended to add:

```json
{
  "pipeline": {
    "@antarix/mobile": {
      "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
      "start": { "cache": false },
      "eas-build:development": { "cache": false },
      "eas-build:preview": { "cache": false },
      "eas-build:production": { "cache": false }
    },
    "@antarix/auto-apply": {
      "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
      "start": { "cache": false },
      "lint": {},
      "test": {}
    }
  }
}
```

## 5. EAS Build profiles (in `apps/mobile/eas.json`)

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "env": { "EXPO_PUBLIC_API_BASE_URL": "http://localhost:3000" }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_BASE_URL": "https://staging.antarix.app" }
    },
    "production": {
      "ios": { "distributionType": "app-store" },
      "android": { "buildType": "app-bundle" },
      "env": { "EXPO_PUBLIC_API_BASE_URL": "https://antarix.app" }
    }
  },
  "submit": {
    "production": {
      "ios": { "ascAppId": "<app-store-connect-app-id>" },
      "android": { "serviceAccountKeyPath": "/run/secrets/play_service_account.json" }
    }
  }
}
```

## 6. Auto-apply headless dev setup

The auto-apply service is a hardened Node service that runs Playwright headless Chromium.

**Local setup**:

```bash
# 1. Install Playwright browsers (one-time)
cd apps/auto-apply
pnpm install
pnpm exec playwright install --with-deps chromium

# 2. Start the service
pnpm start                    # listens on :3001
PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright-browsers pnpm start
```

**Docker setup** (for Fly.io / Railway / Vercel long-running tier):

```dockerfile
# apps/auto-apply/Dockerfile
FROM mcr.microsoft.com/playwright:v1.45.0-jammy
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY dist ./dist
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**Sandbox hardening** (defaults, configurable):

- Per-tenant concurrency cap: 5 (`AUTO_APPLY_TENANT_CONCURRENCY`)
- Per-session idle timeout: 5 minutes (`AUTO_APPLY_SESSION_IDLE_TIMEOUT_SECONDS`)
- Network: only the target ATS domain is allowed outbound; everything else blocked
- File system: only `/workspace` is writable; no reads outside `/workspace`
- Process: hard kill at 30s CPU / 256MB memory per page

## 7. Local mobile dev with Expo Go

```bash
# 1. Install Expo Go on your iOS or Android device
#    iOS: https://apps.apple.com/app/expo-go/id982107779
#    Android: https://play.google.com/store/apps/details?id=host.exp.exponent

# 2. Start the dev server
cd apps/mobile
pnpm install
pnpm start                   # opens the Metro bundler + a QR code

# 3. Scan the QR code with the Expo Go app (iOS Camera / Android Expo Go)

# 4. Verify deep-link: open https://antarix.app/launch?resume=<test-token> in Safari/Chrome on the device;
#    Expo Go should auto-open and resume onboarding
```

## 8. Universal-link + intent-filter setup (one-time)

### iOS — `apple-app-site-association`

Add the mobile bundle ID to the existing `apps/web/public/.well-known/apple-app-site-association` file:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["<APPLE_TEAM_ID>.app.antarix.mobile"],
        "components": [
          { "/": "/launch", "comment": "Expo deep-link resume" },
          { "/": "/leaderboard/*", "comment": "Share-card deep link" },
          { "/": "/collab/rooms/*", "comment": "008 collab room deep link" }
        ]
      }
    ]
  }
}
```

### Android — `assetlinks.json`

Add the mobile package + SHA-256 to the existing `apps/web/public/.well-known/assetlinks.json` file:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.antarix.mobile",
      "sha256_cert_fingerprints": ["<SHA-256>"]
    }
  }
]
```

## 9. Mobile app first-run smoke test

After EAS Build `development` is installed on a device:

1. Open the app cold-start.
2. The onboarding flow should appear (no auto-login).
3. Tap "Sign in with biometric" → the device's biometric prompt should fire.
4. After auth, the dashboard should render with the 7-tile grid.
5. The leaderboard tile should fetch `/api/v1/public/leaderboard/global?period=weekly&limit=10` and show a top-10 list.
6. The jobs tile should fetch `/api/job-matches?status=open&limit=20` and show a list.
7. Push: navigate to `/settings/push`, tap "Enable push" → APNs/FCM should register and the `mobile_device_tokens` table should have a new row with `kind='apns'` (iOS) or `kind='fcm'` (Android).
8. Send a test push: `eas push:notification --to=<device_token> --title="Test" --body="Hello from Antarix"`.

## 10. Auto-apply first-session E2E

1. Sign in as a student with verified credentials (use the seed script in `tests/e2e/auto-apply-cover-letter.spec.ts`).
2. POST `/api/auto-apply/cover-letter` with a real job description:

```bash
curl -X POST http://localhost:3000/api/auto-apply/cover-letter \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "<uuid>",
    "job_description": "We are looking for an SDE-1 to join our payments team. You will work on ..."
  }'
```

3. Assert: response is a `cover_letter` ≤ 400 words within 8s.
4. POST `/api/auto-apply/session`:

```bash
curl -X POST http://localhost:3000/api/auto-apply/session \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "<uuid>",
    "embed_view": "mobile"
  }'
```

5. Assert: response is an `embed_url` and a `session_id` within 5s.
6. Open the `embed_url` in a `WKWebView` (mobile) or a browser (web). The Playwright headless view should render the ATS form prefilled with the student's verified data.
7. Verify: 10+ `auto_apply_log` rows exist for the session, each with a `step` and a `latency_ms`.
8. Click "Submit" in the embed view.
9. Verify: 1 additional `auto_apply_log` row with `step='submit'` and `student_applications.status='submitted'`.
10. Confirm: the agent never auto-submitted (no `submit` log row exists before the student clicked Submit).

## 11. Leaderboard first-refresh + opt-out

1. Sign in as a student.
2. POST `/api/leaderboards/opt-out`:

```bash
curl -X POST http://localhost:3000/api/leaderboards/opt-out \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "prefer private" }'
```

3. Assert: 1 row in `leaderboard_opt_outs` with `opted_out=true`.
4. GET `http://localhost:3000/api/v1/public/leaderboard/global?period=weekly&limit=10` and confirm the student is **not** in the response.
5. Trigger a manual refresh of the MV:

```bash
psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cross_college_leaderboard;"
```

6. Re-run the GET — the student is still excluded (the MV is also opted-out-clean).
7. DELETE the opt-out:

```bash
curl -X DELETE http://localhost:3000/api/leaderboards/opt-out \
  -H "Cookie: <session-cookie>"
```

8. Re-run the GET — the student is back in the response within 60s (the API layer re-checks the opt-out and re-includes).

## 12. Feature flags (recommended rollout)

Behind feature flags from day 1 (use the existing `feature_flags` table):

- `005_mobile_app` — Day 0 GA (P1)
- `005_auto_apply_cover_letter` — Day 0 GA (P1) — but tenant-gated to 1 pilot tenant for the first 30 days
- `005_auto_apply_headless` — Day 14 cohort rollout (P1)
- `005_leaderboard_global` — Day 0 GA (P1) — opted-in by default; opt-out via `/settings/leaderboard`
- `005_esports_ui` — Day 21 cohort rollout (P2)
- `005_share_card_og` — Day 14 cohort rollout

## 13. Smoke tests

```bash
pnpm test                                          # unit (vitest)
pnpm test:e2e -- --grep "mobile"                   # mobile onboarding, dashboard
pnpm test:e2e -- --grep "auto-apply"               # cover letter, headless, kill-switch, no-autosubmit
pnpm test:e2e -- --grep "leaderboard"              # public, opt-out, recruiter view
pnpm test:e2e -- --grep "share-card"               # OG metadata, PNG render
pnpm test:e2e -- --grep "esports"                  # streak fire, confetti, tier badge
pnpm test:detox -- --grep "mobile"                 # Detox E2E for the mobile app
```

## 14. Observability

- Auto-apply: query `auto_apply_log` joined to `student_applications` for daily fill volume; per-domain kill-switch hits in `auto_apply_log.step='kill_switch_hit'`
- Cover letter: per-student weekly token usage → cap-breach alerting
- Mobile app: `mobile_app_sessions` for cold-start volume + crash rate; `mobile_device_tokens` for channel coverage
- Push delivery: per-channel success rate; soft-deleted token count
- Leaderboard MV: `supabase.functions.invoke_log` for `leaderboard-refresh` runs; `X-Leaderboard-Staleness` header in API responses
- Tier-band recompute: weekly cron; alert on missing `leaderboard_share_cards.tier_band` for any top-100 row
- Opt-out propagation: `pg_notify` event count + cache hit rate

## 15. App Store submission

### TestFlight (iOS)

1. EAS Build `production` profile.
2. EAS Submit → App Store Connect.
3. Fill in the App Review information: demo account (a seed student), test instructions, contact info.
4. Submit for review.
5. Expected review time: 24-48h (Antarix is a productivity app, not a social network, so review is generally fast).

### Play Internal (Android)

1. EAS Build `production` profile.
2. EAS Submit → Google Play Console → Internal Testing track.
3. Add the seed-student test account to the Internal Testing testers list.
4. Roll out to Internal Testing (the fastest track; Closed/Open testing take longer).

## 16. Rollback

Each migration is a pure additive `CREATE TABLE` + `ALTER TABLE ADD COLUMN` + `CREATE MATERIALIZED VIEW`. To roll back:

```bash
pnpm supabase migration repair --status reverted 052 051
# then re-apply the corresponding DROP statements (held in supabase/migrations/_rollback/005/)
```

The materialized view is the only complex rollback; the reverse statement is:

```sql
DROP MATERIALIZED VIEW IF EXISTS mv_cross_college_leaderboard CASCADE;
DROP TABLE IF EXISTS auto_apply_log CASCADE;
DROP TABLE IF EXISTS auto_apply_templates CASCADE;
DROP TABLE IF EXISTS leaderboard_share_cards CASCADE;
DROP TABLE IF EXISTS leaderboard_opt_outs CASCADE;
DROP TABLE IF EXISTS mobile_device_tokens CASCADE;
DROP TABLE IF EXISTS mobile_app_sessions CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS cover_letter_drafts_today;
ALTER TABLE users DROP COLUMN IF EXISTS last_mobile_session_at;
ALTER TABLE student_applications DROP COLUMN IF EXISTS cover_letter_text;
ALTER TABLE student_applications DROP COLUMN IF EXISTS auto_apply_session_id;
```

Feature flags allow logical rollback without DB migration reversal. The auto-apply service can be shut down by flipping `005_auto_apply_headless` to `enabled=false` — no in-flight sessions are force-killed; they complete or hit the 5-min idle timeout.
