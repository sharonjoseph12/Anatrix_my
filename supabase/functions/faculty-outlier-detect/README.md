# `faculty-outlier-detect` — Supabase Edge Function

11/10 — Faculty grading outlier monitor (research **D5**, FR-FAC-005).
Runs nightly (cron `faculty-outlier-detect-nightly`, see
`038_cron_004.sql`) and flags faculty whose mean grade distribution
deviates from their institution's peer mean by more than 2 standard
deviations, **and** who have issued at least 5 grades in the trailing
90-day window.

## What it does

For every active faculty row (`faculty_verifications.verified = true
AND revoked_at IS NULL`), it computes the count, mean, and population
stdev of the grades that faculty issued in the last 90 days (read from
`faculty_grades`). It then groups faculty by `institution_id`,
computes the **peer** mean and peer stdev across the per-faculty
means, and flags any faculty whose mean deviates by more than the
configured stdev threshold (default 2.0).

The threshold gates — chosen together — are deliberately strict so
the function does not produce noise on small institutions:

- An institution needs **≥ 3** faculty with at least one grade in
  the window to compute a stable peer distribution. Fewer than that
  and the sweep skips the institution entirely.
- A faculty needs **≥ 5** grades in the window before they are
  eligible to be flagged. Brand-new faculty with insufficient
  signal are never flagged.
- A non-zero peer stdev is required (i.e. the institution has at
  least some spread in its graders' mean grades).

The stdev threshold, minimum grades, and window days are all
configurable via env vars.

## What it does NOT do

Per D5, outlier monitoring is **informational, never punitive**. This
function:

- does **not** modify any `faculty_verifications` or `faculty_grades`
  rows,
- does **not** disqualify or revoke any faculty,
- does **not** send emails or notifications,
- does **not** call any external service,
- does **not** make any HTTP request.

It only reads from Postgres (service role, RLS bypass) and emits one
structured `warn`-level log line per flagged faculty, which is
captured by the existing observability stack
(`supabase.functions.invoke_log`) for downstream alerting.

## Request

```http
POST /functions/v1/faculty-outlier-detect
Content-Type: application/json
```

| Body | Behaviour |
|---|---|
| `{}` (cron) | Run the full sweep. |
| `{ "sweep": true }` | Run the full sweep. |
| `{ "sweep": false }` | Returns 400 — only sweep mode is supported. |

## Response

`200 OK` JSON:

```json
{
  "ok": true,
  "institutions_scanned": 14,
  "faculty_checked": 87,
  "outliers_flagged": 2
}
```

Each flagged faculty also produces a structured warn log line on
stdout, e.g.:

```json
{
  "level": "warn",
  "msg": "faculty_outlier",
  "institution_id": "<uuid>",
  "faculty_id": "<uuid>",
  "mean": 42.5,
  "peer_mean": 71.3,
  "peer_stdev": 6.2,
  "deviation_stdevs": 4.65,
  "graded_count": 23
}
```

## Environment

- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto; required to bypass RLS for the
  reads against `faculty_verifications` and `faculty_grades`).
- `FACULTY_OUTLIER_STDEV_THRESHOLD` (default `2`) — number of peer
  stdevs beyond which a faculty is flagged.
- `FACULTY_OUTLIER_MIN_GRADES_WINDOW` (default `5`) — minimum number
  of grades in the window before a faculty is eligible to be
  flagged.
- `FACULTY_OUTLIER_WINDOW_DAYS` (default `90`).

## Data source

`public.faculty_verifications` (for the active-faculty roster) and
`public.faculty_grades` (for the per-faculty grade distribution). Both
tables are defined in `035_ats_sso_faculty.sql`.

The function prefers an aggregation RPC named
`faculty_outlier_stats(p_window_days int)` if present; if the RPC is
absent (the migration that introduces it has not been applied yet),
it falls back to two client-side `select`s and the same in-memory
aggregation. The fallback is intentionally simple so the function is
useful in environments that have only applied 001-035.

## Cadence

Scheduled nightly at 07:00 UTC by `supabase/migrations/038_cron_004.sql`
(`faculty-outlier-detect-nightly`). Runs after the outcome-billing
finalizer (05:00 UTC) and the next-best-skill sweep (06:00 UTC) so it
sees the freshest faculty grade rows.

## Local dev / deploy

```bash
npx supabase functions serve faculty-outlier-detect --no-verify-jwt
npx supabase functions deploy faculty-outlier-detect
```

Local calls require the `Authorization: Bearer <service-role>` header
to bypass JWT verification.

## Observability

The function does not write to any database tables. All output is on
stdout as structured JSON (one `warn` per outlier) and is captured by
the existing Supabase Edge Function logging pipeline
(`supabase.functions.invoke_log`). A future iteration can wire a
downstream consumer (e.g. an on-call channel or a college-admin
notification table) to surface these flags in the admin console.
