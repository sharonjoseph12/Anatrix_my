# Tasks: 008 — Collaborative Mode

**Feature**: `008-collaborative-mode`
**Generated**: 2026-06-07
**Source**: `specs/008-collaborative-mode/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`

Atomic, dependency-ordered tasks. `[P]` = parallelizable with siblings sharing the same phase prefix. **Bold** tasks are critical-path.

**Total: 125 tasks** (T001–T200, with intentional gaps for parallel-phase readability).

---

## Phase 0 — Pre-flight

- [x] T001 [P] Verify 001-007 task completion (live ledger has 001-007; 004 has 141 tasks, 007 has its own set)
- [x] T002 [P] Survey existing migrations (001-042 present); confirm brief's stated number 041 collides with `047_webhooks.sql`; fallback is 043
- [x] T003 [P] Survey existing edge functions; confirm `collab-*` and `teamwork-*` names don't clash
- [x] T004 [P] Add 008 env vars to `.env.local.example` (per quickstart §1)
- [x] T005 [P] Add 008 env vars to `turbo.json` `globalEnv` array
- [x] T006 Add new dependencies to `apps/web/package.json`: `@liveblocks/client`, `@liveblocks/yjs`, `@liveblocks/node`, `yjs`, `y-monaco`, `@monaco-editor/react`, `@livekit/components-react`, `livekit-client`, `livekit-server-sdk`, `@webcontainer/api`, `xterm`
- [x] T007 Add `flyctl` deploy script + CI workflow for `apps/sandbox-firecracker/`
- [ ] T008 [P] Provision Liveblocks + LiveKit accounts (per quickstart §4-5); store keys in 1Password; mark secret-rotation cadence
- [x] T009 [P] Create `apps/sandbox-firecracker/` standalone Node + WS service skeleton (Dockerfile + fly.toml placeholder)

---

## Phase 1 — Migration 041 (single, all parallel after env)

- [x] **T010 [P] Migration `047_collab.sql`** — 9 tables (`collab_rooms`, `collab_participants`, `collab_events`, `collab_artifacts`, `teamwork_scores`, `collab_recordings`, `collab_consents`, `collab_snapshots`, `collab_audit`); column additions: `users.collab_opt_out`, `anticheat_signals.signal` enum extension; indexes + RLS policies per data-model.md
- [ ] T011 [P] `044_pg_partman_collab.sql` — monthly partitioning on `collab_events` (inherited `pg_partman` pattern from 004)
- [ ] T012 [P] Seed `008_collab_*` feature flags in `supabase/seed.sql` (per quickstart §10)
- [ ] T013 [P] Seed `collab_consent_default_retention_days=90` and `collab_teamwork_score_weights` into `app_settings`
- [ ] T014 [P] Verify migration idempotency: re-apply locally and assert no errors

**Checkpoint**: 9 new tables created. RLS verified. `pnpm supabase db reset` clean. Migration ledger reconciled per `plan.md` §1.

---

## Phase 2 — Shared types + utilities [all parallel after Phase 1]

- [ ] T020 [P] `packages/types/collab.ts` — TS types for `CollabRoom`, `CollabParticipant`, `CollabEvent`, `CollabArtifact`, `TeamworkScore`, `CollabRecording`, `CollabConsent`, `CollabSnapshot`
- [ ] T021 [P] `packages/types/collab-events.ts` — typed event enum + payload shapes (zod schemas for each event_type)
- [ ] T022 [P] Extend `packages/types/anticheat.ts` — add `'collab_typing_divergence'` to the `signal` union
- [ ] T023 [P] Extend `packages/types/database.ts` — regenerate via `supabase gen types` to include the 9 new tables
- [ ] T024 [P] `packages/utils/feature-flags.ts` — add `008_collab_*` flag helpers
- [ ] T025 [P] `packages/utils/cron.ts` — add 008 cron registrations (`teamwork-scorer`, `collab-recording-purge`, `collab-snapshot-cleanup`)
- [ ] T026 [P] `packages/utils/collab-opt-out.ts` — opt-out resolver (used at room-join time to snapshot `users.collab_opt_out` into `collab_participants.opt_out_teamwork`)

---

## Phase 3 — Liveblocks setup [critical path]

- [ ] **T030 `apps/web/src/lib/collab/liveblocks.ts`** — `getClient(roomId, userId)`, `getServerAuthToken(roomId, userId, permission)`, `downgradeObserverToken(roomId, observerId)` (uses `@liveblocks/node`)
- [ ] T031 [P] Unit tests `tests/integration/liveblocks-auth.test.ts` — auth token mint, permission scope, downgrade-on-revoke
- [ ] T032 [P] `apps/web/src/components/collab/collab-editor.tsx` — Monaco + Y.js + Liveblocks binding (uses `y-monaco` + `@liveblocks/yjs`)
- [ ] T033 [P] `apps/web/src/lib/collab/yjs-snapshot.ts` — `encodeUpdate(doc)`, `applyUpdate(doc, update)`, `mergeUpdates(updates)` (binary Y.js helpers)
- [ ] T034 [P] Unit tests `tests/integration/yjs-snapshot.test.ts` — roundtrip snapshot + rehydrate, 5-minute cadence boundary

---

## Phase 4 — LiveKit setup [parallel with Phase 3]

- [ ] **T040 `apps/web/src/lib/collab/livekit.ts`** — `mintToken(roomId, userId, { canPublish, canSubscribe })` (uses `livekit-server-sdk`); helper for `mintObserverToken(roomId, observerId)` (publish=false)
- [ ] T041 [P] Unit tests `tests/integration/livekit-token-mint.test.ts` — publisher + observer token scopes, TTL, identity claim
- [ ] T042 [P] `apps/web/src/components/collab/collab-voice.tsx` — LiveKit room component (uses `@livekit/components-react`)
- [ ] T043 [P] `apps/web/src/components/collab/collab-presence.tsx` — presence indicators (cursors, selection, online status)

---

## Phase 5 — Code sandbox [depends on Phase 3, 4]

### 5a. WebContainer (browser) — JS/TS/Python

- [ ] **T050 `apps/web/src/lib/collab/webcontainer.ts`** — `bootWebContainer({ files, onReady, onError })`, `runTests({ testCommand, onStdout, onStderr, timeoutMs })`, `tearDown()`. Default `network: 'disabled'`. Egress attempts throw `SandboxEgressBlocked` and emit `collab_events.sandbox_egress_blocked`.
- [ ] T051 [P] `apps/web/scripts/build-sandbox-assets.sh` — pre-bake the static sandbox files into `apps/web/public/sandbox/`
- [ ] T052 [P] `apps/web/src/components/collab/collab-terminal.tsx` — xterm.js binding to WebContainer stdout/stderr (for JS/TS/Python rooms)
- [ ] T053 [P] `apps/web/src/app/(student)/collab/layout.tsx` — set COOP/COEP headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`); set `X-Frame-Options: DENY`

### 5b. Firecracker (remote) — Go/Rust/other

- [ ] **T060 `apps/sandbox-firecracker/src/server.ts`** — Node + WS service: receives boot request, allocates microVM from pool, returns WS URL for terminal
- [ ] T061 [P] `apps/sandbox-firecracker/src/vm-pool.ts` — microVM pool (lazy alloc, idle reaper)
- [ ] T062 [P] `apps/sandbox-firecracker/src/runtime/python.ts`, `go.ts`, `rust.ts` — language-specific runtimes (test-run wrappers)
- [ ] T063 [P] `apps/sandbox-firecracker/Dockerfile` — base image with Firecracker + language runtimes
- [ ] T064 [P] `apps/sandbox-firecracker/fly.toml` — Fly.io config (ap-south-1 primary, ap-southeast-1 secondary)
- [ ] T065 `apps/web/src/lib/collab/firecracker-client.ts` — WS client to Fly.io sandbox; boot + runTests + tearDown mirror of WebContainer interface
- [ ] T066 [P] `apps/web/src/components/collab/collab-terminal.tsx` — extend to route Go/Rust rooms to `firecracker-client` instead of WebContainer

### 5c. Sandbox manager (router)

- [ ] T070 `apps/web/src/lib/collab/sandbox-manager.ts` — picks `webcontainer` vs `firecracker` based on `collab_rooms.sandbox_kind`; abstract interface so UI doesn't care
- [ ] T071 [P] E2E `tests/e2e/collab-webcontainer-egress-block.spec.ts` — JS room tries `fetch('https://evil.com')`; assert `sandbox_egress_blocked` event recorded

---

## Phase 6 — Collab API routes [depends on Phase 3, 4, 5]

- [ ] **T080 `apps/web/src/app/api/collab/rooms/route.ts`** — POST create (validates body, INSERT `collab_rooms`, INSERT host `collab_participants`, generates per-invitee join_token, sends invites)
- [ ] T081 [P] `apps/web/src/app/api/collab/rooms/[id]/route.ts` — GET room meta (host, participants, status, remaining_seconds)
- [ ] T082 [P] `apps/web/src/app/api/collab/rooms/[id]/join/route.ts` — POST join (validates `join_token`, UPSERT `collab_participants`, mints Liveblocks + LiveKit tokens, returns bundle)
- [ ] T083 [P] `apps/web/src/app/api/collab/rooms/[id]/end/route.ts` — POST end (validates host or service role, UPDATE `collab_rooms.status`, INSERT `collab_artifacts`, INSERT leave events, ENQUEUE `teamwork-scorer`)
- [ ] T084 [P] `apps/web/src/app/api/collab/rooms/[id]/teamwork/route.ts` — GET score + breakdown (RLS-aware; returns 425 if scoring pending)
- [ ] T085 [P] `apps/web/src/app/api/collab/rooms/[id]/consent/route.ts` — POST/DELETE consent (INSERT/UPDATE `collab_consents`, INSERT `collab_audit`)
- [ ] T086 [P] `apps/web/src/app/api/collab/rooms/[id]/observe/route.ts` — POST observer (validate `collab_consents`, mint READ_ONLY Liveblocks + observer LiveKit tokens, INSERT `collab_participants` + `collab_recordings` + `collab_audit`, send participant notifications)
- [ ] T087 [P] `apps/web/src/app/api/collab/rooms/[id]/events/route.ts` — POST event ingestion (validate seq, INSERT into `collab_events`; return 409 on seq conflict)
- [ ] T088 [P] `apps/web/src/app/api/collab/rooms/[id]/snapshots/route.ts` — POST snapshot (upload to Supabase Storage, INSERT `collab_snapshots`); GET `/latest` (return most recent)
- [ ] T089 [P] `apps/web/src/app/api/collab/rooms/[id]/transcript/route.ts` — GET transcript (returns chat messages in order)
- [ ] T090 [P] `apps/web/src/app/api/collab/recruiter/reviews/[roomId]/route.ts` — GET review payload (RLS-aware; PII-redacted)
- [ ] T091 [P] `apps/web/src/app/api/settings/collab-opt-out/route.ts` — POST opt-out toggle (UPDATE `users.collab_opt_out`, INSERT `collab_audit`)
- [ ] T092 [P] `apps/web/src/app/api/collab/rooms/[id]/interviewer-post-problem/route.ts` — POST problem (observer-only, INSERT `collab_events.interviewer_posted_problem`, broadcast via Liveblocks awareness)

---

## Phase 7 — UI shell [parallel with Phase 6]

- [ ] **T100 `apps/web/src/app/(student)/collab/page.tsx`** — list of upcoming + past rooms; "create room" button (gated by `008_collab_rooms` flag)
- [ ] T101 [P] `apps/web/src/app/(student)/collab/[id]/page.tsx`** — room entry (auth + role redirect to editor or observer view)
- [ ] T102 [P] `apps/web/src/app/(student)/collab/[id]/editor/page.tsx`** — student/mentor editor view (Monaco + terminal + voice + presence)
- [ ] T103 [P] `apps/web/src/app/(student)/collab/[id]/settings/page.tsx`** — in-room settings (voice mute, terminal scrollback size, language)
- [ ] T104 [P] `apps/web/src/app/(student)/collab/history/page.tsx`** — past rooms + scores (read-only)
- [ ] T105 [P] `apps/web/src/app/(recruiter)/observe/page.tsx`** — consent-gated room list (gated by `008_recruiter_observe` flag)
- [ ] T106 [P] `apps/web/src/app/(recruiter)/observe/[id]/page.tsx`** — live observer view (READ_ONLY editor, no voice publish, problem-post banner in interview mode)
- [ ] T107 [P] `apps/web/src/app/(recruiter)/observe/[id]/review/page.tsx`** — recorded review (code + transcript + terminal + score + contribution chart)
- [ ] T108 [P] `apps/web/src/app/(college)/mentor/collab-review/page.tsx`** — mentor queue of `conflict_unresolved` flags (gated by `008_anti_collusion` flag)
- [ ] T109 [P] `apps/web/src/app/settings/collab-opt-out/page.tsx`** — privacy toggle UI
- [ ] T110 [P] `apps/web/src/components/collab/collab-consent-dialog.tsx` — per-room consent grant UI (shows what observer will see)
- [ ] T111 [P] `apps/web/src/components/collab/collab-opt-out-toggle.tsx` — settings privacy toggle
- [ ] T112 [P] `apps/web/src/components/collab/collab-artifact-renderer.tsx` — read-only code + transcript renderer
- [ ] T113 [P] Extend `apps/web/src/messages/{en,hi,ta,te,mr}.json` with `collab.*` keys (4 nudge templates + settings + dashboard chrome + room entry keys)
- [ ] T114 [P] `apps/web/src/i18n/request.ts` — extend to handle `collab.*` keys with same missing-key fallback pattern as 004

---

## Phase 8 — Edge functions [depends on Phase 1, 3, 4, 5]

- [ ] **T120 `supabase/functions/collab-room-create/index.ts`** — server-side room creation with rate limiting, cohort-cap enforcement, invite JWT mint
- [ ] T121 [P] `supabase/functions/collab-room-end/index.ts` — server-side room end (validates host or timer, persists artifact, enqueues scorer)
- [ ] **T122 [P] `supabase/functions/collab-typing-divergence/index.ts`** — computes divergence signal when a coach hint is requested; writes `anticheat_signals.collab_typing_divergence` row
- [ ] T123 [P] `supabase/functions/teamwork-scorer/index.ts` — async scorer; reads `collab_events` + `collab_participants`; writes `teamwork_scores`; emits W3C VC for `skill_proof_score` via 004 `credential-vc-issue` (with 5% cap)
- [ ] T124 [P] `supabase/functions/collab-recording-purge/index.ts` — nightly cron; deletes `collab_recordings` rows where `purge_after < now() AND recording_url IS NOT NULL`; writes `collab_audit.recording_purged` row
- [ ] T125 [P] `supabase/functions/collab-snapshot-cleanup/index.ts` — daily cron; deletes `collab_snapshots` rows where the room is `ended` and snapshot is > 30 days old
- [ ] T126 [P] Cron entry in `045_cron_008.sql` (or extend `038_cron_004.sql`): `teamwork-scorer` is event-triggered (from T121); `collab-recording-purge` daily at 03:00 UTC; `collab-snapshot-cleanup` daily at 04:00 UTC

---

## Phase 9 — Anti-collusion + teamwork scorer algorithms [depends on Phase 2]

### 9a. Teamwork scorer (pure)

- [ ] **T130 `apps/web/src/lib/algorithms/teamwork-scorer.ts`** — `computeTeamworkScore(events, participants) → { subScores, score, breakdown }`. Implements 4 sub-scores with weights per FR-012; emits `breakdown_json.reasons` array; returns `null` for opted-out participants.
- [ ] T131 [P] `apps/web/src/lib/collab/typing-divergence.ts` — pure `divergence(cadenceA, cadenceB) → number`; helpers to extract cadence from `collab_events`
- [ ] T132 [P] `apps/web/src/lib/anticheat/collab-typing-divergence.ts` — thin wrapper that calls the divergence function and writes an `anticheat_signals` row

### 9b. Tests

- [ ] T140 [P] Unit tests `tests/integration/teamwork-scorer.test.ts` — 4 hand-crafted session scenarios (balanced, imbalanced, conflict-heavy, help-heavy); assert each sub-score in expected band
- [ ] T141 [P] Unit tests `tests/integration/collab-typing-divergence.test.ts` — 3 hand-crafted cadence pairs (legitimate pair-programming, suspected ghost-writing, low-activity)
- [ ] T142 [P] Unit tests `tests/integration/collab-consent.test.ts` — grant, revoke, expiry, mid-session revoke token downgrade

### 9c. Coach integration

- [ ] T145 [P] `apps/web/src/lib/collab/coach-gate.ts` — checks `anticheat_signals.collab_typing_divergence` for the last 60s before allowing a coach hint; returns 403 with `collab_divergence_signal_active` if signal active
- [ ] T146 [P] Wire `coach-gate` into the existing 004 LLM coach endpoint (`apps/web/src/app/api/ai-coach/hint/route.ts`)

---

## Phase 10 — Recruiter observe mode [depends on Phase 6, 7]

- [ ] **T150 `apps/web/src/lib/collab/recruiter-observer.ts`** — `mintObserverBundle(roomId, recruiterId)`; checks `collab_consents`; mints Liveblocks READ_ONLY + LiveKit observer token; INSERT `collab_participants` + `collab_recordings` + `collab_audit`
- [ ] T151 [P] `apps/web/src/lib/collab/recruiter-review.ts` — assembles review payload (code + transcript + terminal + score + contribution chart); PII-redacts student emails/phones; returns within p95 2s
- [ ] T152 [P] `apps/web/src/lib/collab/recruiter-problem.ts` — observer posts problem statement; INSERT `collab_events.interviewer_posted_problem`; broadcast via Liveblocks awareness channel (visible to all participants within 1s)
- [ ] T153 [P] `apps/web/src/lib/collab/consent-revoke-watcher.ts` — periodic job (every 5s while room is live) that checks `collab_consents.revoked_at` and calls `downgradeObserverToken` if revoked (FR-024)
- [ ] T154 [P] `apps/web/src/components/collab/observer-notice.tsx` — toast shown to participants when an observer joins/leaves
- [ ] T155 [P] `apps/web/src/components/collab/interview-mode-banner.tsx` — sticky banner for interviewer-posted problems

---

## Phase 11 — Recording retention + cleanup [parallel with Phase 10]

- [ ] **T160 `apps/web/src/lib/collab/recording-purge.ts`** — pure fn `findPurgeableRecordings(now, retentionDays) → CollabRecording[]`; called by `collab-recording-purge` edge function (T124)
- [ ] T161 [P] `apps/web/src/lib/collab/redact-recording.ts`** — on account deletion, set `collab_recordings.redacted=true` and `recording_url=NULL`; preserve row for audit
- [ ] T162 [P] Wire `redact-recording` into the existing 004 account-deletion flow

---

## Phase 12 — Cross-cutting [last, parallel]

- [ ] T170 [P] Add all `008_collab_*` feature flags to `supabase/seed.sql` (per quickstart §10)
- [ ] T171 [P] Update `AGENTS.md` to reference 008 plan
- [ ] T172 [P] Update `README.md` with 008 surfaces (1 paragraph per phase)
- [ ] T173 [P] `docs/008-rollout-runbook.md` — operator runbook for staged rollout (per quickstart §10)
- [ ] T174 [P] DPDP / SOC2 audit log addendum: ensure all new tables have admin-readable audit trails (RLS policy `collab_audit_admin_select` in T010)
- [ ] T175 [P] `apps/sandbox-firecracker/scripts/smoke.sh` — Fly.io deploy smoke test (verifies healthz endpoint, microVM pool warm, language runtimes loadable)
- [ ] T176 [P] Update existing 004 `score-aggregator.ts` to include `teamwork_scores` contribution (5% cap, FR-013); ensure no regression to existing aggregations
- [ ] T177 [P] `apps/web/src/lib/collab/health-check.ts` — connectivity probe for Liveblocks + LiveKit; degrade gracefully (Y.js over fallback WS; voice falls back to data-channel chat)

---

## Phase 13 — E2E tests [depends on all above]

- [ ] T180 E2E `tests/e2e/collab-room-join-and-edit.spec.ts` — 2 students join, both see same Y.js doc state, edit roundtrip < 200ms
- [ ] T181 E2E `tests/e2e/collab-test-run-roundtrip.spec.ts` — JS room: 2 students; one runs tests; both see result within 500ms
- [ ] T182 E2E `tests/e2e/collab-teamwork-scorer.spec.ts` — synthetic session; assert score in expected band; assert 5% cap on Skill Proof contribution
- [ ] T183 E2E `tests/e2e/collab-opt-out.spec.ts` — student opts out; new room ends; their score is null; room score computed over others
- [ ] T184 E2E `tests/e2e/collab-anti-collusion.spec.ts` — synthetic ghost-writing cadence; coach hint blocked with `collab_divergence_signal_active`
- [ ] T185 E2E `tests/e2e/collab-recruiter-observe-live.spec.ts` — recruiter joins as observer; read-only; participants notified
- [ ] T186 E2E `tests/e2e/collab-recruiter-review-recorded.spec.ts` — room ends; recruiter loads review page; sees code + transcript + score
- [ ] T187 E2E `tests/e2e/collab-consent-revoke.spec.ts` — student revokes consent mid-session; observer token downgraded within 5s
- [ ] T188 E2E `tests/e2e/collab-webcontainer-egress-block.spec.ts` — JS room tries `fetch('https://evil.com')`; assert egress blocked + event recorded
- [ ] T189 E2E `tests/e2e/collab-snapshot-rehydrate.spec.ts` — 30-min session, kill client, reconnect from snapshot; assert no data loss

---

## Phase 14 — Cross-feature wiring

- [ ] T190 [P] Trigger: on `collab-room-end`, call 004's `credential-vc-issue` to issue a `teamwork-credential` W3C VC for non-opted-out participants (similar to hackathon_credentials pattern)
- [ ] T191 [P] Trigger: on `teamwork_scores` write, update the student's `skill_proof_score` in 002's `score-aggregator` with the 5% cap applied
- [ ] T192 [P] Trigger: on `collab_consents.revoked_at` update mid-session, downgrade Liveblocks token (FR-024) — this is the watcher in T153
- [ ] T193 [P] Trigger: on `collab_recordings.purge_after` expiry, run `collab-recording-purge` (T124) — already wired in cron

---

## Phase 15 — Observability + alerts

- [ ] T194 [P] Dashboard panel: "Collab live now" (count of `collab_rooms WHERE status='live'`)
- [ ] T195 [P] Dashboard panel: "Teamwork score distribution (7d)"
- [ ] T195b [P] Dashboard panel: "Anti-collusion signals (7d)" — count by confidence band
- [ ] T196 [P] Alert: score distribution drift (median < 40 or > 95 for 3 consecutive days)
- [ ] T197 [P] Alert: anti-collusion false-positive rate (mentor-rejected / total flagged) > 5%
- [ ] T198 [P] Alert: recording bandwidth approaching 80% of `COLLAB_RECORDING_BANDWIDTH_GB_PER_MONTH`
- [ ] T199 [P] Alert: room boot p95 > 8s (Firecracker cold start regression)
- [ ] T200 [P] Alert: Liveblocks MAU approaching `LIVEBLOCKS_MAU_LIMIT` (free tier ceiling)

---

## Parallel Opportunities

- Phase 0 (T001-T009) all parallel.
- Phase 1 (T010-T014) all parallel.
- Phase 2 (T020-T026) all parallel after Phase 1.
- Phase 3 + Phase 4 fully parallel after Phase 2.
- Phase 5a (WebContainer) and 5b (Firecracker) fully parallel after Phase 3+4.
- Phase 6 + Phase 7 can run in parallel after Phase 5a is far enough along for the editor + voice components.
- Phase 8 (edge functions) depends on Phase 1 + 5 (needs the schema and the sandbox manager interface).
- Phase 9 (algorithms) can run in parallel with Phase 6, 7, 8.
- Phase 10 (recruiter observe) can run in parallel with Phase 6, 7 once the consent table is in place (Phase 1).
- Phase 11 (recording) can run in parallel with everything after Phase 1.
- Phase 12 (cross-cutting) is last.
- Phase 13 (E2E) runs after the surface it's testing is in place.
- Phase 14 (cross-feature wiring) can run in parallel with Phase 13.
- Phase 15 (observability) can run in parallel with everything after Phase 6.

## Task Count Summary

| Phase | Tasks | Critical Path |
|---|---|---|
| 0 — Pre-flight | 9 | T006 |
| 1 — Migrations | 5 | T010 |
| 2 — Types | 7 | T020, T023 |
| 3 — Liveblocks | 5 | T030, T032 |
| 4 — LiveKit | 4 | T040, T042 |
| 5 — Sandbox | 10 | T050, T060, T070 |
| 6 — API routes | 13 | T080, T082, T083, T086 |
| 7 — UI shell | 15 | T100, T102, T107 |
| 8 — Edge functions | 7 | T120, T122, T123 |
| 9 — Algorithms | 8 | T130, T145 |
| 10 — Recruiter observe | 6 | T150, T151 |
| 11 — Recording retention | 3 | T160 |
| 12 — Cross-cutting | 8 | T176 |
| 13 — E2E tests | 10 | T180-T188 |
| 14 — Cross-feature wiring | 4 | T190, T191 |
| 15 — Observability | 7 | T194-T200 |
| **Total** | **125** | |

## Rollout Recommendation

1. Land Phases 0–6 in sprint 1 (P1 lifecycle + sandbox, behind `008_collab_rooms` flag for 10% cohort).
2. Land Phases 7–9 in sprint 2 (P1 UI + scoring + anti-collusion, expand cohort to 50%).
3. Land Phases 10–11 in sprint 3 (P2 recruiter observe + recording, expand to 100% with `008_recruiter_observe` off-by-default for recruiters).
4. Land Phases 12–15 in parallel with sprint 3 finish.
5. Cohort rollout per `quickstart.md` §10.
