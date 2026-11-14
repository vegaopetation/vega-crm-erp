#!/usr/bin/env bash
set -euo pipefail
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Install Docker Engine first (see ORACLE_DEPLOY.md)."
  exit 1
fi
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env. Edit it and set Supabase URL and anon key, then rerun this script."
  exit 0
fi
docker compose up -d --build
docker compose ps
