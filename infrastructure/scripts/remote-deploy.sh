#!/bin/sh
set -eu

revision=${1:-}
deploy_root=${LIFEOS_DEPLOY_ROOT:-/opt/lifeos}

case "$revision" in
  *[!0-9a-f]*|'') echo "A full hexadecimal Git revision is required." >&2; exit 1 ;;
esac
[ "${#revision}" -eq 40 ] || { echo "Git revision must contain 40 characters." >&2; exit 1; }
case "$deploy_root" in
  /*) ;;
  *) echo "LIFEOS_DEPLOY_ROOT must be an absolute path." >&2; exit 1 ;;
esac
[ "$deploy_root" != "/" ] || { echo "LIFEOS_DEPLOY_ROOT cannot be the filesystem root." >&2; exit 1; }
case "$deploy_root" in
  *//*|*/../*|*/..|*/./*|*/.) echo "LIFEOS_DEPLOY_ROOT contains an unsafe path segment." >&2; exit 1 ;;
esac

incoming="$deploy_root/incoming/$revision.tar.gz"
releases="$deploy_root/releases"
shared_env="$deploy_root/shared/.env"
release="$releases/$revision"
current="$deploy_root/current"

mkdir -p "$deploy_root/incoming" "$releases" "$deploy_root/shared"
exec 9> "$deploy_root/deploy.lock"
flock -n 9 || { echo "Another LifeOS deployment is running." >&2; exit 1; }

if [ ! -f "$incoming" ]; then
  echo "Missing release archive: $incoming" >&2
  exit 1
fi

if tar -tzf "$incoming" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo "Release archive contains an unsafe path." >&2
  exit 1
fi

if [ ! -d "$release" ]; then
  release_tmp="$releases/.incoming-$revision"
  rm -rf -- "$release_tmp"
  mkdir -p "$release_tmp"
  tar -xzf "$incoming" -C "$release_tmp"
  mv "$release_tmp" "$release"
fi

if [ ! -f "$shared_env" ]; then
  LIFEOS_DEPLOY_ROOT="$deploy_root" sh "$release/infrastructure/scripts/init-secrets.sh"
  echo "Protected server environment created. Add R2 and existing integration secrets, then rerun deployment." >&2
  exit 1
fi

object_storage_secret=$(awk -F= '$1 == "OBJECT_STORAGE_SIGNING_SECRET" { sub(/^[^=]*=/, ""); print; exit }' "$shared_env")
if [ -z "$object_storage_secret" ]; then
  umask 077
  printf 'OBJECT_STORAGE_SIGNING_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$shared_env"
fi
unset object_storage_secret

for required_key in POSTGRES_PASSWORD OBJECT_STORAGE_SIGNING_SECRET; do
  required_value=$(awk -F= -v key="$required_key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$shared_env")
  if [ -z "$required_value" ]; then
    echo "$required_key is missing from the protected server environment." >&2
    exit 1
  fi
done

previous_release=''
previous_revision=''
if [ -L "$current" ]; then
  previous_release=$(readlink -f "$current" || true)
  previous_revision=$(basename "$previous_release")
fi

compose_release() {
  target_release=$1
  target_revision=$2
  shift 2
  LIFEOS_IMAGE_TAG="$target_revision" docker compose \
    --project-name lifeos \
    --env-file "$shared_env" \
    --file "$target_release/docker-compose.yml" \
    "$@"
}

rollback() {
  if [ -n "$previous_release" ] && [ -f "$previous_release/docker-compose.yml" ]; then
    echo "Healthcheck failed; restoring $previous_revision." >&2
    compose_release "$previous_release" "$previous_revision" up -d --remove-orphans
  else
    echo "Healthcheck failed and no earlier OVH release exists. Vercel remains untouched." >&2
  fi
}

compose_release "$release" "$revision" build --pull
compose_release "$release" "$revision" up -d --remove-orphans

healthy=false
attempt=1
while [ "$attempt" -le 30 ]; do
  if compose_release "$release" "$revision" exec -T api node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    && compose_release "$release" "$revision" exec -T web wget --quiet --tries=1 --spider http://127.0.0.1/healthz \
    && compose_release "$release" "$revision" exec -T db sh -c \
      'pg_isready --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" >/dev/null' \
    && compose_release "$release" "$revision" exec -T backup sh -c \
      'pg_isready --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" --dbname "$PGDATABASE" >/dev/null && test -d "$LOCAL_BACKUP_ROOT"'; then
    healthy=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 4
done

if [ "$healthy" != "true" ]; then
  compose_release "$release" "$revision" logs --tail 120 api web db >&2 || true
  rollback
  exit 1
fi

next_link="$deploy_root/.current-$revision"
rm -f "$next_link"
ln -s "$release" "$next_link"
mv -Tf "$next_link" "$current"
rm -f "$incoming"

echo "LifeOS deployment healthy at revision $revision."
