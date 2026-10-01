#!/usr/bin/env bash
# Nightly backup of the Abrican ERP database + uploaded files.
# Writes a compressed, restorable DB dump and a tar of the storage volume, then
# prunes anything older than RETENTION_DAYS. Intended to be run from cron.
#
#   sudo BACKUP_DIR=/var/backups/abrican /opt/abrican/deploy/backup.sh
#
# Restore the DB:
#   docker compose ... exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
#     --clean --if-exists < db_YYYY-MM-DD_HHMM.dump
set -euo pipefail

# Repo root = parent of this script's directory.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/abrican}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%F_%H%M)"

# Read POSTGRES_USER / POSTGRES_DB without executing the env file: it is a
# Compose env file, not a shell script (e.g. `ADMIN_NAME=System Administrator`
# or a secret containing `$`/`&` would break or abort a `source`).
env_get() {
  { grep -E "^$1=" "$ENV_FILE" || true; } | tail -n1 | cut -d= -f2- | sed -E "s/^[\"']//; s/[\"']$//"
}
POSTGRES_USER="$(env_get POSTGRES_USER)"
POSTGRES_DB="$(env_get POSTGRES_DB)"
: "${POSTGRES_USER:?POSTGRES_USER not set in $ENV_FILE}"
: "${POSTGRES_DB:?POSTGRES_DB not set in $ENV_FILE}"

COMPOSE="docker compose -f docker-compose.prod.yml -f deploy/docker-compose.tls.yml --env-file $ENV_FILE"

mkdir -p "$BACKUP_DIR"

# 1) Database — custom format (compressed, restorable with pg_restore).
$COMPOSE exec -T db pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" \
  > "$BACKUP_DIR/db_${STAMP}.dump"

# 2) Uploaded files (receipts, invoice PDFs) from the backend_storage volume.
$COMPOSE exec -T backend tar -czf - -C /app storage \
  > "$BACKUP_DIR/storage_${STAMP}.tgz"

# 3) Retention — delete old backups.
find "$BACKUP_DIR" -name 'db_*.dump'      -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'storage_*.tgz'  -mtime +"$RETENTION_DAYS" -delete

echo "$(date -Is) backup complete: $BACKUP_DIR/db_${STAMP}.dump, storage_${STAMP}.tgz"
