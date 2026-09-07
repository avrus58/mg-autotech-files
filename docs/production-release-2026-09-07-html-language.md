# Production release: initial public HTML language

Owner instruction: "Dostum sen su son guncellemeyi yayinla bir".
Verified on 2026-09-07 at 09:55 UTC (11:55 Europe/Berlin).

## Exact scope and identity

- Deployed source: `e1b3266f3bf862934fe48faaeb9061a00bfcea16`.
- Branch: `codex/html-language-release-20260907`, pushed and remote SHA checked.
- Direct parent and previous live source: `9b78cf41d31d59d6933da05cd40c2076e46d03b9`.
- Only the language delta from `a7827d8` was transplanted. Its original branch
  ancestry includes an unpublished customer guide; that guide was NOT released.
- Sixteen changed files, no dependency/lock, schema, environment, payment,
  consent, vehicle catalog, authentication or deploy-configuration changes.
- Unrelated dirty worktrees and the separate main-site repository preserved.
- Archive: `e1b3266f3bf8.tar.gz`, 12,743,236 bytes. Local and VPS SHA-256 matched:
  `f284a657ecdca17576e393c290bf3831418728e7a95725550cab58ea75e40651`.
- VPS source: `/opt/mgautotech/file-service/releases/e1b3266f3bf8`.
- A subsequent documentation-only commit records this receipt; runtime source
  remains the exact application commit above.

## Fresh pre-release validation

Historical receipts in `server-html-language-validation.md` are NOT substituted
for validation of this new, isolated release base.

- Full `npm test`: 1533/1533 PASS; no failures, cancellations or skips.
- Full lint PASS (only ignored generated runtime QA excluded).
- Full web and customer-uploader typecheck PASS.
- Main build prebuild i18n gate PASS: 12 locales, 2448 reviewed strings per
  non-English locale, zero clean English fallbacks; 37/37 bundle tests PASS.
  A redundant parallel i18n command was intentionally canceled, not counted as
  a pass; the complete prebuild gate is the successful receipt.
- Local webpack Production build PASS, 281 pages. Performance PASS: 139
  prerendered routes, 48 required public artifacts with correct opening HTML
  language, initial homepage gzip 15.7 KiB against the 80 KiB budget.
- Local raw-HTTP checker: 122/122 PASS, including 96 SEO variants, locale
  preference conflicts, query-preserving redirects and existing 404 contract.
  An initial unsupported CLI argument spelling was corrected before this run.
- Independent exact-commit review: no P0-P2 findings; 39 focused tests PASS.
- Isolated local Chrome: 104/104 PASS, all 12 locales without JavaScript and
  EN/DE/TR/ZH hydrated mobile/laptop plus actual language switching. Screenshots
  reviewed, no document overflow, duplicate document or React errors.
- Actual VPS Linux/Turbopack build PASS: same full i18n gate and 37/37 tests,
  TypeScript and 281 pages. A network-disabled/read-only container checked the
  produced image itself: 139 prerenders, all 48 required artifacts correct.

## Cutover, recovery and isolation

The existing reviewed `scripts/vps/deploy.sh e1b3266f3bf8` completed successfully.
Its cached build retained the previously checked application layers, then
started and health-checked analyzer before replacing File Service.

- Current pair: `mgautotech-file-service:e1b3266f3bf8` and
  `mgautotech-file-expert-analyzer:e1b3266f3bf8`, both healthy, zero restarts.
- App start: `2026-09-07T09:54:51.715865208Z`.
- Analyzer start: `2026-09-07T09:54:44.343780565Z`.
- Container image IDs match the newly built tagged image IDs.
- Previous `9b78cf41d31d` app/analyzer images remain available and recorded as
  the previous pair. Application-only recovery is available via the reviewed
  `bash scripts/vps/rollback.sh 9b78cf41d31d` from this release directory.
  No rollback was needed and no images/volumes were pruned.
- Caddy and the separate main-site app were not recreated: their start times
  remain `2026-09-06T19:22:19.119308515Z` and
  `2026-09-06T19:22:11.660307171Z` respectively.
- No migration, production database access, secret display, DNS/Caddy edits,
  customer mutation, real account creation, payment or email submission.

## Immediate live verification

- 115/115 read-only public GET records PASS: 96 SEO variants, 15 auxiliary
  checks and 4 hashed assets retained from the previous release.
- All 12 locales return the correct opening HTML language, Content-Language,
  self canonical, 13 language alternatives and server-visible localized content.
  German `de`, Turkish `tr`, Chinese `zh-CN` replace the old raw `en` shell.
- Readiness is OK, robots/sitemap and login/register available, anonymous admin
  navigation remains 401. The separate `mgautotech.de` is 200 with German HTML.
- Actual Production Chrome: 8/8 PASS, EN/DE/TR/ZH at 390x844 and 1366x768;
  raw/hydrated language correct, no overflow or React errors. Screenshots
  reviewed. Fresh browser contexts closed after verification.
- Browser backend calls were intercepted (32 Production-browser API requests);
  this validates published UI/assets, NOT authenticated operations, payment,
  backend availability or a Google conversion receipt.
- Local QA server was stopped. No ongoing monitoring was created.

## Known unchanged boundaries

Prefixless cookie/header-localized routes such as login/register still have an
English initial document shell. The pre-existing early Next 404 error shell
can lack `lang`; its 404/noindex behavior was preserved. Neither is claimed
fixed. This release does not prove Google has recrawled or indexed a language
variant, nor does it guarantee ranking or search-result presentation.

Fresh receipts are in ignored `.autopilot/runtime/html-release/`,
`.autopilot/runtime/html-language/` and
`.autopilot/runtime/html-language-production-postrelease.json`.
