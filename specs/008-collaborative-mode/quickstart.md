# Quickstart: 008 — Collaborative Mode

**Date**: 2026-06-07
**Prereqs**: 001-007 quickstarts already executed. PostgreSQL 15+, Supabase CLI, pnpm 9+.

## 1. New environment variables

Add to `.env.local` (and document in `.env.local.example`):

```env
# Liveblocks (Y.js relay + presence)
LIVEBLOCKS_SECRET_KEY=sk_dev_xxxxxxxxxxxxxxxxxxxxxxxx
LIVEBLOCKS_PUBLIC_KEY=pk_dev_xxxxxxxxxxxxxxxxxxxxxxxx
LIVEBLOCKS_API_BASE=https://api.liveblocks.io/v2
LIVEBLOCKS_MAU_LIMIT=1000                 # free tier; raise to 'paid' for production

# LiveKit (voice/video)
LIVEKIT_API_KEY=APIxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LIVEKIT_WS_URL=wss://antarix-collab-xxxxx.livekit.cloud

# WebContainer (browser sandbox)
WEBCONTAINER_ORIGIN=https://stackblitz.com   # StackBlitz CDN; can be self-hosted in v2

# Remote Firecracker sandbox (Fly.io)
SANDBOX_VM_PROVIDER=fly
FLY_API_TOKEN=Flyxxxxxxxxxxxx
FLY_REGION_PRIMARY=ap-south-1
FLY_REGION_SECONDARY=ap-southeast-1
SANDBOX_VM_IMAGE=antarix/sandbox-firecracker:latest
SANDBOX_VM_CPU=1                              # vCPU per microVM
SANDBOX_VM_MEMORY_MB=512                      # MB per microVM
SANDBOX_VM_DISK_MB=2048                        # MB rootfs per microVM
SANDBOX_VM_BOOT_TIMEOUT_MS=8000

# Test-run caps
COLLAB_TEST_RUN_CPU_SECONDS=30
COLLAB_TEST_RUN_MEMORY_MB=256
COLLAB_TEST_RUN_NETWORK_ENABLED=false          # default OFF (FR-025/026)

# Room limits
COLLAB_ROOM_MIN_PARTICIPANTS=2
COLLAB_ROOM_MAX_PARTICIPANTS=4
COLLAB_ROOM_MAX_OBSERVERS=2
COLLAB_ROOM_DURATION_MIN_MINUTES=30
COLLAB_ROOM_DURATION_MAX_MINUTES=120
COLLAB_ROOM_DEFAULT_DURATION_MINUTES=60

# Y.js snapshot cadence
COLLAB_SNAPSHOT_INTERVAL_SECONDS=300           # 5 minutes

# Teamwork scoring
TEAMWORK_SCORER_VERSION=1
TEAMWORK_SCORER_WEIGHTS_JSON={"turn_taking":0.25,"code_balance":0.35,"conflict_resolution":0.20,"help_events":0.20}
TEAMWORK_SKILL_PROOF_CONTRIBUTION_CAP_PCT=5   # 5% cap (FR-013)

# Anti-collusion
COLLAB_TYPING_DIVERGENCE_THRESHOLD=0.65
COLLAB_TYPING_DIVERGENCE_WINDOW_SECONDS=60
COLLAB_COACH_BLOCK_DURING_DIVERGENCE=true     # FR-017

# Recording retention
COLLAB_RECORDING_RETENTION_DAYS=90
COLLAB_RECORDING_PURGE_CRON_HOUR=3             # 3 AM UTC nightly
COLLAB_RECORDING_BANDWIDTH_GB_PER_MONTH=500   # hard cap; over-cap = pause new recordings

# Per-student opt-out default
COLLAB_OPT_OUT_DEFAULT=false                  # FR-018
```

## 2. Migrations (run in order)

```bash
pnpm supabase db push       # applies 047_collab.sql in sequence
```

The migration is **idempotent** — re-applying is a no-op. If the brief's stated number `041` conflicts with the live ledger (which has `047_webhooks.sql` from 005), rename to `043_collab.sql` and update `data-model.md` §"Migration `047_collab.sql`" header. See `plan.md` §1 for the reconciliation rule.

## 3. New Edge Functions to deploy

```bash
pnpm supabase functions deploy collab-room-create
pnpm supabase functions deploy collab-room-end
pnpm supabase functions deploy collab-typing-divergence
pnpm supabase functions deploy teamwork-scorer
pnpm supabase functions deploy collab-recording-purge   # nightly cron
```

Each function uses the secret bundle declared in step 1. Verify with `pnpm supabase functions list`.

## 4. Liveblocks setup (one-time)

1. Create a Liveblocks account at https://liveblocks.io.
2. Create a project (region: ap-south-1 or nearest to primary cohort).
3. Copy the secret key → `LIVEBLOCKS_SECRET_KEY`. Copy the public key → `LIVEBLOCKS_PUBLIC_KEY`.
4. In the Liveblocks dashboard, set the project's allowed origins to `http://localhost:3000` (dev) and your staging + production hosts.
5. (Production only) Upgrade to the paid tier; set `LIVEBLOCKS_MAU_LIMIT=10000` to match the platform's expected collab MAU.

## 5. LiveKit setup (one-time)

1. Create a LiveKit Cloud account at https://cloud.livekit.io.
2. Create a new project; copy the API key + secret to `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET`.
3. Copy the WebSocket URL to `LIVEKIT_WS_URL`.
4. (Production only) Configure SIP ingress for outbound recruiter voice (v2 — not in v1).
5. Set per-room publisher limit to 4 (matches FR-001).

## 6. WebContainer setup

WebContainer runs entirely in the browser; no server setup. The COOP/COEP headers are set at the collab route layout level (see `apps/web/src/app/(student)/collab/layout.tsx`).

The `apps/web/public/sandbox/` directory is populated by the boot script (see step 9).

## 7. Fly.io Firecracker sandbox (one-time)

1. Install `flyctl`: `curl -L https://fly.io/install.sh | sh`.
2. Create the sandbox app: `fly apps create antarix-sandbox-ap-south-1`.
3. Build and push the image (uses the Dockerfile in `apps/sandbox-firecracker/`):
   ```bash
   cd apps/sandbox-firecracker
   fly deploy --region ap-south-1
   ```
4. Repeat for the secondary region: `fly deploy --region ap-southeast-1 --app antarix-sandbox-ap-southeast-1`.
5. Set the Fly.io API token: `fly auth token` → `FLY_API_TOKEN`.
6. Test: `curl https://antarix-sandbox-ap-south-1.fly.dev/healthz` should return `{"ok":true,"vm_pool":4}`.

## 8. Sandbox boot script

`apps/web/scripts/build-sandbox-assets.sh` (run on `pnpm dev` startup or pre-build):

```bash
#!/usr/bin/env bash
# Build static assets that the browser-side WebContainer boots with.
# Output: apps/web/public/sandbox/

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../public/sandbox"
mkdir -p "$OUT_DIR"

# Bundled runtimes: minimal package.json + lockfile for npm; pip-freeze for Python.
# In a real deploy, this is a one-time pre-bake from a checked-in artifact.

cat > "$OUT_DIR/package.json" <<'EOF'
{
  "name": "antarix-collab-workspace",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node ./test-runner.mjs"
  }
}
EOF

cat > "$OUT_DIR/test-runner.mjs" <<'EOF'
// Minimal test-runner stub. Real implementation runs the user's test files
// against the WebContainer FS. The stub is here only so the boot script
// can verify the WebContainer can spawn `npm test`.
console.log("test-runner stub: no tests defined");
process.exit(0);
EOF

echo "Sandbox assets built to $OUT_DIR"
```

## 9. Local dev with Liveblocks dev mode

Liveblocks has a "dev mode" that disables auth for localhost development:

1. Set `LIVEBLOCKS_SECRET_KEY=sk_dev_local_dev_mode` in `.env.local`.
2. The `liveblocks.ts` client checks for the `sk_dev_` prefix; if present, it skips the JWT mint and uses a public dev token.
3. (Production) Remove the dev prefix; the client mints a real JWT via `/api/collab/rooms/[id]/join`.

Test flow:
```bash
pnpm dev
# Open two browser windows at http://localhost:3000/collab/room/{id}
# Type in window 1; observe the same text in window 2.
```

## 10. Feature flags (recommended rollout)

Behind feature flags from day 1 (use the existing `feature_flags` table from 003):

| Flag | Default | Rollout |
|---|---|---|
| `008_collab_rooms` | OFF | Day 0 cohort (10% of students) |
| `008_collab_javascript` | OFF | Day 7 cohort (50% of students) |
| `008_collab_python` | OFF | Day 7 cohort |
| `008_collab_go_rust` | OFF | Day 14 cohort (Firecracker route) |
| `008_teamwork_scorer` | OFF | Day 14 cohort |
| `008_anti_collusion` | OFF | Day 21 cohort (after 100 hand-labelled sessions) |
| `008_collab_opt_out_ui` | OFF | Day 0 (toggle is harmless even without scoring) |
| `008_recruiter_observe` | OFF | Day 30 invited recruiters only |
| `008_collab_liveblocks_paid` | OFF | Flip when MAU > 1K |
| `008_collab_recordings` | OFF | Day 30 (bandwidth cost) |

## 11. Smoke tests

```bash
pnpm test                                          # unit
pnpm test:e2e -- --grep "collab"                   # E2E
pnpm test:e2e -- --grep "collab-room"              # room create + join + edit
pnpm test:e2e -- --grep "collab-test-run"          # test-run roundtrip
pnpm test:e2e -- --grep "collab-teamwork"          # scorer
pnpm test:e2e -- --grep "collab-opt-out"           # privacy toggle
pnpm test:e2e -- --grep "collab-anti-collusion"    # typing divergence
pnpm test:e2e -- --grep "collab-recruiter"         # observe + review
pnpm test:e2e -- --grep "collab-consent"           # consent grant + revoke
```

## 12. Observability

- **Rooms live now**: `SELECT * FROM collab_rooms WHERE status='live' ORDER BY created_at DESC;`
- **Score distribution**: `SELECT score, count(*) FROM teamwork_scores WHERE computed_at > now() - interval '7 days' GROUP BY score ORDER BY score;`
- **Anti-collusion signals**: `SELECT * FROM anticheat_signals WHERE signal='collab_typing_divergence' AND detected_at > now() - interval '7 days';`
- **Sandbox egress attempts**: `SELECT count(*) FROM collab_events WHERE event_type='sandbox_egress_blocked' AND created_at > now() - interval '7 days';`
- **Consent revocations**: `SELECT * FROM collab_audit WHERE action='consent_revoked' AND created_at > now() - interval '7 days';`
- **Recording bandwidth**: LiveKit Cloud dashboard; alert at 80% of `COLLAB_RECORDING_BANDWIDTH_GB_PER_MONTH`.

## 13. COOP/COEP header verification

WebContainer requires:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These are set on the collab route layout only (see `apps/web/src/app/(student)/collab/layout.tsx`). Verify:
```bash
curl -I http://localhost:3000/collab/room/test-id 2>&1 | grep -i cross-origin
```
Expected: both headers present.

## 14. Rollback

The migration is pure additive (`CREATE TABLE` + `ALTER TABLE ADD COLUMN` + `ALTER TABLE DROP CONSTRAINT` + `ALTER TABLE ADD CONSTRAINT`). To roll back:
```bash
pnpm supabase migration repair --status reverted 041
# then re-apply the corresponding DROP statements (held in supabase/migrations/_rollback/008/)
```

Feature flags allow logical rollback without DB migration reversal. Liveblocks + LiveKit subscriptions are independent of the DB; cancel via their dashboards if needed.

## 15. First-time deploy checklist

- [ ] `pnpm supabase db push` succeeds
- [ ] `pnpm supabase functions deploy collab-room-create collab-room-end collab-typing-divergence teamwork-scorer collab-recording-purge` succeeds
- [ ] `fly deploy --region ap-south-1` succeeds (Firecracker)
- [ ] `fly deploy --region ap-southeast-1 --app antarix-sandbox-ap-southeast-1` succeeds
- [ ] `curl -I http://localhost:3000/collab/room/test-id` shows COOP/COEP headers
- [ ] `pnpm test` all green
- [ ] `pnpm test:e2e -- --grep "collab"` all green
- [ ] Feature flags `008_collab_rooms` set to OFF in production
- [ ] Liveblocks + LiveKit accounts configured
- [ ] Dashboard alerts configured for: score distribution drift, anti-collusion false-positive rate, recording bandwidth cap
