# Phase 0 Research: 11/10 — Defensible Moat

**Date**: 2026-06-06
**Status**: Decisions ratified; ready for Phase 1

Ten architectural decisions for feature 004. Each captures the choice, the rejected alternatives, and the rationale.

---

## D1. Anti-cheat signal architecture: rule-based first, ML later

**Decision**: Implement anti-cheat as a deterministic rule pipeline (4 signals) with a confidence aggregator. Defer ML-based detection (e.g. fine-tuned classifier) until ≥ 10K labeled cheat/legitimate examples are accumulated from real appeals.

**Signals (v1)**:
1. `fork_no_commits` — fork relation present, zero student commits in the fork
2. `commit_cluster_time` — > 80% of commits within a 30-minute window (suggests bulk paste)
3. `ai_generated_suspect` — code matches a known AI-output fingerprint (GPT-4, Claude, Copilot patterns via regex + AST signatures)
4. `copied_content_overlap` — ≥ 70% line-level overlap with a public repo not authored by the student

**Aggregation**: `anticheat_score = max(signal.confidence)` per repo. Threshold `≥ 0.6` → quarantine.

**Alternatives considered**:
- ML-only approach (rejected — cold-start problem, no labeled data)
- LLM-as-judge for every repo (rejected — too expensive at 50K students × N repos)

**Rationale**: Rule-based is auditable, deterministic, and explainable to students appealing a quarantine. ML can layer on top later as a separate signal once labeled data exists.

---

## D2. ATS sync: REST per-provider, no abstraction layer

**Decision**: Implement Greenhouse and Lever as two separate edge functions (`ats-sync-greenhouse`, `ats-sync-lever`) with no shared abstraction. Share only a thin `pushCandidate(student, score)` interface in `apps/web/src/lib/ats/` per provider.

**Alternatives considered**:
- Universal ATS interface (rejected — Greenhouse and Lever models diverge enough that an abstraction would leak; YAGNI)
- Third-party iPaaS (Merge.dev, Tray.io — rejected for cost and vendor lock-in)

**Rationale**: Two providers ship in v1. If we ever add a third, refactor then. Keep code small and obvious.

**API constraints**:
- Greenhouse: 50 req per 10s per API key. Use `Harvest` API for candidate push.
- Lever: 10 req/s. Use `/v1/candidates` POST.
- Failure handling: exponential backoff (1s, 4s, 16s), then pause sync and notify recruiter.

---

## D3. i18n: next-intl with file-based locale catalogs, locale lives on `users.locale`

**Decision**: Use the existing `next-intl` dependency. Add 4 catalog files: `messages/hi.json`, `messages/ta.json`, `messages/te.json`, `messages/mr.json` (alongside existing `en.json`). Persist user preference in `users.locale` (existing column to be added in migration 034 if absent).

**Alternatives considered**:
- DB-backed translations (rejected — adds latency for every render; file catalogs are diffable + git-versioned)
- LLM auto-translation on-the-fly (rejected — non-deterministic; risks tone drift; cost; brittle)

**Rationale**: File catalogs are reviewable in PRs, translatable by humans or LLM-assisted with human post-edit, and zero-runtime-overhead. Missing keys fall back to English AND log to `i18n_missing_keys` for the translator queue.

**Locale list (v1)**: `en` (default), `hi` (Hindi), `ta` (Tamil), `te` (Telugu), `mr` (Marathi).

**Coverage**: AI Coach nudges (4 templates), settings UI, dashboard chrome, notification inbox. Public profile + verifiable credential page remain English-only (recruiter audience).

---

## D4. Enterprise SSO: WorkOS as the SAML broker

**Decision**: Integrate WorkOS as the SAML 2.0 IdP broker. Use `@workos-inc/node` SDK. Each institution gets a WorkOS connection ID stored in `sso_connections.workos_connection_id`. Login flow: `/api/sso/workos/login?institution_slug=<slug>` → WorkOS hosted login → `/api/sso/workos/callback` → Supabase session.

**Alternatives considered**:
- Roll-our-own SAML with `passport-saml` (rejected — security surface, certificate management, IdP idiosyncrasies)
- Auth0 (rejected — more expensive at scale, no Indian-pricing advantage)
- Supabase SSO (paid tier — viable alternative but ties tenants to Supabase auth more tightly; WorkOS gives us provider portability)

**Rationale**: WorkOS bills per-connection (~$125/connection/mo at the time of writing), generous free trial, single SDK call to handle all IdP variants (Okta, Azure AD, Google Workspace, OneLogin), and a clean React/Next.js example.

**Failure semantics**: SAML callback failures fail-closed; surface an admin alert; never auto-create accounts without a valid `role` attribute.

---

## D5. Faculty grading: per-grade weight capped at 10%; outlier monitoring is per-faculty

**Decision**: Faculty grades contribute up to 10% of total Skill Proof Score. Each grade event creates one row in `faculty_grades`. A nightly job computes the per-faculty distribution (mean, stdev, kurtosis); faculty with > 2 stdev from peer mean for ≥ 30 days are flagged for college-admin review (not auto-rejected).

**Alternatives considered**:
- Equal-weight all faculty (rejected — risks grade inflation)
- Reputation-weighted faculty (deferred to v2 — adds complexity before we have evidence of need)

**Rationale**: 10% cap prevents a single corrupt faculty from gaming the system. Outlier monitoring is informational (humans decide), not punitive (no auto-disqualification).

---

## D6. Hackathon code execution: Supabase Edge Function with hard caps + no network

**Decision**: Execute submissions inside a Deno-based Supabase Edge Function with:
- 30s CPU cap (hard kill)
- 256 MB memory cap (hard kill)
- Network egress disabled at the function boundary
- Input/expected-output JSON from `hackathons.test_cases_url`
- Output captured as JSON and persisted to `hackathon_submissions.test_results_json`

**Alternatives considered**:
- Dedicated container (Docker via Cloud Run / Fly.io — rejected for v1 cost + ops complexity)
- HackerEarth/Codeforces judge integration (rejected — vendor lock-in + we lose control over fraud signals)

**Rationale**: Edge functions are already in the stack. The 30s/256MB envelope handles 95%+ of programming-challenge code. If a hackathon needs more (e.g. ML model training), the recruiter sets `requires_native_runtime=true` and we route to a deferred v2 pipeline.

**Sandbox guarantees**: Deno's permission model + Supabase function isolation provide network/file-system denial by default; the function declares zero permissions.

---

## D7. Mock interview LLM: configurable provider with cost caps

**Decision**: Mock-interview LLM provider is configurable via env (`MOCK_INTERVIEW_PROVIDER=openai|groq|together`). v1 default: Groq (low latency + low cost). Each session has a per-student weekly token cap (`MOCK_INTERVIEW_WEEKLY_TOKEN_CAP=50000`) and a per-tenant monthly cap (`MOCK_INTERVIEW_MONTHLY_TOKEN_CAP=5000000`). Caps enforced at the edge function before the LLM call.

**Alternatives considered**:
- Single provider lock-in (rejected — provider pricing changes; want portability)
- Self-hosted Llama (deferred to v2 — GPU ops complexity)

**Rationale**: Groq's hosted Llama 3.1 70B gives < 1s token-stream latency at < $0.05 per session of typical length. Falling back to OpenAI for premium tiers is a one-config-change.

**Scoring**: Rubric prompt asks the LLM to score clarity/depth/correctness on 0-10 with justification. Result persisted as JSON. Capped score contribution: max 5% of total score per week.

---

## D8. Public API: API keys hashed with `pgcrypto`, rate limit via Postgres + token bucket

**Decision**: API keys stored as `key_hash` (`crypt(key, gen_salt('bf'))`) — never plaintext after creation. Rate limit implemented in Postgres via a `pg_rate_limit` materialized counter (1-minute sliding window). Webhook signatures: HMAC-SHA256 over the JSON body with a per-subscription secret.

**Alternatives considered**:
- Redis-backed rate limit (rejected — adds infra; Postgres-only is sufficient at 50K student scale)
- JWT-based API keys (rejected — JWTs are not natively revocable without a denylist; opaque keys + hash is simpler)

**Rationale**: We already run Supabase Postgres for everything. Adding Redis just for rate-limiting is premature. Hashed keys with prefix-match (e.g. `ant_pub_xxxx`) give us scannable logs while preserving secret confidentiality.

---

## D9. PWA: `serwist` for service worker (Next.js 15 compatible)

**Decision**: Add PWA support via `serwist` (formerly `@serwist/next`). Manifest generated from `app/manifest.ts` (Next.js 15 metadata API). Strategies:
- API routes (`/api/*`): `network-first` with 1s timeout, then cache fallback
- Dashboard chrome: `stale-while-revalidate`
- Static assets: `cache-first`
- Offline fallback page: `/offline`
- Background sync for mark-nudge-read and similar idempotent mutations

**Alternatives considered**:
- `next-pwa` (rejected — slower release cadence, not yet App Router-native)
- Hand-rolled service worker (rejected — too much surface to maintain)

**Rationale**: `serwist` is actively maintained, Next.js 15 App Router-native, has a sensible default for `precache` + `runtimeCaching`.

---

## D10. Next-best-skill: SQL similarity query, no ML model

**Decision**: Implement as a SQL query over the `placements` + `verified_skills` tables. For a student S:
1. Find alumni A with ≥ 60% Jaccard similarity over current skill set
2. Of those A who got placed, count which skills they added *after* matching their pre-placement profile to S's current profile
3. Return top 3 with `source_count` (≥ 5) and confidence

**Alternatives considered**:
- Embeddings + cosine similarity via `pgvector` (deferred to v2 — only worth the index cost once we have 10K+ alumni)
- Collaborative filtering with explicit factorization (rejected — over-engineering for v1)

**Rationale**: SQL similarity is auditable, explainable to students ("8 of 12 alumni placed at <Company> added <Skill> after your current stack"), and runs in < 200ms at 50K-alumni scale with proper indexes. pgvector becomes interesting when we want semantic skill matching (e.g. "Vue ≈ React") — defer.

---

## Cross-cutting decisions

- **Migrations land additive (034-037).** No destructive changes. Each migration is independently reversible.
- **All new edge functions emit structured logs to `supabase.functions.invoke_log`** for the existing observability stack.
- **All new external dispatches (ATS, webhook, mock-interview, anti-cheat appeal) log to a feature-scoped audit table** with `actor`, `subject`, `action`, `payload_hash`, `created_at`.
- **Feature flags via existing `feature_flags` table** (added in 003): every 004 capability ships behind a flag for cohort rollout.
- **All P3 features are explicitly behind a flag from day 1** (PWA, public API, outcome billing, next-best-skill) so they can be rolled out to small cohorts first.
