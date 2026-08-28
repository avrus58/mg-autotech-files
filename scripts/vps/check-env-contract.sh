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

require_optional_value() {
  local map_name=$1
  local key=$2
  local minimum=$3
  local maximum=${4:-4096}
  local -n source=$map_name
  local value=${source[$key]-}
  [[ -z "$value" ]] && return
  if (( ${#value} < minimum || ${#value} > maximum )); then
    errors+=("${key}: invalid length when configured")
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

require_prefixed_value() {
  local map_name=$1
  local key=$2
  local prefix=$3
  local minimum=$4
  local maximum=${5:-4096}
  local -n source=$map_name
  local value=${source[$key]-}
  if (( ${#value} < minimum || ${#value} > maximum )) || [[ "$value" != "$prefix"* ]]; then
    errors+=("${key}: missing or invalid Production credential shape")
  fi
}

require_pattern() {
  local map_name=$1
  local key=$2
  local pattern=$3
  local message=$4
  local -n source=$map_name
  local value=${source[$key]-}
  if [[ ! "$value" =~ $pattern ]]; then
    errors+=("${key}: ${message}")
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

require_distinct_value() {
  local map_name=$1
  local key=$2
  shift 2
  local -n source=$map_name
  local value=${source[$key]-}
  local compared_key
  [[ -z "$value" ]] && return
  for compared_key in "$@"; do
    if [[ -n ${source[$compared_key]-} && "$value" == "${source[$compared_key]}" ]]; then
      errors+=("${key}: must be dedicated and distinct from ${compared_key}")
    fi
  done
}

parse_env_file "$app_env_file" app_environment APP_ENV_FILE
parse_env_file "$analyzer_env_file" analyzer_environment ANALYZER_ENV_FILE

require_exact app_environment NEXT_PUBLIC_SITE_URL https://file.mgautotech.de
require_exact app_environment NEXT_PUBLIC_SUPABASE_URL https://jujaeyvyaeesmipihrrw.supabase.co
require_value app_environment NEXT_PUBLIC_SUPABASE_ANON_KEY 20
require_value app_environment SUPABASE_SERVICE_ROLE_KEY 32
require_value app_environment GROWTH_ATTRIBUTION_HMAC_SECRET 32 512
require_optional_value app_environment GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET 16 512
require_value app_environment UPLOAD_INTEGRITY_SECRET 32
require_value app_environment CUSTOMER_DEVICE_HMAC_SECRET 32
require_value app_environment FILE_EXPERT_ANALYZER_TOKEN 32 512
require_exact app_environment REQUEST_NETWORK_PROVIDER cloudflare-caddy
require_value app_environment REQUEST_NETWORK_PROXY_SECRET 32 512
require_exact app_environment SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED true
require_value app_environment SECURITY_RATE_LIMIT_SALT 16
require_exact app_environment FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED true
require_exact app_environment FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY 1
require_value app_environment WIDGET_SESSION_SECRET 32
require_value app_environment WIDGET_IP_HASH_SALT 32
require_distinct_value \
  app_environment \
  GROWTH_ATTRIBUTION_HMAC_SECRET \
  GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET \
  SUPABASE_SERVICE_ROLE_KEY \
  UPLOAD_INTEGRITY_SECRET \
  CUSTOMER_DEVICE_HMAC_SECRET \
  FILE_EXPERT_ANALYZER_TOKEN \
  REQUEST_NETWORK_PROXY_SECRET \
  SECURITY_RATE_LIMIT_SALT \
  WIDGET_SESSION_SECRET \
  WIDGET_IP_HASH_SALT \
  STRIPE_SECRET_KEY \
  STRIPE_WEBHOOK_SECRET \
  STRIPE_WIDGET_WEBHOOK_SECRET \
  RESEND_API_KEY \
  RESEND_WEBHOOK_SECRET \
  OPENAI_API_KEY \
  LOCAL_AI_API_KEY \
  VLLM_API_KEY \
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY \
  UPSTASH_REDIS_REST_TOKEN \
  KV_REST_API_TOKEN

require_exact app_environment NEXT_PUBLIC_AUTH_CAPTCHA_MODE required
require_pattern \
  app_environment \
  NEXT_PUBLIC_TURNSTILE_SITE_KEY \
  '^0x[A-Za-z0-9_-]{20,100}$' \
  "must be a real Production Turnstile site key"

turnstile_site_key=${app_environment[NEXT_PUBLIC_TURNSTILE_SITE_KEY]-}
case "$turnstile_site_key" in
  1x00000000000000000000AA|2x00000000000000000000AB|1x00000000000000000000BB|2x00000000000000000000BB|3x00000000000000000000FF)
    errors+=("NEXT_PUBLIC_TURNSTILE_SITE_KEY: test keys are forbidden in Production")
    ;;
esac

require_exact app_environment EMAIL_DRY_RUN false
require_prefixed_value app_environment RESEND_API_KEY re_ 16 512
require_value app_environment EMAIL_FROM 6 320
require_pattern \
  app_environment \
  EMAIL_FROM \
  '^([^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+|[^<>]{1,100}<[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+>)$' \
  "must be a valid Production sender address"
require_prefixed_value app_environment RESEND_WEBHOOK_SECRET whsec_ 24 512

require_prefixed_value app_environment NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY pk_live_ 24 512
require_prefixed_value app_environment STRIPE_SECRET_KEY sk_live_ 24 512
require_prefixed_value app_environment STRIPE_WEBHOOK_SECRET whsec_ 24 512
require_prefixed_value app_environment STRIPE_WIDGET_WEBHOOK_SECRET whsec_ 24 512
if [[ -n ${app_environment[STRIPE_WEBHOOK_SECRET]-} && \
      ${app_environment[STRIPE_WEBHOOK_SECRET]} == ${app_environment[STRIPE_WIDGET_WEBHOOK_SECRET]-} ]]; then
  errors+=("STRIPE_WIDGET_WEBHOOK_SECRET: must be distinct from the credit webhook secret")
fi

require_value app_environment NEXT_PUBLIC_BANK_ACCOUNT_NAME 2 200
require_value app_environment NEXT_PUBLIC_BANK_NAME 2 200
require_value app_environment NEXT_PUBLIC_BANK_IBAN 15 64
require_value app_environment NEXT_PUBLIC_BANK_BIC 8 16

require_pattern \
  app_environment \
  NEXT_PUBLIC_GOOGLE_ANALYTICS_ID \
  '^G-[A-Z0-9]{6,14}$' \
  "must be a valid Production GA4 measurement ID"
require_pattern \
  app_environment \
  NEXT_PUBLIC_GOOGLE_ADS_ID \
  '^AW-[0-9]{6,15}$' \
  "must be a valid Production Google Ads tag ID"
for google_ads_conversion_label_key in \
  NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL \
  NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL \
  NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL
do
  require_pattern \
    app_environment \
    "$google_ads_conversion_label_key" \
    '^[A-Za-z0-9_-]{6,40}$' \
    "must be a valid Production Google Ads conversion label"
done

google_ads_registration_label=${app_environment[NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL]-}
google_ads_request_label=${app_environment[NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL]-}
google_ads_purchase_label=${app_environment[NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL]-}
if [[ -n "$google_ads_registration_label" && -n "$google_ads_request_label" && \
      "$google_ads_registration_label" == "$google_ads_request_label" ]]; then
  errors+=("NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL: must be distinct from the registration conversion label")
fi
if [[ -n "$google_ads_registration_label" && -n "$google_ads_purchase_label" && \
      "$google_ads_registration_label" == "$google_ads_purchase_label" ]]; then
  errors+=("NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL: must be distinct from the registration conversion label")
fi
if [[ -n "$google_ads_request_label" && -n "$google_ads_purchase_label" && \
      "$google_ads_request_label" == "$google_ads_purchase_label" ]]; then
  errors+=("NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL: must be distinct from the request conversion label")
fi

require_pattern \
  app_environment \
  NEXT_PUBLIC_GOOGLE_CLIENT_ID \
  '^[0-9]{6,}-[A-Za-z0-9_-]{8,}\.apps\.googleusercontent\.com$' \
  "must be a valid Production Google OAuth client ID"

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
IFS=',' read -r -a analyzer_hosts <<< "${analyzer_environment[FILE_EXPERT_ANALYZER_ALLOWED_HOSTS]-}"
raw_host=$(trim "${analyzer_hosts[0]-}")
normalized_host=${raw_host,,}
normalized_host=${normalized_host%.}
if (( ${#analyzer_hosts[@]} != 1 )) || \
   [[ ! "$normalized_host" =~ ^[a-z0-9][a-z0-9.-]{0,252}[a-z0-9]$ ]] || \
   [[ "$normalized_host" == *..* ]] || \
   [[ "$raw_host" != "$normalized_host" ]] || \
   [[ "$normalized_host" != "$supabase_host" ]]; then
  errors+=("FILE_EXPERT_ANALYZER_ALLOWED_HOSTS: must be exactly one normalized Production Supabase host")
fi

if (( ${#errors[@]} > 0 )); then
  printf 'VPS environment contract failed:\n' >&2
  for error in "${errors[@]}"; do
    printf '  - %s\n' "$error" >&2
  done
  exit 1
fi

printf 'VPS environment contract is valid (values were not printed).\n'
