#!/bin/bash
# JustMail server bootstrap — fresh Ubuntu → hardened Docker host. Idempotent.
# Usage (on the server): sudo bash bootstrap-server.sh mail.devlab.az
set -euo pipefail

HOSTNAME_FQDN="${1:?usage: bootstrap-server.sh <mail-fqdn>}"

echo "==> System update"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq ca-certificates curl gnupg git unattended-upgrades zstd

echo "==> Hostname"
hostnamectl set-hostname "$HOSTNAME_FQDN"
echo "$HOSTNAME_FQDN" > /etc/mailname

echo "==> Docker Engine"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker ubuntu

echo "==> SSH hardening"
sed -i -e 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' \
       -e 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd

echo "==> Sysctl tuning"
cat > /etc/sysctl.d/99-justmail.conf <<'EOF'
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
vm.overcommit_memory = 1
fs.inotify.max_user_watches = 524288
EOF
sysctl --system >/dev/null

echo "==> Swap (2G)"
if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Journald cap"
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=1G\n' > /etc/systemd/journald.conf.d/justmail.conf
systemctl restart systemd-journald

echo "==> App directory"
mkdir -p /opt/justmail
chown ubuntu:ubuntu /opt/justmail

echo "==> Done. Next:"
echo "  1. Clone the repo into /opt/justmail/app"
echo "  2. cp infra/compose/.env.example /opt/justmail/.env && edit (chmod 600)"
echo "  3. Run infra/scripts/deploy.sh"
