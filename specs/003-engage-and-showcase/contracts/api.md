# API Contracts: Engage & Showcase

**Phase 1 output** for `003-engage-and-showcase`. New HTTP endpoints.

All endpoints are Next.js route handlers under `apps/web/src/app/api/` unless otherwise noted. Auth is the standard Supabase session cookie (`getUser()` server-side). Service-role calls from edge functions use the bearer token in the `Authorization` header.

## DSA

### `POST /api/dsa/connect`

Link a LeetCode or HackerRank username. Stores the connection and queues an initial sync.

**Request body**:
```json
{ "platform": "leetcode", "username": "sharon-dave" }
```

**Response 200**:
```json
{ "ok": true, "profile": { "platform": "leetcode", "username": "sharon-dave", "sync_status": "pending" } }
```

**Errors**:
- `400` — invalid platform or username format.
- `401` — not signed in.
- `409` — platform already connected (re-call with `force: true` to replace).

### `POST /api/dsa/sync`

Manually trigger a sync (rate-limited to 1/minute).

**Request body**:
```json
{ "platform": "leetcode" }
```

**Response 200**:
```json
{ "ok": true, "synced": { "easy_solved": 12, "medium_solved": 34, "hard_solved": 5, "contest_rating": 1823, "streak_days": 17 } }
```

## Public profile

### `GET /[slug]`

Public profile page. Served via middleware rewrite from `/[slug]` → `/u/[slug]`.

**Response 200**: HTML page (ISR, `revalidate=300`).

**Response 404**: HTML "this profile doesn't exist" page.

**Response 200 (private)**: HTML "this profile is private" page (`noindex`).

### `GET /api/public-profile/[slug]`

JSON endpoint for OG image generators, embed widgets, and verification.

**Response 200**:
```json
{
  "slug": "sharon-dave",
  "user": { "display_name": "Sharon Dave", "avatar_url": "https://..." },
  "verified": true,
  "overall_score": 86,
  "specialization": "Backend Systems",
  "top_skills": [
    { "name": "PostgreSQL", "proficiency": "expert", "score": 92 },
    { "name": "Go",         "proficiency": "advanced", "score": 81 }
  ],
  "credentials": [{ "id": "uuid", "title": "Verified Backend", "issued_at": "2026-04-12" }],
  "is_open_to_opportunities": true,
  "scheduling_url": "https://antarix.app/company-signup?ref=sharon-dave"
}
```

**Errors**:
- `404` — slug not found.
- `403` — profile is private.

## Channels

### `POST /api/channels/connect`

Initiate a channel connect. Returns either an OAuth URL (Discord) or a deep link + one-time token (Telegram).

**Request body**:
```json
{ "channel": "discord" }
```

**Response 200**:
```json
{ "ok": true, "kind": "oauth", "url": "https://discord.com/oauth2/authorize?client_id=...&state=...&scope=bot+dm_channels.read" }
```

or

```json
{ "ok": true, "kind": "deep_link", "url": "https://t.me/antarix_bot?start=<token>", "token_expires_at": "2026-06-04T18:33:00Z" }
```

### `GET /api/channels/discord/callback`

OAuth callback for Discord. Exchanges the code, stores the `platform_id` and `dm_channel_id`, marks the channel verified, redirects to `/settings/notifications?connected=discord`.

### `POST /api/channels/verify`

Send a test message to the chosen channel. Used to confirm the bot can reach the user.

**Request body**:
```json
{ "channel": "telegram" }
```

**Response 200**:
```json
{ "ok": true, "delivered": true }
```

### `POST /api/channels/disconnect`

Drop a channel connection.

**Request body**:
```json
{ "channel": "telegram" }
```

**Response 200**:
```json
{ "ok": true }
```

## Institution nudge settings

### `POST /api/institution-nudges`

Bulk-enable a channel for every student in an institution. Officer-only.

**Request body**:
```json
{ "institution_id": "uuid", "channel": "telegram", "expires_at": "2027-06-04" }
```

**Response 200**:
```json
{ "ok": true, "affected_students": 412 }
```

### `DELETE /api/institution-nudges`

Disable a previously bulk-enabled channel.

## Webhooks

### `POST /api/webhooks/discord`

Inbound from Discord. Verifies the `X-Signature-Ed25519` header against the bot's public key. Handles:
- `MESSAGE_CREATE` from a user who previously authorized — log interaction.
- `GUILD_MEMBER_REMOVE` — auto-disconnect.
- Interaction pings — return PONG.

### `POST /api/webhooks/telegram`

Inbound from Telegram. Verifies the `X-Telegram-Bot-Api-Secret-Token` header. Handles:
- `/start <token>` — verify the one-time token, store `chat_id` + `verified_at`.
- `/stop` — auto-disconnect.

## Edge function contracts (Deno)

### `dsa-sync`

**Request body**:
```json
{ "user_id": "uuid", "platform": "leetcode", "full_sync": false }
```

or

```json
{ "sweep": true }
```

**Response 200**:
```json
{ "ok": true, "synced": 12, "errors": 0 }
```

### `nudge-dispatch-extended`

**Request body**:
```json
{ "user_id": "uuid", "kind": "daily_morning", "title": "Good morning", "body": "Try 90 min on PostgreSQL", "href": "/dashboard/peak-self" }
```

**Response 200**:
```json
{ "ok": true, "delivered_to": "telegram", "delivered_at": "2026-06-04T04:00:01Z" }
```

or

```json
{ "ok": true, "delivered_to": "in_app", "delivered_at": "2026-06-04T04:00:01Z" }
```

or (suppressed)

```json
{ "ok": true, "delivered_to": null, "reason": "quiet_hours" }
```

### `bot-webhook`

POST endpoint used by Discord and Telegram. Signature verification is mandatory. Returns `200 {ok:true}` on success, `401` on signature failure, `400` on parse failure.
