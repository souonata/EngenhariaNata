#!/bin/sh
# Compare the release the live API answers as against the one the live site announces.
#
# The site publishes config/versions.json from `main` automatically; the API image is built by hand
# on its VM. Twice the two drifted, and the second time the site advertised 0.6.7 for four days
# while 0.6.6 served every request -- so the engine change users were told about was not running.
#
# Exits non-zero when they disagree, so this can be a cron line or a pre-announcement check.
#
#   sh deploy/check-release-drift.sh
#   PINTOR_API_ORIGIN=https://staging.example sh deploy/check-release-drift.sh
set -eu

API_ORIGIN=${PINTOR_API_ORIGIN:-https://pintor-api.engnata.eu}
SITE_ORIGIN=${PINTOR_SITE_ORIGIN:-https://engnata.eu}

extract() {
    # A tiny field reader: avoids depending on jq being installed on the VM.
    sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n 1
}

health=$(curl -fsS -m 20 "$API_ORIGIN/api/health")
api_release=$(printf '%s' "$health" | extract release)
api_engine=$(printf '%s' "$health" | extract engine)
site_release=$(curl -fsS -m 20 "$SITE_ORIGIN/config/versions.json" | extract pintor)

printf 'api    %s (engine %s)\n' "${api_release:-<none>}" "${api_engine:-<none>}"
printf 'site   %s\n' "${site_release:-<none>}"

if [ -z "$api_release" ] || [ "$api_release" = "unset" ]; then
    printf 'DRIFT: the API declares no release; PINTOR_RELEASE is missing from its environment.\n'
    exit 2
fi
if [ -z "$site_release" ]; then
    printf 'DRIFT: the site published no pintor version.\n'
    exit 2
fi
if [ "$api_release" != "$site_release" ]; then
    printf 'DRIFT: the site announces %s while the API answers as %s.\n' \
        "$site_release" "$api_release"
    printf 'Rebuild the image on the VM from the commit the site was published from.\n'
    exit 1
fi

printf 'OK: site and API both report %s.\n' "$api_release"
