#!/bin/sh
set -eu

DEPLOY_ROOT=${PINTOR_DEPLOY_ROOT:-/opt/pintor-api}
BIND_IP=${PINTOR_BIND_IP:-192.168.1.14}
ENV_FILE="$DEPLOY_ROOT/.env"
ACCESS_FILE=/root/pintor-beta-access.txt

umask 077
if [ ! -s "$ENV_FILE" ]; then
    access_code=$(openssl rand -hex 12)
    access_hash=$(printf '%s' "$access_code" | sha256sum | cut -d' ' -f1)
    session_secret=$(openssl rand -hex 48)

    {
        printf 'PINTOR_BIND_IP=%s\n' "$BIND_IP"
        printf 'PINTOR_BETA_KEY_HASH=%s\n' "$access_hash"
        printf 'PINTOR_SESSION_SECRET=%s\n' "$session_secret"
    } > "$ENV_FILE"

    printf '%s\n' "$access_code" > "$ACCESS_FILE"
    chown root:root "$ACCESS_FILE"
    chmod 600 "$ACCESS_FILE"
fi

if ! grep -q '^PINTOR_ADMIN_USERNAME=' "$ENV_FILE" || \
        ! grep -q '^PINTOR_ADMIN_PASSWORD_HASH=' "$ENV_FILE"; then
    if [ ! -t 0 ]; then
        printf '%s\n' 'Administrator bootstrap requires an interactive terminal.' >&2
        printf '%s\n' 'Run deploy/bootstrap-secrets.sh as root and enter the secret when prompted.' >&2
        exit 1
    fi
    printf 'Administrator username: ' >&2
    IFS= read -r admin_username
    if [ -z "$admin_username" ]; then
        printf '%s\n' 'Administrator username cannot be empty.' >&2
        exit 1
    fi
    admin_hash=$(python3 -c '
import base64, getpass, hashlib, secrets, sys
password = getpass.getpass("Administrator password (minimum 4 characters): ")
confirm = getpass.getpass("Confirm administrator password: ")
if password != confirm:
    raise SystemExit("passwords do not match")
if not 4 <= len(password) <= 128:
    raise SystemExit("password must contain between 4 and 128 characters")
salt = secrets.token_bytes(16)
digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
print(":".join(("scrypt", str(2**14), "8", "1",
    base64.urlsafe_b64encode(salt).decode(),
    base64.urlsafe_b64encode(digest).decode())))
')
    {
        printf 'PINTOR_ADMIN_USERNAME=%s\n' "$admin_username"
        printf 'PINTOR_ADMIN_PASSWORD_HASH=%s\n' "$admin_hash"
    } >> "$ENV_FILE"
fi

chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"
