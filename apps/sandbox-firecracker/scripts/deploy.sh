#!/usr/bin/env bash
set -euo pipefail

app="${FLY_APP_NAME:-antarix-sandbox-ap-south-1}"
region="${FLY_REGION_PRIMARY:-bom}"

flyctl deploy --app "$app" --primary-region "$region" --config fly.toml
