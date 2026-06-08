# Antarix Threat Model (STRIDE)

> **Disclaimer:** This is a v1 engineering threat model. It is not a substitute for a formal third-party security assessment, a red-team engagement, or a paid penetration test. Items in §8 ("What is NOT covered in v1") are deferred work that should be funded before the platform crosses 10 000 monthly active users or onboards its first enterprise customer.

**Document owner:** `security@antarix.app`
**Companion documents:**
- [`docs/security/vdp.md`](./vdp.md) — Vulnerability Disclosure Policy
- [`docs/w3c-vc-strategy.md`](../w3c-vc-strategy.md), [`docs/w3c-vc-impl.md`](../w3c-vc-impl.md)
- [`docs/observability.md`](../observability.md), [`docs/rate-limiting.md`](../rate-limiting.md)
- [`docs/legal/privacy-notice.md`](../legal/privacy-notice.md), [`docs/legal/sub-processor-list.md`](../legal/sub-processor-list.md)

**Effective date:** 2026-06-06
**Last reviewed:** 2026-06-06
**Review cadence:** quarterly
**Next review:** 2026-09-06 <!-- TODO: schedule calendar event 2026-09-06 for next review -->

---

## 1. Scope and methodology

This document applies the **STRIDE** model (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) to the Antarix v1 platform. We enumerate trust boundaries (§3), assets (§4), and threats (§5), and we score each threat on a qualitative likelihood × impact matrix with a documented mitigation and a residual risk.

We deliberately scope this v1 model to **design-time threats** that engineering can mitigate in code, configuration, or migration. Operational threats (incident response, key rotation cadence, vendor risk management) are mentioned where they touch a design decision but are tracked separately in the operations runbook.

## 2. System overview

The high-level data flow is:

```
                                       +----------------------------+
                                       | Third-party APIs            |
                                       |  - GitHub OAuth + REST      |
                                       |  - Google Calendar          |
                                       |  - Meta WhatsApp Business   |
                                       |  - VAPID push (FCM / Mozilla)|
                                       +-------------+--------------+
                                                     ^
                                                     | TB-3
                                                     |
+--------------------+        TB-1        +----------+----------+        TB-2        +-------------------------+
|  Student browser   | <----------------> |  Next.js portal      | <----------------> |  Supabase project        |
|  +-----------------+                    |  (apps/web)          |                    |   - Postgres (RLS)       |
|  | Power Mode      |                    |   - SSR pages        |                    |   - Auth (JWT, OAuth)    |
|  | Chrome extension|                    |   - API routes       |                    |   - Edge Functions       |
|  +-----------------+                    |   - sw-push.js       |                    |     (28 fns w/ observ.)  |
+--------------------+                    +----------+-----------+                    |   - Storage (signed URL) |
                                                     |                                +-----------+-------------+
                                                     | (read-only, public)                        ^
                                                     v                                            | TB-4
                                       +----------------------------+                             |
                                       | Public verifier portal      |                  +---------+----------+
                                       | (recruiter, college)        | <-----------+    | Issuer cron        |
                                       |  GET /verify/<slug>          |              \   | (signs VC docs,    |
                                       |  GET /functions/v1/          |               \  |  rotates kid in    |
                                       |    credential-vc-resolve/<did>| <-- TB-4 -->  +>|  vc_issuer_keys)  |
                                       +----------------------------+                  +--------------------+
```

**Components.** The Next.js portal at `apps/web/` is the user-facing layer; it terminates TLS at Vercel (or the chosen edge), proxies authenticated traffic into Supabase, and serves the public verify portal. The Power Mode Chrome extension talks to the same Supabase project over HTTPS using the user's anon-key + JWT. Supabase hosts Postgres (with RLS), Auth, Edge Functions (Deno), and Storage. Three Edge Functions (`whatsapp-send`, `nudge-dispatch`, calendar sync workers) call third-party APIs server-side. The W3C VC layer is split between two Edge Functions: `credential-vc-issue` (authenticated; service-role; writes `vc_document` + `vc_proof`) and `credential-vc-resolve/[did]` (public; no JWT; rate-limited).

## 3. Trust boundaries

| ID | Boundary | Crossing direction | Authentication mechanism | Notes |
|---|---|---|---|---|
| **TB-1** | User device ↔ Next.js portal | Bidirectional | TLS 1.2+, Supabase JWT in cookie or `Authorization` header | The extension presents the same JWT; CSRF protection via SameSite=Lax + state-changing endpoints requiring custom header |
| **TB-2** | Next.js portal / Edge Functions ↔ Supabase Postgres + Auth | Bidirectional | Supabase JWT (anon or authenticated) for user paths; service-role key for `credential-vc-issue`, observability ingest, cron functions | Service-role bypasses RLS and is the highest-value secret in the project |
| **TB-3** | Supabase Edge Functions ↔ third-party APIs (GitHub, Google, Meta, VAPID) | Outbound | OAuth bearer tokens per user (GitHub, Google); Meta system-user token; VAPID per-subscription keys | Tokens are stored encrypted at rest in `oauth_tokens`; never logged |
| **TB-4** | Issuer cron / `credential-vc-issue` ↔ public resolve endpoint | Indirect (via Postgres) | None at the resolve hop — the resolve endpoint is intentionally public; integrity guaranteed by the EdDSA proof on `vc_proof` | Once 034 lands, the resolve endpoint becomes the trust anchor for third-party recruiters; the EdDSA proof is the only thing standing between us and forged credentials |

## 4. Assets and their classifications

| # | Asset | Where it lives | Sensitivity | Notes |
|---|---|---|---|---|
| A-1 | User PII (email, display name, hashed password, phone, time zone) | `auth.users`, `public.user_profiles` | **High** | GDPR / DPDP personal data; subject to DSAR |
| A-2 | Skill Proof scores + per-skill breakdown | `public.skill_proof_scores`, `public.verifiable_credentials.snapshot_*` | **Medium** | Disclosure is reputational, not contractual |
| A-3 | Raw GitHub commit / PR metadata | `public.github_commits`, `public.github_prs` | **Medium** | Public on GitHub, but the *correlation* to an Antarix user is sensitive |
| A-4 | Calendar event metadata + derived flags | `public.calendar_events` | **High** | Reveals daily routine; minimal-fields collected per privacy notice §2 |
| A-5 | Verifiable Credentials (the document + proof) | `public.verifiable_credentials.vc_document`, `.vc_proof` | **Medium** (integrity), **Low** (confidentiality — public by design) | Integrity is paramount; confidentiality is intentionally low |
| A-6 | EdDSA issuer signing key | `public.vc_issuer_keys.private_key_encrypted` (KMS-wrapped) | **Critical** | Compromise lets an attacker mint arbitrary VCs as Antarix |
| A-7 | OAuth tokens (GitHub, Google) | `public.oauth_tokens` (encrypted at rest) | **High** | Compromise = read access to user's GitHub repos / calendar |
| A-8 | Service-role key | Supabase project secret; Vercel env var | **Critical** | Bypasses all RLS; full-DB read/write |
| A-9 | Rate-limit buckets | `public.rate_limit_buckets` | **Low** | Tampering with a bucket lifts a single user's limit |
| A-10 | Observability logs | stdout from Edge Functions → log shipper → backend | **Medium** | Logs carry `user_id` (per `ObsContext`) but no PII payload by design |
| A-11 | WhatsApp message contents | `public.whatsapp_messages` (12-month retention) | **High** | User-generated; may include unstructured PII |
| A-12 | Push subscription endpoints | `public.push_subscriptions` | **Medium** | Endpoint is per-browser; leak enables targeted spam |
| A-13 | `vc_revocations` registry | `public.vc_revocations` (public-SELECT RLS) | **Low** (confidentiality), **High** (integrity) | Unauthorized writes would silently re-validate revoked credentials |
| A-14 | Power Mode session telemetry | `public.power_mode_sessions` | **Medium** | Reveals study patterns; not session contents |
| A-15 | DID Document at `/.well-known/did.json` | static file in `apps/web/public/` | **High** (integrity) | A swapped public key here breaks the entire DID trust chain |

## 5. STRIDE threat enumeration

**Likelihood scale:** Low (theoretical, requires a chain of compromises), Medium (plausible by an unmotivated attacker), High (active classes of attack we see in the wild).
**Impact scale:** Low (single-user, recoverable), Medium (cohort of users, recoverable with effort), High (platform-wide or data-loss), Critical (platform integrity / trust anchor compromise).
**Residual risk** is what remains after the listed mitigations are deployed.

| # | Category | Threat | Asset | Attack vector | Impact | Likelihood | Mitigation | Residual risk |
|---|---|---|---|---|---|---|---|---|
| T-01 | **S**poofing | **JWT forgery** — attacker mints a Supabase JWT with another user's `sub` | A-1, A-2, A-7 | Discover and reuse the JWT-signing secret (anon key compromise is not enough; needs the JWT secret) | Critical | Low | Supabase rotates the JWT secret on demand; secret never leaves the Supabase control plane; all functions verify signature via `@supabase/supabase-js`; service-role key kept out of client bundles (see T-15) | Low — depends on Supabase platform integrity |
| T-02 | **S**poofing | **DID spoofing** — attacker publishes a competing `did:web:antarix.app` at a look-alike domain | A-15 | Typosquat domain (`antarlx.app`), DNS hijack, or BGP attack on `antarix.app` | High | Low | (a) CAA records pinning Let's Encrypt / chosen CA; (b) HSTS preload; (c) DNSSEC <!-- TODO: enable DNSSEC on antarix.app before launch -->; (d) document the canonical DID in the verify portal; (e) plan migration to `did:web` + DNSSEC TLSA pinning in v2 | Medium — DID:web is fundamentally domain-trust-rooted |
| T-03 | **S**poofing | **GitHub OAuth abuse** — attacker initiates OAuth flow on behalf of a victim and races the callback | A-7 | CSRF on `/auth/github/callback`; missing `state` validation; PKCE downgrade | High | Medium | Mandatory `state` validation tied to a server-set cookie (httpOnly, SameSite=Lax); PKCE on the public client; reject callbacks older than 10 minutes; refuse to swap a token whose `state` does not match | Low |
| T-04 | **T**ampering | **SQL injection in Edge Functions** — attacker injects into a `.rpc()` or `.from(...).eq(...)` call with concatenated user input | A-1, A-2, A-6, A-8 | Unsanitized input flowing into a string-built query in an Edge Function | Critical | Low | (a) All DB access uses parameterized `supabase-js` calls — never string concatenation; (b) SECURITY DEFINER functions pin `set search_path = public`; (c) Semgrep rule banning `sql\`...\${` in Edge Functions <!-- TODO: add the Semgrep rule to .semgrep.yml -->; (d) code review checklist item | Low |
| T-05 | **T**ampering | **VC proof tampering** — attacker modifies `vc_document` after issuance but leaves `vc_proof` stale | A-5 | Direct UPDATE via leaked service-role key, or RLS bypass (see T-14) | High | Low | (a) Verifier MUST re-verify the EdDSA signature over the canonical form of `vc_document` before accepting; (b) the public resolve endpoint returns both document and proof so verifiers can re-check; (c) audit trigger on `verifiable_credentials` <!-- TODO: add `vc_audit` append-only trigger in a future migration -->; (d) `vc_revocations` semantics let us deactivate a credential instantly | Low — depends on verifiers actually re-checking |
| T-06 | **T**ampering | **Calendar event injection** — Google returns crafted event metadata that overflows our `is_class` / `is_deadline` classifier and corrupts free-window math | A-4, A-2 | Compromised Google account; Google API anomaly | Medium | Low | (a) Classifier treats every field as untrusted string + bounded length; (b) we never write back to Google Calendar so blast radius is local; (c) per-user event count cap of 5 000 per sync; (d) malformed events logged and skipped, not aborted | Low |
| T-07 | **R**epudiation | **Log tampering** — attacker with write access to the observability backend deletes or modifies access logs to hide intrusion | A-10 | Compromise of observability backend credentials | High | Low | (a) Logs shipped append-only to backend; (b) backend is third-party with its own audit trail (Sentry / Datadog — pending choice in sub-processor list); (c) critical security events also written to Supabase `audit_events` table with INSERT-only RLS <!-- TODO: add `audit_events` table with INSERT-only RLS in a future migration -->; (d) daily SHA-256 digest of the previous day's audit table exported to cold storage | Medium — observability backend is a single point of trust until cold-storage digest lands |
| T-08 | **R**epudiation | **Audit trail gaps for issuance / revocation** — no record that credential X was issued at time T by operator O | A-5, A-13 | Edge Function does not write an audit row; insider revokes a credential without traceability | High | Medium | (a) `credential-vc-issue` already logs structured `info` event via `withObservability`; (b) `vc_revocations.reason` is mandatory in the UI; (c) `vc_audit` append-only table planned (see T-05); (d) require human-readable `reason` field on every revocation, surfaced in the public resolve response | Medium — operator actions are not yet provably non-repudiable until `vc_audit` lands |
| T-09 | **I**nformation disclosure | **IDOR on credential endpoints** — attacker enumerates `credential_id` UUIDs on `credential-vc-issue` and reads other users' VCs | A-2, A-5 | Iterate UUIDs (low entropy if v4 is poorly seeded) or scrape from leaked logs | High | Low | (a) `credential-vc-issue` returns 404 (not 403) when `ctx.userId !== row.user_id` to avoid existence leak; (b) UUID v4 is 122-bit entropy — enumeration is computationally infeasible; (c) rate-limit wrapper at 5/min per user on `credential-vc-issue`; (d) public resolve endpoint is the *intended* read path and only exposes what `vc_document` already contains | Low |
| T-10 | **I**nformation disclosure | **RLS bypass via service-role key leak** — service-role key embedded in client bundle, extension build, or public log | A-1, A-2, A-3, A-4, A-7, A-8, A-11, A-12, A-14 | Developer commits key to public repo; key leaked via Vercel build log; key in extension `manifest.json` | Critical | Medium | (a) gitleaks pre-commit hook + CI gate; (b) Vercel "Sensitive" flag on `SUPABASE_SERVICE_ROLE_KEY` env var; (c) explicit code-review rule: service-role key must only appear in Edge Functions, never in `apps/web` or `apps/extension`; (d) Supabase Logflare alert on service-role key fingerprint appearing in any HTTP body; (e) key rotation runbook with 30-min RPO <!-- TODO: write the service-role rotation runbook --> | Medium — human error in env var handling is the single highest residual risk |
| T-11 | **I**nformation disclosure | **Observability log leak of PII** — `ctx.log.info({email: user.email})` slips past code review | A-1, A-10 | Engineer adds a debug log statement that includes a PII field | Medium | High | (a) `_shared/observability.ts` accepts only a fixed schema (`requestId`, `userId`, `function_name`, etc.); free-form fields go through `ctx.log.info(msg, attrs)` where `attrs` is whitelisted; (b) Semgrep rule banning `email`, `phone`, `password`, `token` substrings as log keys <!-- TODO: add the Semgrep rule -->; (c) sub-processor DPA mandates 30-day log retention; (d) `user_id` is logged but is itself a UUID, not a direct identifier | Medium — the rule catches the obvious cases, not subtle PII in error message strings |
| T-12 | **D**enial of service | **Edge Function cost overrun** — attacker hammers `whatsapp-send` or `ai-coach`, racking up Meta / OpenAI costs | A-8 (indirectly — service-role-backed compute) | Loop a single endpoint at high concurrency from a botnet | High | High | (a) `_shared/rate-limit.ts` token-bucket wrapper applied per-function (see [`docs/rate-limiting.md`](../rate-limiting.md)); (b) `whatsapp-cost-guard` daily budget check; (c) per-user message quotas in `whatsapp_quotas`; (d) Supabase project-wide spend alert at 50% / 80% / 100% of monthly budget | Low — provided every function adopts `withRateLimit` |
| T-13 | **D**enial of service | **Credential-resolve enumeration** — attacker scans the UUID space against `credential-vc-resolve/<did>` to fingerprint who has credentials | A-5, A-2 | High-concurrency UUID enumeration | Medium | Medium | (a) rate-limit at 60/min per IP/user via `_shared/rate-limit.ts`; (b) responses are 60s edge-cached so repeated queries hit cache, not DB; (c) 404s are returned with the DID Resolution envelope so the response size is similar to a 200 — no oracle on existence beyond status code; (d) 122-bit UUID entropy makes enumeration economically infeasible | Low |
| T-14 | **E**levation of privilege | **RLS bypass via policy gap** — a table is created without `enable row level security` or with an overly-permissive policy | A-1 through A-14 | New migration ships a table missing the RLS pattern | Critical | Medium | (a) repo convention: every `create table` must be followed by `alter table ... enable row level security` and at least one policy or an explicit `-- service-role only` comment; (b) Semgrep rule on migrations to flag missing RLS <!-- TODO: add the Semgrep rule -->; (c) `supabase db lint` in CI; (d) per-migration review by a second engineer; (e) periodic RLS-coverage audit script <!-- TODO: write `scripts/rls-coverage-audit.ts` --> | Medium — coverage is enforced by convention, not by Postgres itself |
| T-15 | **E**levation of privilege | **Service-role key compromise** — attacker obtains the key (see T-10) and reads/writes any table | A-1 through A-14 | See T-10 vectors | Critical | Medium | All mitigations from T-10, plus: (a) service-role usage logged with `function_name` so post-compromise forensics can scope blast radius; (b) `vc_issuer_keys.private_key_encrypted` is wrapped by a *separate* KMS key not held by Supabase, so even a service-role compromise does not yield the EdDSA private key in plaintext; (c) Storage signed-URL expiry capped at 1 hour | Medium |
| T-16 | **E**levation of privilege | **OAuth scope creep** — Antarix requests `repo` scope on GitHub when `public_repo` suffices, or `calendar` when `calendar.readonly` suffices | A-7 | Engineering oversight in OAuth client config | High | Medium | (a) Documented minimal-scope policy in privacy notice §2; (b) GitHub scope is `read:user` + `public_repo` only; Google scope is `calendar.readonly` only; (c) annual review of OAuth scopes against actual code usage; (d) any scope addition requires a privacy notice update and a re-consent flow | Low |
| T-17 | **S**poofing | **WhatsApp webhook spoofing** — attacker posts a forged webhook to `/api/wa/webhook` to inject messages | A-11, A-2 | Hit the webhook URL with a crafted body | High | High | (a) Verify `X-Hub-Signature-256` HMAC using the Meta app secret on every request; (b) 5-minute replay window enforced via webhook `timestamp` field; (c) reject any webhook whose `entry[].id` is not in our registered phone-number-id whitelist; (d) rate-limit the endpoint at IP level | Low |
| T-18 | **T**ampering | **Push notification payload poisoning** — attacker abuses VAPID flow to send arbitrary content to a victim's browser | A-12 | Compromised VAPID private key, or push-endpoint forgery | Medium | Low | (a) VAPID private key stored in Supabase secrets, accessed only from `nudge-dispatch` Edge Function; (b) push payload is signed-and-encrypted per-subscription (Web Push protocol); (c) service worker `sw-push.js` validates payload shape before rendering — refuses to display payload with unknown `type` field | Low |
| T-19 | **I**nformation disclosure | **Public DID Document tampering at edge** — attacker MITM's `/.well-known/did.json` and swaps the public key | A-15 | TLS-stripping attack; CDN cache poisoning | Critical | Low | (a) HSTS preload (mandatory before launch); (b) `Content-Type: application/did+json` and `Cache-Control: public, max-age=300` so caches refresh; (c) DID Document additionally published via `credential-vc-resolve` so verifiers have a second source; (d) future: sign `did.json` with a longer-lived offline key (v2 work) | Medium — single-public-key DID Documents are the weakest part of `did:web` |
| T-20 | **R**epudiation | **Insider revokes a credential maliciously** — operator with service-role access deletes a row from `verifiable_credentials` | A-5, A-13 | Insider threat | High | Low | (a) `vc_revocations` is the only supported deactivation path — actual row deletes are forbidden by policy; (b) `vc_audit` append-only table (planned) will log all writes to `verifiable_credentials`; (c) production service-role access requires named MFA + session recording; (d) quarterly access review | Medium — until `vc_audit` lands, an insider with service-role can act un-traceably |

**Total threats enumerated:** 20 (covers all six STRIDE categories with ≥ 2 entries each and the specific examples called out in the engineering brief).

## 6. Threats by category (summary)

| STRIDE category | Threats | Highest impact | Highest likelihood |
|---|---|---|---|
| Spoofing | T-01, T-02, T-03, T-17 | T-01 (Critical) | T-17 (High) |
| Tampering | T-04, T-05, T-06, T-18 | T-04 (Critical) | T-04, T-06 (Low — well mitigated) |
| Repudiation | T-07, T-08, T-20 | T-07, T-20 (High) | T-08 (Medium) |
| Information disclosure | T-09, T-10, T-11, T-19 | T-10, T-19 (Critical) | T-11 (High) |
| Denial of service | T-12, T-13 | T-12 (High) | T-12 (High) |
| Elevation of privilege | T-14, T-15, T-16 | T-14, T-15 (Critical) | T-14, T-15, T-16 (Medium) |

## 7. Out-of-band mitigations (cross-cutting controls)

These controls apply to many threats above and are tracked here for visibility.

| Control | Coverage | Status |
|---|---|---|
| **Dependency scanning** — Dependabot for npm + GitHub Actions; weekly digest | T-04, T-15 | Enabled on the `Anatrix_my` repo; weekly review on Fridays |
| **SAST** — Semgrep with the OWASP top-10 ruleset + Antarix custom rules (RLS, log-PII, raw-SQL) | T-04, T-10, T-11, T-14 | Custom rules TBD <!-- TODO: write .semgrep.yml with the three Antarix rules called out above --> |
| **CodeQL** — GitHub-native SAST as a second opinion on JS/TS | T-04, T-10 | Enabled via GitHub default config <!-- TODO: confirm CodeQL is enabled in the repo Settings → Code security --> |
| **Secret scanning** — gitleaks pre-commit hook + GitHub secret scanning + push protection | T-10, T-15 | Pre-commit hook documented; push protection requires GitHub Advanced Security or self-hosted gitleaks-action <!-- TODO: enable on the repo --> |
| **Container / image scanning** | N/A — we ship to Vercel + Supabase Edge, no containers in v1 | Not applicable |
| **HSTS preload** | T-02, T-19 | TBD before launch <!-- TODO: submit antarix.app to https://hstspreload.org after CAA + DNSSEC are live --> |
| **CAA records** | T-02 | TBD <!-- TODO: publish CAA records pinning the chosen CA --> |
| **DNSSEC** | T-02, T-19 | TBD <!-- TODO: enable DNSSEC at registrar --> |
| **Rate-limit wrapper** | T-12, T-13, T-17 | Landed in [`docs/rate-limiting.md`](../rate-limiting.md) (migration 033) — adoption per-function still required |
| **Observability wrapper with structured logs** | T-07, T-11 | Landed in [`docs/observability.md`](../observability.md) — log-shipper choice still TBD |
| **VDP + safe harbor** | All — channel for external researchers | See [`docs/security/vdp.md`](./vdp.md) |
| **Privacy review on every new data collection** | A-1, A-3, A-4, A-7, A-11, A-14 | Process documented in privacy notice; reviewer is the Grievance Officer TBD |
| **Quarterly access review of service-role and Supabase admin** | T-15, T-20 | TBD <!-- TODO: schedule quarterly review; owners: founders + security lead --> |

## 8. What is NOT covered in v1

These work items are intentionally deferred and should be reflected in the security roadmap.

1. **Dynamic application security testing (DAST).** No scheduled OWASP ZAP / Burp scans against a staging environment. The first DAST pass should run before the first enterprise customer.
2. **Red-team exercises.** No assumed-breach or full-scope red-team engagement. A scoped engagement is recommended once the public DID resolver is being consumed by an external recruiter integration.
3. **Bug bounty program.** No paid bounties (see VDP §10). Move to a paid program (HackerOne, Intigriti, or self-hosted) once the platform crosses 10 000 MAU.
4. **Formal third-party penetration test.** No external pen-test commissioned yet. Should precede the first SOC 2 Type II audit.
5. **Formal threat model for the Power Mode extension.** This document covers the extension as a *client* of the platform; a separate document should enumerate threats specific to the extension's tab-focus sampling and local storage.
6. **EU Cyber Resilience Act conformance assessment.** CRA enters into force in stages through 2027; a conformity assessment is required before Antarix is sold or made available in the EU market beyond the personal-use safe harbor <!-- TODO: confirm CRA timeline and product-vs-service classification with counsel -->.
7. **SOC 2, ISO 27001, ISO 27701, or similar formal certifications.** All deferred to post-Series-A.
8. **`vc_audit` append-only table** for non-repudiable issuance / revocation history (referenced in T-05, T-08, T-20). Planned for a future migration.
9. **Hardware-backed signing key** for the EdDSA issuer key (HSM, AWS KMS Custom Key Store, or YubiHSM). Today the key is software-backed and KMS-wrapped; HSM-backing materially reduces T-15 residual risk.
10. **Bug-bounty disclosure platform integration.** All disclosure flows through `security@antarix.app` directly; no triage assistance from a third-party platform.

## 9. Change log

| Date | Author | Change |
|---|---|---|
| 2026-06-06 | Engineering (Agent C-2) | Initial v1 publication: 20-row STRIDE table, 4 trust boundaries, 15 assets, out-of-band controls, deferred-work register |

## 10. Review cadence

This document is reviewed **quarterly**. Each review must:

1. Re-rate likelihood for every threat against the previous quarter's incident data.
2. Move items from §8 ("not covered") into the live table as they are mitigated.
3. Add new threats for any new asset (table, Edge Function, third-party integration) introduced since the previous review.
4. Update the `Last reviewed` date and the `Next review` date at the top of this document.

Next review: **2026-09-06** <!-- TODO: schedule calendar event 2026-09-06 for next review -->.
