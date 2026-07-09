#!/usr/bin/env bash
# End-to-end smoke test hit against a live JustMail deployment.
#   ./scripts/smoke.sh https://api.justmail.example.com admin@example.com PASSWORD
# Exits non-zero on the first failed assertion.
set -euo pipefail

API=${1:?"usage: smoke.sh <api-base> <email> <password>"}
EMAIL=${2:?"email required"}
PW=${3:?"password required"}

JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

assert() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL $label: expected $expected got $actual" >&2
    exit 1
  fi
  echo "OK   $label"
}

get_code() {
  curl -sS -m 15 -o /dev/null -w "%{http_code}" -b "$JAR" -c "$JAR" "$@"
}
get_body() {
  curl -sS -m 15 -b "$JAR" -c "$JAR" "$@"
}

echo "== unauthenticated =="
assert "healthz" 200 "$(get_code "$API/healthz")"
assert "auth/me without cookie" 401 "$(get_code "$API/v1/auth/me")"

echo "== login =="
LOGIN_STATUS=$(curl -sS -m 15 -o /tmp/smoke-login -w "%{http_code}" -c "$JAR" \
  -H "Content-Type: application/json" -X POST "$API/v1/auth/login" \
  -d "$(jq -n --arg e "$EMAIL" --arg p "$PW" '{email:$e,password:$p}')")
assert "login" 200 "$LOGIN_STATUS"

ME=$(get_body "$API/v1/auth/me")
ORG_ID=$(jq -r '.orgs[0].id' <<<"$ME")
[[ "$ORG_ID" == "null" || -z "$ORG_ID" ]] && { echo "no org for user"; exit 1; }
echo "OK   me → org $ORG_ID"

echo "== read paths =="
assert "orgs list"     200 "$(get_code "$API/v1/orgs")"
assert "dashboard"     200 "$(get_code "$API/v1/orgs/$ORG_ID/dashboard")"
assert "domains list"  200 "$(get_code "$API/v1/orgs/$ORG_ID/domains")"
assert "mailboxes"     200 "$(get_code "$API/v1/orgs/$ORG_ID/mailboxes")"
assert "aliases"       200 "$(get_code "$API/v1/orgs/$ORG_ID/aliases")"
assert "queue"         200 "$(get_code "$API/v1/orgs/$ORG_ID/queue")"
assert "blocked-ips"   200 "$(get_code "$API/v1/orgs/$ORG_ID/security/blocked-ips")"
assert "security score" 200 "$(get_code "$API/v1/orgs/$ORG_ID/security/score")"

echo "== logout =="
assert "logout" 204 "$(get_code -X POST "$API/v1/auth/logout")"
assert "me post-logout" 401 "$(get_code "$API/v1/auth/me")"

echo "== all green =="
