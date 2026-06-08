# docs/architecture.md
# The 11/10 vision as a single diagram and a tour of the moving parts.
# Pair this with `ANTARIX_11_10_DEFINITIVE.md` and `specs/002-antarix-definitive-vision/spec.md`.

## One-line pitch
A verified skill intelligence platform that gives every student a public, signed proof of what they can actually do — derived passively from the work they already do — and matches them with opportunities faster than the resume-based status quo.

## The data flow
```
+----------------------+    +----------------------+    +----------------------+
|  Student sources     |    |  Edge functions      |    |  Database / views    |
|                      |    |                      |    |                      |
| - GitHub OAuth       |--->| - github-sync-fast   |    | - candidate_profiles |
| - Google Calendar    |    | - github-sync        |--->| - calendar_events    |
| - Power Mode ext.    |    | - calendar-sync      |    | - sessions           |
| - WhatsApp           |    | - exam-week-detector |    | - placement_predict. |
| - Web push           |    | - extension-heartbeat|    | - verifiable_creds   |
+----------------------+    | - nudge-trigger      |    | - extension_telemetry|
                             | - nudge-dispatch     |    | - exam_windows       |
                             | - whatsapp-send      |    | - nudges             |
                             | - push-send          |    | - cohorts            |
                             | - placement-predict  |    +----------+-----------+
                             | - credential-issue   |               |
                             | - credential-public  |<----- public URL ------+
                             | - recruiter-search   |
                             | - recruiter-invite   |    +----------------------+
                             | - interview-schedule |    |  Recruiter portal    |
                             | - sources-disconnect |--->|  (apps/web (company))|
                             +----------+-----------+    +----------------------+
                                        |
                                        v
                             +----------------------+
                             |  Student portal      |
                             |  (apps/web (student))|
                             |  - dashboard (Day-1) |
                             |  - ai-coach inbox    |
                             |  - settings/sources  |
                             |  - credential        |
                             |  - applications      |
                             +----------------------+
```

## Key decisions (lifted from `specs/002-antarix-definitive-vision/plan.md`)
- **Day-1 value**: `github-sync-fast` ingests 90 days of public commits on OAuth completion; no 7-day wait.
- **Passive → Power Mode weighting**: `getWeightingProfile({powerModeHeartbeatAt, freshnessHours})` returns 'passive' or 'power_mode'; the score recompute uses it.
- **Snapshot-only credentials**: the public URL is signed once, refreshed only when `abs(delta) >= CREDENTIAL_SNAPSHOT_REFRESH_DELTA` (default 3). See `docs/credential-system.md`.
- **Privacy-first aggregates**: opted-out students are never enumerable in any cohort count, leaderboard, or recruiter-search count. RLS `candidate_profiles_recruiter_read` and `candidate_profiles_recruiter_filter` (in `027_rls_policies_002.sql`) enforce this at the database.
- **WhatsApp cost guard**: `WHATSAPP_COST_GUARD_WEEKLY_MESSAGES_PER_STUDENT` (default 20) is a defensive cap (A-011 in scope); when exceeded, dispatch falls back to web-push. See `docs/whatsapp-setup.md`.
- **Nudge suppression**: every dispatch runs through `shouldSuppress({prefs, type, channel, localNow, examWindows})`. Quiet hours, paused users, opted-out channels, and exam windows are all gated.
- **AI Coach pipeline**: trigger → template → render → suppress → dispatch. Templates iterate without touching trigger logic.

## Project layout
```
apps/
  web/                      Next.js 15 student, college, company, verify portals
  extension/                Chrome MV3 Power Mode extension
  (no mobile in 002)
supabase/
  functions/                Edge functions (Deno)
    _shared/                6 cross-cutting helpers
    (one folder per function)
  migrations/               001-014 are the base; 015-026 are 002
packages/
  types/                    Shared TypeScript types
  utils/                    Pure helpers + unit tests
tests/
  e2e/                      Playwright
  integration/              API smoke tests
specs/
  001-antarix-complete-workflow/    The base spec
  002-antarix-definitive-vision/    The 11/10 vision spec, plan, tasks
docs/                       This file and friends
scripts/                    apply-002-migrations.sh and helpers
```

## How the user story ladder maps to code
| Story | Folder(s) | Cron / trigger | External deps |
| --- | --- | --- | --- |
| US1 Day-1 | `apps/web/(auth)/callback`, `apps/web/(student)/dashboard/_components/DayOneInsights`, `supabase/functions/github-sync-fast` | GitHub OAuth callback | GitHub OAuth app |
| US2 Passive | `supabase/functions/github-sync`, `supabase/functions/calendar-sync`, `supabase/functions/exam-week-detector`, `029_cron_002.sql` | `029_cron_002.sql` (2h / 6h / weekly) | Google Calendar OAuth |
| US3 AI Coach | `supabase/functions/{nudge-trigger, nudge-dispatch, whatsapp-send, push-send, whatsapp-webhook}`, `apps/web/(student)/{ai-coach, settings/notifications}`, `030_nudge_events.sql` | `029_cron_002.sql` (hourly) | T011 (Meta templates), VAPID keys |
| US4 Power Mode | `apps/extension/src/background/heartbeat`, `apps/web/src/components/dashboard/PowerModeBadge`, `031_power_mode_helper.sql` | 15-min extension alarm | Chrome Web Store publish |
| US5 Placement & Credential | `supabase/functions/{placement-predict, credential-issue, credential-public, one-click-apply, credential-distribute}`, `apps/web/(student)/{credential, applications, dashboard/_components/{PlacementPredictionCard, SkillProofCard}}`, `apps/web/verify/[slug]` | `029_cron_002.sql` (weekly 03:00 / daily 04:00) | none |
| US6 College | `apps/web/(college)/**`, `supabase/functions/{college-aggregate, college-curriculum-intel, college-leaderboard}` | none (on-demand) | college portal signup |
| US7 Recruiter | `apps/web/(company)/**`, `supabase/functions/{recruiter-search, recruiter-invite, interview-schedule}` | none (on-demand) | company portal signup |

## Open external dependencies
- **T011** — Meta WhatsApp Business templates (4 templates) — see `docs/whatsapp-setup.md`.
- **VAPID keys** — `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` for web-push.
- **Chrome Web Store** — Power Mode extension listing.
- **College and company portal signups** — for US6 and US7 live data.

## What ships first
- **MVP bundle (T009–T053)**: Setup + Foundational + US1 + US2 + US3.
- **Full bundle (T054–T099)**: US4 + US5 + US6 + US7 + finalization.
- **Live**: only after T011 + VAPID + portal signups.
