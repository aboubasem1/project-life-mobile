#!/bin/sh
set -eu

schedule=${BACKUP_CRON:-15 3 * * *}
case "$schedule" in
  *"\n"*|*"\r"*)
    echo "BACKUP_CRON contains an invalid newline." >&2
    exit 1
    ;;
esac

printf '%s /usr/local/bin/backup-database.sh >> /proc/1/fd/1 2>> /proc/1/fd/2\n' "$schedule" > /etc/crontabs/root

if [ "${BACKUP_RUN_ON_START:-false}" = "true" ]; then
  /usr/local/bin/backup-database.sh || echo "Initial database backup failed; cron will retry." >&2
fi

exec crond -f -l 2

