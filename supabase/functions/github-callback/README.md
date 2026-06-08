# GitHub OAuth Callback

Edge Function that completes the GitHub OAuth flow for Antarix.

## Flow

1. User clicks "Connect GitHub" in the web app
2. Supabase Auth redirects to GitHub OAuth with `state=<user_id>`
3. GitHub redirects back to this function with `?code=...&state=...`
4. We exchange the code for an access token
5. We fetch the user's GitHub profile
6. We store the connection in `github_accounts`
7. We invoke `github-sync` to fetch initial commit history

## Required secrets

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SUPABASE_URL` (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

## Local development

```bash
npx supabase functions serve github-callback --no-verify-jwt
```

In another terminal:

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/github-callback?code=TEST_CODE&state=USER_ID'
```

## Production

```bash
npx supabase functions deploy github-callback
npx supabase secrets set GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=xxx
```
