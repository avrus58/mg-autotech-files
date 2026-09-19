# Browser-session hotfix Production release - 19 September 2026

## Authority and immutable scope

The owner answered `evet` to the scoped clean-build and Production-publication
question. Only the prepared browser-session correction was authorized and
released; unrelated owner worktrees were left untouched.

- Deployed source: `d41f336819b2b1c9494e605f75ba299c0dda0921`.
- Previous live application: `c08b842683bd86d977177455f3564495e66b19bd`.
- Eight runtime auth files; accompanying tests and operational receipts only.
- No dependency manifest/lockfile, migration, database, environment, payment,
  Ads, pricing, consent, layout or translated-copy changes.
- Ordinary logout is local; password-reset global logout, current-session
  revocation and all existing server/device/CAPTCHA checks remain enforced.
- Git archive SHA-256, checked locally and after transfer:
  `ec560cedf97dbe80050de63cda5c8608f9d8a4e0aafac1dc3173a2e63b7091c1`.
- Exact source archive extracted into the previously absent directory
  `/opt/mgautotech/file-service/releases/d41f336819b2`.

## Validation and rollback readiness

The implementation receipt is `docs/auth-session-hotfix-2026-09-19.md`.
Final full tests passed **1703/1703**, lint and web/uploader typecheck passed,
and i18n passed. Fresh independent immutable review found no actionable P0-P2
source/scope issue and reran **69/69** focused tests successfully.

The earlier Windows in-place build exited 1 because of its dependency junction;
that result is not reclassified as a passing build. This release used a fresh
Linux source build through the unchanged Dockerfile and standard npm scripts.
Its prebuild, build and strict postbuild all passed: 12 locales, 2472 reviewed
source strings per non-English locale, no clean English fallbacks, 37/37 bundle
tests, TypeScript, 282/282 pages, 69 required artifact assets, compiled protected
route 401, synthetic PNG/PDF generation and zero external fetches in the artifact
checker. No validator was bypassed.

Preflight found the prior app/analyzer pair healthy with matching release state
and both rollback images retained. The reviewed environment contract passed
without printing values. Read-only anonymous pre-smoke passed **39/39**.

## Deployment and live verification

`bash scripts/vps/deploy.sh d41f336819b2` completed with exit 0. The previous app
served traffic throughout the build; the script switched the analyzer and then
the application only after all build gates passed, checking health at each step.

- Application started `2026-09-19T12:23:06.006136193Z`, healthy, zero restarts.
  Image: `sha256:0d84df11599e8b7aad258d803b8f77a07fc8d2e1576eaa45b1308e9027953fe7`.
- Analyzer started `2026-09-19T12:22:58.200373347Z`, healthy, zero restarts.
  Image: `sha256:5a92c18318e30159f284214443d7da8fc2bd32a425e40f269a4d985fa614f7a3`.
- Atomic release state matches `d41f336819b2` and records `c08b842683bd` as the
  previous pair. Both previous images are still available.
- Immediate read-only anonymous post-smoke at `2026-09-19T12:23:23.198Z`:
  **43/43 PASS**. Twelve localized home/service routes have correct initial HTML
  language; login/register/request/admin/dashboard shells, no-store readiness,
  English redirect, three protected API rejections, four current and four prior
  hashed assets, and the separate main site passed. No POST probes were used.
- The separate `mgautotech.de` app, Caddy and Postgres retained their exact
  pre-release start times and restart counts. They were not deployment targets.
- Connected Chrome's existing authenticated session loaded admin after a fresh
  post-release reload and stayed authenticated beyond the reported 2-3 seconds.
  Customer dashboard also loaded with authenticated navigation and logout UI.
  Browser Back returned to admin; at `12:24:49Z`, approximately 47 seconds after
  returning, admin remained visible without login-required or sync-error UI.
  No sign-out, cookie clearing, credential entry, customer mutation or payment
  was performed. This is existing-session evidence, not a fresh-login test on
  the failing remote computer. A console-log follow-up could not run through the
  available browser binding; no zero-console-error claim is made.

Rollback, only if needed:

```sh
cd /opt/mgautotech/file-service/releases/d41f336819b2
bash scripts/vps/rollback.sh c08b842683bd
```

No rollback was required. Local ignored evidence is under
`.autopilot/runtime/auth-session-hotfix-20260919/`: exact source archive,
`deploy-linux.log`, pre/post smoke JSON and the read-only smoke script.

## Remaining boundaries and separate security follow-up

The failing remote computer's original trigger was not directly captured.
Its owner should reload to obtain the new client and retry login there; that
confirmation is still required before closing the reported incident.

Fresh production-only dependency audit reported four **pre-existing** findings:
Next 16.2.11 critical, sharp 0.35.0 high, js-yaml 4.3.1 high and
baseline-browser-mapping 2.10.32 moderate. Manifests/lockfiles match the former
live source. No audit fix or unreviewed version change was bundled into this
urgent auth release. Independent source triage found no newly introduced or
auth-specific release blocker, not a clean security audit.

Next's Windows-specific issue does not match the Linux deployment. Its AVIF
optimizer risk and sharp's libheif risk need a separate urgent upgrade review;
no attacker-controlled AVIF decode path was established in this bounded review.
The current logo handler accepts authenticated PNG/JPEG with byte-signature
checks; remote image sources are not configured. These observations are not
proof of non-exploitability. js-yaml is in the desktop updater dependency path;
the browser-mapping package is in the Next/browser-targeting path.

Primary upstream references:
- https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4
- https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c
