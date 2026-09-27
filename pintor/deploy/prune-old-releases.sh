#!/bin/sh
# Post-deploy hygiene for the pintor-api VM: keep the live release + a pinned
# rollback + the N most recent, delete the rest, and -- the part that actually
# frees disk -- purge the BuildKit cache.
#
# WHY THIS EXISTS
#   The API is built by hand on its VM. Every publish leaves ~762 MB of image,
#   ~250 MB of extracted release under /opt/pintor-api-releases, and BuildKit
#   layer cache. Left alone the 20 GB root filled to 93% (2026-09-26 cleanup
#   freed ~13 GB). The trap: `docker rmi` of old tags does NOT free space while
#   BuildKit still references the layers -- `docker builder prune -a -f` is what
#   drops the disk. So this script always runs that last.
#
# SAFETY
#   * Dry-run by DEFAULT. It lists what it would remove and touches nothing.
#     Pass --apply to actually delete.
#   * The live image and the live release (read from the running container) are
#     ALWAYS kept, even if a pinned/keep list is wrong.
#   * The data volume (pintor-api_pintor-data) is never touched.
#
# USAGE
#   sh deploy/prune-old-releases.sh              # dry-run: show the plan
#   sh deploy/prune-old-releases.sh --apply      # actually clean up
#
#   KEEP_RECENT=2   how many most-recent releases/images to keep beyond live (default 2)
#   PINNED_RELEASES release SHAs to always keep (default: the documented rollback)
#   PINNED_IMAGES   image tags to always keep   (default: the documented rollback)
#   COMPOSE_PROJECT compose project name        (default: pintor-api)
#   RELEASES_DIR    releases root               (default: /opt/pintor-api-releases)
#   IMAGE_REPO      image repository            (default: engnata/pintor-api)
set -eu

KEEP_RECENT=${KEEP_RECENT:-2}
PINNED_RELEASES=${PINNED_RELEASES:-2b08f7e}
PINNED_IMAGES=${PINNED_IMAGES:-0.6.2}
COMPOSE_PROJECT=${COMPOSE_PROJECT:-pintor-api}
RELEASES_DIR=${RELEASES_DIR:-/opt/pintor-api-releases}
IMAGE_REPO=${IMAGE_REPO:-engnata/pintor-api}

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

in_list() { _n=$1; shift; for _x in "$@"; do [ "$_x" = "$_n" ] && return 0; done; return 1; }

# --- discover what is live -------------------------------------------------
container=$(docker ps -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" | head -n1)
if [ -z "$container" ]; then
    printf 'ABORT: no running container for compose project %s -- refusing to prune while the service is down.\n' "$COMPOSE_PROJECT" >&2
    exit 2
fi
live_image=$(docker inspect --format '{{.Config.Image}}' "$container")
live_image_tag=${live_image##*:}
compose_dir=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$container")
live_release=$(printf '%s' "$compose_dir" | sed -n "s#.*/$(basename "$RELEASES_DIR")/\([^/]*\)/.*#\1#p")

printf 'live image   : %s\n' "$live_image"
printf 'live release : %s\n' "${live_release:-<unknown>}"
printf 'keep recent  : %s   pinned releases: %s   pinned images: %s\n\n' \
    "$KEEP_RECENT" "$PINNED_RELEASES" "$PINNED_IMAGES"

# --- build the release keep-set --------------------------------------------
recent_rel=$(ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | head -n "$KEEP_RECENT" | while read -r d; do basename "$d"; done)
keep_rel="$live_release $PINNED_RELEASES $recent_rel"

# --- build the image keep-set (docker lists newest first) ------------------
recent_img=$(docker images "$IMAGE_REPO" --format '{{.Tag}}' | head -n "$KEEP_RECENT")
keep_img="$live_image_tag $PINNED_IMAGES $recent_img"

# --- plan: releases --------------------------------------------------------
echo "=== releases ==="
rel_to_remove=""
for d in "$RELEASES_DIR"/*/; do
    [ -d "$d" ] || continue
    s=$(basename "$d")
    if in_list "$s" $keep_rel; then
        printf '  KEEP   %s\n' "$s"
    else
        printf '  REMOVE %s\n' "$s"
        rel_to_remove="$rel_to_remove $s"
    fi
done

# --- plan: images ----------------------------------------------------------
echo "=== images ($IMAGE_REPO) ==="
img_to_remove=""
for t in $(docker images "$IMAGE_REPO" --format '{{.Tag}}'); do
    if in_list "$t" $keep_img; then
        printf '  KEEP   %s\n' "$t"
    else
        printf '  REMOVE %s\n' "$t"
        img_to_remove="$img_to_remove $t"
    fi
done

echo ""
df -h / | sed -n '1p;$p'
echo ""

if [ "$APPLY" -eq 0 ]; then
    printf 'DRY-RUN. Re-run with --apply to remove the above, then purge BuildKit cache.\n'
    exit 0
fi

# --- apply -----------------------------------------------------------------
for s in $rel_to_remove; do printf 'rm -rf %s\n' "$RELEASES_DIR/$s"; rm -rf "${RELEASES_DIR:?}/$s"; done
for t in $img_to_remove; do printf 'rmi %s:%s\n' "$IMAGE_REPO" "$t"; docker rmi "$IMAGE_REPO:$t" || true; done
docker image prune -f            # dangling <none>
docker builder prune -a -f       # THE step that actually frees disk

echo ""
echo "=== after ==="
df -h / | sed -n '1p;$p'
docker ps --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" --format '{{.Names}} | {{.Image}} | {{.Status}}'
