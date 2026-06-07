# mock-interview-llm

Edge Function that powers the LLM half of the mock interview flow.

## Why a dedicated edge function?

`apps/web` cannot reach the LLM provider directly from the browser
without exposing the API key. The interview turn stream is also
long-lived, so we run it server-side and proxy the SSE to the
client. This function is the only call site that knows the LLM
provider, the API key, and the cost caps.

## Modes

The function is mode-dispatched on the request body:

| Body shape | Behaviour |
| ---------- | --------- |
| `{ interview_id, message }` | Persist the student turn, return `text/event-stream` of LLM deltas, persist the interviewer turn on completion. |
| `{ interview_id, complete: true }` | Ask the LLM to grade the full transcript on the rubric, persist to `mock_interviews.rubric`, set `status='completed'`, return JSON. |

## Cost caps (FR-MI-005)

Two caps are checked **before** every LLM call, not after:

- **Per-student weekly**: `SUM(tokens_used) FROM mock_interview_turns
  JOIN mock_interviews ON ... WHERE student_id = $student AND
  started_at > now() - interval '7 days'`. Default `50000` tokens
  (`MOCK_INTERVIEW_WEEKLY_TOKEN_CAP`).
- **Per-tenant monthly**: Same shape, scoped to the student's
  inferred institution (resolved via their first `cohort_members`
  row → `cohorts.institution_id`). If the student is in no
  institutional cohort the per-tenant cap is not enforced. Default
  `5_000_000` tokens (`MOCK_INTERVIEW_MONTHLY_TOKEN_CAP`).

Cap overage returns **402** with `weekly_token_cap_exceeded` /
`monthly_token_cap_exceeded` codes. We return 402 (not 429) so
clients can distinguish "rate limit" from "quota" for UX messaging.

## LLM provider

We hit the Groq OpenAI-compatible endpoint directly via `fetch()`:

```
POST https://api.groq.com/openai/v1/chat/completions
{
  "model": "llama-3.1-70b-versatile",
  "stream": true,
  "messages": [...]
}
```

**Why not the Groq SDK?** The Deno import map can't resolve
`groq-sdk` cleanly (its package depends on Node-style streaming
helpers), and we need full control over the SSE wire format. The
OpenAI-compatible endpoint is also the only contract we need, so
swapping providers is a one-config change. Set
`MOCK_INTERVIEW_PROVIDER=openai` and update
`MOCK_INTERVIEW_OPENAI_URL` / `MOCK_INTERVIEW_MODEL` to use OpenAI
or any OpenAI-compatible router.

## SSE plumbing

We use a `ReadableStream` whose `start()` method reads the upstream
SSE chunks, parses each `data: {...}` JSON line, and re-emits
`data: {delta}` events to the client. The terminal event is

```
data: {"done":true,"turn_id":"<uuid>","tokens_used":42}
```

followed by the convention `data: [DONE]`. EventSource clients
close the connection on `[DONE]`. We never log `MOCK_INTERVIEW_API_KEY`
or the full prompt contents.

## Auth

The call must carry a Supabase user JWT. The function re-checks
`mock_interviews.student_id == ctx.userId` so a token from student A
cannot submit turns to student B's interview (returns 403, not 404,
but with the same generic error string to avoid leaking existence).

## Endpoints

```
POST /functions/v1/mock-interview-llm
Content-Type: application/json
Authorization: Bearer <user-jwt>

# Turn:
{ "interview_id": "<uuid>", "message": "..." }
# Returns: text/event-stream

# Complete:
{ "interview_id": "<uuid>", "complete": true }
# Returns: { "ok": true, "rubric": {...}, "score_contribution": 4 }
```

## Env

| Variable                              | Default                       |
| ------------------------------------- | ----------------------------- |
| `MOCK_INTERVIEW_PROVIDER`             | `groq`                        |
| `MOCK_INTERVIEW_API_KEY`              | _(required)_                  |
| `MOCK_INTERVIEW_MODEL`                | `llama-3.1-70b-versatile` (Groq) / `gpt-4o-mini` (OpenAI) |
| `MOCK_INTERVIEW_WEEKLY_TOKEN_CAP`     | `50000`                       |
| `MOCK_INTERVIEW_MONTHLY_TOKEN_CAP`    | `5000000`                     |
| `MOCK_INTERVIEW_OPENAI_URL`           | `https://api.openai.com/v1/chat/completions` |

## Local dev

```sh
npx supabase functions serve mock-interview-llm --env-file ./supabase/.env.local
```
