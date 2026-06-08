# Antarix Changelog

All notable changes to Antarix are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

> **Reading this log.** Versions follow the standard `MAJOR.MINOR.PATCH` shape. `MAJOR` bumps are reserved for breaking changes to the public W3C VC resolve endpoint, the public OpenAPI surface, or the data we expose to third-party verifiers. `MINOR` bumps add features in a backward-compatible way. `PATCH` bumps are backward-compatible fixes. The `[Unreleased]` section is where work-in-progress items live until the next release is cut.

---

## [Unreleased] — staging for v1.1.0

### To add

- **Real EdDSA signing (Stage 3 of the W3C VC rollout).** The `credential-vc-issue` Edge Function will canonicalize the document per RDFC-1.0 and sign the canonical bytes with a real Ed25519 key, replacing the v1 sha256 stub. The migration `039_w3c_vc_real_eddsa.sql` (the Stage 2 handoff) is already shipped; this is the Stage 3 Edge Function patch that consumes the handoff. See [`docs/w3c-vc-eddsa-rollout.md`](./w3c-vc-eddsa-rollout.md) §"Stage 3".
- **Webhook retry cron.** A scheduled job that calls `retryFailedDeliveries()` on the `webhook_deliveries` table every hour, with a 30-second minimum between attempts and a maximum of 5 attempts per delivery. Migration: `041_webhooks.sql` (already shipped, but the cron schedule itself is a follow-up migration so it does not collide with the frozen `029_cron_002.sql`).
- **Stage 2 of i18n.** Adding Bengali (`bn`), Tamil (`ta`), Telugu (`te`), and Marathi (`mr`) to the `messages/` directory. Each locale gets the same 36 flat-dotted keys as `en` and `hi`, with ICU pluralization and interpolation. ETA: 2026-Q3.
- **Five GTM open items.** Administrative inboxes (`support@`, `security@`, `grievance@`, `privacy@`, `dpo@`, `legal@`, `api@`, `press@`, `status@`); the PGP key for `security@antarix.app`; the public Security Hall of Fame page; a Canny or GitHub Discussions feature-request board; and a refreshed press kit. ETA: 2026-Q3.
- **Per-user rate-limit headers.** `X-RateLimit-Remaining` and `X-RateLimit-Reset` on every public Edge Function response. The token-bucket wrapper is already shipped (migration `033_rate_limit.sql`); the headers are the missing surface. ETA: 2026-Q3.

### To change

- **i18n middleware migration.** The next-intl middleware that was shipped additively in the v1.0.0 layer currently lives in the project root as `middleware.ts` and conflicts with the existing `apps/web/src/middleware.ts` (which handles Supabase auth and subdomain routing). The next-intl middleware will be chained into the existing one and the root file deleted. This is the resolution documented in `docs/i18n-scaffold.md` §7.1.
- **Webhook receiver v2.** A persistent `webhook_inbound_events` table is added so that partner-originated events (e.g. `placement.outcome`, `credential.viewed`, `student.engagement`) survive function cold starts. The current v1 implementation accepts the event in-memory and processes it synchronously; v2 will write-then-process.
- **DID Document endpoint move.** The static `/.well-known/did.json` will move to a signed, server-rendered endpoint in v1.1.0. The static file shipped in v1.0.0 is a placeholder; the live one reads from `public.resolve_did('did:web:antarix.app')` and refreshes on key rotation.

### To fix

TBD based on launch-week user feedback. The first 72 hours post-launch generate the v1.1.0 patch list.

---

## [1.0.0] - 2026-06-XX <!-- TODO: set to actual launch date -->

The first public release of Antarix. This release ships all 22 functional requirements from `specs/002-antarix-definitive-vision/spec.md`, the full top-1% layer (59+ new files across 6 functional areas), and the schema/function fixes that the launch required. Migrations 001–042 are applied; Edge Functions under `supabase/functions/` are deployed; the marketing site, help center, and API documentation are published. See the migration set index in [`docs/architecture.md`](./architecture.md) and the Edge Function list below.

**Migration set shipped in v1.0.0:** `001–031` (the Antarix base), `032_w3c_vc.sql` (W3C VC layer), `033_rate_limit.sql` (rate limiting), `034_anticheat.sql` through `038_cron_004.sql` (the 003 layer: anti-cheat, ATS sync, SSO, faculty grading, hackathons, mock interviews, public API, outcome pricing, next-best-skill), `039_w3c_vc_real_eddsa.sql` (Stage 2 EdDSA handoff), `040_status_page.sql` and `041_webhooks.sql` (top-1% layer, with numbering-collision resolution per [`docs/004-top-1-percent/README.md`](./004-top-1-percent/README.md)). <!-- TODO: confirm the resolved migration numbers after the user closes the 020/021/022/040 numbering collisions; the v1.0.0 changelog will be amended before the T-0 cutover. -->

**Edge Functions shipped in v1.0.0:** the 28 functions in `supabase/functions/`, plus the new `credential-vc-issue`, `credential-vc-resolve/[did]`, `status-page-data`, `webhook-receiver/[id]`, and `health-check`. All public-facing functions are wrapped in `withObservability(name, handler)` and `withRateLimit(name, handler)`. The complete list is in [`docs/architecture.md`](./architecture.md) §"Project layout".

### Added

The 22 functional requirements, grouped. References are to `specs/002-antarix-definitive-vision/spec.md`.

- **W3C Verifiable Credentials (FR-018, FR-019).** `did:web:antarix.app` issuer, `did:web:antarix.app:c/<uuid>` subject, Data Integrity proof envelope, public resolve endpoint with W3C DID Resolution v0.3 shape. See [`docs/w3c-vc-strategy.md`](./w3c-vc-strategy.md) and [`docs/w3c-vc-impl.md`](./w3c-vc-impl.md).
- **Public verification portal at `/verify/{slug}`.** Third-party resolution of any Antarix credential with no Antarix account required, returning the current live score and a "last verified" timestamp. See [`docs/w3c-vc-impl.md`](./w3c-vc-impl.md) §5.
- **W3C DID Document at `/.well-known/did.json`.** A static, W3C DID Core-compliant document with one `verificationMethod` (Ed25519VerificationKey2020) and a `service` entry pointing at the public resolver. The `publicKeyMultibase` is a placeholder pending KMS-backed key generation. See [`docs/security/vdp.md`](./security/vdp.md) §1 for the companion document.
- **Placement prediction heuristic (FR-006, FR-008).** A 0–100% probability with a Tier-1/2/3 company label, an estimated time-to-ready, and a top-3 gap analysis. The v1 heuristic is a documented weighted sum; the v2 ML model is on the Q4 2026 roadmap. See [`specs/002-antarix-definitive-vision/spec.md`](../specs/002-antarix-definitive-vision/spec.md) §SC-005.
- **Skill Proof Score (FR-005).** Continuously-updated 0–100 score with separate documented weightings for passive-only and Power-Mode students. The dashboard shows the score, the contributing components, and the delta vs. the prior computation.
- **WhatsApp Business API integration (FR-008).** Daily morning nudge, real-time peak-window trigger, streak-at-risk alert, and weekly summary, all delivered within 60 seconds of trigger. T011 (Meta template approval) is the open dependency; templates will activate as Meta approves them. See [`docs/gtm/launch-checklist.md`](./gtm/launch-checklist.md) §2 for the T-7 risk gate.
- **WhatsApp interactive commands (FR-009).** `START`, `DONE`, `STATS`, `RANK`, `HELP` all produce a documented state change or response. Reply latency target is p95 ≤ 60 seconds.
- **Power Mode Chrome extension (FR-010).** Categorised session start/stop, active window/tab focus sampling, HIGH/MEDIUM/LOW focus quality, self-rating and notes at session end, hourly sync with offline queue.
- **Power Mode profile badge (FR-011).** The "⚡ Power Mode" badge on the public profile when the extension is detected; clears within 24 hours of the last confirmed heartbeat stopping.
- **College placement-readiness dashboard (FR-012).** Ready / Development Path / Early Stage segmentation with counts and percentages, per-batch leaderboards, skill-gap vs. industry-demand report, and company-match recommendations that name specific opted-in students.
- **Cohort leaderboards with tie-breakers (FR-018, SC-008).** Live rankings that reflect the current Skill Proof Score, with documented tie-breakers, Power-Mode indicators, and streak counters per row. Refresh target: within 1 hour of a score change.
- **Privacy-aware cohort comparison (FR-019, SC-013).** Percentile and peer-average comparisons computed only over opted-in students; opted-out students are excluded from all aggregate counts that could leak their presence.
- **Company verified-candidate search (FR-013, SC-009).** Filters by skill, minimum score, batch, and location. Each result row shows a current Skill Proof Score, a Power-Mode status, a match score, and a "last verified" timestamp.
- **One-click candidate invite (FR-013).** Standardised invite, seat-usage decrement, and audit-log entry. The candidate receives the invite within 60 seconds in 95% of cases.
- **Calendar-aware interview scheduling (FR-013, SC-010).** Proposed time slots respect both parties' connected calendars and prefer the candidate's confirmed peak window; at least 80% of accepted slots fall in the candidate's confirmed window.
- **Account deletion + data purge (FR-015, SC-012).** 30-day purge window for personal data, 24-hour credential invalidation window, audit-log entry on completion.
- **Opt-out of company search (FR-016, SC-013).** Excluded from all company search results and aggregate counts; verified by an automated privacy test.
- **GitHub / email OAuth signup (FR-001, SC-001).** Onboarding under 3 minutes for a new student with 3+ months of public GitHub history.
- **First-pass Day-1 dashboard (FR-004, FR-021, SC-001).** Real, derived insights (commits, languages, peak hours, first Skill Proof Score) within 60 seconds of OAuth completion, with no 7-day wait and no fabricated placeholders.
- **GitHub passive auto-sync (FR-002, SC-002).** Every 2 hours; ingests new commits, refreshes derived metrics; an unchanged source produces no duplicate derived events.
- **Google Calendar auto-sync (FR-003).** Every 6 hours; ingests events, derives class schedule, deadline flags, free time windows, and schedule density.
- **Quiet hours, exam-week detection, and pause-all-nudges (FR-020, SC-014).** Every WhatsApp message is suppressed during documented quiet hours, exam-week windows, or after a student has issued a "pause all nudges" command. 100% suppression guarantee.
- **Source disconnect (FR-014).** Disconnecting a source stops ingest within one sync cycle; previously derived insights are marked stale and remain visible.
- **Sync-failure reconnect prompts (FR-017).** Non-blocking, surfaced on the student's next dashboard visit; previously-derived insights remain visible.
- **Install Power Mode affordance (FR-022).** Always visible on the dashboard for non-Power-Mode students; documents the additional data and benefits the extension unlocks.
- **Public OpenAPI spec at `/api-docs`.** Strict OpenAPI 3.1.0 with 14 component schemas, 2 endpoints, 6 named examples, and `npx @apidevtools/swagger-cli@4.0.4 validate` passing. See [`specs/003-engage-and-showcase/openapi.yaml`](../specs/003-engage-and-showcase/openapi.yaml).
- **Public status page at `/status`.** 7 subsystem health indicators with 30s refresh and a 60s in-memory data-endpoint cache. See [`docs/status-page.md`](./status-page.md).
- **Webhook system for partners.** 8 outbound event types with Stripe-compatible HMAC-SHA256 signature scheme, 3 inbound event types with 5-minute replay protection. See [`docs/webhooks.md`](./webhooks.md).
- **Vulnerability Disclosure Policy at `/security/vdp` and `/.well-known/security.txt` (RFC 9116).** 90-day coordinated-disclosure window, CVSS v3.1 severity tiering, no paid bounty in v1. See [`docs/security/vdp.md`](./security/vdp.md).
- **W3C DID Core `did.json` at `/.well-known/did.json`.** Static, placeholder keys, ready for v1.1.0 KMS-backed replacement.
- **Legal: privacy notice, AI Act disclosure, DPDP Act notice, DPA template, sub-processor list.** All under [`docs/legal/`](./legal/). Disclaimer banner on every doc pending counsel review.
- **Marketing site copy.** Landing, 3 personas, 24-question FAQ, 12-row competitor table. See [`docs/marketing/`](./marketing/).
- **Help center: 4 persona pages + 46-item troubleshooting + 42-term glossary.** See [`docs/help/`](./help/).
- **GTM playbook: pricing tiers, sales scripts, college partnership, launch checklist.** See [`docs/gtm/`](./gtm/).
- **i18n scaffold (English + Hindi).** next-intl v3 with locale-prefixed routing, 36 flat-dotted keys per locale. The middleware conflict with the existing `apps/web/src/middleware.ts` is the v1.1.0 follow-up. See [`docs/i18n-scaffold.md`](./i18n-scaffold.md).
- **Rate limiting on public Edge Functions.** Token-bucket wrapper, atomic SQL-backed, no new dependencies. See [`docs/rate-limiting.md`](./rate-limiting.md).
- **Structured logging + W3C trace context on all Edge Functions.** Drop-in wrapper with `withObservability(name, handler)`. See [`docs/observability.md`](./observability.md).

### Changed

- **Aligned the 002 layer to the 001 base schema.** Approximately 30 column-mismatch errors resolved across the 001–018 base and the 015–031 second-wave migrations. See the launch-day migration runbook.
- **Renumbered the 020–031 migration slots.** The original 002 layer had collisions at `020`, `021`, and `022` (each slot had two files). One file in each colliding pair was renumbered to the next free slot; the renumbering is documented in the migration-directory resolution log.
- **Cron conflict fix.** `029_cron_002.sql` is the canonical cron migration for the 002 layer. No future migration schedules base-owned jobs in that file. The webhook retry cron (see [Unreleased]) is added as a new top-level migration rather than appended.

### Deprecated

- **Direct DB access to `verifiable_credentials` is deprecated.** Use the `credential-vc-resolve` Edge Function. Direct reads will continue to work through v1.x but will be removed in v2.0.0; the table will move behind a SQL view.
- **Static `did.json` will move to a signed endpoint in v1.1.0.** The v1.0.0 static file at `apps/web/public/.well-known/did.json` will be replaced with a server-rendered, KMS-backed endpoint that reads from `public.resolve_did('did:web:antarix.app')`. The URL stays the same; the body and `Cache-Control` headers change.

### Removed

- **Removed duplicate `019_nudge_preferences_ext.sql` (folded into `020_whatsapp.sql`).** This is an internal migration cleanup, not a user-facing removal. The nudge preferences schema is in `020_whatsapp.sql`; the old standalone file is deleted.

### Fixed

- **Schema-mismatch fixes.** Approximately 30 column-mismatch errors between the 001–018 base and the 015–031 layer were resolved. Most were `not null` violations on inserts from the 002 layer against base tables that the 002 layer had assumed were nullable; a smaller number were type coercions (mostly `text` vs `varchar`) and missing `default` values.
- **Cron conflict fix.** A scheduled job that was previously double-registered in two cron files is now registered exactly once, in `029_cron_002.sql`. See the launch-day migration runbook.
- **Template-render contract fix.** The template renderer now returns `{templateId, body}` rather than the previous `{subject, body}`. The change was made in a single Edge Function and is invisible to end users; the subject line is now read from a `subject` column on the template row, not from a separate `subject` key in the render call.

### Security

- **First external pen test scheduled for the T-7 launch window.** Findings are tracked in the launch-day runbook; no Critical or High findings are allowed to remain open at T-0. Medium findings must have a remediation date within 30 days post-launch.
- **Vulnerability Disclosure Policy published.** [`docs/security/vdp.md`](./security/vdp.md) and `/.well-known/security.txt` are live; 3-business-day acknowledgement, 7-business-day triage, 14-day status cadence, 90-day coordinated disclosure.
- **9 administrative inboxes scheduled.** `support@`, `security@`, `grievance@`, `privacy@`, `dpo@`, `legal@`, `api@`, `press@`, `status@`. Some are in monitoring-only mode for v1.0.0; the rest light up in v1.1.0.
- **Rate limiting on public Edge Functions.** Public unauthenticated endpoints are rate-limited per-IP and per-user to defend against scraping and DoS. See [`docs/rate-limiting.md`](./rate-limiting.md).
- **Structured logging on all Edge Functions.** Every request is emitted as a structured JSON access log and an OpenTelemetry-shaped span tree, with W3C `traceparent` echoed end-to-end. See [`docs/observability.md`](./observability.md).
- **Stripe-compatible webhook signature scheme.** Outbound webhook deliveries are signed with `X-Antarix-Signature: t=<unix>,v1=<hex-hmac-sha256(secret, "${ts}.${body}")>`, the same shape Stripe uses, so partner integrations can reuse their existing signature-verification code. See [`docs/webhooks.md`](./webhooks.md).

---

## What we did not ship and why

We considered, considered seriously, and explicitly deferred five things in v1.0.0. They are tracked in the "Parked" column of the roadmap.

- **Native iOS + Android apps.** The PWA covers every v1 user story, including push notifications, offline support, and biometric unlock. A native app would be a 4–6 month investment that does not move a student closer to a verified credential, and the PWA install prompt is sufficient for the v1 free-tier distribution. We will revisit this in 2027 if the PWA's install rate, retention rate, or notification reliability proves insufficient.
- **Real-time cohort dashboard.** The v1 college dashboard refreshes nightly. Real-time was a 4x infra cost increase for a 30-second latency reduction that no paying customer has asked for. A WebSocket-based real-time view is a 2027+ feature; the nightly batch is good enough for placement-officer workflows.
- **Blockchain-anchored credentials.** W3C VC v2.0 + W3C DID Core + a public resolver is enough for the v1 verifier ecosystem (LinkedIn badges, university alumni pages, corporate ATS systems, EU EBSI / EUDI Wallet). On-chain anchoring (Bitcoin via ION sidetrees, or Ethereum via Verifiable Data Registry) costs roughly $0.001 per write and adds ~30 minutes of latency. We will adopt it in v3 only if a public-sector EU eIDAS-2 verifier demands it.
- **A "consume OpenAI tokens for free" path for the AI Coach.** Every AI Coach nudge uses a small amount of OpenAI tokens (gpt-4o-mini for templated nudges, a larger model for the free-form weekly summary). The 50,000-student Year-1 cost forecast in [`docs/gtm/pricing-tiers.md`](./gtm/pricing-tiers.md) §7 makes the per-student budget explicit. v1 hard-codes the cheapest model that meets the quality bar; we will not eat OpenAI inflation.
- **A public ML model card for the placement predictor.** The v1 predictor is a documented weighted heuristic, not a learned model. There is no model to card. The v2 ML model will ship with a public model card in 2026-Q4.

---

*For older draft notes, see the commit history of `docs/changelog.md` in the Antarix monorepo.*
