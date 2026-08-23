#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 2 ]]; then
  printf 'Usage: %s APP_ENV_FILE ANALYZER_ENV_FILE\n' "$0" >&2
  exit 64
fi

app_env_file=$1
analyzer_env_file=$2
declare -A app_environment=()
declare -A analyzer_environment=()
declare -a errors=()

trim() {
  local value=$1
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

parse_env_file() {
  local file=$1
  local map_name=$2
  local label=$3
  local -n target=$map_name
  local raw line key value line_number=0

  if [[ ! -f "$file" || ! -r "$file" ]]; then
    errors+=("${label}: file is missing or unreadable")
    return
  fi
  local size
  size=$(stat -c '%s' "$file" 2>/dev/null || printf '0')
  if [[ ! "$size" =~ ^[0-9]+$ || "$size" -gt 262144 ]]; then
    errors+=("${label}: file exceeds the 256 KiB contract")
    return
  fi

  while IFS= read -r raw || [[ -n "$raw" ]]; do
    ((line_number += 1))
    if (( line_number > 1024 )); then
      errors+=("${label}: file exceeds 1024 lines")
      return
    fi
    line=${raw%$'\r'}
    line=$(trim "$line")
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == export\ * ]] && line=$(trim "${line#export }")
    if [[ ! "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      errors+=("${label}: invalid syntax at line ${line_number}")
      continue
    fi
    key=${BASH_REMATCH[1]}
    value=$(trim "${BASH_REMATCH[2]}")
    if [[ ${#value} -ge 2 && ( "$value" == \"*\" || "$value" == \'*\' ) ]]; then
      if [[ "${value:0:1}" != "${value: -1}" ]]; then
        errors+=("${key}: mismatched quotes")
        continue
      fi
      value=${value:1:${#value}-2}
    elif [[ "$value" == \"* || "$value" == \'* ]]; then
      errors+=("${key}: mismatched quotes")
      continue
    else
      value=${value%%[[:space:]]#*}
      value=$(trim "$value")
    fi
    if [[ -v "target[$key]" ]]; then
      errors+=("${key}: duplicate definition")
      continue
    fi
    target[$key]=$value
  done < "$file"
}

require_value() {
  local map_name=$1
  local key=$2
  local minimum=$3
  local maximum=${4:-4096}
  local -n source=$map_name
  local value=${source[$key]-}
  if (( ${#value} < minimum || ${#value} > maximum )); then
    errors+=("${key}: missing or invalid length")
  fi
}

require_exact() {
  local map_name=$1
  local key=$2
  local expected=$3
  local -n source=$map_name
  if [[ ${source[$key]-} != "$expected" ]]; then
    errors+=("${key}: must use the VPS production contract")
  fi
}

require_https_url() {
  local map_name=$1
  local key=$2
  local -n source=$map_name
  local value=${source[$key]-}
  if [[ ! "$value" =~ ^https://[^/@[:space:]]+(/[^[:space:]]*)?$ ]]; then
    errors+=("${key}: must be an HTTPS URL without credentials")
  fi
}

parse_env_file "$app_env_file" app_environment APP_ENV_FILE
parse_env_file "$analyzer_env_file" analyzer_environment ANALYZER_ENV_FILE

require_https_url app_environment NEXT_PUBLIC_SITE_URL
require_https_url app_environment NEXT_PUBLIC_SUPABASE_URL
require_value app_environment NEXT_PUBLIC_SUPABASE_ANON_KEY 20
require_value app_environment SUPABASE_SERVICE_ROLE_KEY 32
require_value app_environment UPLOAD_INTEGRITY_SECRET 32
require_value app_environment FILE_EXPERT_ANALYZER_TOKEN 32 512
require_exact app_environment REQUEST_NETWORK_PROVIDER cloudflare-caddy
require_value app_environment REQUEST_NETWORK_PROXY_SECRET 32 512
require_exact app_environment SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED true
require_value app_environment SECURITY_RATE_LIMIT_SALT 16
require_exact app_environment FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED true
require_exact app_environment FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY 1
require_value app_environment WIDGET_SESSION_SECRET 32
require_value app_environment WIDGET_IP_HASH_SALT 32

captcha_bypass=${app_environment[NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY]-}
case "$captcha_bypass" in
  ""|0|false|FALSE|off|OFF|no|NO) ;;
  *) errors+=("NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY: must stay disabled") ;;
esac

redis_url_key=UPSTASH_REDIS_REST_URL
redis_token_key=UPSTASH_REDIS_REST_TOKEN
if [[ -z ${app_environment[$redis_url_key]-} && -z ${app_environment[$redis_token_key]-} ]]; then
  redis_url_key=KV_REST_API_URL
  redis_token_key=KV_REST_API_TOKEN
fi
require_https_url app_environment "$redis_url_key"
require_value app_environment "$redis_token_key" 16

declare -A analyzer_allowed_keys=(
  [FILE_EXPERT_ANALYZER_TOKEN]=1
  [FILE_EXPERT_ANALYZER_ALLOWED_HOSTS]=1
  [FILE_EXPERT_ANALYZER_MAX_SOURCE_BYTES]=1
  [FILE_EXPERT_ANALYZER_TIMEOUT_SECONDS]=1
)
for key in "${!analyzer_environment[@]}"; do
  if [[ ! -v "analyzer_allowed_keys[$key]" ]]; then
    errors+=("${key}: not allowed in the least-privilege analyzer env file")
  fi
done

require_value analyzer_environment FILE_EXPERT_ANALYZER_TOKEN 32 512
require_value analyzer_environment FILE_EXPERT_ANALYZER_ALLOWED_HOSTS 4 2048
if [[ -n ${app_environment[FILE_EXPERT_ANALYZER_TOKEN]-} && \
      ${app_environment[FILE_EXPERT_ANALYZER_TOKEN]} != ${analyzer_environment[FILE_EXPERT_ANALYZER_TOKEN]-} ]]; then
  errors+=("FILE_EXPERT_ANALYZER_TOKEN: app and analyzer values do not match")
fi

supabase_url=${app_environment[NEXT_PUBLIC_SUPABASE_URL]-}
supabase_authority=${supabase_url#https://}
supabase_authority=${supabase_authority%%/*}
supabase_host=${supabase_authority%%:*}
supabase_host=${supabase_host,,}
host_match=false
IFS=',' read -r -a analyzer_hosts <<< "${analyzer_environment[FILE_EXPERT_ANALYZER_ALLOWED_HOSTS]-}"
if (( ${#analyzer_hosts[@]} > 16 )); then
  errors+=("FILE_EXPERT_ANALYZER_ALLOWED_HOSTS: too many hosts")
fi
for raw_host in "${analyzer_hosts[@]}"; do
  host=$(trim "$raw_host")
  host=${host,,}
  if [[ ! "$host" =~ ^[a-z0-9][a-z0-9.-]{0,252}[a-z0-9]$ || "$host" == *..* ]]; then
    errors+=("FILE_EXPERT_ANALYZER_ALLOWED_HOSTS: contains an invalid hostname")
    continue
  fi
  [[ "$host" == "$supabase_host" ]] && host_match=true
done
if [[ "$host_match" != true ]]; then
  errors+=("FILE_EXPERT_ANALYZER_ALLOWED_HOSTS: must include the configured Supabase host")
fi

if (( ${#errors[@]} > 0 )); then
  printf 'VPS environment contract failed:\n' >&2
  for error in "${errors[@]}"; do
    printf '  - %s\n' "$error" >&2
  done
  exit 1
fi

printf 'VPS environment contract is valid (values were not printed).\n'
