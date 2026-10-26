#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL in the environment; do not put credentials in shell history}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/hotel-platform-$STAMP.archive.gz"
umask 077
mongodump --uri="$DATABASE_URL" --archive="$BACKUP_FILE" --gzip
chmod 600 "$BACKUP_FILE"
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
chmod 600 "$BACKUP_FILE.sha256"
printf 'Backup created: %s\n' "$BACKUP_FILE"
printf 'Store the archive and checksum in encrypted, access-controlled storage outside the application host. Test restoration regularly.\n'
