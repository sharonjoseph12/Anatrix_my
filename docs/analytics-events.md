# Antarix analytics event taxonomy

> **What this covers.** The analytics tool (Plausible, SaaS at
> `plausible.io` for v1, self-host-ready for v2), the event naming
> convention (`snake_case`, `<object>_<verb>`, past tense), the 50
> core events grouped by area, the three standard properties every
> event carries, the three funnel questions the event set must be
> able to answer, the PII policy, the server-side vs. client-side
> dispatch rules, the explicit list of things we are NOT building in
> v1, and the open items we are deferring to v2. This is the contract
> between product, front-end, and Edge Functions; every event name in
> the codebase must match the names in §4 verbatim, and the property
> shapes in §5.

## 1. The tool

We use **Plausible Analytics** (`https://plausible.io`) for v1.
Plausible is a lightweight, cookie-less, GDPR-friendly alternative to
Google Analytics. The reasons we picked it over the alternatives:

- **No cookie banner.** Plausible does not set cookies, so we do not
  have to ship a "we value your privacy" overlay on every page in
  the EU/UK.
- **Server-side event ingestion.** Plausible exposes a
  `POST /api/event` endpoint that accepts JSON and a service-role
  `X-Forwarded-For` header. We use this from Edge Functions so that
  events that have to fire server-side (credential issuance, AI Coach
  sessions, webhook dispatch) are not lost to ad-blockers.
- **Self-host option.** The open-source build is at
  `https://github.com/plausible/analytics` and is a 3-container
  deployment (Plausible app + Postgres + ClickHouse). We document
  the self-host path as the v2 GDPR-clean option for EU customers,
  but v1 is the managed SaaS to keep ops small.

The data flows in two streams. The browser stream goes through
Plausible's 1 KB `<script>` tag in the root layout. The server stream
goes through the Plausible proxy in `apps/web/src/lib/analytics.ts`
(stub — to be implemented in a follow-up) and through the
`@shared/observability.ts` logger from the Edge Functions; see §7.

## 2. Naming convention

Every event name follows three rules. They are not guidelines, they
are the contract — a code review must reject an event that breaks
any of them.

1. **Snake case.** `signup_completed`, not `SignupCompleted` or
   `signup-completed`. Plausible's event-name field is
   case-sensitive and we want grep to work.
2. **`<object>_<verb>`.** The first segment is the noun (the thing
   the event is about), the second is the verb (what happened to
   it). The verb is always past tense. So `credential_issued`, not
   `issue_credential` or `credential_issue`. This puts the noun
   first, which is the same convention Plausible's own example
   dashboards use, and it means every event about credentials starts
   with `credential_*` and groups naturally in the UI.
3. **No free-form verbs.** The verb comes from a fixed set:
   `started`, `completed`, `viewed`, `clicked`, `requested`,
   `responded`, `connected`, `disconnected`, `enabled`, `disabled`,
   `opted_in`, `opted_out`, `installed`, `eligible`, `issued`,
   `shared`, `revoked`, `verified`, `dispatched`, `failed`,
   `selected`, `cancelled`, `upgraded`, `tracked`, `exported`,
   `registered`, `invited`, `onboarded`, `sent`, `suppressed`. If
   you need a verb that is not on this list, propose it in a PR
   review and add it to this section.

The set of events lives in `apps/web/src/lib/analytics-events.ts`
as a TypeScript string-literal union (e.g.
`"signup_completed" | "login_succeeded" | …`). That file is the
source of truth — code that fires an event must import the type, so
a typo at the call site is a compile error, not a silent drop in
the dashboard.

## 3. The 3 standard properties every event carries

Every event — whether fired from the browser or from an Edge
Function — carries the same three properties. They are added by the
dispatcher (`apps/web/src/lib/analytics.ts` on the client,
`@shared/analytics.ts` on the server) and must not be re-added by
the caller.

| Property | Type | Source | Notes |
|---|---|---|---|
| `user_id` | string (64-char hex) | `crypto.subtle.digest('SHA-256', userId + SALT)` | A hash, not the raw UUID. The salt is the same `PLAUSIBLE_USER_SALT` env var we already use for IP hashing; see §6. |
| `session_id` | string (UUIDv4) | `crypto.randomUUID()` set on first page load, kept in `sessionStorage` | Cleared on tab close; never persisted. |
| `timestamp` | string (ISO8601 UTC) | `new Date().toISOString()` | The dispatcher's clock, not the caller's. |

Optional event-specific data goes in a `properties` JSON object. The
shape of `properties` is event-specific; the conventions are in §4
under each event.

## 4. The 50 core events

Eight groups, fifty events total. The verb is past tense throughout.

### 4.1 Auth — 8 events

| Event | Properties | Fired when |
|---|---|---|
| `signup_started` | `referrer`, `utm_source` | The signup form is submitted (whether or not the call succeeds). |
| `signup_completed` | `role` (`student` / `recruiter` / `college` / `company`), `auth_method` (`github` / `google` / `email`) | The user record is created. |
| `login_succeeded` | `auth_method` | The session cookie is set. |
| `login_failed` | `reason` (`invalid_credentials` / `oauth_error` / `rate_limited` / `unknown`) | The login attempt returns non-2xx. |
| `logout` | — | The session is destroyed. |
| `password_reset_requested` | `channel` (`email` / `sms`) | The reset email/SMS is sent. |
| `password_reset_completed` | — | The new password is set. |
| `magic_link_sent` | `channel` (`email`) | The magic link is generated. |

### 4.2 Onboarding — 8 events

| Event | Properties | Fired when |
|---|---|---|
| `onboarding_step_completed` | `step` (string from a fixed list: `connect_github`, `connect_calendar`, `first_credential`, `first_share`, `extension_cta`, `whatsapp_cta`, `done`) | Any onboarding funnel step is completed. |
| `github_connected` | `repo_count` | The GitHub OAuth handshake completes. |
| `github_disconnected` | — | The user revokes GitHub in settings. |
| `calendar_connected` | `provider` (`google` / `microsoft`) | The Calendar OAuth handshake completes. |
| `calendar_disconnected` | `provider` | The user revokes Calendar in settings. |
| `whatsapp_opted_in` | `channel` (`whatsapp`) | The user sends `START` to the WhatsApp bot. |
| `whatsapp_opted_out` | — | The user sends `STOP` or opts out in settings. |
| `extension_installed` | `extension_version` | The Chrome extension reports its first install ping. |

### 4.3 Credentials — 8 events

| Event | Properties | Fired when |
|---|---|---|
| `credential_eligible` | `tier` (the new tier the user crossed) | The score crosses a credential threshold (every 10 points, plus the 60-point "placement-ready" threshold). |
| `credential_issued` | `credential_id`, `tier` | The W3C VC document is signed and persisted. |
| `credential_shared` | `channel` (`linkedin` / `whatsapp` / `email` / `copy_link` / `qr`), `credential_id` | The user clicks a share button. |
| `credential_public_view` | `credential_id`, `viewer_hash` (sha256 of viewer IP+UA) | A third party hits `/verify/<slug>` (a public resolve by a non-owner). |
| `credential_revoked` | `credential_id`, `reason` | The user or an admin revokes a credential. |
| `credential_verified_offplatform` | `credential_id`, `verifier_domain` | A third-party resolver (LinkedIn, an HR system) calls `/functions/v1/credential-vc-resolve/<did>`. |
| `power_mode_started` | `session_id` | The Chrome extension reports a focus session starting. |
| `power_mode_ended` | `session_id`, `duration_seconds` | The session ends (or the user closes the browser). |

### 4.4 Recruiting — 8 events

| Event | Properties | Fired when |
|---|---|---|
| `search_performed` | `filters_hash` (sha256 of the filter set, never the raw values), `result_count` | A recruiter runs a search. |
| `search_result_clicked` | `result_position`, `credential_id` | A recruiter opens a candidate from the search results. |
| `profile_viewed` | `candidate_id` | A recruiter opens a candidate's full profile page. |
| `contact_initiated` | `candidate_id`, `channel` (`email` / `whatsapp` / `in_app`) | A recruiter sends the first message. |
| `contact_responded` | `candidate_id`, `response_time_seconds` | A candidate replies. |
| `ats_export_csv` | `result_count` | A recruiter exports search results as CSV. |
| `ats_export_webhook` | `result_count`, `endpoint_id` | A recruiter exports via the ATS webhook. |
| `webhook_registered` | `endpoint_id` | A recruiter or company admin registers a webhook. |

### 4.5 College — 6 events

| Event | Properties | Fired when |
|---|---|---|
| `cohort_invited` | `cohort_id`, `invitee_count` | A placement officer invites a cohort. |
| `cohort_onboarded` | `cohort_id`, `onboarded_count` | A cohort reaches ≥80% GitHub-connected. |
| `cohort_dashboard_viewed` | `cohort_id` | A placement officer opens the cohort dashboard. |
| `leaderboard_enabled` | `cohort_id` | The placement officer turns on the leaderboard. |
| `alumni_tracked` | `cohort_id`, `alumni_count` | Alumni data is imported (CSV or API). |
| `curriculum_report_viewed` | `cohort_id`, `report_type` (`skill_gap` / `company_interest` / `outcomes`) | A placement officer opens a curriculum report. |

### 4.6 Billing — 6 events

| Event | Properties | Fired when |
|---|---|---|
| `pricing_viewed` | `referrer` | The /pricing page is loaded. |
| `plan_selected` | `plan_id`, `billing_cycle` (`monthly` / `annual`) | The user clicks a "Choose plan" button. |
| `checkout_started` | `plan_id`, `amount_usd` | The Stripe checkout session is created. |
| `checkout_completed` | `plan_id`, `amount_usd`, `coupon` (nullable) | Stripe confirms the payment. |
| `plan_upgraded` | `from_plan_id`, `to_plan_id` | An existing customer moves to a higher tier. |
| `plan_cancelled` | `plan_id`, `reason` | A subscription is cancelled (Stripe webhook). |

### 4.7 AI Coach / nudges — 4 events

| Event | Properties | Fired when |
|---|---|---|
| `nudge_sent` | `nudge_type` (`morning_summary` / `peak_window` / `weekly_summary` / `streak_at_risk`), `channel` (`whatsapp` / `push`) | A nudge is dispatched. |
| `nudge_responded` | `nudge_id`, `response` (`started_session` / `committed` / `replied_done` / `replied_help`) | A user takes an action off a nudge. |
| `nudge_suppressed` | `nudge_type`, `reason` (`paused` / `cap_reached` / `exam_week` / `low_confidence`) | A nudge was eligible but not sent. Useful for tuning. |
| `ai_coach_session_started` | `session_id`, `topic` | The user opens a free-form AI Coach chat. |

### 4.8 Outreach (admin-side) — 2 events

| Event | Properties | Fired when |
|---|---|---|
| `webhook_dispatched` | `event_type`, `endpoint_id`, `attempt_number` | A webhook delivery POST is made. |
| `webhook_failed` | `event_type`, `endpoint_id`, `attempt_number`, `error_code` | A webhook delivery fails (4xx, 5xx, timeout). |

Total: 8 + 8 + 8 + 8 + 6 + 6 + 4 + 2 = **50**.

## 5. The 3 dashboard questions the events must answer

The event set is not academic. Every event in §4 is there because at
least one of the three questions below depends on it. If a new event
is proposed and it does not feed one of these three, it is rejected.

### 5.1 Funnel — `signup → credential → share`

The growth funnel. The four milestones are `signup_started`,
`signup_completed`, `first_credential_issued`, and
`first_credential_shared`. We track conversion at each step, cohort
by ISO week of `signup_started`. The cohort comparison answers "is
the cohort that signed up this week converting at the same rate as
the cohort from 8 weeks ago?" and surfaces funnel regressions early.
Plausible's "funnels" feature can answer this with the raw events;
the offline SQL view is in the analytics warehouse (BigQuery or
ClickHouse mirror — see §7).

### 5.2 Engagement — `dashboard_visited → credential_eligible`

The product-market-fit funnel. We define a "session window" as any
30-day rolling window with at least one `dashboard_visited` (a
custom event fired from the student dashboard; not in the 50 above
because it is a high-volume pageview-ish event and is not in the
"named event" set). For each student, we count the number of
30-day windows in which a `dashboard_visited` occurred, and we
measure what fraction of those windows also produced a
`credential_eligible` event. The target is a 30-day engagement-to-
eligibility rate of ≥30% (this is the spec SC-007 metric, see
`specs/002-antarix-definitive-vision/spec.md`).

### 5.3 Revenue — `pricing_viewed → plan_selected → checkout_completed`

The commercial funnel. The three events are
`pricing_viewed` (top of funnel), `plan_selected` (intent), and
`checkout_completed` (conversion). The conversion rate at each step
is broken out by `utm_source` (the `utm_source` property is added
on `pricing_viewed` from the URL query string). The metric is the
"source-attributed visitor-to-paid conversion rate," and we
re-evaluate it monthly.

## 6. PII policy

**Never send PII as a property.** Specifically, do not send `email`,
`phone`, `name`, `aadhar`, `pan`, `dob`, `address`, or any of the
PII categories from the GDPR Art 4 / DPDP §2 definitions. The
`user_id` property is a sha256 of the real user UUID plus the
`PLAUSIBLE_USER_SALT` env var, which means even a data breach of
Plausible's backend cannot de-anonymize users.

Why this is non-negotiable: **Plausible does not expose a retroactive
PII delete API**. Once a property is in the data, it is there for
the retention window. Sending PII in a property means we cannot
honor a data-subject deletion request for that PII. So the policy is
to never send it in the first place.

For cases where we need to join an event back to a user (e.g. to
send a follow-up email after a `checkout_completed`), the join is
done server-side in our own database (Supabase), keyed on the real
user UUID. The Plausible event stream never carries the join key.

## 7. Server-side vs. client-side dispatch

Two dispatch paths. They differ in the transport but the event
schema is identical.

**Client-side.** The browser fires events from React effects or
event handlers using the Plausible global
(`window.plausible("event_name", { props: { ... } })`). The
Plausible `<script>` tag (1 KB, async, in the root layout) sends
them to `https://plausible.io/api/event`. This is the default
path for anything user-initiated (clicks, form submits, page
transitions).

**Server-side.** Edge Functions fire events that have to happen
even when the user is not in front of the page (`credential_issued`,
`nudge_sent`, `webhook_dispatched`) and that must survive ad-blockers.
The pattern is to add a structured log line:

```ts
ctx.log.info("event", { name: "credential_issued", properties: { credential_id, tier } });
```

The `ctx` here is the `ObsContext` from `_shared/observability.ts`
(see `docs/observability.md`). The `event` log level is reserved
for analytics events. A separate dispatcher
(`supabase/functions/_shared/analytics-dispatcher.ts`, not yet
committed) subscribes to those log lines and POSTs them to
`https://plausible.io/api/event` with the service-role
`X-Forwarded-For` header set to the original client IP. This way
the Edge Function author writes one log line, and the dispatcher
handles the Plausible wire format.

## 8. Self-hosting note (v2)

The open-source Plausible is at
`https://github.com/plausible/analytics`. The deployment is
straightforward: 3 Docker containers (the Plausible app, Postgres,
ClickHouse) behind a reverse proxy. The reasons we are deferring
self-host to v2 are operational (one fewer thing to run on day 1)
and contractual (the SaaS contract is GDPR-clean and the data
resides in EU regions). When we cross the threshold where an
EU-only deployment is required by a customer (a contract clause or
a regulator letter), we will self-host. The event schema in §4 and
the dispatcher in §7 are designed to work with both deployments
unchanged — only the `PLAUSIBLE_API_HOST` env var differs.

## 9. What's NOT in v1

These are all on the radar but are explicitly out of scope.

- **A/B testing framework.** Plausible has no A/B testing; we are
  not building one in v1. Any A/B test runs as a manual
  `pricing_viewed` comparison with a hand-set `experiment_id`
  property, and the analysis is a one-off SQL query.
- **Funnel analysis in Plausible.** Plausible's funnel UI exists
  but is limited (it does not break down by `utm_source`, and it
  caps at 5 steps). The funnels in §5.1 are computed in our own
  warehouse (a BigQuery mirror, populated by a daily Plausible
  export) until Plausible's funnel UX improves.
- **Cohort retention in Plausible.** Plausible added cohort
  retention in 2024-Q4; the UX is rough, the definitions do not
  match our SC-007 metric, and the data is per-`user_id`-hash only.
  We do our own cohort retention in the warehouse.
- **Custom user properties.** Plausible supports
  `set_custom_user_props`; we are not using it in v1. The
  `user_id` hash is enough for our dashboards, and we do not want
  to leak any extra user-level data into Plausible's backend.
- **Session replays.** We explicitly do NOT want session replays
  — the privacy implications are large, the third-party tooling
  is a regulatory gray area in the EU, and the engineering cost
  of a self-hosted alternative (LogRocket, Highlight) is not
  justified in v1. If we ever add them, they will be self-hosted
  and tied to a per-user opt-in.

## 10. Open items

- **Replace Plausible SaaS with a self-hosted instance for EU
  customers.** Trigger is the first EU contract that requires
  data-residency in the EU. The dispatcher in §7 makes this a
  config change.
- **`CohortAnalysis` table for the offline funnel query.** The
  current funnel view is a daily BigQuery job that joins
  Plausible-exported events with our `users` table. Once we
  exceed ~1M events per day, the join gets slow; a denormalized
  `CohortAnalysis` table (one row per cohort per week per funnel
  step) is the v2 fix. Out of scope for v1 because we are at
  ~10k events/day.
- **Weekly placement-officer email summary** — "your cohort had
  X new credentials this week, Y students went placement-ready,
  and Z recruiters expressed interest in the top of your
  distribution." This is a `digest_sent` event that we will
  add to §4 in a follow-up doc revision; the underlying events
  (`cohort_dashboard_viewed`, `credential_issued`, `profile_viewed`)
  are already in place.
- **Per-locale event variants.** When we add the 7-locale queue
  (`bn`, `ta`, `te`, `mr`, `es`, `pt-BR`, `fr`) from
  `docs/seo.md §11`, the question is whether the event set itself
  needs to vary by locale. The current answer is no — events are
  about behavior, not language — but a follow-up will revisit if
  any locale surfaces behavior that is not captured in the 50
  events above.
