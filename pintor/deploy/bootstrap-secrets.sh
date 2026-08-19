#!/bin/sh
set -eu

DEPLOY_ROOT=${PINTOR_DEPLOY_ROOT:-/opt/pintor-api}
BIND_IP=${PINTOR_BIND_IP:-192.168.1.14}
ENV_FILE="$DEPLOY_ROOT/.env"
ACCESS_FILE=/root/pintor-beta-access.txt

if [ -s "$ENV_FILE" ]; then
    exit 0
fi

umask 077
access_code=$(openssl rand -hex 12)
access_hash=$(printf '%s' "$access_code" | sha256sum | cut -d' ' -f1)
session_secret=$(openssl rand -hex 48)

{
    printf 'PINTOR_BIND_IP=%s\n' "$BIND_IP"
    printf 'PINTOR_BETA_KEY_HASH=%s\n' "$access_hash"
    printf 'PINTOR_SESSION_SECRET=%s\n' "$session_secret"
} > "$ENV_FILE"
chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

printf '%s\n' "$access_code" > "$ACCESS_FILE"
chown root:root "$ACCESS_FILE"
chmod 600 "$ACCESS_FILE"
