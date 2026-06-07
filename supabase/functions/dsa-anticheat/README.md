# `dsa-anticheat` — Supabase Edge Function

Feature 004 (Anti-cheat, US1, FR-AC-005). Runs the 2 DSA detectors
(`impossible_velocity`, `rating_delta_anomaly`) against a student's
synced DSA profiles (LeetCode / HackerRank), aggregates via the same
max-confidence rule, and persists signals + audit rows. Profiles whose
aggregate score crosses the quarantine threshold (default **0.6**) are
flagged. See `specs/004-eleven-of-ten/spec.md` US1 and
`specs/004-eleven-of-ten/contracts/api.md` "Internal: Anti-cheat".

This function is the Deno mirror of
`apps/web/src/lib/anticheat/dsa-signals.ts`. Detector logic is
duplicated inline because Edge Functions cannot import from `apps/web`;
the two must be kept in sync.

## Snapshot history — design choice

`public.user_dsa_profiles` (migration 017) stores the **current** state
of a student's DSA platform profile — it has no built-in history
column. Both detectors need ≥ 2 snapshots to fire.

To produce a working history without modifying 001-033 code, this
function uses `anticheat_signals.evidence_payload` as the storage
medium: every signal it inserts carries the *current* totals
(`total_solved`, `easy_solved`, `medium_solved`, `hard_solved`,
`contest_rating`, `platform`, `snapshot_at`) in the payload. The next
run reads the most recent active signal for the same `(user_id,
platform)` from that payload and treats it as the "previous snapshot".

**Consequence**: the **very first** run on a student never fires —
there is no prior snapshot to compute the delta from. From the second
run onward, both detectors are operational. This is an accepted v1
trade-off; the alternative was a new `user_dsa_profile_snapshots` table
in 040+ which is out of scope for this feature slice.

## Request

```http
POST /functions/v1/dsa-anticheat
Content-Type: application/json
```

| Body | Behaviour |
|---|---|
| `{ "user_id": "<uuid>" }` | Scan only that student (both platforms). |
| `{ "sweep": true }` (or `{}` from cron) | Scan every student with `user_dsa_profiles.last_synced_at` in the last 7 days. |

## Response

`200 OK` JSON on success, e.g.:

```json
{ "ok": true, "scanned": 2, "quarantined": 1, "errors": 0 }
```

`sweep` responses also include `students` (the unique user count). A
clean student returns `{ ok: true, scanned: 0, quarantined: 0 }`.

## Environment

- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto; required for `anticheat_signals`
  + `anticheat_audit` writes — both deny INSERT to authenticated).
- `ANTICHEAT_QUARANTINE_THRESHOLD` (default `0.6`).

## Cadence

Scheduled by `supabase/migrations/038_cron_004.sql`
(`dsa-anticheat` is implied via the same cron pattern as
`github-anticheat-6h`; if not yet added, run on the same 6h cadence).
Manual / on-demand invocations pass `user_id`.

## Audit semantics

For every profile that crosses the threshold, ONE `anticheat_audit` row
is written with `actor_type='system'`, `action='quarantine'`,
`actor_id=NULL`, and a `payload` containing the aggregate score,
primary signal kind, confidence, platform, and the profile id. The
audit table is read-only for authenticated users and service-role-only
for writes (migration 034).

## Local dev / deploy

```bash
npx supabase functions serve dsa-anticheat --no-verify-jwt
npx supabase functions deploy dsa-anticheat
```

Local calls require the `Authorization: Bearer <service-role>` header
to bypass JWT verification.
