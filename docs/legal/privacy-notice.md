# Antarix Privacy Notice

> **Disclaimer:** This is a template prepared for the Antarix 11/10 platform. It is not legal advice and has not been reviewed by qualified counsel. Engage a privacy lawyer licensed in each jurisdiction where you have users before relying on this document for production use.

**Effective date:** TBD
**Last updated:** 2026-06-06

This notice explains what personal data Antarix collects, why, who we share it with, and the rights you have over it. It applies to `antarix.app`, the Power Mode Chrome extension, the verify portal, and the college and company portals.

## 1. Who is the controller

The data controller is:

**Antarix** — `privacy@antarix.app` — Registered address: TBD <!-- TODO: confirm entity name, registered address, company number with founders before public launch -->

- **EU representative under Art 27 GDPR:** TBD <!-- TODO: appoint an EU representative before any EEA users are onboarded -->
- **Grievance Officer (DPDP Act 2023):** TBD <!-- TODO: publish name, email, and postal contact for the Grievance Officer -->

## 2. What personal data we collect

We collect the minimum data we need to power the product.

**Account data**
- Email address, display name, hashed password (email sign-up only; we never store plain text)

**Profile data**
- Stated goals, self-declared skill level, optional institution, time zone and approximate locale

**GitHub data** (only if you connect GitHub)
- User ID, username
- Public commit metadata: hash, repository, branch, author, timestamp, file change counts, additions, deletions
- Repository metadata: name, primary language, stars, forks, private/public flag, README/CI/releases presence
- Pull request metadata: id, status, merged-at, review state
- We store **no more than the first 200 characters of a commit message** and never read code diffs beyond aggregate counts
- We do not read issues, issue comments, or discussion posts
- We never log into GitHub on your behalf beyond the OAuth scopes you grant

**Google Calendar data** (only if you connect Google Calendar)
- Event metadata: id, start, end, title, attendee count, your RSVP status
- Derived flags we compute: `is_class`, `is_deadline`, `is_study_group`, `is_free_window`
- We do **not** read event descriptions, attachments, conference links, the email addresses of other attendees, or any free-text content
- We never create, modify, or delete events on your calendar

**Power Mode extension data** (only if you install the extension)
- Work sessions: start, end, category (DSA, Coding, Project, Learning, Research), self-rated focus quality (1–5), optional short note
- Aggregate window- and tab-focus samples; we do not capture the content of any tab
- Extension version and heartbeat timestamps

**Skill Proof outputs**
- 0–100 Skill Proof Score, per-skill proficiency, weighting profile (passive vs. Power Mode), contributing components
- Placement prediction: 0–100 probability, predicted company tier, time-to-ready, top-3 gap items
- "Last verified" timestamp on any exportable credential

**Communications**
- WhatsApp phone number and bot message contents
- Web push subscription endpoint and key
- Transactional emails we send you (account, security)

**Usage telemetry**
- Dashboard visits, feature clicks, device metadata
- Error and performance events (see the sub-processor list for the current observability provider)

## 3. Why we use it (purposes and lawful basis)

| Purpose | Lawful basis under GDPR Art 6 |
|---|---|
| Operating the platform: score, credential, college and company portals | Art 6(1)(b) contract, and Art 6(1)(f) legitimate interest |
| WhatsApp nudges and bot interactions | Art 6(1)(a) explicit consent (opt-in from the dashboard) |
| Web push notifications | Art 6(1)(a) explicit consent (browser permission prompt) |
| Issuing and verifying Skill Proof credentials | Art 6(1)(b) contract |
| Aggregated, anonymized analytics (with k-anonymity thresholds) | Art 6(1)(f) legitimate interest |
| Security, fraud prevention, abuse detection | Art 6(1)(f) legitimate interest |

Where we rely on legitimate interest, you can object at any time (see §7).

## 4. Who we share data with

We do not sell personal data. We share it only with vetted sub-processors acting on our written instructions: **Supabase** (hosting), **Meta / WhatsApp Business API** (nudges you opted into), **Google Calendar API** (event sync you authorized), **GitHub OAuth + API** (commit/PR sync you authorized), a **VAPID-compatible web push provider** (the default is your browser vendor's push service), an **email provider** TBD <!-- TODO: pick Postmark / Resend / SES and sign a DPA before launch -->, and an **observability provider** TBD <!-- TODO: Agent A-3's wrapper is provider-agnostic. Pick Sentry or Datadog and sign a DPA before launch -->. The full list with locations, data shared, and opt-out paths is in [sub-processor-list.md](sub-processor-list.md).

## 5. International data transfers

We store data in the region closest to you:
- **EEA, UK, Switzerland** → `eu-central-1`
- **India** → Mumbai region
- **Elsewhere** → `us-east-1` (we will add regions as user density justifies)

Cross-border transfers rely on:
- The **EU–US Data Privacy Framework** (and UK / Swiss extensions) for certified US recipients
- **Standard Contractual Clauses (SCCs)** as a fallback, with a Transfer Impact Assessment on file
- For transfers out of India, we transfer only to recipients not on the negative list issued under Section 16 of the DPDP Act 2023

## 6. How long we keep data

| Data | Retention |
|---|---|
| Account profile, connections, score, prediction | Until you delete your account, plus 90 days for audit and recovery |
| Raw GitHub commit / PR rows | 24 months, then aggregated into monthly buckets |
| Raw Calendar event rows | 12 months, then aggregated into weekly free-window statistics |
| Power Mode session rows | 18 months |
| WhatsApp bot message content | 12 months; aggregated command counts kept indefinitely |
| Audit logs (who accessed what, when) | 24 months |
| Anonymized, aggregated metrics | Indefinitely — they cannot be linked back to you |
| Backups | 35 days rolling, then overwritten |

## 7. Your rights and how to exercise them

You have the right to access, rectify, erase, port, restrict, object, withdraw consent, and lodge a complaint with your supervisory authority.

To exercise any of these, go to **Settings → Privacy** in the app, or email `privacy@antarix.app`. We respond within **30 days** (extendable by up to 60 days for complex requests, with notice).

## 8. Children

Antarix is for users **18 or older**. We do not knowingly collect data from anyone under 18. If we discover an under-18 user, we delete their account and all associated data within **7 days**. Parents or guardians: email `privacy@antarix.app` for immediate deletion.

## 9. Automated decision-making

The placement prediction on your dashboard is generated automatically. It is a **learning aid only** — we never use it for adverse decisions (loans, credit, insurance). You can:
- See exactly which inputs fed your prediction (click **"Why this?"** on the placement card)
- Opt out from **Settings → Privacy → Placement prediction**; the rest of the product, including the Skill Proof Score and credential, remain fully functional

## 10. Changes to this notice

Material changes are announced at least 14 days before they take effect, with a dashboard banner and an email. Non-material changes (typos, clarifications, a new sub-processor on the same terms) take effect immediately.

## 11. Contact

`privacy@antarix.app`
