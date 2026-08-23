# File Service VPS runbook

This stack runs the Next.js File Service and the isolated File Expert analyzer
on the existing Hostinger VPS. It does not install Docker, change DNS, edit
Caddy, apply SQL, or read/mutate Production data by itself.

## Fixed contract

- Release root: `/opt/mgautotech/file-service`
- Compose project: `mgautotech-file-service`
- App env: `/etc/mgautotech/file-service.env` (`root:root`, mode `0600`)
- Analyzer env: `/etc/mgautotech/file-expert-analyzer.env` (`root:root`, mode `0600`)
- Release state: `/var/lib/mgautotech-file-service`
- External Caddy network: `mgautotech_file_service_edge`
- Caddy upstream: `file-service:3000`
- Private analyzer upstream: `file-expert-analyzer:8010`
- Private analyzer transport opt-in: `FILE_EXPERT_ANALYZER_ALLOW_PRIVATE_DOCKER_HTTP=true`
- Process readiness: `GET /api/health/ready`
- Analyzer readiness: `GET /health` inside the backend network

Production Compose publishes no host port. The app joins the external edge
network and the private backend bridge; the analyzer joins only the backend
bridge. The backend bridge is intentionally not Docker `internal`, because both
services need outbound HTTPS. No `depends_on` health condition couples login or
orders to the analyzer. Analyzer failure therefore leaves the main app running
and File Expert returns its existing retryable unavailable state.

## One-time host preparation

Docker Engine, Docker Compose v2, Bash, `flock`, and `stat` must already be
available. Create the fixed directories, copy a clean reviewed release into the
release root, and create the external edge network once. Attach the existing
Caddy container to that network. Do not recreate an existing network or Caddy
container during an application release.

The app env remains the full server runtime configuration. It must include the
public Next build variables plus the existing server-only Supabase, upload,
device, Widget and distributed-admission configuration. It must also set:

```text
NEXT_PUBLIC_SITE_URL=https://file.mgautotech.de
NEXT_PUBLIC_SUPABASE_URL=https://jujaeyvyaeesmipihrrw.supabase.co
NEXT_PUBLIC_AUTH_CAPTCHA_MODE=required
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<real non-test Production site key>
NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY=false
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<Production Google OAuth client ID>
EMAIL_DRY_RUN=false
RESEND_API_KEY=<Production re_ credential>
EMAIL_FROM=<verified Production sender>
RESEND_WEBHOOK_SECRET=<Production whsec_ signing secret>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<Production pk_live_ credential>
STRIPE_SECRET_KEY=<Production sk_live_ credential>
STRIPE_WEBHOOK_SECRET=<credit webhook whsec_ signing secret>
STRIPE_WIDGET_WEBHOOK_SECRET=<distinct widget webhook whsec_ signing secret>
NEXT_PUBLIC_BANK_ACCOUNT_NAME=<existing Production value>
NEXT_PUBLIC_BANK_NAME=<existing Production value>
NEXT_PUBLIC_BANK_IBAN=<existing Production value>
NEXT_PUBLIC_BANK_BIC=<existing Production value>
REQUEST_NETWORK_PROVIDER=cloudflare-caddy
REQUEST_NETWORK_PROXY_SECRET=<32-512 character server-only value>
```

The widget schema defaults checkout to enabled and there is no server env kill
switch that proves it disabled. A real, separately registered Stripe widget
webhook secret is therefore a release requirement; never generate or reuse a
placeholder merely to satisfy preflight. The Turnstile private secret remains
only in the matching hosted Supabase Auth configuration and is not copied into
the app or analyzer env files.

Caddy must remove any client-supplied `X-MG-*` trust headers, then set
`X-MG-Proxy-Secret`, `X-MG-Client-IP`, and `X-MG-Country` according to
`docs/request-network-trust-contract.md`. The proxy secret must match the app
env and must never be exposed to a browser, log, or analyzer.

The analyzer env is deliberately separate and may contain only:

```text
FILE_EXPERT_ANALYZER_TOKEN=<same 32+ character token as the app env>
FILE_EXPERT_ANALYZER_ALLOWED_HOSTS=<exact Production Supabase host>
# Optional bounded overrides:
FILE_EXPERT_ANALYZER_MAX_SOURCE_BYTES=
FILE_EXPERT_ANALYZER_TIMEOUT_SECONDS=
```

The Compose file fixes analyzer concurrency to `1`, its wall timeout to `30`
seconds, its lock to `/tmp/mg-autotech-file-expert.lock`, and the server-only
private-HTTP opt-in for the exact `http://file-expert-analyzer:8010` base URL.
The application rejects every other non-loopback HTTP analyzer URL even when
that opt-in is present. Never put the Supabase service-role key, Stripe, Resend,
Redis, or proxy secret in the analyzer env file.

## Preflight and deploy

Run from the reviewed release root as a user that can operate Docker and read
the root-owned env files (normally via the host's controlled root release
account):

```bash
bash scripts/vps/check-env-contract.sh \
  /etc/mgautotech/file-service.env \
  /etc/mgautotech/file-expert-analyzer.env
bash scripts/vps/deploy.sh
```

The deploy script refuses a dirty Git checkout when deriving the tag, validates
env names/shapes without printing values, verifies the external network, builds
both immutable local images, and switches the analyzer before the app. A failed
analyzer never replaces the existing app. A failed app restores the previous
local pair when available. The script never edits Caddy, DNS, SQL, or env files.
Git checkouts always derive the immutable tag from a clean HEAD and reject an
explicit override. Only a source archive without Git metadata may pass an
explicit lowercase release ID: `bash scripts/vps/deploy.sh 2026.08.23-1`.

When completed release state exists, any running container whose image differs
from that recorded pair stops the deploy before a build or switch. A missing or
unhealthy container on the recorded image does not block repair by the next
deploy. If an interrupted operation left a mixed pair, explicitly restore the
recorded current release ID with `rollback.sh <current-release-id>` before
retrying. Without release state, the script adopts only a healthy app/analyzer
pair from the two configured local repositories with one identical valid tag;
no containers is a clean first install, while partial or unmanaged runtime
containers fail closed.

## DNS-free cutover smoke

The preview override is only for a short loopback/SSH-tunnel smoke before Caddy
cutover. It is not part of the Production deploy script:

```bash
FILE_SERVICE_IMAGE=mgautotech-file-service:<release-id> \
FILE_EXPERT_ANALYZER_IMAGE=mgautotech-file-expert-analyzer:<release-id> \
FILE_SERVICE_RELEASE=<release-id> \
docker compose \
  --env-file /etc/mgautotech/file-service.env \
  -f compose.vps.yml -f compose.vps.preview.yml up -d --no-build
ssh -L 3100:127.0.0.1:3100 <operator>@<vps>
curl -fsS http://127.0.0.1:3100/api/health/ready
```

Re-apply only `compose.vps.yml` with the same three exact image/release variables
before enabling Caddy traffic so the loopback mapping is removed. The override
binds `127.0.0.1` only and must never be changed to `0.0.0.0`.

The readiness route is intentionally process-local: it returns only
`{"status":"ok"}` with no-store/noindex headers. Supabase, Stripe, Resend,
Upstash and analyzer health are release/smoke gates, not Docker restart
dependencies; a provider outage must not create a container restart loop.

## Rollback

The default rollback is idempotent and restores the recorded previous image
pair without rebuilding or pulling:

```bash
bash scripts/vps/rollback.sh
```

Running it again makes no change when the recorded current pair is healthy; if
that pair is missing, unhealthy, or drifted, it is restored without rewriting
release history. An operator can restore an older locally retained pair
explicitly with `bash scripts/vps/rollback.sh <release-id>`.
Rollback starts and health-checks the analyzer before switching the app. Never
delete the two static volumes during rollback.

## Static assets, cache, and pruning

The image keeps its own release assets at `/app/static-release`. On every start,
the non-root entrypoint atomically copies them into the named
`mgautotech_file_service_static_assets` volume and retains the current plus two
previous release manifests. Files outside that three-release union are pruned
with bounded manifest size/count checks. This prevents browsers holding a prior
HTML response from receiving 404s for its hashed `/_next/static` chunks.

Manifest metadata lives in the separate, non-public
`mgautotech_file_service_static_state` volume. `.next/cache` is a fresh 128 MiB
tmpfs per container and is never carried across releases, so rendered/data cache
semantics cannot silently cross incompatible builds. A rollback image always
re-adds its own assets before Node starts.

After at least two verified releases, inspect exact unused local image tags with
`docker image ls`. Remove only an explicitly reviewed tag that is not named by
`/var/lib/mgautotech-file-service/release-state`; do not use broad image or
volume pruning in the release path.

## Operations

- App limits: CPU shares `384`, hard cap `0.85` CPU, 1 GiB memory, 256 PIDs.
- Analyzer limits: CPU shares `192`, hard cap `0.90` CPU, 768 MiB memory,
  128 PIDs, one admitted analysis. The lower shares let the existing default
  `1024`-share site win CPU contention while preserving near-one-core burst
  capacity for the analyzer deadline.
- Both roots are read-only; only named static volumes and bounded tmpfs mounts
  are writable. Capabilities are dropped and `no-new-privileges` is enabled.
- JSON logs rotate at 10 MiB x 3 files per service. Inspect with a bounded tail,
  and do not paste logs containing customer or provider data into tickets.
- Monitor headroom with `docker stats --no-stream`. Do not raise analyzer
  concurrency or add replicas without a measured load test and code review.
- Database backup, migration, verification, and customer E2E remain separate
  release gates. These scripts deliberately perform none of them.
