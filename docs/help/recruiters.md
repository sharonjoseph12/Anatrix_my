# Help Center — Recruiters

This page is for the recruiter who searches the Antarix candidate database, verifies a student's credential, and reaches out. It assumes you have a paid company account and you are trying to hire, not to browse. If something is broken, jump to [Troubleshooting](troubleshooting.md). If a word is unfamiliar, see the [Glossary](glossary.md). The legal ground rules for handling candidate data are in [Privacy Notice](../legal/privacy-notice.md) and [DPDP Act Notice](../legal/dpdp-act-notice.md) — read them before your first bulk export.

## Signing up and your first search

A recruiter account lives inside a company account. If your company is already on Antarix, ask your company admin to invite you. If not, your admin can sign up at `https://antarix.app/company/signup`. <!-- TODO: confirm this URL exists after the marketing site ships -->

1. Open the invite email from your company admin. Click **Accept invite**. You are routed to `https://antarix.app/recruiter` to set a password.
2. Turn on two-factor authentication. Go to **Settings → Security** and follow the TOTP setup. This is required for any account that issues invites.
3. Click **New search**. Pick a single skill filter first (for example, "TypeScript") so you can see how the result set behaves.
4. Add a minimum score band — start at 60 — and a location filter if relevant. Click **Search**.
5. Read the result list. Each row shows the candidate's current Skill Proof Score, Power-Mode status, a fit/match score, and a one-line activity summary. The three result states are explained in the next section.

## Filters explained

The search panel has six filters. They compose with AND, not OR. Leave a filter blank to omit it.

- **Skill.** A single primary language or skill (for example, "PostgreSQL", "React", "Distributed systems"). Multi-skill filtering is on the roadmap. <!-- TODO: confirm multi-skill ships in v1 -->
- **Location.** City, state, or country. The filter matches the candidate's self-declared city, not their IP-derived location.
- **College.** Drop-down of all opted-in institutions on the platform. Picking a college limits the result set to that college's opted-in students.
- **Score band.** Minimum and maximum Skill Proof Score. The default is 0–100. Most recruiters use a minimum of 50–70 to filter noise.
- **Salary band.** The candidate's expected CTC range in lakhs per annum (LPA) for India, or in USD for international. The candidate's band is self-declared.
- **Search-visible only.** On by default. This filter excludes students who have opted out of company search. **Never turn it off.** The system enforces it at the database layer for privacy; see [Privacy Notice §7](../legal/privacy-notice.md).

## The three search result states

Each row in the result list is marked with one of three indicators. Read them carefully before you reach out.

- **Green check — "fully verified credential."** The candidate has connected at least one data source, has a Skill Proof Score, and has generated a verifiable credential. The score is the current live score, with a "last verified" timestamp. Treat this as the highest-trust signal.
- **Yellow dot — "unverified profile."** The candidate has an Antarix account and a self-declared profile, but has not yet generated a credential. The score (if shown) is computed from whatever data is connected. Reach out with caution.
- **Gray dot — "claimed profile."** The candidate has claimed a username and an institution, but the account is dormant or has zero connected data sources. There is no score. Do not treat the profile as a candidate yet.

## Verifying a credential

A candidate gives you one of two things: a public URL or a DID. Both resolve to the same thing.

1. Paste the URL or DID into the verify box at `https://antarix.app/verify`. <!-- TODO: confirm this URL exists after the marketing site ships --> If you have the URL, you can also just open it in your browser.
2. The verification page renders the candidate's name, institution, current Skill Proof Score, per-skill proficiency, verified activity totals, cohort percentile, and a "last verified" timestamp. No login is required.
3. If the page is green and the score is the one you expected, the credential is valid. Click **Copy signed JSON** if you want to archive the cryptographic envelope for compliance.
4. If the page shows a red **Revoked** banner, the credential is no longer valid. The candidate may have deleted their account, or the issuer (Antarix) may have revoked it. Do not act on the data. The full revocation flow is documented in [docs/api-verification.md §7.1](../api-verification.md).
5. If the page returns a 404, the slug or DID was mistyped. Re-paste carefully, or ask the candidate to re-share.

## The contact button

The contact button on a candidate row opens a small dialog with three actions.

**You can:**

1. Send a one-click invite to a specific role. The candidate receives a message in their Antarix inbox and (if WhatsApp is connected) a WhatsApp notification.
2. View the candidate's current credential.
3. Save the candidate to a named pipeline for follow-up.

**You cannot:**

1. See the candidate's email address or phone number without their explicit consent. Antarix brokers the first message.
2. See private repositories. Only public repo activity contributes to the score.
3. Bulk-message candidates. Every invite is a one-to-one action, and your seat usage is decremented per the plan. This is by design, and it is required by [DPDP Act §2](../legal/dpdp-act-notice.md) for any candidate you contact from India.

## Privacy law reminders

Recruiters handle personal data, and the law treats that as a serious responsibility. The full text is in [Privacy Notice](../legal/privacy-notice.md), [DPDP Act Notice](../legal/dpdp-act-notice.md), and the [DPA template](../legal/dpa-template.md). The short version:

- **GDPR (EEA / UK).** You can ask Antarix for the data we hold on a candidate you contacted. You must tell the candidate, in your first message, who you are and why you are reaching out. You must delete candidate data within 30 days of a candidate's request.
- **DPDP Act (India).** You are a Data Fiduciary for any candidate data you download or copy out of Antarix. You must have a lawful purpose (placement is one), and you must erase on request. Cross-border transfers to a country on the negative list under Section 16 are not allowed.
- **CCPA (California).** Candidates can ask you to disclose, delete, or opt out of the "sale" of their data. We do not sell candidate data. Treat any data you export as if it were subject to a deletion request at any time.

For a printable list of sub-processors (Supabase, Meta, Google, GitHub, the email provider, the observability provider) see [sub-processor-list.md](../legal/sub-processor-list.md).

## Pricing and credits

Your company plan gives you a monthly allocation of search credits and one-click invites. The current plan and balance are visible at the top of the recruiter dashboard.

- **Monthly credit allocation.** Plans are billed monthly. The default starter plan includes 200 search credits and 50 one-click invites per seat. <!-- TODO: confirm with the GTM playbook when it lands -->
- **What costs what.** A search credit is consumed per result page (25 candidates). A one-click invite is consumed per send, regardless of the candidate's response. A credential verify (paste the URL or DID) is free.
- **Overage policy.** Searches above the monthly allocation return a soft 429 with a `Retry-After` of 30 days, i.e. they reset at the next billing cycle. To raise the cap, contact your company admin to upgrade the plan. Recruiter and company pricing tiers are documented in the GTM playbook. <!-- TODO: link to GTM playbook pricing-tiers.md when it lands -->

## Bulk actions

Recruiters who need to move data into an ATS or a spreadsheet have three options.

- **CSV export.** On the result list, click **Export CSV**. The file contains the candidate's name, current score, fit/match score, college, batch, location, and the public credential URL. It does **not** contain emails or phone numbers.
- **ATS integration (webhook).** Wire your ATS to a webhook endpoint to receive invite, response, and outcome events. Setup is documented in [docs/webhooks.md](../webhooks.md). Greenhouse, Lever, and Workday have first-class connectors; see [Companies → ATS integration](companies.md#ats-integration).
- **Saved searches.** Save a search by clicking **Save this search**. Saved searches are private to your seat and can be re-run with one click. There is no scheduled export of saved searches in v1.

## Troubleshooting

Something broken? See [Troubleshooting](troubleshooting.md). The most common recruiter issues — 429 from search, contact button greyed out, "credential revoked" on a link the candidate just sent — are covered there.
