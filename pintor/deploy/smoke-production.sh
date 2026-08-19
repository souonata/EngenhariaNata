#!/bin/sh
set -eu

API_ORIGIN=${PINTOR_API_ORIGIN:-https://pintor-api.engnata.eu}
DEPLOY_ROOT=${PINTOR_DEPLOY_ROOT:-/opt/pintor-api}
ACCESS_FILE=${PINTOR_ACCESS_FILE:-/root/pintor-beta-access.txt}
CONTAINER=${PINTOR_CONTAINER:-pintor-api-api-1}
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT INT TERM

cookie="$temporary/cookies.txt"
source_pdf="$temporary/synthetic-wiring.pdf"
result_pdf="$temporary/painted.pdf"
headers="$temporary/headers.txt"
job_json="$temporary/job.json"
state_json="$temporary/state.json"
access_code=$(cat "$ACCESS_FILE")

unauthorized=$(curl -sS -o /dev/null -D "$headers" -w '%{http_code}' \
    -H 'Origin: https://engnata.eu' "$API_ORIGIN/api/capabilities")
[ "$unauthorized" = "401" ]
grep -qi '^access-control-allow-origin: https://engnata.eu' "$headers"

payload=$(printf '{"code":"%s"}' "$access_code")
curl -fsS -c "$cookie" -H 'Content-Type: application/json' \
    -H 'Origin: https://engnata.eu' --data "$payload" \
    "$API_ORIGIN/api/access" >/dev/null

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

printf 'external_auth=ok unauthenticated=%s job=%s result=pdf delete=%s\n' \
    "$unauthorized" "$status" "$deleted"
