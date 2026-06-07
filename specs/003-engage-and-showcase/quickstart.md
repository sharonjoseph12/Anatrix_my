# Quickstart: Engage & Showcase

**Phase 1 output** for `003-engage-and-showcase`. Run on top of the 001 + 002 quickstart.

## New environment variables

Add to `.env.local` (and to your hosting provider's secret store):

```env
# LeetCode (no auth required for v1; documented in research D1)
LEETCODE_API_URL=https://leetcode.com/graphql

# HackerRank (no auth required for v1; documented in research D2)
HACKERRANK_API_URL=https://www.hackerrank.com/rest/hackers

# Discord bot (https://discord.com/developers/applications)
DISCORD_BOT_TOKEN=<bot-token>
DISCORD_CLIENT_ID=<oauth-client-id>
DISCORD_CLIENT_SECRET=<oauth-client-secret>
DISCORD_REDIRECT_URI=http://localhost:3000/api/channels/discord/callback

# Telegram bot (https://t.me/BotFather)
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_BOT_USERNAME=<bot-username-without-@>
TELEGRAM_WEBHOOK_SECRET=<random-32-char-string>

# WhatsApp Business (paid channel; reused from 002)
WHATSAPP_API_URL=<meta-or-twilio-endpoint>
WHATSAPP_API_TOKEN=<api-token>
WHATSAPP_PHONE_NUMBER_ID=<phone-number-id>
```

## New migrations

Apply in order (Supabase CLI picks them up automatically):

```bash
npx supabase db push
```

- `017_dsa_profiles.sql` — `user_dsa_profiles`, `slug_redirects`, plus the `before update` trigger for slug history.
- `018_external_channels.sql` — `external_channel_handles`, `institution_nudge_settings`.
- `019_nudge_preferences_ext.sql` — adds `channel_priority` and `whatsapp_premium_opt_in` to `nudge_preferences`.

## New Edge Functions

```bash
npx supabase functions deploy dsa-sync
npx supabase functions deploy nudge-dispatch-extended
npx supabase functions deploy bot-webhook
```

- `dsa-sync` — accepts `{ user_id, platform, full_sync? }`; pulls LeetCode/HackerRank; upserts `user_dsa_profiles`. Idempotent.
- `nudge-dispatch-extended` — extends the 002 `nudge-dispatch`; calls `pickChannel()` and dispatches to the chosen platform. Honors quiet hours and exam windows.
- `bot-webhook` — handles inbound events from Discord and Telegram; verifies signatures; updates `external_channel_handles.verified_at`.

## New cron jobs

```sql
-- Append to 012_cron_jobs.sql
select cron.schedule('dsa-sync-6h', '0 */6 * * *', $$
  select net.http_post(
    url := current_setting('app.functions_url') || '/dsa-sync',
    body := json_build_object('sweep', true)::text
  );
$$);
```

## Local dev recipe

```bash
# Start Supabase and apply migrations
npx supabase start
npx supabase db push

# Serve edge functions
npx supabase functions serve

# Expose a public URL for bot webhooks (in a separate terminal)
ngrok http 54321
# Copy the https URL into:
#   - Discord developer portal → OAuth2 → Redirects
#   - Telegram @BotFather → /setwebhook → <ngrok-url>/functions/v1/bot-webhook
```

## Smoke test

```bash
# 1. Sign up, complete onboarding, paste a LeetCode username.
# 2. Trigger a manual sync:
curl -X POST http://localhost:54321/functions/v1/dsa-sync \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"platform":"leetcode","full_sync":true}'

# 3. Visit /dashboard/skills and confirm a "DSA" category card appears.

# 4. Visit /settings/profile-visibility, claim a slug, set visibility to public.
# 5. Open http://localhost:3000/<your-slug> in an incognito window.

# 6. Visit /settings/notifications, click "Add to Discord" (or Telegram).
# 7. Confirm the bot DM, then trigger a test nudge:
curl -X POST http://localhost:54321/functions/v1/nudge-dispatch-extended \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid>","kind":"test","title":"hello","body":"from curl"}'
```

## Rollback

Each migration is additive and idempotent. To roll back:

```bash
# 1. Drop the new tables
psql "$DATABASE_URL" <<'SQL'
drop table if exists public.institution_nudge_settings cascade;
drop table if exists public.external_channel_handles cascade;
drop table if exists public.slug_redirects cascade;
drop table if exists public.user_dsa_profiles cascade;
SQL

# 2. Drop the columns from nudge_preferences
psql "$DATABASE_URL" <<'SQL'
alter table public.nudge_preferences
  drop column if exists channel_priority,
  drop column if exists whatsapp_premium_opt_in;
SQL

# 3. Undeploy the edge functions
npx supabase functions delete dsa-sync
npx supabase functions delete nudge-dispatch-extended
npx supabase functions delete bot-webhook
```
