# Antarix Help Center — For Companies

> **What this page covers.** Help for company admins — the people who manage the company account, invite recruiters, set up integrations, and own billing. If you are a recruiter who just wants to search for candidates, see `docs/help/recruiters.md` instead. If you are a student, see `docs/help/students.md`. If you are a placement officer, see `docs/help/colleges.md`.

## 1. Setting up your company

A company admin is the first user from your organization to sign up. Once you complete signup:

1. **Claim your company profile.** Search for your company on `/company/signup`. If the profile is already claimed by someone else, request a transfer via `mailto:admin@antarix.app` (TBD). If it doesn't exist, you can create it.
2. **Invite your recruiters.** Go to `/admin/team` and paste a list of emails (one per line) or upload a CSV (columns: `email, role, seat_tier`). They'll get a magic link to join.
3. **Assign roles.** Three roles: `admin` (full access + billing), `recruiter` (can search + contact), `viewer` (read-only analytics). Each role maps to a seat tier — see `docs/gtm/pricing-tiers.md` for what each tier costs.
4. **Set your default filters.** Save your common search filters as a "Saved Search" so every recruiter on the team starts from the same baseline. (Go to `/search` → adjust filters → "Save as default for team".)

## 2. Pricing tiers and seat management

The pricing model is at `docs/gtm/pricing-tiers.md` — read that for the full breakdown. Quick reference:

- **Free recruiter seat:** 5 candidate views/month, no contact button
- **Starter:** $99/month (or ₹8,000/month, TBD), 100 views/month, contact + ATS export
- **Pro:** $499/month (or ₹40,000/month, TBD), unlimited views, API, webhooks, analytics
- **Enterprise:** contact sales — SLAs, SSO, dedicated success manager

To add a seat: `/admin/billing/seats` → "Add seat" → pick tier → enter the recruiter's email. The seat is prorated for the current month. To remove a seat: same page → "Remove" — it stays active until the end of the billing period. The company admin always pays the consolidated bill; recruiters never see pricing.

## 3. The recruiter search history and audit log

Every search by every recruiter on your team is logged:

- **Who searched.** Recruiter email + their role.
- **What they searched for.** The full filter set (skills, location, college, score band, etc.).
- **When.** Timestamp in your team's time zone.
- **What they did with the result.** "Viewed profile", "Clicked contact", "Exported to ATS", or "Skipped".

Go to `/admin/audit` to see it. The default view is the last 30 days; you can filter by recruiter, date range, or action. The audit log is append-only and tamper-evident (each entry references the SHA-256 of the previous entry's payload — a v2 feature; v1 is append-only with a daily checksum job).

**Why this matters:** GDPR, DPDP Act, and CCPA all require you to demonstrate a lawful basis for processing candidate data. The audit log is your proof. If a candidate files a complaint, the support team will ask for the relevant audit-log entries.

## 4. Webhook setup

To receive Antarix events in your ATS or internal system, set up a webhook:

1. Go to `/admin/webhooks` → "Register endpoint" → paste your URL (HTTPS only, must respond within 10 seconds).
2. Antarix generates a 32-byte secret. Copy it — you can only see it once.
3. We send a test event (`ping`) to your URL. Your endpoint must return 2xx within 10 seconds.
4. Subscribe to event types: `credential.issued`, `credential.revoked`, `placement.predicted`, `student.connected`, `cohort.report_ready`, `job_match.created`, `nudge.sent`, `nudge.failed`. (Subscribe to all by default; you can unsubscribe per-type.)
5. Implement the signature verification (Stripe-compatible `X-Antarix-Signature: t=<unix>,v1=<hex-hmac-sha256(secret, "${ts}.${body}")>`) — code samples in `docs/webhooks.md`.

If your endpoint returns 5xx or times out 10 times in a row, it's auto-disabled. Re-enable from the same page.

## 5. ATS integration

We have first-class integrations with three ATS systems:

- **Greenhouse** — install the Antarix app from the Greenhouse marketplace, paste your Antarix API key, map the custom fields.
- **Lever** — same; Lever's integration is at `https://antarix.app/integrations/lever`.
- **Workday** — for Workday, use the webhook setup (§4) and map the event types to Workday's REST API. A reference implementation is at `docs/integrations/workday-webhook-bridge.md` (TBD).

For all other ATS systems, the webhook is the path. We also support CSV export of any search result — go to `/search` → "Export" → "CSV" (up to 1,000 rows per export).

## 6. Hiring analytics

Go to `/admin/analytics` for:

- **Time-to-hire.** From first search result to offer accepted. Median + p90, by source (Antarix vs. LinkedIn vs. referral).
- **Source quality.** What % of your hires from Antarix are still in role after 90 / 180 / 365 days. Compared to industry benchmark for the same role.
- **Salary benchmarks.** Aggregate, not individual. p25 / p50 / p75 salary for the role + location + experience band, based on the placements your recruiters have made.

All analytics are computed nightly; data is updated by 02:00 UTC.

## 7. Compliance

You are a Data Processor for the candidate data we surface to you. Your obligations are in the DPA — see `docs/legal/dpa-template.md`. Three things to do today:

1. **Sign the DPA.** `/admin/legal` → "Sign DPA" → countersigned within 1 business day by our team.
2. **Check the sub-processor list.** `/legal/sub-processors` — we notify you 30 days before adding a new sub-processor. Subscribe to the change-log in `/admin/legal/notifications`.
3. **Candidate data-handling training.** Every recruiter on your team must complete the 15-minute module at `/admin/training/recruiter-gdpr` (TBD) before they can use the contact button.

If a candidate files a Data Subject Request (DSR), forward it to `privacy@antarix.app` within 48 hours — we have the tooling to fulfil it; you do not action it directly.

## 8. Troubleshooting

If something is broken on the admin side, check these first:

- **My seat count shows wrong.** Refresh `/admin/billing/seats` — seat changes can take up to 5 minutes to propagate. If still wrong, contact `billing@antarix.app` (TBD).
- **A recruiter can't see candidates I can see.** Their role + tier may be more restrictive than yours. Check `/admin/team` → click their row → "Effective permissions".
- **A webhook is not firing.** Go to `/admin/webhooks` → click the endpoint → "Recent deliveries" — you'll see the last 100 attempts, the response code, and the response body excerpt (first 500 chars).
- **I can't sign the DPA.** The DPA requires a legal-signatory authority. If you don't have it, forward the DPA link to your legal team — they sign via DocuSign.

Still stuck? Email `admin@antarix.app` (TBD) with a screenshot and the affected user/company ID. SLA: 1 business day for admin issues, 1 hour for billing emergencies.

## 9. Related pages

- For recruiters (searching, contacting): `docs/help/recruiters.md`
- For students (credentials, AI Coach): `docs/help/students.md`
- For colleges (cohort dashboards, alumni tracking): `docs/help/colleges.md`
- For the troubleshooting index: `docs/help/troubleshooting.md`
- For the platform glossary: `docs/help/glossary.md`
- For the pricing model: `docs/gtm/pricing-tiers.md`
- For the DPA template: `docs/legal/dpa-template.md`
- For the sub-processor list: `docs/legal/sub-processor-list.md`
- For the webhook reference: `docs/webhooks.md`
