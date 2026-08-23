#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

release_preflight
acquire_release_lock

current_service=$(state_value current_service)
current_analyzer=$(state_value current_analyzer)
previous_service=$(state_value previous_service)
previous_analyzer=$(state_value previous_analyzer)
last_action=$(state_value last_action)
repair_current=false

[[ -n "$current_service" && -n "$current_analyzer" ]] || die "no completed release state is available"
validate_image_reference "$current_service"
validate_image_reference "$current_analyzer"

if [[ -n ${1:-} ]]; then
  validate_release_id "$1"
  target_service="$SERVICE_IMAGE_REPOSITORY:$1"
  target_analyzer="$ANALYZER_IMAGE_REPOSITORY:$1"
else
  if [[ "$last_action" == rollback ]]; then
    target_service=$current_service
    target_analyzer=$current_analyzer
    repair_current=true
  else
    target_service=$previous_service
    target_analyzer=$previous_analyzer
  fi
fi

[[ -n "$target_service" && -n "$target_analyzer" ]] || die "no previous complete release pair is recorded"
validate_image_reference "$target_service"
validate_image_reference "$target_analyzer"

if [[ "$target_service" == "$current_service" && "$target_analyzer" == "$current_analyzer" ]]; then
  if runtime_pair_is_healthy "$current_service" "$current_analyzer"; then
    if [[ "$last_action" == rollback && -z ${1:-} ]]; then
      printf 'Rollback is already applied and healthy; no services were changed.\n'
    else
      printf 'Requested rollback target is already current and healthy; no services were changed.\n'
    fi
    exit 0
  fi
  repair_current=true
fi

image_is_available "$target_service" || die "target File Service image is not available locally"
image_is_available "$target_analyzer" || die "target analyzer image is not available locally"

printf 'Restoring the recorded analyzer release before switching the File Service.\n'
if ! start_service "$target_service" "$target_analyzer" rollback file-expert-analyzer; then
  start_service "$current_service" "$current_analyzer" recovery file-expert-analyzer || true
  die "target analyzer did not become healthy; File Service was not switched"
fi

printf 'Restoring the recorded File Service release.\n'
if ! start_service "$target_service" "$target_analyzer" rollback file-service; then
  start_service "$current_service" "$current_analyzer" recovery file-expert-analyzer || true
  start_service "$current_service" "$current_analyzer" recovery file-service || true
  die "target File Service did not become healthy; current local images were restored"
fi

if [[ "$repair_current" == true ]]; then
  printf 'Recorded current release pair was restored and is healthy; release history was unchanged.\n'
  exit 0
fi

write_release_state \
  "$target_service" \
  "$target_analyzer" \
  "$current_service" \
  "$current_analyzer" \
  rollback \
  "$current_service" \
  "$current_analyzer"

printf 'Rollback completed and both target services are healthy.\n'
