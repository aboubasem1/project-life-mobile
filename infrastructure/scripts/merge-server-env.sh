#!/bin/sh
set -eu

patch_file=${1:-}
env_file=${LIFEOS_ENV_FILE:-/opt/lifeos/shared/.env}

[ -n "$patch_file" ] || { echo "Encoded environment patch path is required." >&2; exit 1; }
[ -f "$patch_file" ] || { echo "Encoded environment patch is missing." >&2; exit 1; }
[ -f "$env_file" ] || { echo "Protected server environment is missing." >&2; exit 1; }

case "$env_file" in
  /*) ;;
  *) echo "LIFEOS_ENV_FILE must be an absolute path." >&2; exit 1 ;;
esac

allowed_key() {
  case "$1" in
    LIFEOS_SITE_ADDRESS|R2_ACCOUNT_ID|R2_ENDPOINT|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET|R2_REGION|\
    UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN|OPENAI_API_KEY|\
    LLM_API_KEY|LLM_API_URL|LLM_MODEL|\
    TRANSCRIPTION_API_KEY|TRANSCRIPTION_API_URL|TRANSCRIPTION_ENABLED|\
    JEV_API_KEY|TYPESAFE_API_KEY|JEV_API_URL|JEV_MODEL|\
    JEV_ENABLED|JEV_AUTO_ACTIONS_ENABLED|JEV_LLM_FALLBACK_ENABLED|JEV_TIMEOUT_MS|\
    VITE_JEV_ENABLED|VITE_JEV_AUTO_ACTIONS_ENABLED|\
    GITHUB_ADMIN_TOKEN) return 0 ;;
    *) return 1 ;;
  esac
}

umask 077
work_dir=$(mktemp -d "${env_file}.merge.XXXXXX")
trap 'rm -rf -- "$work_dir" "$patch_file"' EXIT HUP INT TERM
cp "$env_file" "$work_dir/current"

while IFS=':' read -r key encoded_value; do
  [ -n "$key" ] || continue
  allowed_key "$key" || { echo "Refusing unsupported environment key: $key" >&2; exit 1; }
  [ -n "$encoded_value" ] || { echo "Refusing empty encoded value for $key." >&2; exit 1; }

  value_file="$work_dir/value"
  if ! printf '%s' "$encoded_value" | base64 -d > "$value_file" 2>/dev/null; then
    echo "Invalid base64 value for $key." >&2
    exit 1
  fi
  [ -s "$value_file" ] || { echo "Refusing empty value for $key." >&2; exit 1; }
  if LC_ALL=C grep -q '[[:cntrl:]]' "$value_file"; then
    echo "Refusing control characters in $key." >&2
    exit 1
  fi

  next_file="$work_dir/next"
  awk -F= -v wanted="$key" '$1 != wanted { print }' "$work_dir/current" > "$next_file"
  printf '%s=' "$key" >> "$next_file"
  cat "$value_file" >> "$next_file"
  printf '\n' >> "$next_file"
  mv "$next_file" "$work_dir/current"
done < "$patch_file"

install -m 0600 "$work_dir/current" "$env_file"
echo "Protected LifeOS server environment updated."
