# Phase 0 Research: 008 — Collaborative Mode

**Date**: 2026-06-07
**Status**: Decisions ratified; ready for Phase 1
**Builds on**: 001-004 architecture; reuses 004's anti-cheat, cron, audit, public-API patterns

Eight architectural decisions for feature 008. Each captures the choice, the rejected alternatives, and the rationale.

---

## D1. CRDT engine: Y.js (not Automerge)

**Decision**: Use **Y.js** as the in-room CRDT engine, bound to Monaco via `y-monaco`. Y.js is mature, fast, has a first-class Liveblocks binding, and a tiny wire format (binary Y.js updates) that we can ship to the Liveblocks relay.

**Alternatives considered**:
- **Automerge / Automerge-Repo** — Rejected for v1: document-size overhead is ~3-5× Y.js for the same edit volume; binding to Monaco is community-only; Liveblocks's first-class binding is Y.js. Revisit if a use case demands Automerge's JSON-patch history.
- **Operational Transform (OT)** — Rejected: requires a custom server; we don't want to operate OT infrastructure when a CRDT gives us P2P convergence for free.
- **Hand-rolled CRDT** — Rejected: years of research have produced Y.js/Automerge; rolling our own is a maintenance tax we won't pay.

**Rationale**: Y.js is the de-facto standard for in-browser real-time collab. Its binary update format is small (a typical keystroke op is ~30-80 bytes), which matters for Indian broadband. Y.js is a JS library, so it runs in the WebContainer and in the main browser tab without changes.

**Trade-off accepted**: Y.js's CRDT model means a malicious participant could intentionally produce state divergence. We mitigate with the typing-divergence signal (D7) and the per-room participant cap of 4 (FR-001).

---

## D2. Presence + persistence server: Liveblocks (not self-hosted Y.js)

**Decision**: Use **Liveblocks** as the Y.js relay + presence server. Each room maps to a Liveblocks room; the Liveblocks Node SDK mints short-lived JWTs that authorize a client to read/write the room's Y.js doc and presence channel.

**Alternatives considered**:
- **Self-hosted Y.js server (y-websocket + a Node server)** — Rejected: we'd have to operate WebSocket infrastructure at scale, handle auth, persist snapshots, and replicate the presence semantics Liveblocks gives us for free. Y.js server libs also have weaker production stories (e.g. `y-websocket` is a reference impl, not a hardened server).
- **Hocuspocus** — Rejected: better than `y-websocket` but still self-hosted; Liveblocks gives us managed infra + SOC2 + global edge for less than the cost of operating Hocuspocus at our scale.
- **Partykit** — Viable alternative; has a Y.js binding and a hosted tier. Rejected for v1 because Liveblocks's Monaco binding is more battle-tested and Liveblocks's pricing matches our cohort-rollout model better.

**Rationale**: Liveblocks is the shortest path to a production-quality real-time room. The free tier (1K MAU) is enough for the 008 cohort rollout; the paid tier scales linearly. SOC2 + GDPR ready out of the box.

**Trade-off accepted**: Liveblocks is a vendor. We mitigate by keeping the client-side Y.js doc fully functional even if Liveblocks goes down (the Y.js CRDT can converge over a fallback WebSocket we control; presence degrades but editing continues). This fallback is documented in `contracts/api.md` §"Y.js init flow".

**Wire cost optimization**: We send binary Y.js updates, not JSON. A typical 5-minute snapshot of Y.js updates is ~50-200 KB; Liveblocks storage pricing includes 1 GB / room.

---

## D3. Voice/video: LiveKit (not Daily.co)

**Decision**: Use **LiveKit** for the voice channel. Each room has a LiveKit room ID = `collab_room_id`; participants get a LiveKit JWT scoped to publish/subscribe voice. Recruiter observers get a token with **no publish capability** (read-only audio).

**Alternatives considered**:
- **Daily.co** — Comparable product. Rejected for v1 because LiveKit's open-source media server option means we can self-host if pricing becomes a problem; Daily is closed-source.
- **Twilio Video** — Rejected: pricing, latency, and the deprecated path (Twilio sunset Programmable Video in 2024-2026).
- **WebRTC peer-to-peer mesh** — Rejected: 4-party P2P audio over Indian broadband collapses; SFU is required.
- **Jitsi** — Viable; we considered it. Rejected because LiveKit's SDK is React-native and has a hosted cloud option (LiveKit Cloud) that lets us defer self-hosting.

**Rationale**: LiveKit's hosted cloud tier + React SDK + `livekit-server-sdk` for token mint is the smallest surface area for a 4-party voice channel. SFU architecture scales beyond 4 parties if we ever raise the cap.

**Trade-off accepted**: Voice is a vendor dependency. The collab room is fully functional without voice — if LiveKit is unreachable, voice falls back to data-channel chat (FR-006 implied + edge case in spec).

**Latency budget**: LiveKit claims < 200ms server-side round-trip; with Indian ISPs, p95 we measure at ~300-400ms. This is well within the voice-quality bar for a coding session (vs. a 1:1 voice call where < 150ms matters).

---

## D4. Code sandbox: WebContainer (browser) for JS/TS/Python; Firecracker (remote) for the rest

**Decision**: Use **WebContainer** from StackBlitz as the in-browser sandbox for JavaScript, TypeScript, and Python. For all other languages (Go, Rust, C++, Java, etc.), boot a **Firecracker microVM** on a per-region Fly.io app and route the terminal WebSocket to it.

**Alternatives considered**:
- **WebContainer only (no remote fallback)** — Rejected: WebContainer is Chromium-only and doesn't support Go/Rust/etc. The recruiter use case (interview mode) explicitly includes "any language" in the product brief.
- **Firecracker microVM for everything** — Rejected: WebContainer is free, instant, and zero-ops for 80%+ of the cohorts' language mix. Spinning up a microVM for "build a Node + Express app" is overkill.
- **Docker containers via Supabase Edge or Fly.io** — Considered: Docker is heavier than Firecracker (slower boot, larger image). Firecracker boots in < 125ms with a small footprint; better fit for "session-scoped" VMs.
- **Replit / CodeSandbox SDKs** — Rejected: vendor lock-in + the same Chromium-only caveat as WebContainer.
- **GitHub Codespaces** — Rejected: $0.18/hr pricing + 30-60s cold-boot + auth complexity. Not session-scoped friendly.

**Rationale**: WebContainer for the common case (fast, free, browser-side), Firecracker for the long tail (slower, paid, session-scoped, per-region). The same Y.js editor + xterm.js terminal can drive both, with a thin abstraction in `apps/web/src/lib/collab/sandbox-manager.ts`.

**Security**: WebContainer runs in the user's browser tab with `network: 'disabled'` by default. Firecracker microVMs run in a private Fly.io network with no outbound internet; only the Liveblocks relay and the room's own Y.js doc are reachable. CPU cap 30s, memory cap 256 MB (FR-027); over-cap runs killed and marked `failed_resource_cap`.

**Trade-off accepted**: WebContainer requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on the page (SharedArrayBuffer requirement). We set these headers on the collab route layout (see `plan.md` §"Complexity Tracking" for the iframe-embed caveat).

**Boot latency budget**:
- WebContainer: 1-3s p50, ≤ 5s p95 (browser-side, no infra)
- Firecracker: 2-5s p50, ≤ 8s p95 (cold-boot + language runtime)

---

## D5. Sandbox security model

**Decision**: Defense in depth, no single layer trusted.

**Layer 1 — Network isolation**:
- WebContainer: `network: 'disabled'` (FR-025). Egress attempts blocked at the WebContainer boundary; logged as `collab_events.sandbox_egress_blocked` (SC-009).
- Firecracker: microVM has no outbound network (Fly.io private network only). The room's WebSocket to the microVM is over a signed token (short-lived, 1 hour).

**Layer 2 — Filesystem isolation**:
- WebContainer: process is scoped to its own in-memory FS; no reads/writes outside the room's working directory.
- Firecracker: ext4 rootfs with a tmpfs `/workspace`; the room is the only process; kernel-level no-new-privileges.

**Layer 3 — Resource caps**:
- WebContainer: WebContainer itself enforces memory limits; we add a 30s CPU cap on test runs (FR-027).
- Firecracker: microVM gets 1 vCPU + 512MB RAM; cgroups enforce hard caps; 30s CPU cap on test runs.

**Layer 4 — Content scanning**:
- Every `code_commit` is fed to the 004 anti-cheat signal pipeline (no new detectors — reuse `commit_cluster_time` and `ai_generated_suspect`). High-confidence signals write a `collab_events.collusion_signal` event; score contribution is suppressed on flagged events.

**Layer 5 — Audit**:
- Every sandbox boot, shutdown, restart, escape attempt, and resource-cap breach is logged to `collab_events` with `room_id`, `user_id`, `event_type`, `payload_json`. Logged to `collab_audit` for cross-feature observability.

**Alternatives considered**:
- **Trust the WebContainer sandbox alone** — Rejected: WebContainer's threat model is "untrusted user code in a browser tab"; the *room* is multi-user, so we need a second layer of isolation between the room's sandbox and other rooms.
- **Trust Firecracker alone (no WebContainer)** — Rejected: cost + boot latency. WebContainer is free, instant, and works for 80%+ of use cases.

**Rationale**: Multi-layer isolation is table stakes for multi-user code execution. We document the threat model in `data-model.md` (RLS policies) and `contracts/api.md` (auth tokens).

---

## D6. Teamwork scoring algorithm: deterministic, weighted sub-scores

**Decision**: Implement the teamwork score as a deterministic, SQL-callable pure function (`apps/web/src/lib/algorithms/teamwork-scorer.ts`). Four sub-scores, each in [0,100], with documented weights (FR-012):

| Sub-score | Weight | Inputs |
|---|---|---|
| `turn_taking` | 25% | Per-author active-seconds; ratio of least-active to most-active author; flag if one author < 10% of window |
| `code_balance` | 35% | Per-author line-adds (from `code_commit` events); per-author distinct-files-touched; per-author time-active |
| `conflict_resolution` | 20% | `conflict_unresolved` events (one writes while another's lock is held) → negative weight; `conflict_resolved` events (the writer resolves within 60s) → small positive weight |
| `help_events` | 20% | `help_event` rows: one author sends a chat that precedes another author's code_commit in a previously-zero-progress area within 90s |

Final score = `0.25*turn_taking + 0.35*code_balance + 0.20*conflict_resolution + 0.20*help_events`, clamped to [0,100]. The score is then converted to a Skill-Proof-Score contribution that is capped at 5% of the per-student delta (FR-013).

**Alternatives considered**:
- **LLM-as-judge on the transcript** — Rejected: too expensive at scale (50K students × 1-2 sessions/month × LLM rubric), and the rubric is harder to defend in an appeal than a deterministic formula.
- **Embeddings + cosine similarity over event sequences** — Rejected for v1: cold-start problem (no labeled "good teamwork" examples yet); the deterministic formula is auditable.
- **Peer-rating only** — Rejected: easily gamed (students rate each other 100 to inflate the score).

**Rationale**: A deterministic, weighted formula is auditable, explainable to students ("you got 60 in `turn_taking` because Author B was active for 8% of the window"), and cheap to compute. The 5% Skill-Proof-Score cap (FR-013) prevents collab-grinding from inflating the main score.

**Audit log**: Every score row includes a `breakdown_json` with the input counts and the human-readable `reasons` array (e.g. `["low_engagement: author B active < 10% of window", "help_event: A unblocked B at minute 18"]`).

---

## D7. Anti-collusion algorithm: typing-cadence divergence

**Decision**: Implement a `collab_typing_divergence` signal that runs whenever a participant requests an LLM coach hint during a collab room. The signal compares the cadence of the requesting participant (keys/sec) against the cadence of the other active participant (keys/sec) over the last 60 seconds. If the divergence exceeds a tuned threshold AND the other participant is actively committing code, the signal fires.

**Computation** (pure function in `apps/web/src/lib/algorithms/collab-typing-divergence.ts`):

```ts
type Cadence = { user_id: string; keys_per_sec: number; commits_in_window: number };
function divergence(a: Cadence, b: Cadence): number {
  // normalized to [0,1]; higher = more suspicious
  const cadenceGap = Math.abs(a.keys_per_sec - b.keys_per_sec) / Math.max(a.keys_per_sec, b.keys_per_sec, 1);
  const commitConcentration = b.commits_in_window / (a.commits_in_window + b.commits_in_window + 1);
  return clamp(cadenceGap * commitConcentration, 0, 1);
}
```

Threshold: `divergence ≥ 0.65` → signal fires (`anticheat_signals` row with `signal='collab_typing_divergence'`, `confidence = divergence`).

**Tuning**: Threshold and weights are tuned against 100 hand-labeled sessions (50 legitimate pair-programming, 50 suspected ghost-writing). False-positive rate target ≤ 2% (SC-007). We ship behind `008_anti_collusion` flag with 2-week cohort; mentor-review queue catches false positives (FR-015).

**Alternatives considered**:
- **Pure commit-cadence analysis (no typing data)** — Rejected: too easy to game (a determined cheater can slow their commits to mimic a teammate's cadence).
- **ML model on a feature vector of (commits, typing, presence)** — Deferred to v2: cold-start problem; the deterministic formula is the v1 floor.
- **Style/formatting fingerprinting** — Deferred to v2: requires deep code analysis; high false-positive risk across different coding styles.

**Rationale**: Typing cadence is a hard-to-fake signal (you can't type at 4 keys/sec if you don't have the muscle memory of the codebase). The ML model layers on top once we have labeled data; v1 ships the deterministic floor.

---

## D8. Recording retention: 90 days default, configurable per-tenant, with audit

**Decision**: `collab_recordings` rows auto-purge after the configured retention period (default 90 days). `collab_artifacts` (code snapshot, transcript, events) is retained per 002's audit policy (1 year). A nightly cron (`collab-recording-purge`) handles the purge.

**Retention table**:

| Artifact | Retention | Reason |
|---|---|---|
| `collab_recordings` (LiveKit egress) | 90 days (configurable) | Recording bandwidth cost; recruiter can re-observe if needed; 90d is long enough for placement loops |
| `collab_artifacts` (code, transcript, events) | 1 year (per 002 policy) | Audit + score recompute reproducibility |
| `collab_events` (raw event log) | 1 year (per 002 policy) | Audit + post-hoc scoring + dispute resolution |
| `collab_consents` (history) | 2 years (per 002 audit) | Consent disputes can arise after the fact |
| `teamwork_scores` | Permanent (per 002 audit) | The score is part of the verified credential |

**Alternatives considered**:
- **Permanent recording retention** — Rejected: storage cost. 90 days covers the placement cycle (recruiter observes → makes offer → student accepts → 30-60 days).
- **30-day recording retention** — Rejected: too short for senior placement loops at large Indian companies (3-month hiring cycles are common).
- **Tenant-configurable per-recruiter** — Rejected: too much surface area. Tenant-level config (per `institution_id` or per `company_id`) is sufficient.

**Rationale**: 90 days is the sweet spot for placement-loop coverage. Audit-trail artifacts (`collab_artifacts`, `collab_events`, `collab_consents`) are retained per 002's policy because they're cheap (KB-MB) and they're how we'd resolve a dispute.

**Compliance note**: Recording a collab room captures both participants' work and voices. This is sensitive PII. The per-room consent UI (FR-029) explicitly states "your voice and screen will be recorded for X days; accessible to recruiters who have your consent". Account deletion tombstones the recording (`recording_url=NULL, redacted=true`) but retains the artifact.

---

## Cross-cutting decisions

- **Migrations land additive (`041_collab.sql`).** Single migration for all 8 new tables + 1 column-add to `anticheat_signals.signal` enum. No destructive changes. Idempotent.
- **All new edge functions emit structured logs to `supabase.functions.invoke_log`** (inherited from 004) and to `collab_audit` (new) for cross-feature observability.
- **All new feature flags live in the existing `feature_flags` table** (003). Enumerated in `quickstart.md` §11. Default OFF for all P1/P2 capabilities.
- **COOP/COEP headers** are set at the collab route layout level (not the global app layout), so they don't impact the rest of the marketing pages.
- **WebContainer is gated to Chromium-only clients**; non-Chromium clients get a degraded view (read-only editor + remote Firecracker microVM). The UI shows "For the best experience, please use Chrome".
- **All P1 features ship behind a flag from day 1**; P2 features additionally roll out in 2-week cohorts.
