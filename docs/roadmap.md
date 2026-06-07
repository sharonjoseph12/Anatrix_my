# Antarix Public Roadmap

This is our public roadmap. We update it monthly. Dates are estimates, not promises. The **Committed** column is what we will ship; the **Exploring** column is what we are investigating; the **Parked** column is what we have deliberately deferred. Items in Exploring may move to Committed, to Parked, or stay in Exploring. Items in Parked are not dead — they are ideas that did not clear the bar in §"How we decide what to build" yet, but might later.

---

## Now — Q3 2026 (the quarter we are shipping in)

We are focused on three things this quarter. **First**, hardening the launch: closing the migration-numbering collisions, getting the Deno Edge Functions type-checked and tested, and running the first external pen test in the T-7 launch window. **Second**, shipping the real EdDSA signature path (Stage 3 of the W3C VC rollout) so that `proofValue` on every issued credential is a genuine Ed25519 signature over an RDFC-1.0 canonicalized document, not the v1 sha256 stub. **Third**, standing up the nine administrative inboxes (`support@`, `security@`, `grievance@`, `privacy@`, `legal@`, `api@`, `press@`, `dpo@`, `status@`) that the v1 launch commitments and the DPDP Act require. The team is small, so we are saying no to everything else until these three things are done.

## 12-month outlook — what success looks like by mid-2027

- **100 colleges onboarded** through the Pro and Strategic partnership tiers, with at least 30 in active pilot and 10 in paid production contracts.
- **10,000 verified credentials issued** through the public W3C VC resolver, with at least 1,000 resolved by a third-party verifier (a university alumni page, a corporate ATS, or a LinkedIn badge).
- **$1M ARR** split roughly 60% college partnerships / 35% company recruiter seats / 5% other, with gross margin above 80%.
- **50,000 active students** on the free tier, of whom at least 30,000 are in at least one connected cohort and at least 10,000 have a verified credential with a non-zero `cohortPercentile`.
- **Zero P0 or P1 incidents** over a rolling 90-day window, and an external pen test that returns no Critical or High findings on the production environment.

## The three columns

### Committed

These are the things we have committed to ship. They are on the active sprint board, they have an owner, and they have an ETA.

- **Real EdDSA signing (W3C VC Stage 3).** The Edge Function will canonicalize the document per RDFC-1.0 and produce a real Ed25519 signature. ETA: 2026-Q3.
- **Administrative inboxes.** Nine `@antarix.app` mailboxes wired to a shared helpdesk, with PGP for `security@` and the Grievance Officer identity published for `grievance@`. ETA: 2026-Q3.
- **Hindi launch stabilisation.** Bug fixes, missing-string backfill, and a round of native-speaker review on `messages/hi.json` now that 1,000+ Hindi-speaking students have used the product. ETA: 2026-Q3.
- **Migration-directory cleanup.** Resolve the duplicate `020`, `021`, `022`, `040` numbers, add a `00X_uniqueness_check.sql` migration, and document the numbering convention. ETA: 2026-Q3.
- **Webhook retry cron.** A scheduled job that calls `retryFailedDeliveries()` on the webhook delivery table every hour, with a 30-second minimum between attempts and 5 attempts max. ETA: 2026-Q3.
- **Per-user rate-limit headers.** `X-RateLimit-Remaining` and `X-RateLimit-Reset` on every public Edge Function response. ETA: 2026-Q3.
- **2FA account recovery flow.** Time-limited, single-use, signed recovery codes; mandatory for recruiters and college admins, opt-in for students. ETA: 2026-Q4.
- **Verifiable parental-consent flow.** Required to make the under-18 student signup DPDP-compliant. ETA: 2026-Q4.

### Exploring

These are the things we are actively investigating. They might become Committed, might become Parked, or might stay in Exploring for a while. We do not promise dates for items in this column.

- **Self-hosted Plausible for EU customers.** Stand up a Plausible instance in `eu-central-1` so that EU customer traffic never leaves the EU. Trigger: when the EU customer count crosses 10,000 MAU. ETA: 2026-Q4.
- **White-label college portal.** A college-customizable version of the placement-readiness dashboard with the college's own domain, logo, and color palette. Trigger: at least 3 Strategic-tier requests in writing. ETA: 2026-Q4.
- **ATS integrations (Greenhouse, Lever, Workday).** Direct, OAuth-mediated, one-way push of candidate shortlists into a recruiter's existing ATS. Trigger: at least 5 paid company customers asking for it. ETA: 2027-Q1.
- **Public Plausible analytics dashboard.** A read-only page that shows aggregate signups, issuances, and resolves per day, for the curious researcher. ETA: 2026-Q4.
- **Companion Chrome extension for the verify portal.** A "right-click verify" affordance that pastes a candidate's URL into the recruiter's flow. ETA: 2027-Q1.
- **Public rewards/recognition Hall of Fame page.** A public, opt-in list of the researchers who reported a security vulnerability through our VDP. ETA: 2026-Q4.

### Parked

These are ideas we have considered, considered seriously, and explicitly deferred. The reason each one is parked is in the rightmost column.

- **Native iOS + Android apps.** Deferred until the PWA proves insufficient for the use case. The PWA covers the same flows; native buys us push-notification reliability and biometric unlock, neither of which the free tier needs yet. ETA: 2027+.
- **Blockchain-anchored credentials.** W3C VC v2.0 + W3C DID is enough for the v1 verifier ecosystem. On-chain anchoring (Bitcoin / Ethereum / ION) is the v3 upgrade path if a regulator (likely an EU eIDAS-2 verifier) demands it. ETA: 2027+.
- **Real-time cohort dashboard.** Nightly batch is sufficient for the v1 college dashboard. A real-time stream is a 4x infra cost increase for a 30-second latency reduction that no paying customer has asked for. ETA: 2027+.
- **Open-source student-credentialling spec.** A separate open-source project to standardise the JSON-LD context for `AntarixSkillProof` and `AntarixSkillSubject` so that other platforms can emit compatible credentials. ETA: 2027+.
- **Public ML model card for the placement predictor.** Not until the v2 ML model is live and we have meaningful evaluation metrics. ETA: 2027-Q2.

## Feature-by-feature table

| Feature | FR / SC ref | Status | ETA | Notes |
|---|---|---|---|---|
| W3C Verifiable Credentials | FR-018, FR-019 / SC-006, SC-011 | Committed | v1.0.0 | Issued and resolved via `did:web`; real EdDSA Stage 3 in 2026-Q3 |
| Placement prediction | FR-006, FR-008 / SC-005 | Committed | v1.0.0 | Heuristic v1, ML v2 in 2026-Q4 |
| Skill Proof Score (0–100) | FR-005 | Committed | v1.0.0 | Passive and Power-Mode weightings both shipped |
| WhatsApp Business API | FR-008 / SC-004 | Committed | v1.0.0 | T011 unblocked once Meta approves templates |
| WhatsApp interactive commands | FR-009 | Committed | v1.0.0 | `START`, `DONE`, `STATS`, `RANK`, `HELP` |
| Power Mode Chrome extension | FR-010 | Committed | v1.0.0 | Session start/stop, focus quality, hourly sync |
| Power Mode profile badge | FR-011 | Committed | v1.0.0 | Clears within 24h of last heartbeat |
| College placement-readiness dashboard | FR-012 | Committed | v1.0.0 | Ready / Development Path / Early Stage segmentation |
| College batch leaderboards | FR-012, FR-018 / SC-008 | Committed | v1.0.0 | Documented tie-breakers |
| Curriculum intelligence | FR-012 | Committed | v1.0.0 | Skill supply vs industry demand |
| Company verified-candidate search | FR-013 / SC-009 | Committed | v1.0.0 | Skill / score / batch / location filters |
| One-click candidate invite | FR-013 | Committed | v1.0.0 | Decrements seat usage, logs to pipeline |
| Calendar-aware interview scheduling | FR-013 / SC-010 | Committed | v1.0.0 | Prefers candidate's confirmed peak window |
| Account deletion + data purge | FR-015 / SC-012 | Committed | v1.0.0 | 30-day purge window, 24h credential invalidation |
| Opt-out of company search | FR-016 / SC-013 | Committed | v1.0.0 | Excluded from results and aggregate counts |
| GitHub / email OAuth signup | FR-001 / SC-001 | Committed | v1.0.0 | Onboarding under 3 minutes |
| First-pass Day-1 dashboard | FR-004, FR-021 | Committed | v1.0.0 | Real insights in 60s, no fabrication |
| GitHub passive auto-sync | FR-002 | Committed | v1.0.0 | Every 2 hours |
| Google Calendar auto-sync | FR-003 | Committed | v1.0.0 | Every 6 hours |
| Cohort leaderboards | FR-018 / SC-008 | Committed | v1.0.0 | Hourly ranking refresh |
| Privacy-aware cohort comparison | FR-019 | Committed | v1.0.0 | Opted-in students only |
| Quiet hours + exam-week suppression | FR-020 / SC-014 | Committed | v1.0.0 | 100% suppression guarantee |
| Pause-all-nudges control | FR-020 | Committed | v1.0.0 | Single toggle per student |
| Source disconnect | FR-014 | Committed | v1.0.0 | Stops ingest within one sync cycle |
| Sync-failure reconnect prompts | FR-017 | Committed | v1.0.0 | Non-blocking, preserves prior insights |
| Install Power Mode affordance | FR-022 | Committed | v1.0.0 | Always visible on dashboard |
| i18n (Hindi + 5 more) | FR-002 / SC-003 | Committed | v1.1.0 | Hindi in v1.0.0; bn / ta / te / mr in v1.1.0; es / pt-BR / fr in v1.2.0 |
| Self-hosted Plausible for EU | — | Exploring | 2026-Q4 | After EU customer count crosses 10K MAU |
| White-label college portal | — | Exploring | 2026-Q4 | Enterprise tier request |
| ATS integrations (Greenhouse, Lever, Workday) | — | Exploring | 2027-Q1 | Direct OAuth push of shortlists |
| Native iOS + Android apps | — | Parked | 2027+ | Deferred until PWA proves insufficient |
| Blockchain-anchored credentials | — | Parked | 2027+ | W3C VC + W3C DID is enough for v1 |

## How to request a feature

Email `product@antarix.app` (TBD <!-- TODO: confirm mailbox owner and response-time SLA -->) with a 1-paragraph description of the use case. We do not have a public feature-request board in v1; the GitHub Discussions category "Feature requests" and a Canny board (TBD <!-- TODO: pick Canny vs GitHub Discussions vs Fider; lean Canny for moderation; need admin account -->) are the planned replacements. Every request gets a "Triage" reply within 5 business days with one of three outcomes: **Tracking** (we are considering it for the next planning round), **Committed** (we have added it to a sprint), or **Parked** (we have logged it and will revisit in 6 months with the rationale). We do not promise dates for Tracking items.

## How we decide what to build

We use a single, simple rule. Items are prioritised in this order:

1. **Does it move the user closer to a verified credential?** If yes, it ranks above everything else. The credential is the asset; everything that helps the student get one, refresh it, share it, or have it verified is top priority.
2. **Does it increase trust or portability?** Trust means the credential is hard to forge, hard to revoke incorrectly, and easy for a third party to verify. Portability means the credential works in LinkedIn, an HR system, a college alumni page, and a government verifier without per-partner work.
3. **Does it unblock a paying customer?** If a paying customer is waiting on a feature, and the feature is not in conflict with 1 or 2, it jumps the queue. We do not build speculative features ahead of paying-customer demand.

"Parked" means at least one of those three tests is currently failing — most often because a different thing needs to ship first. "Exploring" means all three tests pass, but the implementation cost or the open questions are not yet small enough to commit.

## Related pages

- **Changelog:** [`docs/changelog.md`](./changelog.md) — every release, every fix, every security disclosure, in Keep-a-Changelog format.
- **Status page:** [`apps/web/public/status.html`](../apps/web/public/status.html) — live subsystem health at `https://antarix.app/status`.
- **API documentation:** [`apps/web/public/api-docs/index.html`](../apps/web/public/api-docs/index.html) — the public OpenAPI spec for the W3C VC resolve and authed issue endpoints.
- **Security policy:** [`docs/security/vdp.md`](./security/vdp.md) — how to report a vulnerability, with a 90-day coordinated-disclosure window.
