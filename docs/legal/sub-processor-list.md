# Antarix Sub-Processor List

> **Disclaimer:** This is a template prepared for the Antarix 11/10 platform. It is not legal advice and has not been reviewed by qualified counsel. Engage a privacy lawyer before relying on this list for production use.

**Effective date:** TBD
**Last updated:** 2026-06-06

Sub-processors that process personal data on Antarix's behalf, each on a written Data Processing Agreement (DPA) under GDPR Art 28 (or equivalent). We notify you at least 30 days before adding a new one.

| # | Sub-processor | Purpose | Data shared | Region | Opt-out path | DPA |
|---|---|---|---|---|---|---|
| 1 | **Supabase, Inc.** | Database, auth, Edge Functions | Account, score, prediction, credential, raw rows | `eu-central-1`, Mumbai, `us-east-1` (chosen at sign-up) | Account deletion | TBD <!-- TODO: attach Supabase's standard DPA before launch --> |
| 2 | **Meta Platforms (WhatsApp Business API)** | WhatsApp nudges and bot | Phone, opt-in, message content, delivery status | Global | **Settings → Notifications → WhatsApp** (one-click) | TBD <!-- TODO: for EEA users, attach Meta's EU WhatsApp DPA addendum --> |
| 3 | **Google LLC (Calendar API)** | Calendar event metadata | OAuth token, event id, start, end, title, attendee count, RSVP | Global | **Settings → Sources → Disconnect Calendar** | TBD <!-- TODO: attach Google Cloud or Workspace DPA before launch --> |
| 4 | **GitHub, Inc. (OAuth + API)** | Commit and PR metadata | OAuth token, user ID, commit/PR/repo metadata | Global | **Settings → Sources → Disconnect GitHub** | TBD <!-- TODO: GitHub's standard DPA covers paid Enterprise only; confirm coverage for free-tier OAuth with counsel --> |
| 5 | **VAPID web push** (FCM, Mozilla Autopush, APNs — browser-vendor default) | Web push delivery | Push endpoint and key | Provider's region (global) | **Settings → Notifications → Browser push** | n/a (browser-vendor transport) |
| 6 | **Email provider (transactional)** — TBD <!-- TODO: pick Postmark, Resend, or SES; sign DPA before launch --> | Transactional email | Email, content | TBD | Security: cannot disable; weekly: **Settings → Notifications** | TBD |
| 7 | **Observability (Sentry or Datadog)** — TBD <!-- TODO: Agent A-3's `_shared/observability.ts` is provider-agnostic. Pick and sign a DPA before launch. --> | Error tracking, performance | Function, request id, status, latency, error, user id (if JWT) | TBD (suggest EU region for EU data) | Account deletion purges the user id; PII in errors is redacted | TBD |

## Notice and verification

We email you 30+ days before adding a new sub-processor (object under GDPR Art 21). Each signs a DPA requiring processing only on our instructions, confidentiality, security at least equivalent to [docs/architecture.md](../architecture.md), breach notification aligned with [Privacy Notice](privacy-notice.md) §7, return or deletion of data at end of engagement, and audit cooperation.

Contact: `privacy@antarix.app`
