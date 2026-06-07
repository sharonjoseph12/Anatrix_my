# Research: Antarix 11/10 — Verified Skill Intelligence Platform

**Branch**: `002-antarix-definitive-vision` | **Date**: 2026-06-04
**Builds on**: `specs/001-antarix-complete-workflow/research.md` (foundation tech stack)

This research document captures only the **new** technical decisions introduced by the 11/10 vision. The foundation stack (Next.js 15 + Supabase + Chrome Extension MV3 + Tailwind v4 + shadcn/ui + Turborepo + pnpm) is inherited from spec 001 and is not re-litigated here.

## New Decisions Introduced by the 11/10 Vision

### Decision A: WhatsApp Delivery Channel

**Decision**: WhatsApp Business API via **Meta Cloud API** (hosted) as the primary nudge channel, with a documented fallback path to the **Twilio WhatsApp API** for regions or templates where Meta is constrained.

**Rationale**: Indian students live on WhatsApp. The 11/10 vision treats the AI Coach as the engagement engine, and the coach must reach the student where they already are. Meta Cloud API is the first-party option (cheaper, faster template approval, no per-message Twilio markup) and aligns with Meta's free entry-tier pricing for the first 1,000 service conversations per month.

**Alternatives considered**:
- Twilio as the only provider — simpler operationally, but per-message cost is higher and locks the product into one vendor.
- Gupshup / Wati — strong Indian-market presence, but template review is slower and the long-term pricing curve is steeper than Meta's hosted offering.
- WhatsApp via BSP-only — adds a vendor between us and Meta; rejected for v1.

**Cost risk acknowledged (per source vision §11)**: At 50,000 students × 365 daily messages, WhatsApp API costs become a real line item. This is a billing concern, not a product concern — it lives in cost-optimization work (template batching, per-student send budgets, "lite nudge" mode during inactive weeks) and is not in scope for the spec/plan.

---

### Decision B: AI Coach Trigger & Generation Pipeline

**Decision**: A **trigger → template → render → dispatch** pipeline.
- **Trigger** layer: pg_cron jobs (daily 8 AM nudge, Sunday 10 AM weekly, every-2-hour streak-risk check) plus event-driven triggers (score recomputed, new commit, calendar free-window opening).
- **Template** layer: A small library of parameterized message templates per nudge type, each with a documented personalization contract (e.g., "Daily Morning Nudge MUST include yesterday's commit count, current streak, today's first free window ≥ 60 min, and one in-progress project").
- **Render** layer: A Supabase Edge Function that, given a (student, nudge_type, context) tuple, fetches the data the template contract requires and produces a final message body.
- **Dispatch** layer: A separate Edge Function that hands off the rendered message to the WhatsApp provider (or to the push/extension channel fallback) and records the `nudges` row.

**Rationale**: Separating trigger / template / render / dispatch keeps each piece testable, allows template iteration without touching trigger logic, and means the same renderer can produce content for WhatsApp, push, and dashboard cards with channel-specific formatting.

**Alternatives considered**:
- Single monolith function — faster to build, impossible to evolve without breaking changes.
- External workflow tool (n8n, Temporal) — over-engineering for v1 volume and adds infrastructure to manage.

---

### Decision C: Verifiable Credential Issuance

**Decision**: A **signed, public-resolution credential** with the following properties:
- Public URL of the form `antarix.app/verify/{slug}` that any third party (no Antarix account) can visit.
- The verification page shows: name, institution, current overall score, per-skill proficiency, verified activity totals, cohort percentile, and a "last verified at" timestamp.
- Each credential has a server-side **revocation/invalidation** flag and a **last-known score snapshot** that the public page compares against the current live score; if they differ by more than a documented threshold, the public page exposes the delta with a "score has changed since issuance" disclosure.
- Distribution channels: public URL (canonical), PDF download (generated server-side), QR code (PNG of the URL), LinkedIn badge (a LinkedIn-embeddable card linking back to the URL).

**Rationale**: The credential is the student's portable asset. It must work outside the Antarix product (third-party verification, LinkedIn, PDF) and must be self-consistent (what's on the credential matches what's live, with a clear "this is current as of X" semantic).

**Alternatives considered**:
- W3C VC / DID-based credentials — interoperable and standards-based, but adoption is thin in 2026 and the marginal value over a signed public URL is low for a v1 product.
- PDF-only credential — easy to print on a resume but unverifiable; rejected as the only channel.
- Embedding the live score in the PDF (no URL) — defeats verifiability; rejected.

---

### Decision D: Placement Prediction Model

**Decision**: A **scoring + rule-augmented** model in v1, not a deep-learning model.
- v1 placement prediction = function `(current_skill_proof_score, score_trajectory_90d, specialization_market_alignment, cohort_percentile, project_completion_rate, consistency_score, power_mode_bonus, historical_cohort_data)` → `(probability_0_100, company_tier, time_to_ready, top_3_gaps)`.
- Implemented as a documented PostgreSQL function called weekly by pg_cron, with results persisted to `placement_predictions` for inspection and backtesting.
- A second layer (model retraining on real outcome data) is explicitly out of scope for v1 but the data shape must support it: per-student feature snapshots are stored, not just the latest prediction.

**Rationale**: The product needs a defensible, explainable prediction from day 1. A rule-augmented scorer with documented inputs is auditable, easy to tune, and gives the AI Coach something to cite ("your placement prediction is 87% because…"). Deep-learning models can be layered in later once there is real placement-outcome data to train on.

**Alternatives considered**:
- Black-box ML model from day 1 — high cost, low explainability, and no training data yet.
- Static score-only display (no probability) — too vague; the "87% chance of Tier-1" framing is the entire point of the prediction.

---

### Decision E: Privacy-First Cohort Comparison

**Decision**: Cohort leaderboards and percentiles are computed **only over opted-in students** and are never used to leak the presence of opted-out students.
- A "cohort size" displayed in any leaderboard reflects opted-in members; if a student is in the cohort but opted out, they are not counted.
- Search-result counts returned to recruiters reflect only opted-in-to-company-search students. A recruiter can never infer the existence of an opted-out student from a count.
- Account deletion is a **first-class, irreversible** action with a documented purge window (30 days) and a hard credential-invalidation window (24 hours).

**Rationale**: Privacy is a first-class product requirement (FR-014, FR-015, FR-016, FR-019) and the cheapest way to honor it is to compute the aggregates correctly from the start, not to retrofit exclusion logic later.

---

### Decision F: Calendar-Aware Interview Scheduling

**Decision**: When a recruiter issues a one-click invite and the candidate accepts, the system proposes interview slots generated by intersecting the candidate's connected calendar, the interviewer's connected calendar, and the candidate's confirmed peak window (from passive data, refined by Power Mode data when available).

**Rationale**: The "87% Tier-1 placement" pitch is undermined if the platform then schedules interviews during the student's documented lowest-productivity hours. Calendar-awareness is what makes the verified profile *actionable* for recruiters, not just descriptive.

**Alternatives considered**:
- Plain round-robin slot suggestion — simpler, but ignores the data the platform already has.
- Manual student confirmation of every slot — adds friction, reduces the "one-click" promise.

---

### Decision G: Time-Zone & Quiet-Hours Discipline

**Decision**: Every nudge, leaderboard, peak-window computation, and daily-morning-send schedule is computed in the **student's local timezone** from day 1. The system also supports:
- Per-student quiet hours (default 22:00–07:00 local).
- Per-student "pause all nudges" switch.
- Auto-detected **exam weeks** (calendar events with high "exam" / "test" density or all-day "exam" blocks) during which real-time peak-window nudges are suppressed in favor of a single low-pressure daily message.

**Rationale**: An 8 AM nudge in the wrong timezone is a worse experience than no nudge at all. The platform's value is personalized, and personalization requires correct local time. Auto-detecting exam weeks is what keeps the AI Coach from being annoying during the weeks students are most stressed.

---

## Inherited Foundation (from spec 001 — not re-decided)

- **Monorepo**: Turborepo + pnpm workspaces (apps/web, apps/extension, packages/types, packages/utils, supabase/)
- **Frontend**: Next.js 15 App Router, Tailwind CSS v4, shadcn/ui
- **Backend**: Supabase (Auth, PostgreSQL with RLS, Edge Functions, Realtime, Storage)
- **Browser extension**: Manifest V3, TypeScript, chrome.alarms for sync
- **Jobs**: pg_cron + Supabase Edge Functions
- **Testing**: Vitest (unit), Playwright (e2e), Supabase local (integration)
- **Schema baseline**: 17 entities (see `specs/001-antarix-complete-workflow/data-model.md`)

## Unresolved Items

None. All new decisions resolved.
