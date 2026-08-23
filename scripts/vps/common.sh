#!/usr/bin/env bash
set -Eeuo pipefail

VPS_SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd -- "$VPS_SCRIPT_DIR/../.." && pwd -P)
COMPOSE_FILE=${FILE_SERVICE_COMPOSE_FILE:-$REPO_ROOT/compose.vps.yml}
APP_ENV_FILE=${FILE_SERVICE_ENV_FILE:-/etc/mgautotech/file-service.env}
ANALYZER_ENV_FILE=${FILE_EXPERT_ANALYZER_ENV_FILE:-/etc/mgautotech/file-expert-analyzer.env}
STATE_DIR=${FILE_SERVICE_STATE_DIR:-/var/lib/mgautotech-file-service}
STATE_FILE=$STATE_DIR/release-state
EDGE_NETWORK=mgautotech_file_service_edge
SERVICE_IMAGE_REPOSITORY=${FILE_SERVICE_IMAGE_REPOSITORY:-mgautotech-file-service}
ANALYZER_IMAGE_REPOSITORY=${FILE_EXPERT_ANALYZER_IMAGE_REPOSITORY:-mgautotech-file-expert-analyzer}
HEALTH_TIMEOUT_SECONDS=${FILE_SERVICE_HEALTH_TIMEOUT_SECONDS:-120}

die() {
  printf 'VPS release error: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command '$1' is unavailable"
}

validate_image_reference() {
  image_reference_is_valid "$1" || die "invalid local image reference"
}

image_reference_is_valid() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9._/:@-]{0,254}$ ]]
}

validate_release_id() {
  release_id_is_valid "$1" || die "release ID must be a lowercase Docker tag"
}

release_id_is_valid() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9._-]{0,63}$ ]]
}

validate_secret_file() {
  local file=$1
  local label=$2
  [[ "$file" == /* ]] || die "$label path must be absolute"
  [[ -f "$file" && -r "$file" ]] || die "$label is missing or unreadable"
  local owner mode
  owner=$(stat -c '%u' "$file")
  mode=$(stat -c '%a' "$file")
  [[ "$owner" == 0 ]] || die "$label must be root-owned"
  [[ "$mode" == 400 || "$mode" == 600 ]] || die "$label must use mode 0400 or 0600"
}

release_preflight() {
  require_command docker
  require_command flock
  require_command stat
  [[ "$STATE_DIR" == /* && "$STATE_DIR" != / ]] || die "state directory must be a narrow absolute path"
  [[ -f "$COMPOSE_FILE" ]] || die "Production compose file is missing"
  validate_secret_file "$APP_ENV_FILE" "File Service env file"
  validate_secret_file "$ANALYZER_ENV_FILE" "analyzer env file"
  bash "$VPS_SCRIPT_DIR/check-env-contract.sh" "$APP_ENV_FILE" "$ANALYZER_ENV_FILE"
  docker info >/dev/null 2>&1 || die "Docker engine is unavailable"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is unavailable"
  docker network inspect "$EDGE_NETWORK" >/dev/null 2>&1 || die "external edge network '$EDGE_NETWORK' does not exist"
  mkdir -p -- "$STATE_DIR"
  chmod 0700 -- "$STATE_DIR"
  [[ "$HEALTH_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || die "health timeout must be an integer"
  (( HEALTH_TIMEOUT_SECONDS >= 30 && HEALTH_TIMEOUT_SECONDS <= 300 )) || die "health timeout must be between 30 and 300 seconds"
  validate_image_reference "$SERVICE_IMAGE_REPOSITORY"
  validate_image_reference "$ANALYZER_IMAGE_REPOSITORY"
}

acquire_release_lock() {
  exec 9>"$STATE_DIR/release.lock"
  flock -n 9 || die "another File Service release operation is active"
}

compose_for() {
  local service_image=$1
  local analyzer_image=$2
  local release=$3
  shift 3
  env \
    -u COMPOSE_PROJECT_NAME \
    -u NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY \
    -u NEXT_PUBLIC_AUTH_CAPTCHA_MODE \
    -u NEXT_PUBLIC_BANK_ACCOUNT_NAME \
    -u NEXT_PUBLIC_BANK_BIC \
    -u NEXT_PUBLIC_BANK_IBAN \
    -u NEXT_PUBLIC_BANK_NAME \
    -u NEXT_PUBLIC_GOOGLE_ADS_ID \
    -u NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL \
    -u NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL \
    -u NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL \
    -u NEXT_PUBLIC_GOOGLE_ANALYTICS_ID \
    -u NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    -u NEXT_PUBLIC_SITE_URL \
    -u NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    -u NEXT_PUBLIC_SUPABASE_ANON_KEY \
    -u NEXT_PUBLIC_SUPABASE_URL \
    -u NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    -u NEXT_PUBLIC_WHATSAPP_NUMBER \
    FILE_SERVICE_IMAGE="$service_image" \
    FILE_EXPERT_ANALYZER_IMAGE="$analyzer_image" \
    FILE_SERVICE_RELEASE="$release" \
    FILE_SERVICE_ENV_FILE="$APP_ENV_FILE" \
    FILE_EXPERT_ANALYZER_ENV_FILE="$ANALYZER_ENV_FILE" \
    docker compose \
      --project-name mgautotech-file-service \
      --env-file "$APP_ENV_FILE" \
      --project-directory "$REPO_ROOT" \
      -f "$COMPOSE_FILE" \
      "$@"
}

state_value() {
  local key=$1
  [[ -f "$STATE_FILE" ]] || return 0
  awk -F= -v wanted="$key" '$1 == wanted { sub(/^[^=]*=/, ""); print; exit }' "$STATE_FILE"
}

write_release_state() {
  local current_service=$1
  local current_analyzer=$2
  local previous_service=$3
  local previous_analyzer=$4
  local action=$5
  local rollback_service=${6:-}
  local rollback_analyzer=${7:-}
  local temporary
  umask 077
  temporary=$(mktemp "$STATE_DIR/release-state.XXXXXX")
  printf '%s\n' \
    "current_service=$current_service" \
    "current_analyzer=$current_analyzer" \
    "previous_service=$previous_service" \
    "previous_analyzer=$previous_analyzer" \
    "last_action=$action" \
    "rollback_from_service=$rollback_service" \
    "rollback_from_analyzer=$rollback_analyzer" > "$temporary"
  mv -f -- "$temporary" "$STATE_FILE"
}

container_id_for() {
  local service_image=$1 analyzer_image=$2 release=$3 service=$4
  compose_for "$service_image" "$analyzer_image" "$release" ps -q "$service" 2>/dev/null | head -n 1
}

runtime_snapshot_for() {
  local service_image=$1 analyzer_image=$2 release=$3 service=$4
  local container_id
  container_id=$(container_id_for "$service_image" "$analyzer_image" "$release" "$service")
  [[ -n "$container_id" ]] || return 0
  docker inspect --format '{{.Config.Image}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true
}

runtime_pair_is_healthy() {
  local expected_service=$1 expected_analyzer=$2
  local service_snapshot analyzer_snapshot
  service_snapshot=$(runtime_snapshot_for "$expected_service" "$expected_analyzer" verify file-service)
  analyzer_snapshot=$(runtime_snapshot_for "$expected_service" "$expected_analyzer" verify file-expert-analyzer)
  [[ "$service_snapshot" == "$expected_service|healthy" &&
     "$analyzer_snapshot" == "$expected_analyzer|healthy" ]]
}

resolve_deploy_baseline() {
  local recorded_service=$1 recorded_analyzer=$2 probe_service=$3 probe_analyzer=$4
  local service_snapshot analyzer_snapshot actual_service actual_analyzer service_status analyzer_status

  DEPLOY_BASELINE_SERVICE=
  DEPLOY_BASELINE_ANALYZER=

  if [[ -n "$recorded_service" || -n "$recorded_analyzer" ]]; then
    [[ -n "$recorded_service" && -n "$recorded_analyzer" ]] || die "completed release state is incomplete; repair it before deploying"
    validate_image_reference "$recorded_service"
    validate_image_reference "$recorded_analyzer"
  fi

  service_snapshot=$(runtime_snapshot_for "$probe_service" "$probe_analyzer" probe file-service)
  analyzer_snapshot=$(runtime_snapshot_for "$probe_service" "$probe_analyzer" probe file-expert-analyzer)
  actual_service=${service_snapshot%%|*}
  actual_analyzer=${analyzer_snapshot%%|*}
  service_status=${service_snapshot#*|}
  analyzer_status=${analyzer_snapshot#*|}

  if [[ -n "$recorded_service" && -n "$recorded_analyzer" ]]; then
    if [[ ( -n "$actual_service" && "$actual_service" != "$recorded_service" ) ||
          ( -n "$actual_analyzer" && "$actual_analyzer" != "$recorded_analyzer" ) ]]; then
      die "running services do not match the completed release state; restore the recorded current pair explicitly before deploying"
    fi
    DEPLOY_BASELINE_SERVICE=$recorded_service
    DEPLOY_BASELINE_ANALYZER=$recorded_analyzer
    return 0
  fi

  if [[ -z "$actual_service" && -z "$actual_analyzer" ]]; then
    return 0
  fi

  local adopted_release=
  if [[ "$actual_service" == "$SERVICE_IMAGE_REPOSITORY:"* ]]; then
    adopted_release=${actual_service#"$SERVICE_IMAGE_REPOSITORY:"}
  fi
  if [[ "$service_status" != healthy ||
        "$analyzer_status" != healthy ||
        ! -n "$adopted_release" ]] ||
      ! release_id_is_valid "$adopted_release" ||
      [[ "$actual_analyzer" != "$ANALYZER_IMAGE_REPOSITORY:$adopted_release" ]]; then
    die "unmanaged or incomplete runtime services exist without completed release state; remove or recover the exact paired stack before deploying"
  fi

  DEPLOY_BASELINE_SERVICE=$actual_service
  DEPLOY_BASELINE_ANALYZER=$actual_analyzer
}

wait_for_service_health() {
  local service_image=$1 analyzer_image=$2 release=$3 service=$4
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  local expected_image inspection actual_image status
  case "$service" in
    file-service) expected_image=$service_image ;;
    file-expert-analyzer) expected_image=$analyzer_image ;;
    *) return 1 ;;
  esac
  while (( SECONDS < deadline )); do
    inspection=$(runtime_snapshot_for "$service_image" "$analyzer_image" "$release" "$service")
    if [[ -n "$inspection" ]]; then
      actual_image=${inspection%%|*}
      status=${inspection#*|}
      if [[ "$actual_image" == "$expected_image" ]]; then
        case "$status" in
          healthy) return 0 ;;
          unhealthy|dead|exited) return 1 ;;
        esac
      fi
    fi
    sleep 2
  done
  return 1
}

start_service() {
  local service_image=$1 analyzer_image=$2 release=$3 service=$4
  compose_for "$service_image" "$analyzer_image" "$release" up -d --no-build --no-deps "$service" || return 1
  wait_for_service_health "$service_image" "$analyzer_image" "$release" "$service"
}

stop_service() {
  local service_image=$1 analyzer_image=$2 release=$3 service=$4
  compose_for "$service_image" "$analyzer_image" "$release" stop --timeout 10 "$service" >/dev/null 2>&1 || true
}

image_is_available() {
  docker image inspect "$1" >/dev/null 2>&1
}
