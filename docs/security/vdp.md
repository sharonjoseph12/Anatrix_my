# Antarix Vulnerability Disclosure Policy (VDP)

> **Disclaimer:** This is a v1 policy prepared by the engineering team for the Antarix 11/10 platform. It is not legal advice. Counsel licensed in each jurisdiction where Antarix operates should review this document — in particular the safe-harbor language in §1.5 and §8 — before it is held out to researchers as a binding commitment.

**Effective date:** 2026-06-06
**Last reviewed:** 2026-06-06
**Next review:** 2026-09-06 <!-- TODO: schedule calendar event 2026-09-06 for the quarterly VDP + threat-model review -->
**Document owner:** `security@antarix.app`
**Companion documents:**
- [`docs/security/threat-model.md`](./threat-model.md) — STRIDE-style threat model
- [`/.well-known/security.txt`](../../apps/web/public/.well-known/security.txt) — RFC 9116 machine-readable contact
- [`/.well-known/did.json`](../../apps/web/public/.well-known/did.json) — DID Document for `did:web:antarix.app`

---

## 1. Summary — what this policy is and is not

Antarix welcomes coordinated, good-faith security research. This document is our public commitment to researchers about how we will receive, triage, fix, and recognize vulnerability reports.

This policy:

1. Tells you which assets you may test (§2) and which you must not (§3).
2. Tells you what to report and what we consider a vulnerability (§4).
3. Tells you how to contact us (§5) and how to encrypt your report (§6).
4. Tells you what we will do after we receive your report (§7).
5. Gives you a safe-harbor commitment when you follow the rules (§8).
6. Explains severity, SLAs, and recognition (§9 and §10).

This policy is **not**:

- A bug-bounty program. Antarix does not pay monetary rewards in v1 (see §10).
- A penetration-testing authorization for engagements broader than the scope in §2.
- A waiver of any third party's rights, including the rights of our sub-processors listed in [`docs/legal/sub-processor-list.md`](../legal/sub-processor-list.md).

## 2. In-scope assets

You may test these assets under the terms of this policy:

| Asset | Identifier | Notes |
|---|---|---|
| Antarix marketing and product site | `https://antarix.app`, `https://www.antarix.app` | All public pages |
| All Antarix subdomains | `*.antarix.app` | College portal, company portal, verify portal, status, docs |
| Verify portal | `https://verify.antarix.app` | Public DID + VC resolution UI |
| Public DID resolver | `https://antarix.app/functions/v1/credential-vc-resolve/<did>` | Unauthenticated endpoint; rate-limited |
| Power Mode Chrome extension | Chrome Web Store listing for `Antarix Power Mode` | Static analysis and runtime testing of your own session |
| Supabase Edge Functions | `https://*.functions.supabase.co/...` for the Antarix project | All functions under `supabase/functions/` in our public repo |
| Supabase project (logical layer) | Antarix-controlled Postgres + Auth | RLS misconfiguration, policy bypass, signed-URL leakage are in scope |
| VAPID web push endpoint | `https://antarix.app/api/push/subscribe` | Subscription, key handling, and message-handler logic |
| `/.well-known/security.txt` and `/.well-known/did.json` | Static files | Content correctness, signature freshness |
| GitHub OAuth callback handler | `https://antarix.app/auth/callback` | State / PKCE / scope handling |
| WhatsApp webhook handler | `https://antarix.app/api/wa/webhook` | Signature verification, replay defense |
| Calendar OAuth callback handler | `https://antarix.app/auth/google/callback` | State / scope / token storage |

## 3. Out-of-scope assets and activities

The following are **explicitly out of scope**. Reports against these will be politely declined and the safe harbor in §8 does not apply.

**Third-party services we use but do not operate**

- Supabase platform itself (`supabase.com`, `*.supabase.co`, `*.supabase.io`) — report to `security@supabase.com`
- Meta / WhatsApp Business API — report to Meta's bug bounty program
- Google Calendar API and Google Cloud — report to Google VRP
- GitHub OAuth and GitHub API — report to GitHub Security
- VAPID web push providers (Mozilla autopush, FCM, Apple Push) — report to the respective vendor
- Chrome Web Store hosting — report to Google Chrome VRP
- Any sub-processor listed in [`docs/legal/sub-processor-list.md`](../legal/sub-processor-list.md)

**Attack classes that are out of scope**

- Social engineering, phishing, or smishing of Antarix staff, contractors, customers, or end users
- Physical attacks against Antarix property, staff, or data-center hardware
- Volumetric DDoS (network-layer floods, amplification, or sustained high-rate L7 floods); application-layer abuse mitigated by our rate-limit wrapper *is* in scope
- Compromise of accounts other than your own (you must test on accounts you control or with explicit written permission from the account owner)
- Any test that materially degrades service for other users
- Any test that exfiltrates, modifies, or destroys data that does not belong to you
- Lateral movement into our sub-processors' infrastructure after a finding on ours

**Reports we do not consider vulnerabilities (without an exploit chain)**

- Missing best-practice HTTP headers (HSTS preload absence, X-Frame-Options on JSON endpoints, CSP `report-only`) — submit a hardening suggestion instead
- Lack of rate limiting on endpoints that do not perform privileged or expensive work
- Self-XSS that requires the victim to paste an attacker-supplied payload
- Reports generated solely by automated scanners with no demonstrated impact
- TLS / SSL configuration findings already at A or A+ on SSL Labs
- CSV injection in user-generated download endpoints (we explicitly accept this risk for v1; tracked in the threat model §5)
- Login or signup brute force without a working bypass of our rate-limit wrapper (see [`docs/rate-limiting.md`](../rate-limiting.md))
- Public information exposure (email addresses, employee names) from sources outside our control

## 4. What to report

Report any vulnerability that affects the **confidentiality, integrity, or availability** of user data, credentials, or the Antarix platform.

Examples we are particularly interested in:

- Authentication or session bypass (JWT forgery, password-reset weaknesses, OAuth state/PKCE flaws)
- Authorization bypass (IDOR on `verifiable_credentials`, RLS policy bypass, signed-URL re-use across users)
- Server-side injection (SQL, NoSQL, command, header, template) — especially against Edge Functions
- Forgery of W3C Verifiable Credentials or DID Documents
- Compromise of the EdDSA issuer signing key in `vc_issuer_keys` or any code path that exposes a private key
- Server-side request forgery (SSRF) via OAuth callback, GitHub repo metadata fetch, or calendar sync
- Cross-site scripting (stored, reflected, DOM) on any `*.antarix.app` page
- Sensitive data exposure: PII leak in logs, error messages, or `/.well-known/*` responses
- Misconfigured Row-Level Security (RLS) policies that expose another user's data
- Service-role key leakage in client bundles, public CDN paths, or extension build artifacts
- WhatsApp webhook signature bypass or replay
- Push notification poisoning (delivering attacker-crafted payloads to other users)
- Cost-based denial of service: a single request that disproportionately consumes Edge Function compute, OpenAI tokens, or WhatsApp message quota
- Supply-chain compromise (typosquatted dependency, postinstall script, malicious GitHub Action)

## 5. How to report

Use the channel that works best for you. **Encrypted email is preferred** for any report that includes proof-of-concept payloads, screenshots of other users' data, or sensitive technical detail.

| Channel | Address | When to use |
|---|---|---|
| Encrypted email | `security@antarix.app` (PGP key §6) | First choice for all reports |
| Web form | `https://antarix.app/.well-known/security-contact-form` (TBD) <!-- TODO: build and host a Tines / Cal.com / Typeform intake at this URL; until it exists, the email channel is the only working route --> | If you cannot use PGP and prefer a structured form |
| Signal | TBD <!-- TODO: provision an Antarix-owned Signal number; do not use a personal staff number. Until it exists, this row is informational only --> | Synchronous escalation for actively-exploited or wormable issues |

Please include in your report:

1. A short title and a one-paragraph summary of impact.
2. Affected asset(s) and URL(s).
3. Steps to reproduce — minimal, deterministic, copy-pasteable where possible.
4. Proof-of-concept (request/response, screenshots, video). Redact other users' data.
5. Your suggested severity (CVSS v3.1 vector) — optional but appreciated.
6. Your preferred name / handle for recognition (or "anonymous").

**Please do not** open a public GitHub issue, post on social media, or share details with third parties until we have published the fix or 90 days have elapsed (whichever is sooner). See §7 for our coordinated-disclosure timeline.

## 6. Our PGP key

| Field | Value |
|---|---|
| User ID | `Antarix Security <security@antarix.app>` |
| Key type | Ed25519 + Cv25519 (modern, RFC 9580) |
| Fingerprint | `TBD TBD TBD TBD TBD  TBD TBD TBD TBD TBD` <!-- TODO: generate and publish the security@antarix.app PGP key; fingerprint is 40-char hex grouped 5+5, e.g. "ABCD EFGH IJKL MNOP QRST  UVWX YZAB CDEF GHIJ KLMN" --> |
| Public key URL | `https://antarix.app/.well-known/openpgpkey/hu/<wkd-hash>` (TBD per RFC 9580 §7) |
| Key server | `keys.openpgp.org` (after upload) |

Until the production key is generated and published, please send reports in plaintext to `security@antarix.app` and do not include payloads that themselves leak third-party data.

## 7. What we promise (our SLAs)

When you submit a report in good faith and follow this policy, Antarix commits to:

| Stage | Commitment |
|---|---|
| **Acknowledgement** | We will acknowledge receipt within **3 business days** (Mon–Fri, Asia/Kolkata) |
| **Triage** | We will complete an initial triage — severity, in-scope confirmation, reproducibility — within **7 business days** of acknowledgement |
| **Status updates** | We will send a status update **at least every 14 calendar days** until the issue is resolved or closed |
| **Resolution target** | Per the severity SLAs in §9 |
| **Coordinated disclosure** | We ask for **90 days from confirmation** before public disclosure. This window is negotiable in both directions — we will request extensions for complex fixes and will support faster disclosure when the fix is already live |
| **Credit** | If you wish, we will credit you in our Security Hall of Fame (§10) once the fix is live |
| **Post-fix communication** | We will confirm in writing when the fix is deployed and ask you to verify |

If we miss any of these commitments, please escalate to `security-escalation@antarix.app` (TBD) or, until that mailbox exists, reply to your original thread and we will route internally.

## 8. Safe harbor for good-faith research

If you make a good-faith effort to comply with this policy, Antarix will:

1. Consider your activity authorized under the U.S. Computer Fraud and Abuse Act (CFAA) and analogous state laws.
2. Consider your activity authorized under the U.S. Digital Millennium Copyright Act (DMCA) §1201, including the security-research exemption renewed by the Librarian of Congress.
3. Treat your activity as authorized under the EU Cyber Resilience Act's forthcoming coordinated-vulnerability-disclosure safe-harbor provisions, once they enter into force <!-- TODO: confirm exact CRA effective date and update this clause to cite the article number once in force -->.
4. Not bring or support a civil claim against you under our Terms of Service for activity that complies with this policy.
5. Work with you in good faith if a third party (a sub-processor, a customer, a regulator) initiates an action that we have the standing to influence.
6. Treat any inadvertent, minimized, and promptly-disclosed access to another user's data as authorized under §8(1)–(4), provided you delete it on request and do not retain copies.

**Limits of safe harbor.** The safe harbor does not apply if you:

- Test out-of-scope assets (§3) after we have asked you to stop.
- Exfiltrate, modify, or destroy data beyond the minimum needed to demonstrate the issue.
- Use a finding to access other users' accounts without their written permission.
- Disclose the vulnerability publicly before the agreed coordinated-disclosure date.
- Demand payment as a condition of disclosure.
- Violate any applicable law that we have no authority to indemnify (export control, sanctions, criminal law in your jurisdiction).

Antarix cannot grant safe harbor on behalf of third parties (Supabase, Meta, Google, GitHub, our sub-processors). If your research touches their infrastructure, you must comply with their VDPs in parallel.

## 9. Severity and SLAs

We use **CVSS v3.1** as the baseline. The severity tier and resolution SLA are:

| Tier | CVSS v3.1 base score | Resolution SLA (from confirmation) | Examples |
|---|---|---|---|
| **Critical** | 9.0 – 10.0 | **24 hours** to mitigate; full fix within 7 days | RCE on Edge Function; service-role key compromise; signing-key leak; account takeover at scale |
| **High** | 7.0 – 8.9 | **7 days** to fix | Vertical IDOR exposing PII; auth bypass; stored XSS in authenticated portal; SSRF reaching internal metadata service |
| **Medium** | 4.0 – 6.9 | **30 days** to fix | Reflected XSS in authenticated context; CSRF on non-state-changing endpoint; rate-limit bypass on a non-privileged endpoint |
| **Low** | 0.1 – 3.9 | **90 days** to fix or formally accept residual risk | Verbose error messages with low information value; missing defense-in-depth headers; misconfigured but non-exploitable HSTS preload |

We may adjust the tier up or down based on:

- Exploit complexity in our specific environment (e.g., a vector blocked by our rate-limit wrapper)
- Real user impact (number of affected users × sensitivity of data)
- Existence of compensating controls (RLS, signed URLs, audit logs)

If we change the severity, we will explain the reasoning in the report thread.

## 10. Bounties and recognition

**Bounties.** Antarix does not run a paid bug-bounty program in v1. We may, at our discretion, issue a "researcher thanks" reward for exceptional reports — swag, conference passes, or one-off honoraria — but this is **not** a guaranteed payment and should not be relied upon. If and when a formal bounty program launches, it will be announced on the Security Hall of Fame page.

**Recognition.** With your permission, we will list your name and your report's high-level title (no exploit details) on:

- **Security Hall of Fame** at `https://antarix.app/docs/security/hall-of-fame` (TBD) <!-- TODO: build the public Hall of Fame page; currently this URL 404s. Until it exists, recognition is via email confirmation only -->
- The release notes of the fix
- The Antarix changelog at `https://antarix.app/changelog`

You may also request anonymity (we will list "Anonymous Researcher" with the report month) or full omission.

## 11. Reporting on behalf of others

If you are reporting on behalf of an organization, please tell us:

- The organization's name (so we can route to their security contact)
- Whether the organization has authorized you to act on its behalf
- Whether the report contains personal data of the organization's employees or customers

We treat third-party-supplied PII as a sub-processor would: minimize, encrypt in transit, and delete on request.

## 12. Changes to this policy

We will update this policy as the platform changes. Material changes will be:

- Announced in the Antarix changelog and the `security@antarix.app` mailing list
- Reflected in the `Last reviewed` date at the top of this document
- Versioned in the Git history of `docs/security/vdp.md`

Researchers who have an open report at the time of a policy change will be notified directly and the version of the policy in force on their report date will continue to apply to that report.

## 13. Contact and escalation tree

| If | Contact |
|---|---|
| Standard vulnerability report | `security@antarix.app` (PGP-encrypted preferred) |
| Active exploitation in progress | Signal (TBD) → `security@antarix.app` with subject `[ACTIVE EXPLOIT]` |
| We have not responded within the SLA | `security-escalation@antarix.app` (TBD) <!-- TODO: provision the escalation alias and document who reads it; until then, reply on the original thread --> |
| Press / coordinated-disclosure planning | `press@antarix.app` |
| Legal / safe-harbor questions | `legal@antarix.app` |
| Privacy / DPDP Act Grievance Officer | See [`docs/legal/privacy-notice.md`](../legal/privacy-notice.md) §1 |

---

*Thank you for helping keep Antarix and our users safe. We genuinely appreciate the time and skill it takes to find and report vulnerabilities responsibly.*
