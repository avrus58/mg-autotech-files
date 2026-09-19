# Device-verification retry hotfix Production release - 19 September 2026

## Authority and immutable scope

The owner answered `evet` to the explicit question requesting publication of
this correction. This is fresh approval for the follow-up package, not authority
to bundle unrelated work. The isolated release checkout was clean.

- Approved source: `031923f40a985b692765fa38e328fb77edf83427`.
- Previous live source: `d41f336819b2b1c9494e605f75ba299c0dda0921`.
- Fifteen changed paths: login bootstrap, device-verification panel/transport,
  typed localization catalogs/manifest, regression tests and incident receipts.
- No dependency/lockfile, schema/migration, environment, payment, advertising,
  pricing, consent or deployment-script change. No authentication weakening.
- Exact Git archive SHA-256 matched before and after transfer:
  `12ea05ce0a907eb33aa86578b8894f3391c49d8c431f831d08f7a9ecc5d6a0b6`.
- Previously absent release directory:
  `/opt/mgautotech/file-service/releases/031923f40a98`.

## Validation and rollback readiness

Implementation evidence: `docs/device-verification-retry-2026-09-19.md`.
Final local full suite passed **1742/1742**, with zero failed/skipped/cancelled
tests; standard lint and web/desktop typecheck passed. The i18n gate passed for
12 locales, 2471 reviewed strings, zero clean-English fallback and 37/37 bundle
cases. Actual-component synthetic Chrome checks passed 24 EN/DE/TR/ZH x
mobile/laptop x loading/error/challenge cases. These are not live logins.

A fresh physical-source standard Windows build and unchanged strict postbuild
passed exit 0. Build ID: `e-1b8NHHVNTBxftC7DZPn`. The previous junction-based
build failure is not reclassified. Independent source review found no release
blocker. A second release-scope review rehashed 1045 snapshot source/config/test
files with zero mismatches and independently checked the full-test/build logs.

Preflight verified the previous app/analyzer pair healthy with zero restarts and
matching release state. Both rollback images remain available. No environment
values were printed. Read-only anonymous pre-smoke passed **39/39**.

Rollback target, only if required:

```sh
cd /opt/mgautotech/file-service/releases/031923f40a98
bash scripts/vps/rollback.sh d41f336819b2
```

## Deployment result

`bash scripts/vps/deploy.sh 031923f40a98` completed with exit 0. The unchanged
Linux production build passed prebuild (12 locales, 37/37 bundle tests), Next
compilation, TypeScript and 282/282 page generation. Strict postbuild passed:
69 assets (5 fonts, 30 pdfkit, 34 sharp), compiled protected-route 401, valid
synthetic PNG/PDF and zero external fetches. No validator was bypassed.

- Application image: `mgautotech-file-service:031923f40a98`,
  `sha256:8baf66dd1b6cabc7a0982c821d673320742b3150040e882f1a50d40e9ffc7fe7`;
  started `2026-09-19T15:22:58.131031511Z`, healthy, zero restarts.
- Analyzer image: `mgautotech-file-expert-analyzer:031923f40a98`,
  `sha256:c4558f922894f797a33ab06d148fb6dbca77e0f3b7e82a72906316cf4a621063`;
  started `2026-09-19T15:22:50.457300122Z`, healthy, zero restarts.
- Atomic release state matches the new pair and retains `d41f336819b2` as the
  previous pair. Rollback image IDs remain available: app
  `sha256:0d84df11599e8b7aad258d803b8f77a07fc8d2e1576eaa45b1308e9027953fe7`,
  analyzer `sha256:5a92c18318e30159f284214443d7da8fc2bd32a425e40f269a4d985fa614f7a3`.
- Immediate anonymous post-smoke at `2026-09-19T15:23:19.153Z`: **43/43 PASS**.
  This covers localized initial HTML, login/register/request/admin/dashboard
  shells, no-store readiness, English redirect, three protected API 401s, four
  current and four retained prior assets, and the separate main site. No POST
  probes were used.
- The separate main-site app, Caddy and Postgres retained their exact preflight
  start times and zero restart counts. They were not release targets.
- Independent local artifact review confirms the archive hash, successful Linux
  build/strict checker, healthy cutover, matching runtime image IDs and complete
  pre/post smoke JSON. No blocking inconsistency found. No rollback required.

## Connected Chrome observation

The available Chrome profile's EXISTING session reached admin before deployment.
A fresh post-release reload at `15:23:25Z` briefly showed session restoration;
by `15:23:35Z`, admin was visible without login-required or sync-error UI.
Navigation to `/dashboard` loaded the German customer panel, including
`Kundenbereich`, `Meine letzten Anfragen` and `Abmelden` (English-only probes
initially did not recognize those localized labels). Browser Back at `15:23:54Z`
returned to admin; at `15:24:07Z`, admin was visible without restoration/error UI.
At `15:24:13Z`, the bounded browser log capture contained zero error/warning
entries. This is existing-session navigation evidence, not affected-PC recovery.
At `15:24:52Z` (approximately 58 seconds after Back and 87 seconds after reload),
admin remained visible with no login-required, restoration or sync-error UI;
the final bounded log capture again contained zero error/warning entries.

## Evidence and incident boundary

Local ignored evidence directory:
`.autopilot/runtime/auth-device-release-20260919/` (exact source archive,
`deploy.log`, `release-smoke.mjs`, pre/post smoke JSON).

The failing remote computer is not connected here. Existing-session checks in
the available Chrome profile do not prove a fresh login or email delivery there.
The underlying incident remains In Progress pending actual remote recovery.
No logout, cookie clearing, credential entry, OTP retrieval, real email dispatch
or customer/payment mutation is part of this release check. Security settings
remain unchanged. Pre-existing dependency advisories are documented in the prior
release receipt; this scoped hotfix is not a clean security-audit claim.
