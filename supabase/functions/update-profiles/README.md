# Update Profiles

Edge Function that rebuilds `user_skills` rows and re-aggregates
`candidate_profiles` for every user with activity in the last 24 hours.
Invoked daily via pg_cron so the dashboard's score, ranking, and recruiter
search results stay current without manual recompute.

## Required env

- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto)

## Required SQL helpers

The function depends on the following PL/pgSQL helpers (already in
`migrations/011_functions.sql` plus a new helper added in
`migrations/012_cron_jobs.sql`):

- `public.recalculate_user_skill(p_user_id uuid, p_skill_id uuid)` — single row
- `public.recalculate_candidate_profile(p_user_id uuid)` — full aggregate
- `public.rebuild_user_skills(p_user_id uuid)` — returns the set of
  `(skill_id, hours_logged, skill_proof_score)` rows that the function should
  refresh (derived from recent sessions + github repos).

## Local development

```bash
npx supabase functions serve update-profiles --no-verify-jwt
```

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/update-profiles' \
  -H 'Authorization: Bearer <service_role_key>' \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000"}'
```

## Production

```bash
npx supabase functions deploy update-profiles
```
