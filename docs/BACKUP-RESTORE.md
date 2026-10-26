# MongoDB backup and restore

These scripts require MongoDB Database Tools (`mongodump`, `mongorestore`) and a `DATABASE_URL` supplied through the environment or secret manager.

## Backup

```bash
export DATABASE_URL='mongodb+srv://...'
BACKUP_DIR=/secure/backups ./scripts/backup-mongodb.sh
```

The script creates a gzip archive and SHA-256 checksum with restrictive local permissions. Move backups to encrypted, access-controlled storage outside the host. Protect the connection URI and do not paste it into tickets or logs.

## Restore

First restore to a separate test database and verify application behavior. The restore script uses `--drop`, which replaces matching collections in the target database. It refuses to run unless explicit confirmation is supplied:

```bash
export DATABASE_URL='mongodb+srv://.../hotel_platform_restore_test'
export BACKUP_FILE='/secure/backups/hotel-platform-YYYYMMDDTHHMMSSZ.archive.gz'
CONFIRM_RESTORE=YES_I_HAVE_VERIFIED_THE_TARGET ./scripts/restore-mongodb.sh
```

If a checksum file exists beside the archive, it is checked before restore. Do not restore to production without an approved incident/change plan and a second-person review of the target database.
