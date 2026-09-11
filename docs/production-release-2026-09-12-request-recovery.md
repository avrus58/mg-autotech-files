# Request preparation recovery — Production release

Owner authorization: `canliya al`. Deployed and verified on **12 September
2026 at 01:05 Europe/Berlin** (11 September 23:05 UTC).

## Exact scope and identity

- Source/archive commit: `511a22b48c7e30eae5e026bf6f8512c7c84389e4`.
- Branch: `codex/acquisition-verification-20260912`; pushed and exact remote
  source SHA verified before deployment.
- Previous runtime and retained rollback pair: `742553f7d618`.
- Isolated release directory: `/opt/mgautotech/file-service/releases/511a22b48c7e`.
- Source archive SHA-256, verified locally and on the VPS before extraction:
  `67ce4fcd4d3559662d98bf55493fdb72cbe6795789be3bcfd6bc6671e4452cef`.

Only the new-request preparation transport-rejection catch and error alert
semantics changed at runtime. A rejected preparation fetch releases submit,
shows the existing translated error and retains the selected file, form and
idempotency metadata for a customer-initiated retry. No automatic retry was
added. Existing downstream upload and success behavior remain unchanged.

The parent is a documentation-only successor of the verified live source.
The unrelated dirty owner checkout was excluded. No database migration,
dependency/lockfile, environment configuration, authentication, pricing,
payment, consent, tracking, campaign, Caddy, DNS or main-site code change.
Existing environment files were consumed internally by the reviewed release
scripts; values were not displayed or copied into this report.

## Pre-release gates

- The unchanged candidate retains its completed full **1635/1635** test suite,
  lint, web/desktop typecheck, 12-locale i18n and 282-page local Production-mode
  build. The full test suite was not rerun during the deployment turn.
- Fresh focused request-recovery, VPS packaging/environment-contract and
  upload-security checks: **38/38 PASS**. Fresh full lint and web/desktop
  typecheck: PASS. Independent immutable-source review: no blocking finding.
- Prior actual-handler baseline/candidate comparison: 5/8 versus 8/8.
  Actual feedback JSX plus compiled CSS passed bounded EN/DE/TR/ZH mobile and
  laptop checks. These were synthetic fixtures, not authenticated E2E.
- Running service/analyzer pair and atomic release state matched the expected
  baseline; both were healthy. Both exact prior images were available.
- Anonymous pre-release HTTP smoke: **38/38 PASS**. The Chinese initial-HTML
  assertion uses the existing correct `zh-CN` contract, not bare `zh`.

## Build and live verification

- Existing VPS infrastructure was retained. The Linux image was built before
  cutover while the old application remained running. Mandatory i18n checks
  passed for 12 locales, 2472 source strings and **37/37** bundle tests.
- Production Turbopack compilation, TypeScript and **282/282** generated pages
  passed. Strict postbuild verified **69** required assets, compiled protected
  route status 401, synthetic PNG and valid PDF, with zero external fetches
  during that artifact check. The previous local webpack asset count was 43;
  the two bundlers have different emitted artifacts.
- The established `scripts/vps/deploy.sh 511a22b48c7e` exited 0 after starting
  and health-checking the analyzer, then the application. Its second build
  reused the completed cache. No critical regression or rollback occurred.
- Live service: `mgautotech-file-service:511a22b48c7e`, started
  `2026-09-11T23:05:27.82997626Z`, healthy, zero restarts. Runtime image ID:
  `sha256:01d48c9bf7acbaf612bd10058f2e231a8dd74889672839d37e1d4b07e0336a47`.
- Live analyzer: `mgautotech-file-expert-analyzer:511a22b48c7e`, started
  `2026-09-11T23:05:20.378989401Z`, healthy, zero restarts. Runtime image ID:
  `sha256:851017167acbc2903abb845014b8c728c2b83a02c905113f6e1b2a9013704fdc`.
- Atomic release state agrees with both running images and records the exact
  previous pair as `742553f7d618`.
- Immediate anonymous post-release HTTP smoke: **42/42 PASS**, zero failures.
  All 12 homepages and localized file-service pages returned 200 with correct
  initial HTML language and no Next error shell. Login/register/request shells,
  `/en` canonical redirect, no-store readiness, protected admin/account routes
  and anonymous preparation/onboarding rejection passed.
- Four current hashed CSS/JS assets and four captured pre-release asset URLs
  returned 200. Current asset MIME types were checked. The protected POST probes
  were unauthenticated and rejected before request processing or mutation.
- Caddy and the separate main-site app remained healthy, with unchanged start
  timestamps (`2026-09-06T19:22:19.119308515Z` and
  `2026-09-06T19:22:11.660307171Z` respectively) and zero restarts.
  `https://mgautotech.de/` returned 200 before and after deployment.

## Recovery and limits

The previous complete image pair remains on the VPS. For a critical regression:

```bash
cd /opt/mgautotech/file-service/releases/511a22b48c7e
bash scripts/vps/rollback.sh 742553f7d618
```

No database reset, migration reversal or volume deletion is needed for this
code-only fix. Local ignored smoke receipts are under
`.autopilot/runtime/release-20260912/`. A documentation-only follow-up commit
does not change the deployed source/archive SHA.

Readiness establishes process health, not provider or commercial transaction
health. No real account, customer file/order, payment, email or artificial
conversion was created. Authenticated upload delivery and actual Google
conversion receipt are not claimed as verified. Campaign settings were not
changed or reactivated. See the acquisition report for those separate gates.
