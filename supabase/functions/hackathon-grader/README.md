# hackathon-grader

Edge Function that grades a single hackathon submission, writes the
result to `public.hackathon_submissions`, and issues a
`public.hackathon_credentials` row + W3C Verifiable Credential.

## Modes

| `EVALUATION_MODE`  | Behaviour                                                                |
| ------------------ | ------------------------------------------------------------------------ |
| `stub` (default)   | Iterates test cases, writes `test_results` with `passed=0` and forces `score=0`. Marked with a `note: "stub mode — replace with real runner"`. Does **not** execute student code. |
| `external`         | POSTs `{ language, source, cpu_time_limit, memory_limit, network, cases }` to `EVALUATION_RUNNER_URL` and normalises the response. We use a 30s wall-clock cap (configurable) + 5s slack, `AbortController` cancels the request if the runner stalls. |

### Why two modes?

The Deno runtime inside Supabase Edge Functions cannot safely spawn a
child process to execute arbitrary untrusted code. The platform's
permission model denies subprocess creation by default, and even if it
were available the network/filesystem isolation guarantees required by
`FR-HK-003` (no network egress, 30s CPU, 256MB memory) are not
enforceable from inside the same V8 isolate as the grader. The
**stub** mode lets us ship the entire grading, credential, and
leaderboard pipeline while we wire up an external Judge0/HackerEarth
runner. The **external** mode is the production path; the stub never
promotes a winner (`winner`/`top_1_pct`/`top_10_pct` are only issued
when `mode !== "stub"`).

## Endpoints

```
POST /functions/v1/hackathon-grader
Content-Type: application/json
Authorization: Bearer <service-role or user jwt>

{ "submission_id": "<uuid>" }
```

Response:

```json
{ "ok": true, "score": 0, "mode": "stub", "credential_kind": "participation" }
```

`credential_kind` is one of `participation | top_10_pct | top_1_pct |
winner`. The participation row is always written; the rank-specific
rows depend on the leaderboard at the moment of grading.

## Env

| Variable                      | Default | Notes                                                |
| ----------------------------- | ------- | ---------------------------------------------------- |
| `EVALUATION_MODE`             | `stub`  | `stub` or `external`                                 |
| `EVALUATION_RUNNER_URL`       | —       | Required when `EVALUATION_MODE=external`             |
| `EVALUATION_RUNNER_TOKEN`     | —       | Bearer token for the external runner                 |
| `HACKATHON_CPU_SECONDS`       | `30`    | Hard wall-clock cap, per `FR-HK-003`                 |
| `HACKATHON_MEMORY_MB`         | `256`   | Advisory cap, per `FR-HK-003`                        |
| `HACKATHON_DISALLOW_NETWORK`  | `true`  | Logged + forwarded to the runner; never executed in-fn |

## Credential pipeline

1. We pick the best score per student from the live
   `hackathon_submissions` window.
2. We insert a `verifiable_credentials` row (snapshot fields filled
   from the submission) and a `hackathon_credentials` row whose
   `vc_id` points at it.
3. We fire a best-effort POST to `credential-vc-issue` so the W3C
   envelope gets signed. Failures are logged but do not block the
   badge.

## Idempotency

Re-invoking the function for the same `submission_id`:

- Returns the cached score without re-grading if `score IS NOT NULL`.
- Skips re-inserting a credential row if one already exists for
  `(hackathon_id, student_id, kind)`.

This means a queue worker can retry freely.

## Local dev

```sh
npx supabase functions serve hackathon-grader --env-file ./supabase/.env.local
curl -X POST http://localhost:54321/functions/v1/hackathon-grader \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -d '{ "submission_id": "..." }'
```
