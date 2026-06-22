#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

# Seeding is idempotent (per-section guards) and always creates the RBAC
# catalogue + admin user. Set SEED_ON_START=false to skip it (e.g. once a
# production database is established and you don't want demo data re-checked).
SEED_ON_START="${SEED_ON_START:-true}"

if [ "$NODE_ENV" = "production" ]; then
  if [ "$SEED_ON_START" = "true" ]; then
    echo "Seeding database (compiled seed)..."
    node dist-seed/seed.js
  else
    echo "Skipping seed (SEED_ON_START=$SEED_ON_START)."
  fi
  echo "Starting Nest application (production)..."
  exec node dist/main
else
  if [ "$SEED_ON_START" = "true" ]; then
    echo "Seeding database..."
    npx prisma db seed
  fi
  echo "Starting Nest application (development, watch mode)..."
  exec npm run start:dev
fi
