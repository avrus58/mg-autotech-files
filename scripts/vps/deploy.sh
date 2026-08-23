#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

release_preflight
acquire_release_lock

release=${1:-}
if [[ -e "$REPO_ROOT/.git" ]]; then
  require_command git
  [[ -z "$release" ]] || die "explicit release IDs are allowed only for non-Git source archives"
  git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "release root Git metadata is invalid"
  [[ -z $(git -C "$REPO_ROOT" status --porcelain --untracked-files=normal) ]] || die "repository must be clean before deriving a release ID"
  release=$(git -C "$REPO_ROOT" rev-parse --short=12 HEAD)
elif [[ -z "$release" ]]; then
  die "a non-Git source archive requires an explicit release ID"
fi
validate_release_id "$release"

service_image="$SERVICE_IMAGE_REPOSITORY:$release"
analyzer_image="$ANALYZER_IMAGE_REPOSITORY:$release"
validate_image_reference "$service_image"
validate_image_reference "$analyzer_image"

state_service=$(state_value current_service)
state_analyzer=$(state_value current_analyzer)
probe_service=${state_service:-$service_image}
probe_analyzer=${state_analyzer:-$analyzer_image}
resolve_deploy_baseline "$state_service" "$state_analyzer" "$probe_service" "$probe_analyzer"
old_service=$DEPLOY_BASELINE_SERVICE
old_analyzer=$DEPLOY_BASELINE_ANALYZER
previous_service=$(state_value previous_service)
previous_analyzer=$(state_value previous_analyzer)

if [[ -n "$old_service" ]]; then validate_image_reference "$old_service"; fi
if [[ -n "$old_analyzer" ]]; then validate_image_reference "$old_analyzer"; fi
if [[ "$old_service" != "$service_image" ]]; then previous_service=$old_service; fi
if [[ "$old_analyzer" != "$analyzer_image" ]]; then previous_analyzer=$old_analyzer; fi

printf 'Building immutable local File Service release %s.\n' "$release"
compose_for "$service_image" "$analyzer_image" "$release" build file-service file-expert-analyzer
image_is_available "$service_image" || die "File Service image was not produced"
image_is_available "$analyzer_image" || die "analyzer image was not produced"

printf 'Starting analyzer release %s on the private backend network.\n' "$release"
if ! start_service "$service_image" "$analyzer_image" "$release" file-expert-analyzer; then
  if [[ -n "$old_analyzer" ]] && image_is_available "$old_analyzer"; then
    start_service "${old_service:-$service_image}" "$old_analyzer" recovery file-expert-analyzer || true
  else
    stop_service "$service_image" "$analyzer_image" "$release" file-expert-analyzer
  fi
  die "new analyzer did not become healthy; the existing File Service was not replaced"
fi

printf 'Starting File Service release %s.\n' "$release"
if ! start_service "$service_image" "$analyzer_image" "$release" file-service; then
  if [[ -n "$old_service" ]] && image_is_available "$old_service"; then
    start_service "$old_service" "$analyzer_image" recovery file-service || true
  else
    stop_service "$service_image" "$analyzer_image" "$release" file-service
  fi
  if [[ -n "$old_analyzer" ]] && image_is_available "$old_analyzer"; then
    start_service "${old_service:-$service_image}" "$old_analyzer" recovery file-expert-analyzer || true
  else
    stop_service "$service_image" "$analyzer_image" "$release" file-expert-analyzer
  fi
  die "new File Service did not become healthy; previous local images were restored when available"
fi

write_release_state \
  "$service_image" \
  "$analyzer_image" \
  "$previous_service" \
  "$previous_analyzer" \
  deploy

printf 'Release %s is healthy. Caddy routing is managed separately.\n' "$release"
