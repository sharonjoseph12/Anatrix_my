# 004 — Top 1% International Improvements

> **What this is.** The accumulated output of the 18 sub-agent batches that shipped 59+ new files to the Antarix 11/10 platform. This is a meta-index: every file below is a real file on disk, with a one-paragraph summary, links to the deep docs, and the originating agent. The goal was to move Antarix from "a strong product" to "the international top-1% product for verified skill intelligence" — globally portable credentials (W3C VC), legally compliant (GDPR / DPDP / CCPA / LGPD / AI Act), observability-instrumented, rate-limit-protected, webhook-enabled, fully documented, and ready to launch.

## 1. The 6 layers

The 59+ files ship in 6 functional layers. Each layer can be adopted independently. The 002 layer (Antarix Definitive Vision) is prerequisite to everything below; the 003-004 layers are additive.

| # | Layer | Files | Purpose |
|---|---|---:|---|
| 003 | W3C VC + DID + EdDSA | 8 | Globally-portable, cryptographically-verifiable credentials |
| 003 | i18n scaffold (next-intl) | 6 | English + Hindi as the first 2 locales, ready to scale to 10+ |
| 003 | Edge Function observability | 4 | Structured logging + W3C trace context + OTel-shaped spans |
| 004 | Webhooks for partners | 4 | 7 outbound + 3 inbound event types, Stripe-compatible HMAC |
| 004 | Public status page | 4 | Self-contained, no-framework, 7-subsystem parallel probe |
| 004 | Public API docs site | 3 | Swagger UI 5.x from CDN, byte-synced to the OpenAPI 3.1.0 spec |
| 004 | Real EdDSA signing (Plan C) | 3 | SQL-side handoff to Edge Function signing when Supabase ships `pg_eddsa` |
| 004 | Rate limiting + abuse guard | 4 | Token-bucket per `user_id`/`fn`, atomic SQL-backed, 7 default configs |
| 004 | Legal & compliance docs | 5 | Privacy notice, AI Act disclosure, DPDP Act notice, DPA template, sub-processor list |
| 004 | VDP + threat model | 5 | RFC 9116 security.txt, W3C DID Core did.json, 20 STRIDE rows |
| 004 | OpenAPI spec for VC API | 2 | 2 endpoints, 14 schemas, 6 examples, swagger-cli validate passed |
| 004 | Marketing site copy | 4 | Landing, 3 personas, 24-FAQ, 5-competitor table |
| 004 | Help center / knowledge base | 6 | 4 persona pages + 46-item troubleshooting + 42-term glossary |
| 004 | GTM playbook | 4 | Pricing tiers, sales scripts, college partnership, T-30 launch checklist |

## 2. The file index

### 2.1 W3C VC + DID + EdDSA (8 files)
- `supabase/migrations/032_w3c_vc.sql` — W3C VC v2.0 + `did:web` schema, 6 new columns on `verifiable_credentials`, 2 new tables (`vc_revocations`, `vc_issuer_keys`), 3 SECURITY DEFINER functions (`build_vc_document`, `sign_vc_document` stub, `resolve_did`). (A-1)
- `docs/w3c-vc-strategy.md` — design rationale, `did:web` choice, third-party verification flow, 6 open questions. (A-1)
- `supabase/functions/credential-vc-issue/index.ts` — authed POST endpoint, chains the 032 SQL fns, writes the issued `vc_document` + `vc_proof` to the row. (B-1)
- `supabase/functions/credential-vc-resolve/[did]/index.ts` — **public**, no JWT, returns the W3C DID Resolution envelope. (B-1)
- `docs/w3c-vc-impl.md` — end-to-end flow, real EdDSA upgrade path, curl example. (B-1)
- `supabase/migrations/039_w3c_vc_real_eddsa.sql` — Plan C: SQL function becomes a handoff (`edge_signing_required: true`, `proofValue: null`). (C-3)
- `scripts/seed-issuer-key.ts` — one-time Deno/Node script to generate the Ed25519 keypair and print the `publicKeyMultibase` for `did.json`. (C-3)
- `docs/w3c-vc-eddsa-rollout.md` — the 3-stage rollout, key rotation, compromise response, test vector. (C-3)

### 2.2 i18n scaffold (6 files)
- `apps/web/messages/en.json` — 36 flat-dotted English message keys. (A-2)
- `apps/web/messages/hi.json` — 36 Hindi translations, 1:1 key parity. (A-2)
- `apps/web/src/i18n/config.ts` — `locales`, `defaultLocale`, `Locale` type, `localeLabels`. (A-2)
- `apps/web/src/i18n/request.ts` — `getRequestConfig` for `next-intl`. (A-2)
- `apps/web/src/i18n/locale-switcher.tsx` — client `<select>` using `useRouter` + `usePathname`. (A-2)
- `apps/web/middleware.ts` — `next-intl` middleware (⚠️ **collides with existing `apps/web/src/middleware.ts`** — see §4 adoption). (A-2)
- `apps/web/next.config.ts` — additively wrapped with `createNextIntlPlugin`. (A-2, modified)
- `apps/web/package.json` — additively lists `next-intl ^3.26.0` (not yet installed). (A-2, modified)
- `docs/i18n-scaffold.md` — adoption pattern, switcher wiring, the middleware-conflict resolution. (A-2)

### 2.3 Edge Function observability (4 files)
- `supabase/functions/_shared/observability.ts` — `withObservability(name, handler)` + `ObsContext` with `log`/`span`/`requestId`/`userId`. (A-3)
- `supabase/functions/health-check/index.ts` — reference impl, 30s in-memory cache, copy-paste template in header. (A-3)
- `supabase/functions/_shared/observability.test.ts` — 4 Deno stdlib test cases (un-run; Deno not on this machine). (A-3)
- `docs/observability.md` — 3-step adoption guide, log shipper options (Vector recommended), OTel v2 migration path. (A-3)

### 2.4 Webhooks (4 files)
- `supabase/migrations/041_webhooks.sql` — `webhook_endpoints` + `webhook_deliveries` + `webhook_event_types` (3 tables). (D-3)
- `supabase/functions/_shared/webhook-dispatch.ts` — Stripe-compatible `t=,v1=` HMAC, 10s timeout, 10-failure auto-disable, retry-with-backoff. (D-3)
- `supabase/functions/webhook-receiver/[id]/index.ts` — partner-to-Antarix inbound for 3 closed-loop event types. (D-3)
- `docs/webhooks.md` — 7 outbound schemas, signature verification in Node/Python/Go, retry policy, 6 open items. (D-3)

### 2.5 Public status page (4 files)
- `supabase/functions/status-page-data/index.ts` — `Promise.allSettled` probe of 7 subsystems, 60s in-memory cache, always 200. (D-1)
- `supabase/migrations/040_status_page.sql` — `status_incidents` + `status_scheduled_maintenances` tables with 2+1 seeded rows. (D-1, ⚠️ **numbering conflict** — see §4)
- `apps/web/public/status.html` — self-contained, no framework, no build step, dark-mode-aware. (D-1)
- `docs/status-page.md` — the 3 components, incident logging, caching, 4 open items. (D-1)

### 2.6 Public API docs site (3 files)
- `apps/web/public/api-docs/index.html` — Swagger UI 5.32.6 from `unpkg`, no SRI yet, v2 vendoring path. (D-2)
- `apps/web/public/api-docs/openapi.yaml` — **byte-identical** to `specs/003-engage-and-showcase/openapi.yaml`. (D-2)
- `docs/api-docs-site.md` — why static, 3 components, manual-sync, 5 v2 follow-ups, CDN-compromise mitigation ladder. (D-2)

### 2.7 Rate limiting (4 files)
- `supabase/migrations/033_rate_limit.sql` — `rate_limit_buckets` table + `rate_limit_consume` SQL fn (atomic, single statement). (B-3)
- `supabase/functions/_shared/rate-limit.ts` — `withRateLimit(name, cfg, handler)`, 7 default configs, composes with `withObservability`. (B-3)
- `supabase/functions/_shared/rate-limit.test.ts` — 9 Deno test cases with `__setSupabaseFactoryForTesting` hook (un-run). (B-3)
- `docs/rate-limiting.md` — model, configs table, 3-step adoption, 30-day GC, atomicity claim, IP-fallback gap. (B-3)

### 2.8 Legal & compliance (5 files)
- `docs/legal/privacy-notice.md` — 1186w, GDPR Art 6 lawful basis, DPF + SCCs, 90-day retention, 7 DSR rights, AI Act Art 22 disclosure. (B-2)
- `docs/legal/ai-act-disclosure.md` — 595w, "limited-risk" classification, opt-out, EU representative TBD. (B-2)
- `docs/legal/dpdp-act-notice.md` — 786w, Data Fiduciary + Processors, parental-consent flow flagged as product gap. (B-2)
- `docs/legal/dpa-template.md` — 2535w, redline-ready with `{{PARTY_NAME}}` placeholders, 13 sections + SCCs annex. (B-2)
- `docs/legal/sub-processor-list.md` — 472w, 6 entries (Supabase, Meta, GCAL, GitHub, Web Push, Email/observability TBD). (B-2)

### 2.9 VDP + threat model (5 files)
- `docs/security/vdp.md` — 245w, RFC 9116-aligned VDP, 4-tier CVSS SLA, no paid bounty v1, PGP key TBD. (C-2)
- `docs/security/threat-model.md` — 182w, **20 STRIDE rows** (T-01 through T-20), out-of-band mitigations, quarterly review. (C-2)
- `apps/web/public/.well-known/security.txt` — RFC 9116 strict, `Expires 2027-06-06`, `Preferred-Languages: en, hi`. (C-2)
- `apps/web/public/.well-known/did.json` — W3C DID Core, `JSON.parse` verified, `LinkedVerifiablePresentation` service endpoint. (C-2)
- `apps/web/public/.well-known/did.json.README.md` — operator notes, `publicKeyMultibase` replacement procedure. (C-2)

### 2.10 OpenAPI spec (2 files)
- `specs/003-engage-and-showcase/openapi.yaml` — 1570L, **swagger-cli validate PASSED**, 2 endpoints, 14 schemas, 6 examples. (C-1)
- `docs/api-verification.md` — 621w, 4-step verification flow, 30-line Node reference client, code samples in curl/Node/Python/Go. (C-1)

### 2.11 Marketing copy (4 files)
- `docs/marketing/landing-copy.md` — 708w, H1 "Proof, not promises" + 2 alternates, 3-step how-it-works, 5 differentiation bullets. (E-1)
- `docs/marketing/3-personas.md` — 1966w, Riya / Arjun / Dr. Sharma with 5 sections each (cares / fears / 60s pitch / objections / CTA). (E-1)
- `docs/marketing/faq.md` — 3401w, 24 questions (8 per persona + 3 general). (E-1)
- `docs/marketing/competitor-comparison.md` — 1604w, 12-row table vs HackerRank / LeetCode / CodeSignal / LinkedIn Skills / Handshake. (E-1)

### 2.12 Help center (6 files)
- `docs/help/students.md` — 1760w, 10 sections (onboarding, GitHub/Calendar, AI Coach, Power Mode, etc.). (E-2)
- `docs/help/recruiters.md` — 1400w, 9 sections (search, filters, verify, contact, GDPR/DPDP/CCPA, pricing, webhooks). (E-2)
- `docs/help/colleges.md` — 1293w, 9 sections (cohort dashboard, curriculum intelligence, alumni tracking, DPDP). (E-2)
- `docs/help/companies.md` — 9 sections (setup, pricing, audit log, webhooks, ATS, analytics, compliance, troubleshooting). (orchestrator, filling F-1's flagged gap)
- `docs/help/troubleshooting.md` — 4609w, **46 items** in 5 sections. (F-1)
- `docs/help/glossary.md` — 1681w, **42 terms** in 6 groups. (F-1)

### 2.13 GTM playbook (4 files)
- `docs/gtm/pricing-tiers.md` — 3751w, 3 pricing principles (students free / recruiters per-seat / colleges per-institution), 90%+ gross margin claim. (E-3)
- `docs/gtm/sales-scripts.md` — 4183w, 7 scripts (recruiter cold/discovery/close, college cold/discovery/close, student self-serve). (E-3)
- `docs/gtm/college-partnership.md` — 2311w, 3 partnership models, 8-step process, 4 success criteria, 3 red flags. (F-2)
- `docs/gtm/launch-checklist.md` — 1898w, T-30 (8 items) / T-7 (5) / T-1 (4) / T-0 (6 ordered steps) / T+72h (5 retro Qs). (F-2)

## 3. The 18 sub-agents (provenance)

| # | Agent | Scope | Outcome |
|---|---|---|---|
| 1 | A-1 | W3C VC + DID schema | landed |
| 2 | A-2 | i18n scaffold (next-intl) | landed (middleware conflict flagged) |
| 3 | A-3 | Edge Function observability | landed (Deno tests un-run) |
| 4 | B-1 | W3C VC Edge Functions | landed |
| 5 | B-2 | Legal & compliance docs | landed (false-alarm cancel) |
| 6 | B-3 | Rate limiting | landed |
| 7 | C-1 | OpenAPI spec for VC API | landed (swagger-cli validate passed) |
| 8 | C-2 | VDP + security.txt + did.json | landed |
| 9 | C-3 | Real EdDSA (Plan C) | landed (1 retry; picked `039` over prescribed `034`) |
| 10 | D-1 | Public status page | landed (picked `040`, conflicts w/ Agent B) |
| 11 | D-2 | Public API docs site | landed |
| 12 | D-3 | Webhooks | landed (picked `041` to avoid D-1 collision) |
| 13 | E-1 | Marketing copy | landed (all 4) |
| 14 | E-2 | Help center | landed (3 of 6 directly) |
| 15 | E-3 | GTM playbook | landed (2 of 4 directly) |
| 16 | F-1 | Help fill-in: troubleshooting + glossary | landed (flagged missing `companies.md`) |
| 17 | F-2 | GTM fill-in: partnership + launch checklist | landed |
| 18 | orchestrator | Help fill-in: companies.md | landed |

**Aggregate:** 18 invocations, 100% successful, 2 retries needed, 3 spurious-cancel false alarms. 59 new files + 2 modified (`apps/web/next.config.ts`, `apps/web/package.json`).

## 4. The unresolved things you must close before commit

### 4.1 Migration directory numbering collisions

The other agent (Agent B) and the 004 top-1% layer have been adding migrations concurrently. Real state of `supabase/migrations/0xx_*.sql` (lex-sorted):

| # | File | Owner | Notes |
|---|---|---|---|
| 001–018 | base | Agent B | clean |
| 020 | `dispatch_columns` + `whatsapp` | **collision** | 002 layer |
| 021 | `institution_nudge_polish` + `predictions` | **collision** | 002 layer |
| 022 | `engage_showcase_indexes` + `credentials` | **collision** | 002 layer |
| 023–031 | 002 layer | clean | |
| 032 | `w3c_vc` | A-1 | |
| 033 | `rate_limit` | B-3 | |
| 034–038 | Agent B's 003 layer | clean | |
| 039 | `w3c_vc_real_eddsa` | C-3 | (picked to avoid `034_anticheat.sql`) |
| 040 | `institutions_slug` (B) + `status_page` (D-1) | **collision** | 004 layer |
| 041 | `webhooks` | D-3 | (picked to avoid D-1's `040`) |
| 042 | `verify_api_key` | Agent B | new since batch 3 |

**Recommendation:** renumber the "polish" / "indexes" / "showcase" / "status_page" files to 040+ so the originals keep their 020/021/022/040 slots. Lex-sort preserves 001→018 base → 020-031 002 layer → 032-039 003 layer → 040+ 004 layer.

### 4.2 The i18n middleware conflict

A-2 created `apps/web/middleware.ts` for `next-intl`, but `apps/web/src/middleware.ts` already exists (subdomain routing + Supabase auth + `/u/<slug>` rewrites). Next.js allows only one. Resolution documented in `docs/i18n-scaffold.md` §7.1: chain `next-intl` middleware into the existing `src/middleware.ts`, delete the new root `middleware.ts`. **The adopting agent owns this; do not apply the new `middleware.ts` as-is.**

### 4.3 The `publicKeyMultibase` placeholder in `did.json`

The real value is generated by `scripts/seed-issuer-key.ts` (C-3). The orchestrator must: (1) install Deno or Node 20+, (2) run the seed script, (3) paste the printed `publicKeyMultibase` into `apps/web/public/.well-known/did.json`. Until then, the `did.json` is structurally valid but the verification will fail.

### 4.4 The `vc_issuer_keys` empty in dev

`credential-vc-issue` returns 500 `no_issuer_key` until a row is inserted. Run the seed script (§4.3) to fix.

### 4.5 Inboxes that don't exist yet

`support@`, `security@`, `grievance@`, `privacy@`, `status@`, `admin@`, `billing@`, `api@`, `press@` — referenced from the docs but not all provisioned. Provision them on the email provider of choice (recommend: Google Workspace with aliases, or a `forwardemail.net` setup).

### 4.6 2FA account-recovery flow

Referenced from `docs/help/troubleshooting.md` (L46) but doesn't exist. v2 work.

### 4.7 Parental-consent flow for under-18 students

DPDP Act §17 requires verifiable parental consent. We have NO flow. v1 is 18+ only (we delete under-18 users within 7 days per the privacy notice), but this blocks the v2 "expand to 16+ in India" plan.

### 4.8 The W3C VC `proofValue: null` in dev

Until `039_w3c_vc_real_eddsa.sql` is applied AND `scripts/seed-issuer-key.ts` is run AND `credential-vc-issue` is patched to detect `edge_signing_required: true` and call `@noble/ed25519`, every issued credential has `proofValue: null`. The v1 stub is documented but **not for production**.

### 4.9 Deno tests un-run

A-3, B-1, B-3, C-1, D-1, D-3 all shipped `.test.ts` files. Deno is not on this Windows machine; none of the tests ran. The adopting agent must install Deno and run `deno test supabase/functions/_shared/*.test.ts` before declaring green.

### 4.10 The webhook retry cron not landed

`retryFailedDeliveries()` is exported and ready, but no `cron.schedule` was added. Drop-in SQL snippet in `docs/webhooks.md` §11; awaiting a post-038 cron migration.

## 5. The adoption order (recommended)

1. **Resolve migration-dir collisions** (§4.1). One git mv per file. No code changes.
2. **Resolve i18n middleware conflict** (§4.2). One file delete + one chain. ~10 lines.
3. **Apply the 004 migrations against a dev database in order:** 032 → 033 → 039 → 040 → 041. Verify with `psql -f supabase/migrations/032_w3c_vc.sql` etc.
4. **Run `scripts/seed-issuer-key.ts`** to generate the keypair. Paste `publicKeyMultibase` into `did.json`.
5. **Deploy the new Edge Functions:** `health-check`, `credential-vc-issue`, `credential-vc-resolve/[did]`, `status-page-data`, `webhook-receiver/[id]`.
6. **Wire `withObservability` into the other 28 Edge Functions** (3-step adoption, ~5 min per function).
7. **Wire `withRateLimit` into the public endpoints** (3-step adoption).
8. **Install next-intl** (`pnpm add next-intl@^3.26.0`) and adopt the i18n pattern in 1 page as a pilot.
9. **Commit:** 001 base → 002 layer → 003 top-1% layer → 004 international layer (in that order, so `git log` reads chronologically).
10. **Run the launch checklist** (`docs/gtm/launch-checklist.md`).

## 6. The 5 things this did NOT do (intentional)

- **No portfolio feature.** LinkedIn owns that. Antarix is the verified-signal layer, not the resume layer.
- **No general-purpose student records system.** The credential is the artifact. We don't store transcripts, marksheets, or anything else.
- **No real-time collaboration.** The placement officer dashboard refreshes nightly. Real-time is a recruiter-time feature and a v2 add.
- **No multi-tenant college branding.** The college dashboard uses the Antarix brand. White-label is a v2 enterprise add (see `docs/gtm/pricing-tiers.md`).
- **No data-residency switching per user.** v1 lets you pick a Supabase region per project. Per-user switching (EU user → eu-central-1, IN user → mumbai) is a v2 add.

## 7. The follow-up batches (if you want them)

- **Batch 6 (pure docs):** SEO/sitemap, public roadmap, changelog, onboarding email/WhatsApp sequences, Plausible analytics spec
- **Batch 7 (low-risk code):** wire `withObservability` + `withRateLimit` into the 28 existing Edge Functions (an `apps/web/src/middleware.ts` patch for the i18n conflict), Stage 3 of the EdDSA rollout (the 30-line Deno patch to `credential-vc-issue`), the webhook retry cron migration
- **Batch 8 (real releases):** provision the 9 inboxes, generate the PGP key, sign the DPAs, submit the WhatsApp templates (unblocks T011), publish the Chrome extension to the Web Store, run the T-30 launch checklist
