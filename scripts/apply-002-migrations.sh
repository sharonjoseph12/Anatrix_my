#!/usr/bin/env bash
# scripts/apply-002-migrations.sh
# Applies 002-specific migrations in the correct order on top of an existing
# 001-baseline database. Use when you want to upgrade the base project without
# running the full db push.
#
# Usage:
#   SUPABASE_DB_URL=postgres://... bash scripts/apply-002-migrations.sh
#   # or with psql env vars:
#   PGHOST=… PGUSER=… PGPASSWORD=… PGDATABASE=… bash scripts/apply-002-migrations.sh

set -euo pipefail
MIGRATIONS=(
  "020_whatsapp.sql"
  "021_predictions.sql"
  "022_credentials.sql"
  "023_applications.sql"
  "024_extension_telemetry.sql"
  "025_privacy.sql"
  "026_user_deltas.sql"
  "027_rls_policies_002.sql"
  "028_nudge_prefs_default.sql"   # optional; the trigger is also in 026
  "029_cron_002.sql"
  "030_nudge_events.sql"
  "031_power_mode_helper.sql"
)

cd "$(dirname "$0")/../supabase/migrations"

for f in "${MIGRATIONS[@]}"; do
  echo "→ applying $f"
  psql "${SUPABASE_DB_URL:-}" -v ON_ERROR_STOP=1 -f "$f" || {
    echo "✗ failed at $f" >&2
    exit 1
  }
done
echo "✓ 002 migrations applied"
