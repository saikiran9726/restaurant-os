#!/bin/sh
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/hub_backup_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting Local Hub automated PostgreSQL database backup..."
mkdir -p "${BACKUP_DIR}"

# Run pg_dump and gzip
pg_dump -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" --clean --if-exists | gzip > "${BACKUP_FILE}"

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"

# Prune old backups older than retention window
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "hub_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -exec rm -f {} +
echo "[$(date)] Backup rotation completed."
