#!/usr/bin/env bash
# JustMail single-command installer for Ubuntu 24.04+.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/azedevlab/justmail/main/scripts/install.sh | sudo bash
set -euo pipefail

DOMAIN=${JM_DOMAIN:-}
ADMIN_EMAIL=${ADMIN_EMAIL:-}
INSTALL_DIR=/opt/justmail
REPO=${JM_REPO:-https://github.com/azedevlab/justmail.git}
BRANCH=${JM_BRANCH:-main}

if [[ $EUID -ne 0 ]]; then
  echo "run as root (sudo bash)"
  exit 1
fi

command -v docker >/dev/null || {
  echo "Installing Docker"
  curl -fsSL https://get.docker.com | sh
}

id justmail &>/dev/null || useradd -r -s /usr/sbin/nologin -d "$INSTALL_DIR" justmail

mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/backups" "$INSTALL_DIR/attachments"
if [[ ! -d "$INSTALL_DIR/app/.git" ]]; then
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$INSTALL_DIR/app"
else
  (cd "$INSTALL_DIR/app" && git pull --ff-only)
fi

if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  cp "$INSTALL_DIR/app/services/compose/.env.example" "$INSTALL_DIR/.env"
  chmod 600 "$INSTALL_DIR/.env"
  echo "Edit $INSTALL_DIR/.env with your domain, DNS token, and storage settings, then re-run this installer."
  exit 0
fi

cd "$INSTALL_DIR/app/services/compose"
docker compose --env-file "$INSTALL_DIR/.env" \
  --profile core --profile certs --profile mail --profile obs --profile sec --profile app up -d

echo "==> JustMail installed. Open the admin console at your JM_ADMIN_HOST."
