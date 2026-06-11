# Antarix public status page

The Antarix status page is the single source of truth for "is the system
working?" — for users, customers on sales calls, recruiters verifying a
candidate, and our own on-call rotation. It is intentionally **public**,
**read-only**, and **as simple as possible**.

- Public URL: `https://antarix.app/status.html` (also reachable at
  `/status` if a Vercel rewrite is configured to alias the static file)
- Data endpoint: `https://antarix.app/functions/v1/status-page-data`

---

## 1. The 3 components

### 1.1 `supabase/functions/status-page-data/index.ts` — the aggregator

A single Supabase Edge Function, public, no JWT. Composed as
`serve(withRateLimit("status-page-data", "_default", withObservability(…)))`
so a 429 short-circuits before any handler work, and every request produces
the standard access log + span from `_shared/observability.ts`.

On a `GET` it:

1. Returns the cached JSON envelope if a request landed in the last 60 s.
2. Otherwise, runs **7 parallel subsystem checks** via `Promise.allSettled`,
   each with a 5 s `AbortController` timeout.
3. Reads `public.status_incidents` and `public.status_scheduled_maintenances`
   in parallel.
4. Classifies each subsystem: `2xx/3xx/4xx → operational`, `5xx → degraded`,
   timeout / network error → `down`. The overall envelope status is the
   worst-of-all (down > degraded > operational; `unknown` if the map is
   empty).
5. Caches the rendered JSON body for 60 s and returns it with
   `Cache-Control: public, max-age=30` so any CDN edge in front can absorb
   visitor bursts at 30 s per edge.

The function **always returns 200**. A 5xx from the status page is itself
an outage; the handler degrades to an `unknown` envelope rather than
exploding. (The DB-read path also catches its own errors and emits empty
incident/maintenance lists — a DB hiccup must not 5xx the page.)

### 1.2 `apps/web/public/status.html` — the static page

Pure HTML + inline CSS + a small inline JS fetch loop. ~190 lines. Lives in
`apps/web/public/` so Next.js serves it as a static asset at
`/status.html` with no route handler, no SSR, no build step. Opens
correctly when launched directly as a `file://…/status.html` in a browser
(makes the `fetch()` call to `https://antarix.app/…`; the CORS headers on
the Edge Function allow it).

On load it fetches the aggregator endpoint, renders:

- A coloured banner (green / yellow / red / grey) summarising overall
  status.
- The list of 7 subsystems with a status emoji (`🟢 🟡 🔴 ⚪`) and
  per-subsystem latency in ms.
- An **Active incidents** section (visible only when at least one
  `status !== 'resolved'` row exists).
- A **Scheduled maintenance** section.
- A collapsed **Past incidents** section (uses native `<details>`).
- A `Last updated: HH:MM:SS` line that auto-refreshes every 30 s via
  `setInterval`.

Two security/contact links at the bottom:
- `https://antarix.app/docs/security/vdp` (VDP per RFC 9116)
- `mailto:status@antarix.app`

The page is `noindex` (`<meta name="robots" content="noindex">`) — we don't
want a transient outage of `credential-vc-resolve` to surface as a Google
search hit for "Antarix down".

### 1.3 `supabase/migrations/040_status_page.sql` — the data layer

Two additive tables, both RLS-enabled with **no policies** (service-role
only). The status-page Edge Function reads them with the service-role key;
everyone else (anon, authenticated) sees zero rows.

- `public.status_incidents` — one row per incident. `id text pk`,
  `title`, `status` (4-value check constraint), `started_at`,
  `resolved_at`, `summary`, `affected_subsystems text[]`. The
  `status <> 'resolved'` partial index makes the "active" query cheap.
- `public.status_scheduled_maintenances` — one row per upcoming /
  in-flight maintenance window. `id`, `title`, `starts_at`, `ends_at`,
  `description`, `affected_subsystems text[]`. Indexed on `starts_at` for
  the "what's coming up" query.

Both `create table if not exists`; seeds use `on conflict (id) do nothing`.
The migration is fully idempotent.

Two seeded incidents and one seeded maintenance are included so the page
is not empty on first deploy.

---

## 2. How to update the page

The page is **purely additive and is served as a static file by
Next.js**. To change the layout, copy, or design:

1. Edit `apps/web/public/status.html`.
2. Commit and push to the branch.
3. Vercel auto-deploys. The new file is served on the next request.

No build step. No `npm run build`. The page is not in the React tree.

To change the **subsystem list** (add / remove / rename a check), see
§4.1.

To change the **overall status logic** (e.g. treat 4xx as "degraded"
instead of "operational"), edit `classifyHttp` in
`supabase/functions/status-page-data/index.ts` and redeploy with
`npx supabase functions deploy status-page-data --no-verify-jwt`.

To change the **incident schema**, edit the migration. The migration is
idempotent — you can add a new column with `add column if not exists …`
in a follow-up `04x_*.sql` (do not edit `040_*.sql` in place once it has
been applied; the `if not exists` guards will silently no-op the new
column).

---

## 3. How to log an incident

Incidents are rows in `public.status_incidents`. There is **no admin Edge
Function yet** (see §7); for now, log incidents from the Supabase
dashboard or via `psql`:

```sql
insert into public.status_incidents
  (id, title, status, started_at, summary, affected_subsystems)
values
  (
    'inc-2026-07-01-1',                                  -- any unique id
    'credential-vc-resolve returning 500',                -- human title
    'investigating',                                       -- investigating|identified|monitoring|resolved
    now(),
    'Root cause: migration 042 introduced a NOT NULL on did. Investigating.',
    array['credential-vc-resolve']                        -- one or more subsystem names
  );
```

Update the status by editing the row:

```sql
update public.status_incidents
   set status      = 'identified',
       summary     = 'Bad migration 042 rolled back; recovery in progress.',
       affected_subsystems = array['credential-vc-resolve']
 where id = 'inc-2026-07-01-1';

update public.status_incidents
   set status      = 'resolved',
       resolved_at = now(),
       summary     = 'Migration 042 fixed and re-applied; resolver back to normal.'
 where id = 'inc-2026-07-01-1';
```

The page re-fetches every 30 s (or earlier on a hard refresh), so the
change is visible within ~30 s of commit. The `Cache-Control: max-age=30`
on the Edge Function response means a CDN edge can hold the result for up
to 30 s; behind a CDN with 30 s freshness this is "see the change within
60 s worst case" — good enough for a status page.

For scheduled maintenance, insert into
`public.status_scheduled_maintenances` and the page picks it up on the
next fetch. The same edit-by-hand pattern; or, when the admin Edge
Function ships (§7), a JSON POST from the on-call console.

---

## 4. The subsystem list

### 4.1 The 7 subsystems

| Key                       | Friendly name              | Probe                                                              | Expected response |
|---------------------------|----------------------------|--------------------------------------------------------------------|-------------------|
| `core-platform`           | Core platform              | `GET /functions/v1/health-check`                                   | 200               |
| `credential-vc-resolve`   | Public credential resolution | `GET /functions/v1/credential-vc-resolve/<all-zero-uuid>`       | 404 (well-formed, no row) |
| `ai-coach`                | AI Coach pipeline          | `POST /functions/v1/credential-vc-issue` (no body)                 | 401 (no JWT)      |
| `whatsapp-send`           | WhatsApp delivery          | `POST /functions/v1/whatsapp-send` (no body)                       | 400 (missing `nudge_id`) |
| `nudge-dispatch`          | Nudge dispatch             | `POST /functions/v1/nudge-dispatch` (no body)                      | 400 (missing `user_id`) |
| `github-sync`             | GitHub sync                | `POST /functions/v1/github-sync` (no body)                         | 400 (missing `user_id`) |
| `calendar-sync`           | Calendar sync              | `POST /functions/v1/calendar-sync` (no body)                       | 400 (missing `user_id`) |

**Why these 7:** they map 1:1 to the product surface that a customer,
recruiter, or candidate can see break. The `ai-coach` entry is a slight
abstraction: the AI Coach is a web inbox fronted by `nudge-dispatch` /
`whatsapp-send` / `push-send`; it has no dedicated Edge Function, so we
use a stable, lightweight Edge Function (`credential-vc-issue`, 401 on
no auth) as a proxy for "the Edge Function runtime is healthy". This is
the only signal a status page needs for that subsystem.

**Classification rule:** 2xx, 3xx, and 4xx all mean "the function is up".
4xx is the expected response for authed endpoints probed without a token,
and 3xx (redirect) means the function is reachable. Only 5xx is
"degraded" (function is up but erroring on this request), and only
timeout / network / DNS error is "down" (function unreachable).

### 4.2 Adding a new subsystem

A 5-line code change — 1 line in the Edge Function's `SUBSYSTEMS` array,
1 line in the HTML's `NAME` map, optionally 1 line in the subsystem
table above:

1. **Edge Function.** Open `supabase/functions/status-page-data/index.ts`
   and append one entry to the `SUBSYSTEMS` array:

   ```ts
   {
     name: "new-subsystem",
     method: "POST",
     url: `${SUPABASE_URL}/functions/v1/new-subsystem`,
   },
   ```

2. **HTML.** Open `apps/web/public/status.html` and add one entry to the
   `NAME` map in the inline `<script>`:

   ```js
   "new-subsystem": "New subsystem friendly name",
   ```

3. **Doc.** Add a row to the table in §4.1 above (purely editorial).

4. **Deploy.** `npx supabase functions deploy status-page-data
   --no-verify-jwt`. The HTML update deploys on the next Vercel build.

That's it. No migration, no schema change, no auth. The next request to
`/functions/v1/status-page-data` includes the new subsystem.

### 4.3 Removing or renaming a subsystem

Reversal of §4.2: remove the line from `SUBSYSTEMS`, remove the entry
from the `NAME` map, update the table in §4.1, redeploy. Existing
`status_incidents.affected_subsystems` rows can keep the old key
forever; the page falls back to the raw key for any subsystem name it
doesn't recognise in `NAME`.

---

## 5. Caching strategy

Three layers, all multiplicative:

| Layer | TTL | Where | What it does |
|-------|-----|-------|--------------|
| Edge Function in-memory | 60 s | Inside the function isolate | 1 upstream call per 60 s per cold start of the isolate, regardless of how many visitors hit the page |
| CDN edge (`Cache-Control: public, max-age=30`) | 30 s | Vercel / Cloudflare in front of the Edge Function | At most 1 call per 30 s per CDN edge per visitor burst |
| Browser | none | The page itself | Refetches every 30 s via `setInterval`; the page does not set `Cache-Control` itself, so the browser can use the standard heuristics |

Worst case end-to-end:
- A status change is reflected in the Edge Function within 0 s (the next
  rebuild fires).
- The CDN edges pick it up within 30 s (max-age expiry).
- The page picks it up within 30 s of that (the next `setInterval` tick
  from the longest-running browser tab).

**Total: ≤ 60 s from row commit to user-visible.** This matches the
cadence of the Slack and GitHub public status pages.

The in-memory cache is **per isolate**. Supabase Edge Functions may run
multiple isolates simultaneously across regions; in practice the function
is small and traffic is bursty enough that there is usually one warm
isolate, but a high-traffic event could see N parallel upstream calls
(where N is the number of warm isolates). For a status page this is
acceptable — N is small, the probes are cheap, and the rate limiter caps
the per-visitor call rate at 1 rps sustained.

---

## 6. Why no auth

The page is **public by design**. Three reasons:

1. **Recruiter / sales calls.** A hiring manager is verifying a candidate
   mid-call. They will not create an Antarix account to check whether
   `credential-vc-resolve` is up; they will type `antarix.app/status.html`
   and read.
2. **Customer trust signal.** The page itself is the trust signal.
   Putting it behind a login makes it useless. ("Login to see if we're
   up" is the failure mode of every over-authed status page.)
3. **It's read-only data.** The page emits no PII, no credential
   payloads, no per-user information. It's the worst-of-all-subsystems
   status, latency in ms, and admin-curated incident text. The cost of
   exposing this to the world is zero.

The only protection we layer in front is:
- `withRateLimit` (`_default` config: 60 burst / 1 rps sustained per
  bucket key). The unauth bucket key is `ip:<requestId>:fn:status-page-data`
  — see the "IP-fallback gap" note in `docs/rate-limiting.md` for why
  this is per-request-id rather than per-real-IP in v1. The CDN edge
  rate-limit (Vercel's built-in) is the real backstop.
- Structured logging via `withObservability`. Every call hits the access
  log; any abuse pattern is visible in the log shipper.

The data tables themselves (`status_incidents`,
`status_scheduled_maintenances`) are RLS-enabled with no policies, so the
public Edge Function reads them with the service-role key but the anon
and authenticated roles cannot read them directly via PostgREST.

---

## 7. Why no real-time updates

The page polls every 30 s with `setInterval`. We considered three other
options and rejected them:

| Option | Verdict | Why |
|--------|---------|-----|
| WebSockets / SSE | Rejected | The status of 7 subsystems does not change second-by-second. SSE adds a long-lived connection per visitor, complicates the CDN (no buffer), and is a foot-gun for the rate limiter. |
| Server-Sent Events from a single edge | Rejected | Same connection-management cost as WebSockets, with the additional cost of stateful aggregation. |
| 30 s `setInterval` poll | **Chosen** | Matches the cadence of the Slack and GitHub status pages. Stateless, CDN-friendly, rate-limit-friendly. Worst-case staleness of 60 s is fine for a status page. |

The 30 s interval is shorter than the 60 s in-memory cache in the Edge
Function on purpose: most polls will be cache hits, but if a long poll
interval coincides with a cache miss right after a real upstream call,
we want the *next* poll to potentially see fresh data.

---

## 8. Open items

Roadmap, in rough priority order:

1. **Admin Edge Function for incident management.** `incident-create`,
   `incident-update`, `incident-resolve` Edge Functions, JWT-gated to
   an `admin` role. Replaces the "edit the table by hand in the
   dashboard" flow in §3. ~200 LoC + a migration for the `admin` role
   + a RLS policy that lets the admin role INSERT/UPDATE on
   `status_incidents` and `status_scheduled_maintenances`.
2. **Public RSS / Atom feed.** `GET /functions/v1/status-feed.rss` (or
   `/status-feed.atom`) emitting the last 50 incidents + 30 days of
   scheduled maintenances. Useful for the same audiences that want the
   HTML page but in a feed reader. ~150 LoC in a new Edge Function,
   shares the same `_shared/observability.ts` wrapper.
3. **iCalendar feed for scheduled maintenances.** Subscribe in Google
   Calendar / Outlook and get a calendar entry for each scheduled
   window. `text/calendar` is well-specified; ~100 LoC.
4. **Per-component history charts.** Render a 7-day sparkline of
   `latency_ms` per subsystem next to each row. Needs a tiny time-series
   table (`status_subsystem_samples`) populated by the Edge Function
   itself (1 INSERT per successful probe, sampled to 1/min). Pure
   additive migration + an additional `SELECT` in the Edge Function.
5. **Subscribe to incident updates.** Per-incident RSS permalink so a
   watcher can subscribe to "all incidents affecting credential-vc-resolve".
6. **Webhook subscription.** Allow paying customers to subscribe their
   own PagerDuty / Slack to incident-open / incident-resolve events.
   The webhook system in `040_webhooks.sql` (Agent D-4) is the right
   substrate; the status page only needs a tiny glue function that
   fires `webhook-dispatch` on incident status transitions.

---

## 9. Filename notes

This migration is `040_status_page.sql`. At the time of writing the
`040_*` slot is shared with Agent B's `040_institutions_slug.sql` (an
additive `slug` column on `public.institutions`); the lex sort will
apply `040_institutions_slug.sql` first, then `040_status_page.sql`,
then Agent D-4's `041_webhooks.sql`. The two `040_*` files do not
overlap in schema (`status_*` vs. `institutions.slug`) so they coexist
safely.

The brief instructed `040_*` as the slot; the slot name in Postgres
migrations is just a filename, so duplicate numbers are tolerated
provided the order is correct.
