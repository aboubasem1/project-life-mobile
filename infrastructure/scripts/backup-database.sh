#!/bin/sh
set -eu

for variable in PGHOST PGUSER PGPASSWORD PGDATABASE R2_ENDPOINT R2_BUCKET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
  value=$(printenv "$variable" 2>/dev/null || true)
  if [ -z "$value" ]; then
    echo "$variable is required for database backups." >&2
    exit 1
  fi
done

umask 077
backup_tmp=$(mktemp -d)
trap 'rm -rf -- "$backup_tmp"' EXIT HUP INT TERM

timestamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
backup_file="$backup_tmp/lifeos-$timestamp.dump"

pg_dump \
  --host "$PGHOST" \
  --port "${PGPORT:-5432}" \
  --username "$PGUSER" \
  --dbname "$PGDATABASE" \
  --format custom \
  --compress 9 \
  --no-owner \
  --no-privileges \
  --file "$backup_file"

aws_r2() {
  aws --endpoint-url "$R2_ENDPOINT" "$@"
}

upload_copy() {
  prefix=$1
  aws_r2 s3 cp "$backup_file" "s3://$R2_BUCKET/backups/database/$prefix/lifeos-$timestamp.dump" --only-show-errors
}

prune_prefix() {
  prefix=$1
  keep=$2
  object_prefix="backups/database/$prefix/"
  keys=$(aws_r2 s3api list-objects-v2 \
    --bucket "$R2_BUCKET" \
    --prefix "$object_prefix" \
    --query 'sort_by(Contents,&LastModified)[].Key' \
    --output text 2>/dev/null || true)
  [ -n "$keys" ] && [ "$keys" != "None" ] || return 0

  key_file="$backup_tmp/$prefix-keys"
  printf '%s\n' "$keys" | tr '\t' '\n' | sed '/^$/d;/^None$/d' > "$key_file"
  count=$(wc -l < "$key_file" | tr -d ' ')
  remove=$((count - keep))
  [ "$remove" -gt 0 ] || return 0

  head -n "$remove" "$key_file" | while IFS= read -r key; do
    case "$key" in
      "$object_prefix"*) aws_r2 s3 rm "s3://$R2_BUCKET/$key" --only-show-errors ;;
      *) echo "Refusing to prune unexpected R2 key." >&2; exit 1 ;;
    esac
  done
}

upload_copy daily

day_of_week=$(date -u +%u)
day_of_month=$(date -u +%d)
if [ "$day_of_week" = "7" ]; then upload_copy weekly; fi
if [ "$day_of_month" = "01" ]; then upload_copy monthly; fi

prune_prefix daily 7
prune_prefix weekly 4
prune_prefix monthly 3

echo "Database backup completed: $timestamp"
