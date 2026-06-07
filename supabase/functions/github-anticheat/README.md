# `github-anticheat` — Supabase Edge Function

Feature 004 (Anti-cheat, User Story 1, FR-AC-001..005). Runs the 4 GitHub
detectors (`fork_no_commits`, `commit_cluster_time`, `ai_generated_suspect`,
`copied_content_overlap`) against a student's recent commit activity,
aggregates per-repo via the max-confidence rule, and persists signals +
audit rows. Repositories whose aggregate score crosses the quarantine
threshold (default **0.6**) are flagged; the student sees them in
`/dashboard/skills` and can file an appeal that a college mentor decides
on. See `specs/004-eleven-of-ten/spec.md` US1 and
`specs/004-eleven-of-ten/contracts/api.md` "Internal: Anti-cheat".

This function is the Deno mirror of
`apps/web/src/lib/anticheat/github-signals.ts`. The detector logic is
duplicated inline because Edge Functions cannot import from `apps/web`;
the comment at the top of `index.ts` calls this out and the two must
be kept in sync.

## Request

```http
POST /functions/v1/github-anticheat
Content-Type: application/json
```

Two body shapes:

| Body | Behaviour |
|---|---|
| `{ "user_id": "<uuid>" }` | Scan only that student. |
| `{ "sweep": true }` (or `{}` from cron) | Scan every student with `github_activity` activity in the last 7 days. |

## Response

`200 OK` JSON on success, e.g.:

```json
{ "ok": true, "scanned": 14, "quarantined": 3, "errors": 0 }
```

`sweep` responses also include `students` (the unique user count). The
function never throws for "no signals found" — a clean student returns
`{ ok: true, scanned: 0, quarantined: 0 }`.

## Environment

- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto; required to bypass RLS for writes
  to `anticheat_signals` / `anticheat_audit`).
- `ANTICHEAT_QUARANTINE_THRESHOLD` (default `0.6`). Aggregate score
  above this marks a repo as quarantined.

## Data sources

The only per-user per-commit table that exists in 001-033 is
`public.github_activity` (added in migration 003). Migration 034 adds
columns to `public.github_repos` but does not create the table itself.
The function:

1. Aggregates `github_activity` rows by `repo_full_name` per user.
2. Computes a deterministic UUIDv5-shaped `entity_id` from
   `(user_id, repo_full_name)`.
3. Writes `anticheat_signals` and `anticheat_audit` rows with
   `entity_type='github_repo'`.
4. **Best-effort** updates `github_repos.{anticheat_score,quarantined_at}`
   when the table exists; the call is wrapped in a try/catch and any
   error is logged at `warn` level. Once `github_repos` is provisioned
   the same code path will start working with no change.

## Cadence

Scheduled every 6 hours by `supabase/migrations/038_cron_004.sql`
(`github-anticheat-6h`). The cron fires the sweep mode with an empty
`{}` body. Manual / on-demand invocations pass `user_id`.

## Audit semantics

For every repo that crosses the quarantine threshold, ONE
`anticheat_audit` row is written with `actor_type='system'`,
`action='quarantine'`, `actor_id=NULL`, and a `payload` containing the
aggregate score, primary signal kind, confidence, and the repo
`full_name`. The audit table is read-only for authenticated users and
service-role-only for writes (migration 034).

## Local dev / deploy

```bash
npx supabase functions serve github-anticheat --no-verify-jwt
npx supabase functions deploy github-anticheat
```

Local calls require the `Authorization: Bearer <service-role>` header
to bypass JWT verification.
