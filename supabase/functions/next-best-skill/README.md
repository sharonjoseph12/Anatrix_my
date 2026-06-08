# `next-best-skill` — Supabase Edge Function

11/10 — Next-Best-Skill recommender (research **D10**, US3, FR-NBS-001..005).
Computes the top-N next-skill suggestions for one student (or every
eligible student in a sweep) and persists them to
`public.next_best_skills` (defined in `037_api_outcome_nbs.sql`). The
student-facing card in `/dashboard/skills` reads from that table; the
cron in `038_cron_004.sql` (`next-best-skill-sweep-daily`) drives the
nightly refresh at 06:00 UTC.

## Algorithm

Per **D10**: for a student S, find alumni A with ≥ 60% Jaccard
similarity over their current skill set, then for each kept A compute
the set difference `A.post_placement_skills \ S.current_skills` and
tally which skills come up most often. Drop skills whose
`source_count < 5` (the D10 floor — no low-signal noise). The top 3
become recommendations, with a confidence of
`min(0.95, count / kept_count)` and a human-readable reasoning string
of the form `"N of M alumni placed at <Company> added <Skill> after
your current stack"`.

This Edge Function is the **Deno mirror** of
`apps/web/src/lib/algorithms/next-best-skill.ts`. Edge Functions
cannot import from `apps/web`, so the algorithm is duplicated inline
and the two must be kept in sync — the top comment on
`index.ts` flags this. The TypeScript module is the source of truth
for the in-process Vitest unit tests; this Deno file is the source
of truth for the production cron.

## v1 data mapping (temporary approximation)

There is no per-user skill-history table in 001-033, so the function
uses these proxies until a future migration adds a snapshot table:

- **Alumni corpus** = students with at least one row in
  `public.outcome_billing_events` (i.e. a confirmed placement per the
  outcome-pricing pipeline).
- **Alumni skill set** = the student's current `user_skills` rows
  (used for both pre- and post-placement; a v1 limitation).
- **`placement_company`** = the `companies.name` from
  `student_applications` joined to the offer that produced the
  billing event.
- **Student current skills** = `user_skills` joined to `skills.name`.

## Request

```http
POST /functions/v1/next-best-skill
Content-Type: application/json
```

| Body | Behaviour |
|---|---|
| `{ "user_id": "<uuid>" }` | Recompute and store the recommendations for one student. |
| `{ "sweep": true }` (or `{}` from cron) | Recompute for every student with ≥ 3 rows in `user_skills` (a v1 proxy for "verified skills in the last 90 days"). |

## Response

`200 OK` JSON on success.

Single-student:
```json
{ "ok": true, "student_id": "<uuid>", "recommendations": 3 }
```

Sweep:
```json
{
  "ok": true,
  "students_processed": 412,
  "students_skipped": 0,
  "recommendations_per_student": 3,
  "total_recommendations": 1236
}
```

## Idempotency

For each (re-)computation, the function first **deletes** all existing
rows for that `student_id` from `next_best_skills`, then inserts the
freshly computed rows (≤ 3 per student). Re-running the function for
the same student is therefore a safe overwrite; there is no unique-
constraint violation risk, and the unique `(student_id, skill)` index
(defined in 037) protects against accidental duplication inside a
single run.

## Environment

- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto; required to bypass RLS for writes
  to `next_best_skills`).
- `NEXT_BEST_SKILL_MIN_SOURCE_COUNT` (default `5`) — D10 floor; the
  schema CHECK `next_best_skills_source_count_chk` enforces the same
  value at the database level.
- `NEXT_BEST_SKILL_JACCARD_THRESHOLD` (default `0.6`).
- `NEXT_BEST_SKILL_TOP_K` (default `3`).

## Cadence

Scheduled daily at 06:00 UTC by `supabase/migrations/038_cron_004.sql`
(`next-best-skill-sweep-daily`). The cron fires the sweep mode with an
empty `{}` body. Manual / on-demand invocations pass `user_id`.

## Local dev / deploy

```bash
npx supabase functions serve next-best-skill --no-verify-jwt
npx supabase functions deploy next-best-skill
```

Local calls require the `Authorization: Bearer <service-role>` header
to bypass JWT verification. The function is service-role-only; no
end-user calls are accepted.
