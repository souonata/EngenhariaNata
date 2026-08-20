#!/bin/sh
set -eu

PUBLIC_HEALTH_URL=${PINTOR_PUBLIC_HEALTH_URL:-https://pintor-api.engnata.eu/api/health}
CONTAINER=${CLOUDFLARED_CONTAINER:-cloudflared}
STATE_FILE=${CLOUDFLARED_STATE_FILE:-/run/pintor-cloudflared-watchdog.failures}
FAILURE_THRESHOLD=${CLOUDFLARED_FAILURE_THRESHOLD:-3}
CURL=${CURL:-/usr/bin/curl}
DOCKER=${DOCKER:-/usr/bin/docker}
LOGGER=${LOGGER:-/usr/bin/logger}

if "$CURL" -fsS --max-time 12 -o /dev/null "$PUBLIC_HEALTH_URL"; then
    rm -f "$STATE_FILE"
    exit 0
fi

failures=0
if [ -r "$STATE_FILE" ]; then
    read -r failures < "$STATE_FILE" || failures=0
fi
case "$failures" in
    ''|*[!0-9]*) failures=0 ;;
esac
failures=$((failures + 1))

if [ "$failures" -lt "$FAILURE_THRESHOLD" ]; then
    printf '%s\n' "$failures" > "$STATE_FILE"
    "$LOGGER" -t pintor-tunnel-watchdog \
        "public health failed ($failures/$FAILURE_THRESHOLD); waiting before recovery"
    exit 0
fi

"$DOCKER" restart "$CONTAINER" >/dev/null
rm -f "$STATE_FILE"
"$LOGGER" -t pintor-tunnel-watchdog \
    "restarted $CONTAINER after $FAILURE_THRESHOLD consecutive public health failures"
