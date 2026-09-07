# Customer activation Production release

Owner authorization: `evet`, answering the explicit request to publish the
validated customer guide, first-request guidance and draft-preserving links.

Release status: **Deployed and verified on 2026-09-07 at 17:20 Europe/Berlin.**

## Exact scope

- Source/archive commit: `742553f7d6182c7de204edbf55d779de765e7ff5`.
- Validated application commit: `fff11e4e613d3ee9eb171396d3bcf9e2249b4b32`;
  later changes are status/documentation only.
- Branch: `codex/customer-activation-release-20260907`; pushed and exact remote
  source SHA verified before deployment.
- Baseline and rollback pair: `65a53b606b5f`.
- Immutable source directory: `/opt/mgautotech/file-service/releases/742553f7d618`.
- Archive SHA-256, identical locally and on VPS:
  `b836cac45d725634844e6aa05e36beb98b96bc084a2cc37b4b42489e60425b14`.

The optional guide supports all 12 locales. Customers with no orders and zero
credits see the existing credit guidance before optional profile fields.
Guide credit/order links from `/new-request` open a separate tab so entered
details and the selected file remain in the original request. Existing accounts
are not silently enrolled in the new-customer guide.

No migration, dependency, environment, payment, consent, Ads measurement,
firmware, Docker, Caddy, DNS or separate main-site implementation change.
The new metadata preference is backward-compatible and needs no database undo.

## Evidence available before cutover

- Exact runtime source retains the completed local checks: 1627/1627 full tests,
  lint, web/uploader typecheck, 12-locale i18n with 37 bundle tests, 282-page
  webpack build, strict native/PDF artifact checks, performance and 64 synthetic
  browser scenarios. Independent review cleared the immutable source and scope.
- Current live app/analyzer and release state matched `65a53b606b5f`; both
  healthy and both previous local images available for rollback.
- Anonymous pre-deployment HTTP smoke: **39/39 PASS**. All 12 homepages and
  localized file-service pages, public auth/request shells, `/en` redirect,
  readiness, protected report endpoints and four hashed assets checked.
  The guide endpoint is absent at the baseline (404), as expected.

## Production verification

- Immutable Linux Turbopack image build and the established deployment script
  both exited 0. Compilation completed in 101 seconds; all 282 pages generated.
  Mandatory i18n/client-bundle checks and strict artifact verification passed
  with 69 required assets. The local webpack asset count differs by bundler.
- Runtime and atomic release state both identify `742553f7d618`. App and analyzer
  are running and healthy, with zero restarts. App started at
  `2026-09-07T15:19:58.81064792Z`; analyzer at `2026-09-07T15:19:51.321826154Z`.
- Running app image ID:
  `sha256:09e44a6ce838b7b57515bd368bad6044a685edbc8d931f723d0a685503a9ebd6`.
  Running analyzer image ID:
  `sha256:917625e9e15d5e18912340f7f0c175abdd5dcff770ff50e59536e58d5118e5c1`.
- Anonymous post-deployment HTTP smoke: **43/43 PASS**, zero failures. All 12
  homepages and localized file-service pages, public auth/request shells,
  locale redirect, readiness and protected report endpoints passed. The new
  guide endpoint now returns the expected anonymous 401 with private/no-store.
- Four current hashed CSS/JS assets and all four captured pre-release assets
  return 200 with the expected MIME types, preserving existing open pages.
- A separate anonymous browser verified the hydrated login screen: security
  verification completed, Login enabled, Google sign-in ready. The registration
  link opened the expected account-setup screen. Neither screen had horizontal
  overflow at a 1265-pixel viewport or captured console warnings/errors.
- Caddy and the separate main-site app remained healthy with their original
  start timestamps and zero restarts; `mgautotech.de` remained available.
- No rollback was needed. The exact prior image pair remains available and is
  recorded as the previous release. Documentation commits after the source
  archive do not change the deployed runtime SHA.

The browser checks did not submit credentials or create an account. The HTTP
readiness probe establishes process health, not payment-provider health. Real
authenticated guide persistence and commercial transactions are not claimed
as tested in Production; the guide behavior has the separate local synthetic
and compiled-route evidence listed above.

## Recovery

The established deployment script checks the analyzer before switching the app,
then restores the prior pair if health checks fail. For a critical post-deploy
regression, the retained exact previous pair can be restored with:

```bash
cd /opt/mgautotech/file-service/releases/742553f7d618
bash scripts/vps/rollback.sh 65a53b606b5f
```

No volume deletion, database reset or down migration is part of recovery.
Ignored local receipts are under `.autopilot/runtime/activation-release/`.
Real customer registration, payment, email and firmware transactions are outside
the anonymous release-smoke claims.
