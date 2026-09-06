# Production release receipt - mobile admin

The owner's current "Canliya al" instruction authorized release of the previously
reviewed mobile admin and homepage mobile account-entry package.

## Exact release

- Site: https://file.mgautotech.de
- Source: `9b78cf41d31d59d6933da05cd40c2076e46d03b9`.
- Branch: `codex/admin-mobile-navigation-20260906`, pushed and verified.
- Runtime source unchanged from validated `def5538`; later changes are docs only.
- Archive SHA-256, verified locally and on the VPS:
  `3f2e101b5c1db700a3178349cc479bcdc6db1054b56e9d0c1c68bdf531104f86`.
- App: `mgautotech-file-service:9b78cf41d31d`, started
  2026-09-06 19:13:41 UTC.
- Analyzer: `mgautotech-file-expert-analyzer:9b78cf41d31d`, started
  2026-09-06 19:13:34 UTC; its source is unchanged, deployed as the standard pair.
- Both services healthy, zero restarts at post-release verification.

Only mobile admin navigation, filters, overviews, vehicle section navigation,
save-action placement, notification containment, the read-only own-navigation
endpoint and homepage mobile account entry are included. Desktop admin and the
customer dashboard are preserved. No dependencies, migration, SQL, business
prices, payment/Ads configuration, environment values, DNS or Caddy changes.
Unrelated dirty owner work was not included.

## Validation

- Unchanged-source local suite: 1517/1517 tests, lint, web/desktop typecheck,
  i18n, build, performance and independent immutable reviews passed. Existing
  synthetic UI evidence: 38 + 5 scenarios, 45 route-width checks, and 16 desktop
  comparisons with zero changed pixels. See the bounded mobile review receipt.
- Actual Linux Production build: Next.js 16.2.11 Turbopack, TypeScript passed,
  281/281 generated pages. Mandatory prebuild: 37/37 tests; all 12 locales,
  2448 reviewed source strings, zero clean English fallback.
- Fresh production-only npm audit: zero findings. The builder's full development
  dependency tree reports 2 moderate / 6 high findings, as before; this is not
  a blanket zero-vulnerability claim.
- Public HTTP smoke: 34/34 before, 35/35 after, at 2026-09-06 19:14:13 UTC.
  Includes EN/DE/TR/ZH home/login/register documents, application shells,
  readiness, public vehicle brands, sitemap/robots, anonymous admin API rejection,
  four old hashed assets and the separate main website.
- `/api/admin/navigation` exists in compiled output and rejects anonymous
  requests with HTTP 401.
- Live browser at 390px: new homepage Login link visible and navigates correctly;
  no horizontal overflow. Login reaches "Security verification complete" and
  enables Login. Anonymous `/admin` leaves session checking and shows the proper
  protected sign-in screen. No credentials, accounts, orders, payments or mail
  submitted. Two captured console messages came from the Cloudflare challenge
  frame, not first-party application code; verification still completed.
- Authenticated live staff menu/E2E and physical mobile devices were not tested;
  permission/focus/navigation behavior is covered by the scoped synthetic tests.

Caddy and the separate `mgautotech.de` app retain their 2026-09-05 14:06:34 and
14:06:25 UTC start timestamps respectively; both remain healthy and were not
recreated. Browser viewport override was reset after QA.

## Recovery and receipts

Previous pair `412180164e96` is recorded in
`/var/lib/mgautotech-file-service/release-state` and both images remain local.
From `/opt/mgautotech/file-service/releases/9b78cf41d31d`, the existing reviewed
`bash scripts/vps/rollback.sh 412180164e96` restores that complete pair without
database work. No critical regression was detected, so rollback was not invoked.

Ignored `.autopilot/runtime/mobile-release-*` artifacts retain archive, hash,
Linux build/deploy, dependency audit, runtime before/after, prior asset inventory
and public smoke results. This receipt is docs-only, subsequent to the deployed
source above; it does not change the deployed source identifier.
