# Production release: optional registration locale reads, 5 October 2026

## Approved scope

The owner answered `evet` to the explicit offer to publish the already prepared
registration correction. This approval covers only the reviewed candidate
`b4c22314d60f0db6cd48af2c7b57583f3f8a0f70` on
`codex/acquisition-register-locale-20261005`, not unrelated work in the primary
checkout, further Ads changes or the separate other-device login incident.

The only runtime diff from the previously live `61d82840aac7` is in
`src/app/register/page.tsx`: the existing safe `readStoredLocale()` helper and
a guarded raw cookie-header read replace optional preference reads that could
throw before the SDK signup call. Existing locale precedence, callback,
CAPTCHA, recovery, visible text and layout remain unchanged. There is no
schema, dependency, price, consent, payment, session-policy or catalogue change.

## Source and release verification

- Focused commit and remote feature branch both verified as `b4c22314d60f`.
- Original immutable archive SHA-256:
  `9a4c31c0d96c9cd840712930232800e3faeb24381b40895abc4fd72c6c58f6bf`.
- Archive uploaded completely and checksum verified before extraction into
  `/opt/mgautotech/file-service/releases/b4c22314d60f`. No Git metadata or
  environment files were included. Root-owned existing runtime configuration
  was used by the reviewed runner without printing values or changing settings.
- The initial physical-source checksum expected mixed Windows CRLF bytes;
  Git archive emits uniform CRLF for this TSX. Preflight stopped before any
  deployment. Archived source SHA-256 `c43849874ae3354340686f405b4d4eb4ec6d3d3d3367fc9ab519b4f0629e6734`
  was then verified against the exact archive and normalized committed Git blob
  `b028001db878e11a133a8cfd463485e41db247bfbcc789a0879db1f779f1c419`.
  Content is identical to the reviewed source; deploy/common/rollback shell
  scripts are LF-only and byte-identical to the commit. Independent reviewer
  confirmed no source discrepancy. No source was edited to bypass this check.
- Existing `bash scripts/vps/deploy.sh b4c22314d60f` exited **0**. It built both
  new images before replacing the healthy old app, started and verified the
  private analyzer first, then started and verified the app. Release state now
  records `b4c22314d60f` as current and `61d82840aac7` as previous.

## Validation

The unchanged source/test/lock hashes retain the completed local validation:
actual RegisterPage 71/71, combined focused 100/100, targeted i18n 109/109,
mandatory 12-locale i18n 37/37 with zero clean-English fallback, lint,
web/desktop typecheck, full **1,866/1,866** tests and fresh Webpack production
build (282 pages and unchanged strict artifact verification). The independent
frozen source review found no P1/P2 issue.

The fresh VPS Linux standard production build also passed:

- Next.js 16.2.11 / Turbopack; build ID `KDCumHmx72BirKzk6eaLF`.
- Prebuild i18n 37/37, TypeScript and 282/282 generated pages.
- Unchanged strict postbuild: 69 required assets, five report fonts, 30 PDFKit
  files, 34 Linux sharp files, compiled anonymous-auth status 401 and zero
  checker external fetches. No packaging gate was weakened.

Anonymous GET-only production checks:

- Pre-release **57/57**, 4 October 23:40:45 UTC / 5 October 01:40:45 CEST.
- Post-release **58/58**, 4 October 23:51:21 UTC / 5 October 01:51:21 CEST.
- Public homepage and File Service page in all twelve languages retain the
  expected HTTP/content-language/server HTML-language contract.
- Register/login shells checked in EN/DE/TR/ZH; private endpoints remain
  denied/private and private panels remain noindex.
- All 20 pre-release static asset SHA-256 checks still match after release.
- The new compiled guarded cookie reader, not merely the old recovery marker,
  is publicly served by the registration page's referenced scripts.

Additional robots/sitemap and homepage canonical/alternate-presence checks
passed **6/6**; this is not Search Console indexing or ranking evidence.

Browser render/localization QA passed **16/16** in the existing Codex in-app
browser context: initial register step and login shell, EN/DE/TR/ZH, 1366x768 compact laptop and
390x844 mobile. No horizontal overflow or visible page crash was observed;
hydrated headings/buttons/labels switched correctly. Eight public register
screenshots were saved. No login screenshot was saved because the embedded
Google iframe personalized from the existing Google browser session. It was
not clicked; no account, login or consent action was performed. Original EN
language preference and viewport were restored; only the QA tab was closed.

The previously available Chrome connection disconnected, so these are IAB
render checks, not Chrome/affected-device session tests. Console was **not**
zero: twelve hidden-format `NaN` entries (six errors/six warnings) were sourced
to the Cloudflare Turnstile iframe, and two Google GSI repeated-initialization
warnings appeared during locale changes. No app-origin console error was
captured. These third-party entries do not establish real signup failure or
success; they were retained as evidence rather than suppressed or labelled
as a fully clean browser-console result. Prefixless server-language and other
unchanged findings are outside this registration preflight release.

## Runtime and rollback

App and analyzer both run `b4c22314d60f`, are healthy and have zero restarts.
App started at 4 October 23:50:52 UTC; analyzer at 23:50:44 UTC. A later fresh
check at approximately 23:52:31 UTC confirmed health, exact release labels,
zero restarts, readiness HTTP 200 `{"status":"ok"}` and both retained rollback
images. The other workshop app, Caddy and PostgreSQL retain their original
images/start timestamps/healthy status/zero restarts; they were not recreated.

Rollback uses the retained paired images, without rebuilding:

```sh
cd /opt/mgautotech/file-service/releases/b4c22314d60f
bash scripts/vps/rollback.sh 61d82840aac7
```

No critical regression was observed, so no rollback was performed. No volumes,
old images, backups or customer data were removed.

## Evidence boundaries

This is a code-only registration preflight fix, not proof that every denied
storage environment supports the full real SDK signup/session flow. No real
account, login, CAPTCHA, email, payment, customer-data operation or artificial
conversion was performed. Email delivery, other-device session persistence,
Google conversion receipt, new customers and attributed revenue remain
separate evidence questions. Ads budgets and all Ads settings were untouched
in this release turn; the preceding Ads edits have their own dated receipt.

Independent final release review accepted the deployment/smoke records before
the separate completed browser QA above. Detailed ignored receipts:

- `.autopilot/runtime/register-locale-storage-validation-2026-10-05.json`
- `.autopilot/runtime/register-locale-production-release-2026-10-05.json`
- `.autopilot/runtime/register-locale-release-pre-2026-10-05.json`
- `.autopilot/runtime/register-locale-release-post-2026-10-05.json`
- `.autopilot/runtime/register-locale-release-seo-preservation-2026-10-05.json`
- `.autopilot/runtime/register-locale-release-20261005-browser-qa.json`

Root also visually inspected the saved DE mobile and ZH laptop registration
captures; the reported layout/localized-heading result agrees with those views.

Tracked follow-up changes are release documentation only; the live runtime
remains the immutable approved `b4c22314d60f` source.
