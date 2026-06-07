# Antarix Launch Checklist

> **What this playbook covers.** The T-30, T-7, T-1, T-0, and T+72h checklist for the public launch. Every item has a role-based owner and a specific done-criterion. This is the operational runbook, not an aspirational plan. The CEO, CTO, Head of Sales, and on-call lead are the four humans in the T-1 go/no-go meeting. Every T-30 item must be checked before any T-7 work begins. Missing a T-7 item is a launch-delay trigger; the launch is explicitly postponed, not slipped silently.

## 1. T-30 (One Month Out)

All 8 items must be checked by the end of T-30. The CTO owns the technical items; the Head of Sales owns the marketing-site and case-study items; legal owns the legal docs. Each item has a single human owner; the owner reports done in the internal `#launch-day` Slack channel with a link to the artifact.

| # | Item | Owner | Done-criterion |
|---|---|---|---|
| 1 | Pricing page live at `/pricing` | Head of Sales | Page renders the 4 recruiter tiers + 3 college tiers + the company bundle; prices match `docs/gtm/pricing-tiers.md` v1; "Contact sales" CTAs route to the sales inbox |
| 2 | Legal docs published at `/legal/privacy`, `/legal/dpa`, `/legal/sub-processors` | Legal (with CTO sign-off on sub-processor list) | All 3 URLs return 200; content matches the source docs in `docs/legal/`; DPA template is the latest signed version; sub-processor list has 6 entries (Supabase, Meta, GCAL, GitHub, Web Push, Email) with region + purpose + opt-out |
| 3 | Security page live at `/security/vdp` | CTO | VDP matches `docs/security/vdp.md`; `/.well-known/security.txt` is RFC 9116-compliant; CVSS 4-tier SLA table renders; `security@antarix.app` is monitored |
| 4 | Status page live at `/status` | CTO | Self-contained HTML at `apps/web/public/status.html`; 7 subsystems shown; 30s refresh; `Cache-Control: public, max-age=30` on the data endpoint; `status@antarix.app` inbox is monitored |
| 5 | API docs live at `/api-docs` | CTO | Swagger UI 5.x rendered with the 2 public endpoints; "Try it out" works in a real browser; the OpenAPI yaml is byte-identical to `specs/003-engage-and-showcase/openapi.yaml` |
| 6 | 3 help-center articles published | Head of Sales | 3 articles under `docs/help/` (at minimum: one student-facing, one recruiter-facing, one college-facing) are published to the in-product help widget; each has a 1-paragraph summary, a 3-step how-to, and a link to the troubleshooting page |
| 7 | 5 case studies in draft (or 2 case studies + 3 testimonials) | Head of Sales | 5 markdown files exist with the standard case-study format (problem, what Antarix did, measurable outcome); placement-officer and student quotes are placeholder until the pilot clears; format matches `college-partnership.md` §5 |
| 8 | On-call rotation staffed for launch week | CTO | A 7-day rotation is published in PagerDuty / OpsGenie; primary + secondary on-call for each of 5 time zones (IST, EU, ET, PT, AU); the launch-week rotation overlaps the 72h post-launch window |

**Why T-30:** legal review, security review, and finance sign-off on prices are the long-pole items, and they all have external dependencies (counsel, security questionnaire, finance) that slip. A T-30 item at risk of missing must be escalated to the CEO by T-21, not T-7.

## 2. T-7 (One Week Out)

All 5 items must be checked by the end of T-7. The CTO owns 4 of 5; the marketing-site placeholders are owned by the Head of Sales. The T-7 gate is the last full-team review before launch; missing a T-7 item is a launch-delay trigger (postpone by 7 days, do not slip silently).

| # | Item | Owner | Done-criterion |
|---|---|---|---|
| 1 | Final security review passed | CTO | A named external pen-tester (or the internal security lead) has signed off on the production environment; no Critical or High findings open; all Medium findings have a remediation date ≤ 30 days post-launch |
| 2 | Load test passed (10x expected launch traffic) | CTO | k6 / Gatling / Locust script runs against the staging environment at 10x the expected concurrent-user peak; p99 latency on the top 10 user flows stays under the SLA; no 5xx errors; the cost forecast at 10x is within the launch budget |
| 3 | Backup & restore drill completed | CTO | The production database is backed up; the backup is restored to a fresh environment; the restored environment passes the smoke test (T-1 item 1); the restore time is documented and within the 4-hour RTO |
| 4 | All "TBD" placeholders in the marketing site filled in | Head of Sales | Every `<!-- TODO: validate with finance -->` and `<!-- TODO: confirm with team -->` marker on the public site is replaced with a real value or removed; the as-launched version of `/pricing` is byte-identical to the version in `docs/gtm/pricing-tiers.md` |
| 5 | Press kit ready | Head of Sales | A single zip file with: logo pack (SVG + PNG, light + dark), 5 product screenshots, 2 founder bios (250 words each, with a 1-paragraph version), 1-page fact sheet (company, founding date, HQ, mission, contact); the kit is linked from `/press` and is reachable without a form-fill |

**Why T-7:** the security review, load test, and backup drill are the three things that, if they fail, the launch cannot happen. Finding this out at T-1 is a scramble; at T-7 it is a controlled postponement.

## 3. T-1 (Day Before)

All 4 items must be checked by 6 PM local on T-1. The T-1 gate is the go/no-go meeting itself; if any item is unchecked, the launch is postponed by 24 hours, not slipped silently. The on-call lead joins the meeting even if the on-call rotation has not yet started.

| # | Item | Owner | Done-criterion |
|---|---|---|---|
| 1 | Smoke test of the top 10 user flows | CTO | A scripted end-to-end test of the 10 most-used flows (sign up, link GitHub, view dashboard, run recruiter search, issue credential, resolve credential, send WhatsApp nudge, generate NIRF export, upgrade tier, cancel tier) — all 10 pass in < 5 minutes total in a real browser; the script is committed to the repo |
| 2 | Final go/no-go meeting | CEO (chair) | 30-minute meeting with CEO, CTO, Head of Sales, on-call lead; each owner gives a 2-minute status; the CEO calls go or no-go; the decision is logged in `#launch-day` with a timestamp; a "no-go" decision triggers a 24-hour delay and a new T-1 cycle |
| 3 | Status page shows all green | CTO | All 7 subsystems on `/status` show "operational"; the data endpoint returns `{status: "operational"}`; the page renders in < 2 seconds on a fresh load |
| 4 | Internal Slack channel `#launch-day` staffed 24/7 for 72h | Head of Sales | The channel exists; the 4 humans from the go/no-go meeting are in it; the 7-day on-call rotation is also in it; a pinned message in the channel lists the 4 humans, the 3 backup contacts, and the escalation tree |

**Why T-1:** this is the last point at which a problem is cheap to fix. A problem found at T-0 is a 5-minute scramble; at T-1 it is a 24-hour scramble; at T+24h it is a public incident.

## 4. T-0 (Launch Day)

The 6 ordered steps. Do them in this order. Do not parallelize. The CEO is the final approver at step 3.

1. **Deploy the production migration set.** Owner: CTO. The full set of migrations queued for launch is applied in order; the migration log is checked for errors; the post-migration smoke test (the 10 flows from T-1 item 1) is run against production; the deployment is logged in `#launch-day` with a timestamp and a commit SHA. The CEO does not approve launch until this step is done.

2. **Switch DNS to production.** Owner: CTO. DNS records are updated to point to the production environment; the TTL was dropped to 60s at T-7; propagation is monitored via `dig` from 3 geographic locations; the previous DNS state is preserved in case a rollback is needed. The CTO announces "DNS switched" in `#launch-day` and waits 5 minutes for propagation.

3. **Post the launch announcement.** Owner: Head of Sales. Order matters: Product Hunt first (launch-day traffic concentration), LinkedIn second, X third, Hacker News last (its own etiquette — show HN at 9 AM ET, then respond to every comment for the first 4 hours). The CEO personally posts the HN submission. The Head of Sales cross-posts to the 3 other channels within 5 minutes of the HN post.

4. **Email the waitlist.** Owner: Head of Sales (CEO on copy). Three segments, in order: students first (largest list, longest activation cycle), then recruiters (highest expected ARPU), then colleges (smallest list, longest sales cycle, most-tailored copy). Each segment gets a segment-specific email; the emails are scheduled with a 2-hour gap to keep the support inbox manageable.

5. **Monitor for 72 hours.** Owner: on-call lead. The on-call lead watches (in real time, not on a dashboard) error rate, signup rate, support inbox, status page, and social-media mentions. Any anomaly is escalated to the CTO within 15 minutes. A second human (CTO or CEO) is on standby for the full 72 hours. Sleep is in 4-hour shifts; no single human is on the hook for more than 8 hours at a stretch.

6. **T+72h retro.** Owner: CEO. See §5. 60-minute meeting, all-hands, the same 4 humans from T-1 plus any engineer paged during the 72h. Logged in `#launch-day`; action items in the standard task tracker.

## 5. T+72h Retro — The 5 Questions

A working meeting, not a celebration. Each question is answered with a number, a quote, and a follow-up action. "We did great" is not an answer; "Signup rate was 1,200 in 72h vs. forecast 800 — 50% over — driven by the HN front page" is an answer.

1. **What was the actual signup rate vs. forecast?** Compare the 72h signup count to the launch plan, segmented by channel (Product Hunt, LinkedIn, X, HN, waitlist email). Identify the single largest over- or under-performer. Action: update the forecast model for the next launch.
2. **What was the actual infra cost vs. forecast?** Compare the 72h Supabase + observability + email + Edge Function spend to the forecast in `pricing-tiers.md` §7. Identify the single largest cost driver. Action: if any cost line is > 2x forecast, the CTO writes a one-page postmortem within 7 days.
3. **What were the top 3 support tickets?** Triage the 72h support inbox by volume. Identify the 3 most-common ticket types, the 3 most-upvoted (if a help-center thumbs-up/down is in place), and the 3 longest-resolution-time. Action: each top-3 type gets a fix-it-or-document-it owner within 14 days.
4. **What feature was most-complained-about as missing?** Mine the support inbox, the HN / Reddit / X replies, and the App Store / Chrome Web Store reviews. Identify the single most-requested missing feature. Action: the CEO decides whether it is a v1.1 (30 days), v1.2 (90 days), or v2 (next quarter) commitment.
5. **What feature was most-complimented as unexpectedly good?** Same sources as question 4, in reverse. Identify the single most-mentioned "I did not expect this to work" feature. Action: marketing turns it into a case study, a tweet, a Product Hunt update, or paid amplification — whichever fits the channel.
