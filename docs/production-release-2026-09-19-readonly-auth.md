# Read-only user-verification hotfix release - 19 September 2026

## Explicit authority and exact scope

The owner answered `evet` to the direct request to publish this new correction.
This approval applies to `e90e4362c7bad699cb765402a6fa558cbb872e1e`, not unrelated
owner work. The isolated checkout was clean. Previous live source is
`031923f40a985b692765fa38e328fb77edf83427`.

The correction changes five runtime paths: browser Supabase client, stable auth
guards, login bootstrap, onboarding and datalog loader. Tests and incident
documentation complete the 14-file commit. Compared with the previous live
source, a fifteenth path is the already committed prior release receipt.
There is no schema, environment, dependency/lockfile, server authorization,
device-security setting, price, payment, advertising or deployment-script change.

## Validation and preparation

- Full suite **1765/1765**, standard lint, full web/desktop typecheck and i18n
  pass. The localization gate checks 12 locales, 2471 source rows, zero clean
  English fallback and 37 compact-bundle cases.
- Actual installed-SDK regressions: 15/15. Actual-source deterministic admin
  boundary regressions: 8/8. These reproduce the exact warning without claiming
  a live affected-PC trace. Genuine absent/revoked sessions remain denied.
- Fresh physical-source standard build and unchanged strict postbuild pass:
  `OxoJE3X7HZ4tn5MP0ZqVt`, 280/280 generated pages, 43 assets, protected 401,
  valid synthetic PNG/PDF and zero external fetches. Source/runtime hashes match.
- Independent immutable review rehashed 20 receipt files and 1047 source/test/
  script/app/config files with zero mismatches, verified raw validation logs and
  found no blocker. Implementation evidence:
  `docs/auth-readonly-verification-2026-09-19.md`.
- Read-only pre-smoke at `2026-09-19T16:55:20.879Z`: **39/39 PASS**.
- Current app/analyzer pair is healthy, zero restarts; matching release state
  and both rollback images available. The separate main-site app, Caddy and
  Postgres are healthy and are not release targets.
- Exact source archive SHA-256 matches locally and on the VPS:
  `42f4329ad3ec96970131bb5106aec2268b78eb68fe44035022a37e7837320ecb`.
  Only two unused environment example templates were omitted from the Git
  archive; no runtime source was excluded. No secret/config values were read or
  printed by the agent. Existing deployment machinery supplies runtime settings.
- Previously absent release directory:
  `/opt/mgautotech/file-service/releases/e90e4362c7ba`.

Rollback target if required:

```sh
cd /opt/mgautotech/file-service/releases/e90e4362c7ba
bash scripts/vps/rollback.sh 031923f40a98
```

## Deployment and immediate verification

The unchanged `bash scripts/vps/deploy.sh e90e4362c7ba` completed with exit 0.
The fresh Linux standard prebuild, compilation, TypeScript, 282/282 pages and
strict postbuild all passed: 69 assets, compiled protected 401, valid PNG/PDF,
zero external fetches. No validator was skipped or weakened.

- App image `mgautotech-file-service:e90e4362c7ba`:
  `sha256:1faf3014072e4ad06072825a5edd910a2875219283f1240a3fa401c564ed503d`;
  started `2026-09-19T17:03:20.585087066Z`, healthy, zero restarts.
- Analyzer image `mgautotech-file-expert-analyzer:e90e4362c7ba`:
  `sha256:f65535d680574982f2df7b7ccf3e48aa4bb18d0d17493d6eab4bf33880c65cb0`;
  started `2026-09-19T17:03:13.147218338Z`, healthy, zero restarts.
- Atomic release state matches this image pair and records `031923f40a98` as
  previous. Both previous image IDs remain available: app
  `sha256:8baf66dd1b6cabc7a0982c821d673320742b3150040e882f1a50d40e9ffc7fe7`
  and analyzer
  `sha256:c4558f922894f797a33ab06d148fb6dbca77e0f3b7e82a72906316cf4a621063`.
- Immediate post-smoke at `2026-09-19T17:03:58.641Z`: **43/43 PASS**:
  12-locale initial HTML, public/auth/panel
  shells, readiness/no-store, redirect, three protected anonymous 401s, current
  and retained previous assets, and the separate main site. All probes are GET.
- Separate main-site app/Caddy/Postgres retained their exact preflight image IDs,
  start times and zero restart counts. They were not changed by this release.
- No rollback was needed. No database/configuration/payment mutation occurred.
- Independent read-only release audit corroborates archive hash, fresh Linux
  build, strict packaging, healthy runtime identities, rollback pair and all
  pre/post smoke outcomes; no blocking inconsistency found.

## Browser and incident boundaries

Before cutover, the connected Chrome profile's existing session showed the
admin panel at `2026-09-19T16:56:54.211Z` without login-required, restoration or
sync-error UI. Post-cutover reload at `17:03:45.263Z` loaded the new application;
at `17:04:06.931Z`, admin was visible without login-required, restoration or
sync-error UI, and the bounded console capture had zero warnings/errors.
Navigation to `/dashboard` at `17:04:19.039Z` loaded the German customer panel;
at `17:05:05.507Z`, both `Kundenbereich` and `Meine letzten Anfragen` were visible
without login-required/restoration UI. Browser Back at `17:05:11.532Z` returned
to admin; at `17:05:31.324Z` (about 20 seconds later), admin remained visible
without login-required/restoration/sync-error UI. The final bounded console
capture again contained zero warnings/errors.
This is not a fresh login on the affected remote computer.
No passwords, cookies, tokens or customer details are collected. No logout,
cookie clearing, OTP retrieval or real email dispatch is used to test this.

Local ignored release evidence:
`.autopilot/runtime/auth-readonly-release-20260919/`.
The underlying incident remains In Progress until affected-device recovery is
confirmed; successful publishing alone does not prove that recovery.
