#!/bin/sh
set -eu

API_ORIGIN=${PINTOR_API_ORIGIN:-https://pintor-api.engnata.eu}
DEPLOY_ROOT=${PINTOR_DEPLOY_ROOT:-/opt/pintor-api}
ACCESS_FILE=${PINTOR_ACCESS_FILE:-/root/pintor-beta-access.txt}
CONTAINER=${PINTOR_CONTAINER:-pintor-api-api-1}
temporary=$(mktemp -d)
smoke_username=
cleanup() {
    if [ -n "$smoke_username" ]; then
        docker exec "$CONTAINER" python - "$smoke_username" <<'PY' >/dev/null 2>&1 || true
import sqlite3
import sys

with sqlite3.connect("/data/accounts.sqlite3") as connection:
    connection.execute("DELETE FROM accounts WHERE username = ?", (sys.argv[1],))
PY
    fi
    rm -rf "$temporary"
}
trap cleanup EXIT INT TERM

cookie="$temporary/cookies.txt"
source_pdf="$temporary/synthetic-wiring.pdf"
result_pdf="$temporary/painted.pdf"
headers="$temporary/headers.txt"
job_json="$temporary/job.json"
state_json="$temporary/state.json"
access_code=$(cat "$ACCESS_FILE")
smoke_username="production-smoke-$(date +%s)-$(openssl rand -hex 4)"
smoke_password=$(openssl rand -hex 16)

unauthorized=$(curl -sS -o /dev/null -D "$headers" -w '%{http_code}' \
    -H 'Origin: https://engnata.eu' "$API_ORIGIN/api/capabilities")
[ "$unauthorized" = "401" ]
grep -qi '^access-control-allow-origin: https://engnata.eu' "$headers"

payload=$(printf '{"code":"%s"}' "$access_code")
curl -fsS -c "$cookie" -H 'Content-Type: application/json' \
    -H 'Origin: https://engnata.eu' --data "$payload" \
    "$API_ORIGIN/api/access" >/dev/null

account_payload=$(python3 - "$smoke_username" "$smoke_password" <<'PY'
import json
import sys

print(json.dumps({"username": sys.argv[1], "password": sys.argv[2]}))
PY
)
curl -fsS -b "$cookie" -c "$cookie" -H 'Content-Type: application/json' \
    -H 'Origin: https://engnata.eu' --data "$account_payload" \
    "$API_ORIGIN/api/accounts/register" >/dev/null
curl -fsS -b "$cookie" -H 'Origin: https://engnata.eu' \
    "$API_ORIGIN/api/account" >/dev/null

docker exec "$CONTAINER" python -c \
    "import pymupdf; d=pymupdf.open(); p=d.new_page(width=595,height=842); p.draw_line((80,220),(515,220),color=(0,0,0),width=1); p.draw_line((80,320),(515,320),color=(0,0,0),width=1); p.insert_text((235,212),'1.5 RD',fontsize=10); p.insert_text((235,312),'1.5 BU',fontsize=10); d.save('/tmp/synthetic-wiring.pdf'); d.close()"
docker exec "$CONTAINER" cat /tmp/synthetic-wiring.pdf >"$source_pdf"
docker exec "$CONTAINER" rm -f /tmp/synthetic-wiring.pdf

curl -fsS -b "$cookie" -c "$cookie" \
    -F "file=@$source_pdf;type=application/pdf" \
    -F page=0 -F convention=iec_two_letter -F consent_learning=false \
    "$API_ORIGIN/api/jobs" >"$job_json"
job_id=$(python3 -c "import json; print(json.load(open('$job_json'))['id'])")

status=queued
attempt=0
while [ "$attempt" -lt 100 ]; do
    curl -fsS -b "$cookie" "$API_ORIGIN/api/jobs/$job_id" >"$state_json"
    status=$(python3 -c "import json; print(json.load(open('$state_json'))['status'])")
    case "$status" in
        ready|declined|failed|revision-requested) break ;;
    esac
    attempt=$((attempt + 1))
    sleep 2
done

[ "$status" = "ready" ]
curl -fsS -b "$cookie" "$API_ORIGIN/api/jobs/$job_id/download" -o "$result_pdf"
[ "$(head -c 5 "$result_pdf")" = "%PDF-" ]
python3 -c "import sys; data=open('$result_pdf','rb').read(); assert len(data) > 500"
deleted=$(curl -sS -o /dev/null -w '%{http_code}' -b "$cookie" \
    -X DELETE "$API_ORIGIN/api/jobs/$job_id")
[ "$deleted" = "204" ]

printf 'external_auth=ok account=ok unauthenticated=%s job=%s result=pdf delete=%s\n' \
    "$unauthorized" "$status" "$deleted"
