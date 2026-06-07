# Quickstart: Antarix 11/10 — Verified Skill Intelligence Platform

**Branch**: `002-antarix-definitive-vision` | **Date**: 2026-06-04
**Builds on**: `specs/001-antarix-complete-workflow/quickstart.md`

This document specifies only the **new** setup steps and environment variables introduced by the 11/10 vision. The base monorepo + Supabase + Next.js + Extension setup from spec 001 remains in place.

## New Prerequisites

- A **Meta Cloud API** WhatsApp Business account (preferred) **or** a Twilio account with WhatsApp enabled (fallback).
- A **WhatsApp message template** registered and approved for each nudge type (daily_morning, real_time_peak, streak_risk, weekly_summary) — Meta requires template approval before any non-reply message can be sent.
- A **public HTTPS webhook endpoint** for the WhatsApp provider to call back when a student replies (in dev, use a tunnel such as `cloudflared` or `ngrok` to expose `http://localhost:54321/functions/v1/whatsapp-webhook`).
- A **signed-URL secret** for the public credential verification page (HMAC key used to sign the public slug → credential lookup).

## New Environment Variables

Add to `.env.local` (and to `turbo.json` `globalEnv`):

```env
# WhatsApp — Meta Cloud API (preferred)
WHATSAPP_PROVIDER=meta_cloud
WHATSAPP_PHONE_NUMBER_ID=<your_phone_number_id>
WHATSAPP_BUSINESS_ACCOUNT_ID=<your_waba_id>
WHATSAPP_ACCESS_TOKEN=<meta_system_user_token>
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<random_64_char_string>
WHATSAPP_TEMPLATE_DAILY_MORNING=antarix_daily_morning_v1
WHATSAPP_TEMPLATE_REAL_TIME_PEAK=antarix_peak_window_v1
WHATSAPP_TEMPLATE_STREAK_RISK=antarix_streak_risk_v1
WHATSAPP_TEMPLATE_WEEKLY_SUMMARY=antarix_weekly_summary_v1

# WhatsApp — Twilio (fallback)
# Leave WHATSAPP_PROVIDER=meta_cloud unless Twilio is in use.
TWILIO_ACCOUNT_SID=<twilio_sid>
TWILIO_AUTH_TOKEN=<twilio_token>
TWILIO_WHATSAPP_FROM=<e164_number>

# Credential signing
CREDENTIAL_SIGNING_SECRET=<random_64_char_string>
CREDENTIAL_PUBLIC_BASE_URL=https://antarix.app/verify
# Minimum absolute score delta that triggers a credential snapshot refresh (see spec.md A-014)
CREDENTIAL_SNAPSHOT_REFRESH_DELTA=3

# Placement prediction
PLACEMENT_PREDICTION_MODEL_VERSION=v1-rule-augmented
PLACEMENT_PREDICTION_MIN_DAYS=30

# Defensive WhatsApp cost guard (see spec.md A-011)
# Soft per-student weekly cap; over the cap, the next nudge falls back to push-only and a metric is emitted.
WHATSAPP_COST_GUARD_WEEKLY_MESSAGES_PER_STUDENT=20
WHATSAPP_COST_GUARD_WEEKLY_RESET_DAY=0
# 0 = Sunday (Nudge weekly summary day), 1 = Monday, etc.

# Nudge scheduling
NUDGE_DEFAULT_DAILY_LOCAL_TIME=08:00
NUDGE_DEFAULT_WEEKLY_LOCAL_DAY=0
NUDGE_DEFAULT_WEEKLY_LOCAL_TIME=10:00
NUDGE_DEFAULT_QUIET_START=22:00
NUDGE_DEFAULT_QUIET_END=07:00
NUDGE_EXAM_WEEK_KEYWORD_DENSITY_THRESHOLD=0.6
NUDGE_POWER_MODE_BADGE_FRESHNESS_HOURS=24
```

## New Migrations (apply on top of spec 001's 11 migrations)

The schema migrations for 002 introduce 11 new tables and additive column deltas. Tasks also create a small number of follow-up files (RLS for the new tables, pg_cron schedules, helper SQL functions, and the `nudge_preferences` default trigger that fires on user insert). The full set, in apply order, is:

```text
supabase/migrations/
├── 001_users.sql                  # (001)
├── 002_sessions.sql               # (001)
├── 003_github.sql                 # (001)
├── 004_calendar.sql               # (001)
├── 005_skills.sql                 # (001)
├── 006_insights.sql               # (001)
├── 007_cohorts.sql                # (001)
├── 008_institutions.sql           # (001)
├── 009_companies.sql              # (001)
├── 010_rls_policies.sql           # (001)
├── 011_functions.sql              # (001)
├── 020_whatsapp.sql               # T013 — whatsapp_connections, nudge_preferences, nudges, nudge_responses
├── 021_predictions.sql            # T014 — placement_predictions, exam_windows
├── 022_credentials.sql            # T015 — verifiable_credentials, credential_distributions
├── 023_applications.sql           # T016 — student_applications, interview_slots
├── 024_extension_telemetry.sql    # T017 — extension_telemetry
├── 025_privacy.sql                # T018 — privacy_requests, account-deletion triggers
├── 026_user_deltas.sql            # T019 — additive columns on 001 tables + the nudge_preferences default trigger
├── 027_rls_policies_002.sql       # T020 — RLS for all 002 tables
├── 028_nudge_prefs_default.sql    # T033 — explicit default nudge_preferences row on user insert (folded into 018 in tasks; file kept here for the standalone-task version)
├── 029_cron_002.sql               # T037, T051, T067 — pg_cron schedules (github-sync, calendar-sync, exam-week-detect, nudge-trigger, placement-predict, credential-issue)
├── 030_nudge_events.sql           # T046, T052 — trigger_nudge_event helper + Power-Mode event triggers
└── 031_power_mode_helper.sql      # T058 — v_power_mode_status view
```

Apply with: `npx supabase db push` (same command as 001). The T033 nudge_preferences default trigger is folded into `026_user_deltas.sql` in the canonical tasks list, with `028_nudge_prefs_default.sql` listed above as the standalone-task equivalent for teams that prefer one trigger per file.

## New Edge Functions

```text
supabase/functions/
├── (001 functions retained)
├── whatsapp-send/              # Renders template + dispatches to provider; called by nudges worker
├── whatsapp-webhook/           # Receives inbound replies; updates nudge_responses
├── nudge-trigger/              # Cron-driven: daily 8 AM, weekly Sunday 10 AM, hourly streak check
├── placement-predict/          # Weekly pg_cron call; writes placement_predictions
├── credential-issue/           # Creates / refreshes verifiable_credentials rows
├── credential-public/          # Public route at /functions/v1/credential/{slug} for antarix.app/verify/{slug}
├── exam-week-detect/           # Weekly calendar scan; writes exam_windows
└── account-deletion-purge/     # Daily job; purges accounts past deletion_purge_after
```

Serve locally with: `npx supabase functions serve --env-file ./supabase/.env.local.functions`

## New Frontend Routes

```text
apps/web/src/app/(student)/
├── dashboard/                  # (001) Updated to render Day-1 insights (per FR-004)
├── onboarding/                 # (001) Streamlined to 3 minutes
├── ai-coach/                   # NEW — Inbox of all nudges + reply interface
├── credential/                 # NEW — Manage + export verifiable credential
├── settings/
│   ├── sources/                # NEW — GitHub / Calendar / WhatsApp connect/disconnect
│   ├── notifications/          # NEW — Nudge preferences, quiet hours, pause all
│   └── privacy/                # NEW — Company-search opt-out, account deletion
└── applications/               # NEW — Student's one-click-apply history
```

## New Extension Features

```text
apps/extension/src/background/
├── heartbeat.ts                # NEW — Sends a heartbeat to extension_telemetry every 15 min while running
└── (001 service-worker, focus-monitor, sync retained)
```

## Local End-to-End Test (Day-1 Value Flow)

```bash
# 1. Start infra (inherited from 001)
pnpm install
npx supabase start
npx supabase db push

# 2. Apply new 002 migrations
npx supabase db push   # picks up 012-018
npx supabase functions deploy --local whatsapp-send whatsapp-webhook nudge-trigger

# 3. Seed a test student with a real GitHub user (replace with any public account)
psql "$DATABASE_URL" -c "SELECT seed_test_student('sharondav');"

# 4. Run the web app
pnpm --filter web dev

# 5. Expose WhatsApp webhook for local testing
cloudflared tunnel --url http://localhost:54321

# 6. In the Meta WhatsApp dashboard, point the webhook at the cloudflared URL
#    /functions/v1/whatsapp-webhook?verify=<WHATSAPP_WEBHOOK_VERIFY_TOKEN>

# 7. Test the Day-1 value flow:
#    - Sign up via "Continue with GitHub"
#    - Confirm dashboard shows real GitHub-derived insights within 60 seconds
#    - Connect WhatsApp
#    - Trigger a manual nudge via psql:
#       SELECT trigger_daily_morning_nudge('<user_id>');
#    - Confirm WhatsApp delivery (or push fallback)
```

## New Tests

```text
tests/
├── e2e/
│   ├── day1-onboarding.spec.ts          # NEW — Signup → real insights in < 3 min
│   ├── ai-coach-whatsapp.spec.ts        # NEW — Nudge delivery + interactive commands
│   ├── credential-public-page.spec.ts   # NEW — antarix.app/verify/{slug} renders + invalidates on score change
│   └── privacy-opt-out.spec.ts          # NEW — Opted-out students never appear in recruiter search
└── integration/
    ├── placement-prediction.test.ts     # NEW — Rule-augmented scorer outputs documented fields
    ├── exam-week-suppression.test.ts    # NEW — Real-time nudges suppressed during detected exam windows
    └── credential-threshold.test.ts     # NEW — Snapshot refresh + disclosure on score delta
```
