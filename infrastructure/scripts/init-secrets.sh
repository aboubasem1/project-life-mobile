#!/bin/sh
set -eu

deploy_root=${LIFEOS_DEPLOY_ROOT:-/opt/lifeos}
shared_dir="$deploy_root/shared"
env_file="$shared_dir/.env"

umask 077
mkdir -p "$shared_dir"

if [ -e "$env_file" ]; then
  echo "Environment file already exists; nothing changed: $env_file"
  exit 0
fi

postgres_password=$(openssl rand -hex 32)
developer_secret=$(openssl rand -hex 32)

{
  printf '%s\n' 'LIFEOS_SITE_ADDRESS=:80'
  printf '%s\n' 'HTTP_PORT=80'
  printf '%s\n' 'HTTPS_PORT=443'
  printf '%s\n' 'POSTGRES_USER=lifeos'
  printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password"
  printf '%s\n' 'POSTGRES_DB=lifeos'
  printf '%s\n' 'R2_ACCOUNT_ID='
  printf '%s\n' 'R2_ENDPOINT='
  printf '%s\n' 'R2_ACCESS_KEY_ID='
  printf '%s\n' 'R2_SECRET_ACCESS_KEY='
  printf '%s\n' 'R2_BUCKET=lifeos-production'
  printf '%s\n' 'R2_REGION=auto'
  printf '%s\n' 'SYNC_UPSTASH_BRIDGE=true'
  printf '%s\n' 'UPSTASH_REDIS_REST_URL='
  printf '%s\n' 'UPSTASH_REDIS_REST_TOKEN='
  printf '%s\n' 'OPENAI_API_KEY='
  printf '%s\n' 'LLM_API_KEY='
  printf '%s\n' 'LLM_API_URL='
  printf '%s\n' 'LLM_MODEL='
  printf '%s\n' 'LLM_TIMEOUT_MS=4000'
  printf '%s\n' 'TRANSCRIPTION_API_KEY='
  printf '%s\n' 'TRANSCRIPTION_API_URL='
  printf '%s\n' 'TRANSCRIPTION_ENABLED='
  printf '%s\n' 'TRANSCRIPTION_LANGUAGE=de'
  printf '%s\n' 'TRANSCRIPTION_MODEL=whisper-1'
  printf '%s\n' 'TRANSCRIPTION_TIMEOUT_MS=25000'
  printf '%s\n' 'JEV_API_KEY='
  printf '%s\n' 'TYPESAFE_API_KEY='
  printf '%s\n' 'JEV_API_URL='
  printf '%s\n' 'JEV_MODEL='
  printf '%s\n' 'JEV_ENABLED=false'
  printf '%s\n' 'JEV_AUTO_ACTIONS_ENABLED=false'
  printf '%s\n' 'JEV_LLM_FALLBACK_ENABLED=false'
  printf '%s\n' 'JEV_TIMEOUT_MS=2500'
  printf '%s\n' 'VITE_JEV_ENABLED=false'
  printf '%s\n' 'VITE_JEV_AUTO_ACTIONS_ENABLED=false'
  printf 'DEV_ADMIN_SECRET=%s\n' "$developer_secret"
  printf '%s\n' 'GITHUB_ADMIN_TOKEN='
  printf '%s\n' 'BACKUP_CRON=15 3 * * *'
  printf '%s\n' 'BACKUP_RUN_ON_START=false'
} > "$env_file"

chmod 0600 "$env_file"
unset postgres_password developer_secret
echo "Created protected environment file: $env_file"
