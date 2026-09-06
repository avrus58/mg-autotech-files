# Production release receipt — 2026-09-06 SEO report isolation

## Outcome and exact scope

The owner's current `yayinla` instruction authorized this scoped release.
The Google-report isolation fix is live at https://file.mgautotech.de.

- Deployed archive source: `412180164e96d231591709661c156fbf2e0d92c3`.
- Reviewed code candidate: `a7d5b0ac6507e18ac0084fe1b7a6cd886f58286e`;
  the later deployed commit adds only audit/status documentation.
- App image: `mgautotech-file-service:412180164e96`.
- Analyzer image: `mgautotech-file-expert-analyzer:412180164e96`.
- Analyzer activated at 2026-09-06 18:10:35 UTC; app at 18:10:42 UTC.
- Both services healthy with zero restarts after deployment and final smoke.
- Previous healthy rollback pair: `47ec45224470`, retained locally and recorded
  in `/var/lib/mgautotech-file-service/release-state`.
- Archive SHA-256 verified on both machines:
  `6548634588880d6c50c86f697ccd560672090f164b2b74fc1a6a50cd508e07e0`.
- Source branch `codex/seo-report-site-isolation-20260906` pushed and verified.

All three Search Console queries restrict pages to the exact HTTPS File Service
origin before aggregation and row limits. All five GA4 queries restrict
`hostName` to `file.mgautotech.de`; existing event allowlists remain combined
with that filter. Internal report limitations identify hostless-event exclusion
and bounded aggregate rows. These are reporting changes, not new tracking.

Runtime source changes are limited to the three `src/lib/seoGrowth` modules,
with synthetic regression tests and documentation. No migration, database or
customer mutation, payment/Ads configuration, consent/privacy wording, public
UI, dependency manifest/lockfile, Compose, or analyzer source change. Unrelated
dirty main-worktree edits and earlier homepage-worktree notes were preserved.

## Release validation

- Fresh full lint and web/desktop TypeScript checks: PASS.
- Fresh full test suite: **1504/1504 PASS**, no failures, skips or cancellations.
- Targeted SEO suite at unchanged code candidate: **16/16 PASS**; independent
  immutable review found no actionable issue in code or later audit docs.
- Actual Linux Production build: Next.js 16.2.11 Turbopack, **280/280 routes**.
- Mandatory Linux prebuild: **37/37 PASS**; 12 supported locales, 2448 reviewed
  source strings per non-English locale, zero clean English fallbacks.
- Fresh npm production-only dependency audit: **zero findings**. The builder's
  full development tree still reported 2 moderate and 6 high findings; this is
  not a claim of zero vulnerabilities across every dependency/runtime.
- Public HTTP smoke: **35/35 before and 35/35 after** deployment, including
  EN/DE/TR/ZH homepage/login/register documents, anonymous application shells,
  readiness, vehicle brands, sitemap/robots, protected API rejection, the
  separate main website and four retained prior-release static assets.
- The modified `/api/admin/seo-performance` surface returned expected anonymous
  HTTP 401. Compiled server output contains the new report-scope limitation.
- Additional post-release IPv4 readiness/homepage checks: HTTP 200.
- Browser: login reached `Security verification complete`, enabled Login and
  loaded Google sign-in; its registration link opened the account form.
  Registration document width/content width both 1265px; no console errors.
  No credentials entered and no account, request, email or payment submitted.

Caddy and the separate `mgautotech.de` application retained their pre-release
start timestamps (2026-09-05 14:06:34 and 14:06:25 UTC respectively), remained
healthy and were not recreated by this release. Only File Service app/analyzer
were switched using the existing analyzer-first release procedure.

## Limits and recovery

An authenticated live Google report fetch was not exercised in this release:
the available browser had no authenticated File Service admin session. Request
shape is verified by synthetic tests; anonymous 401 and compiled-source checks
are not presented as successful Google API receipt or a real business funnel.

No 522 occurred in this release's checks. The previously intermittent 522
root cause remains unresolved; passing health checks do not establish a fix.
No speculative Cloudflare, DNS, firewall, Caddy or timeout changes were made.

From `/opt/mgautotech/file-service/releases/412180164e96`, the reviewed
`bash scripts/vps/rollback.sh 47ec45224470` restores the previous complete pair
and verifies health. No database rollback is needed. No critical new regression
was found, so rollback was not invoked.

Ignored `.autopilot/runtime/release-20260906-*` files retain lint, typecheck,
full tests, production audit, Linux build, deploy, previous-asset inventory and
before/after public smoke evidence. This receipt is a subsequent docs-only
commit and does not alter the deployed source identifier above.
