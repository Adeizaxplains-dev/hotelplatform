#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL for the intended restore target}"
: "${BACKUP_FILE:?Set BACKUP_FILE to the archive to restore}"
if [[ "${CONFIRM_RESTORE:-}" != "YES_I_HAVE_VERIFIED_THE_TARGET" ]]; then
  echo "Refusing restore. Verify the target and backup, then set CONFIRM_RESTORE=YES_I_HAVE_VERIFIED_THE_TARGET." >&2
  exit 2
fi
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file does not exist." >&2
  exit 2
fi
if [[ -f "$BACKUP_FILE.sha256" ]]; then
  sha256sum -c "$BACKUP_FILE.sha256"
else
  echo "WARNING: no adjacent checksum file; restore integrity has not been verified." >&2
fi
printf 'This operation replaces matching collections in the target database. Proceeding because explicit confirmation was supplied.\n'
mongorestore --uri="$DATABASE_URL" --archive="$BACKUP_FILE" --gzip --drop
