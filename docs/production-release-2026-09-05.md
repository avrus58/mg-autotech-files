# Production release receipt — 2026-09-05

## Outcome and scope

Owner explicitly requested publication of all completed changes. The cumulative
validated panel/localization package is live at https://file.mgautotech.de.

- Deployed source: `47ec45224470510b8ab15a4e9766727847842dea`.
- App image: `mgautotech-file-service:47ec45224470`.
- Analyzer image: `mgautotech-file-expert-analyzer:47ec45224470`.
- Previous healthy image pair retained: `8b06841df042`.
- Application activated at 2026-09-05 14:15:58 UTC; analyzer at 14:15:51 UTC.
- Both services healthy with zero restarts on final inspection.
- Archive SHA-256 verified locally and on VPS:
  `7b52fd36dcaa46158ec9dd73016521d7f9916097836bd1cee2892bc457d5ea58`.

Includes completed permanent localization enforcement/finalization, customer
and admin panel readability/responsive work, and all six reviewed panel
follow-up fixes. Existing functionality, supported locales and pricing rules
are preserved. See `panel-follow-up-review-2026-09-05.md` for application details.

Release packaging corrections narrowly include required prebuild fixtures in
Docker, preserve generated catalog LF endings through Windows Git archives,
and make source-boundary tests newline-portable. No quality gate was skipped.

No API-route, database migration, production dependency/lockfile, payment
configuration, legal, Compose or analyzer-source change versus prior live
`8b06841df042`. Unrelated dirty main-worktree changes were not mixed into this
validated linear-successor release. Source commits were pushed on the focused
`codex/homepage-refresh-20260830` branch. This receipt is a later docs-only commit
and does not change the deployed source identifier.

## Verification

| Gate | Result |
| --- | --- |
| Full tests | 1501/1501 PASS, zero failures/skips |
| Lint | Full lint plus final changed-test lint PASS |
| TypeScript | Web and all desktop projects PASS |
| Localization audit | 2448 sources × 11 non-English locales; zero clean English fallbacks |
| Linux prebuild catalog tests | 37/37 PASS |
| Actual VPS Production build | Next 16.2.11 Turbopack, 280/280 pages PASS |
| Local performance / emitted catalog budgets | PASS |
| Production dependency audit | Zero findings; not a claim about development dependencies |
| Public HTTP smoke | 29/29 PASS on final IPv4-first run |
| Live browser matrix | EN/DE/TR/ZH × homepage/login/register × laptop/mobile: 24/24 PASS |
| Final ordinary network checks | Readiness and homepage both HTTP 200, approximately 0.2 seconds |

Browser viewport sizes: 1366×768 and 390×844. The final matrix used real visible
language-menu changes and waited for translated headings, with no horizontal
overflow, nonempty alert or console warning/error. Chinese mobile registration
was also visually inspected. Initial language checks observed mixed English
preference/readiness and one transient language-load alert; these did not recur
in the corrected complete matrix. This is not a guarantee against future
transport failures.

HTTP smoke includes localized documents, public/anonymous route shells,
readiness, vehicle brands, expected 401 from protected admin APIs, and four
retained prior-release assets. Protected-page 200 responses mean anonymous
shell availability, not successful authenticated customer/admin workflows.

Full dependency installation reported development-tree findings (2 moderate,
6 high); no automatic dependency changes were made. Production-only audit was
clean. No live accounts, requests, payments, emails or customer files were
created/modified for release verification.

## Remaining availability observation

Intermittent Cloudflare HTTP 522 responses occurred both before and after this
release from the local HTTP client. Concurrent VPS public requests and browser
loads returned 200; both application containers stayed healthy. Explicit IPv4
and IPv6 checks subsequently returned 200, as did final default-network checks.
Root cause is not established, and the observation is **not marked fixed**.
No speculative DNS, firewall, Caddy or timeout change was made. No critical new
application regression was established by the final smoke/browser results.

Caddy and the separate mgautotech.de container start times changed independently
during this release turn; this release's commands only rebuilt/recreated File
Service app/analyzer services. Both separate services were healthy and the main
website returned 200. Their timestamps are not asserted unchanged.

## Recovery and evidence

Previous complete images were verified present before activation. Existing
`scripts/vps/rollback.sh 8b06841df042`, run from the new release directory, can
restore the analyzer-first pair and verifies resulting health. No database
rollback is required because this release contains no migration.

The focused worktree's ignored `.autopilot/runtime/` contains final test,
typecheck, audit, performance, Linux build, deployment and HTTP smoke logs:

- `release-20260905-final-tests.log`
- `release-20260905-final-typecheck.log`
- `release-20260905-audit-production.json`
- `release-20260905-vps-build-47ec452.log`
- `release-20260905-deploy.log`
- `release-20260905-public-smoke-final.json`

The final browser checks are also retained in the release task's tool history.
Earlier failed build/smoke attempts are diagnostic history, not final PASS
evidence. The standing 522 observation remains a separate availability follow-up.
