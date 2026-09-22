#!/bin/sh
set -eu

deploy_user=$(id -un)
public_key='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINyMGPPvbxz2hGiwdpKm3DZ66ocOn6zjBM9wbaT3y8Zl lifeos-github-actions'
commit='166d037515260664aa9d065286382d5c6ca8f34e'
base="https://raw.githubusercontent.com/aboubasem1/project-life-mobile/${commit}/infrastructure/scripts"

umask 077
mkdir -p "$HOME/.ssh"
touch "$HOME/.ssh/authorized_keys"
chmod 700 "$HOME/.ssh"
chmod 600 "$HOME/.ssh/authorized_keys"
grep -qxF "$public_key" "$HOME/.ssh/authorized_keys" || printf '%s\n' "$public_key" >> "$HOME/.ssh/authorized_keys"

curl -fsSL "$base/bootstrap-server.sh" -o /tmp/lifeos-bootstrap.sh
sudo env DEPLOY_USER="$deploy_user" sh /tmp/lifeos-bootstrap.sh
curl -fsSL "$base/init-secrets.sh" -o /tmp/lifeos-init-secrets.sh
sh /tmp/lifeos-init-secrets.sh

echo "LIFEOS_BOOTSTRAP_OK"
