# docs/credential-system.md
# How the verifiable credential system works end-to-end (US5 / T065-T075).
# This is the single source of truth for "what does it mean to have a
# credential?" — the public surface, the storage, and the snapshot rules.

## Public surface
- A student gets a **public URL**: `https://antarix.app/verify/{slug}`
- The slug is generated when the first snapshot is taken, and never changes.
- Anyone with the URL can view the verification card; **no auth required**.

## What's on the card
- Student name + avatar
- Skill Proof Score (snapshot value, not live)
- Cohort percentile
- Snapshot taken date
- Current score delta (`live - snapshot`)
- Revocation status (active / revoked)
- Verification count + last verified timestamp

## Storage (`verifiable_credentials` table)
- `public_slug` — UNIQUE, used in the URL
- `snapshot_overall_score`, `snapshot_per_skill`, `snapshot_verified_activity`, `snapshot_cohort_percentile`
- `snapshot_taken_at`
- `revocation_status` — `active` or `revoked`; flipped on account deletion via `025_privacy.sql` trigger
- `verification_count`, `last_verified_at` — bumped by `supabase/functions/credential-public`

## Snapshot refresh rules
- The first snapshot is issued when `candidate_profiles` has enough signal to be meaningful.
- A **refresh** only happens when `abs(current_score - snapshot_score) >= CREDENTIAL_SNAPSHOT_REFRESH_DELTA` (default 3, per `spec.md` A-014).
- Both upward and downward deltas trigger a refresh; the absolute value is the rule.
- Refresh is run by `supabase/functions/credential-issue` (cron daily 04:00 UTC) or on-demand via `?user_id=…`.

## Distribution channels (`credential_distributions` table)
- `pdf` — generates a signed PDF with the verification card
- `qr` — generates a QR PNG pointing at the public URL
- `linkedin` — returns a LinkedIn share intent URL
- `twitter` — Twitter share intent
- `email` — sends a plain-text email (not implemented; the slot exists)
- All rows are upserted on `(credential_id, channel)` so re-sharing is idempotent.

## Revocation
- `users.deletion_requested_at` is set → `025_privacy.sql` trigger flips `revocation_status = 'revoked'` and stamps `revoked_at = now()` within 24 hours.
- The public page shows a red "Revoked" badge in that case.
- Recruiter search and the AI Coach stop referencing the credential immediately (they check `revocation_status = 'active'`).

## Edge cases
- A student with score 0 still gets a credential once they have any activity — the URL proves "they used Antarix" even if the score is low.
- If the `WHATSAPP_COST_GUARD_WEEKLY_MESSAGES_PER_STUDENT` env is changed, the next scheduled credential-issue run picks it up.
- A recruiter search that includes a revoked credential in the snapshot should not display it; we filter at the API layer.

## Related code
- `supabase/functions/credential-issue/index.ts`
- `supabase/functions/credential-public/index.ts`
- `supabase/functions/credential-distribute/index.ts`
- `apps/web/src/app/verify/[slug]/page.tsx`
- `apps/web/src/app/(student)/credential/page.tsx`
- Migration: `022_credentials.sql`
- Trigger: `025_privacy.sql` (revocation on deletion)
- Cron: `029_cron_002.sql`
