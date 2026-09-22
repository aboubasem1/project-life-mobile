#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root on the OVH VPS." >&2
  exit 1
fi

. /etc/os-release
if [ "${ID:-}" != "ubuntu" ]; then
  echo "This bootstrap is intentionally limited to Ubuntu LTS." >&2
  exit 1
fi

deploy_user=${DEPLOY_USER:-${SUDO_USER:-}}
if [ -z "$deploy_user" ] || ! id "$deploy_user" >/dev/null 2>&1; then
  echo "Set DEPLOY_USER to the existing non-root SSH user." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git gnupg openssl ufw util-linux

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
architecture=$(dpkg --print-architecture)
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' "$architecture" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
usermod -aG docker "$deploy_user"
install -d -m 0750 -o "$deploy_user" -g "$deploy_user" /opt/lifeos /opt/lifeos/incoming /opt/lifeos/releases /opt/lifeos/shared

ssh_port=$(sshd -T 2>/dev/null | awk '$1 == "port" { print $2; exit }')
ssh_port=${ssh_port:-22}
ufw allow "$ssh_port/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

if [ "${HARDEN_SSH:-false}" = "true" ]; then
  deploy_home=$(getent passwd "$deploy_user" | cut -d: -f6)
  if [ -z "$deploy_home" ] || [ ! -s "$deploy_home/.ssh/authorized_keys" ]; then
    echo "SSH hardening refused: no authorized key found for $deploy_user." >&2
    exit 1
  fi
  {
    printf '%s\n' 'PasswordAuthentication no'
    printf '%s\n' 'KbdInteractiveAuthentication no'
    printf '%s\n' 'PermitRootLogin prohibit-password'
    printf '%s\n' 'MaxAuthTries 3'
  } > /etc/ssh/sshd_config.d/99-lifeos-hardening.conf
  sshd -t
  systemctl reload ssh
fi

echo "OVH host prerequisites are ready. Reconnect before enabling SSH hardening or deploying."
