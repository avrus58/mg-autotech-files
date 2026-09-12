# Request-completion deadline release — 12 September 2026

## Scope and immutable source

The owner authorized publishing the prepared fix and checking it live in
response to the explicit scoped release question. No advertising budget,
database, dependency, environment, pricing, payment, consent policy or visible
copy change is included.

- Candidate: `c08b842683bd86d977177455f3564495e66b19bd`.
- Previous live source: `511a22b48c7e30eae5e026bf6f8512c7c84389e4`.
- Runtime delta: only `src/app/new-request/page.tsx`; the companion test is
  `tests/request-upload-prepare-recovery.test.ts`. Other cumulative files are
  operational documentation.
- Accepted requests no longer wait indefinitely for the optional notification
  response. The four-second deadline is fail-soft, accepted completion stays
  latched, and persisted history restores resume completion. Unconfirmed RPC
  failures remain retryable with the existing idempotency contract.
- Git archive SHA-256:
  `f1b00d6a9b8c32502d74131d3e7987453f64babb9d2a0495b8b679622c8f0c83`.
  Local and uploaded archive hashes match. LF-normalized archived runtime source
  matches the Git blob (`14f8ad5a1c2eab13ada9e9b079a57b559714539aa24db9c4ef22ed3ae391ade6`).
  Windows checkout/archive line endings differ; no source content difference.
- Exact candidate pushed without force to
  `codex/acquisition-verification-20260912`; remote SHA verified.
- New source directory: `/opt/mgautotech/file-service/releases/c08b842683bd`.
  Owner checkout and the three existing operational receipt edits are preserved.

## Fresh pre-release verification

- Full lint and web/desktop typecheck: PASS.
- Full tests: **1651/1651 PASS**, no failures, skips or cancellations.
- Independent immutable review: no blocking P0/P1/P2 issue; fresh focused
  actual-handler suite **24/24 PASS**. The optional reviewer packaging subprocess
  was not counted as a separate passing result.
- Anonymous live baseline: **38/38 PASS**. No customer account, order, payment,
  email, firmware or artificial conversion was created.
- Baseline application and analyzer healthy; matching release state; both exact
  `511a22b48c7e` rollback images retained. Server had 26 GB available at preflight.
- Separate main app baseline: started `2026-09-06T19:22:11.660307171Z`, zero
  restarts, healthy. Caddy: started `2026-09-06T19:22:19.119308515Z`, zero
  restarts, healthy. Neither is a deployment target.
- Reviewed deployment script consumes the existing root-owned environment
  internally; its contract passed without printing secret values.

## Fresh Google evidence (approximately 22:59–23:03 Europe/Berlin)

The authenticated MG AutoTech File Service account was refreshed, not read from
the earlier stale zero-spend table. The September 12 report showed **22
impressions, 4 clicks, EUR 2.89 cost, 0 conversions**. Reporting is delayed.
EN Search remains enabled at EUR 5 average/day. PMax and UK/Ireland remain paused.
This turn did not change campaigns, bids, rules, end dates or conversion actions.

Google conversion diagnostics still showed:

- Verified File Request: Primary / Every / Needs attention; tag inactive;
  last activity August 31.
- Verified Registration: Secondary / One / No recent conversions.
- Verified Credit Purchase: Primary / Every / Inactive.

Google Tag Assistant connected to the existing public file-service page and
found both configured GA4 and Ads destinations. Its Ads output showed page-view
hits; the console panel showed zero entries. The consent view showed denied
defaults, granted analytics/ad measurement after the existing saved choice,
and denied ad personalization. Selecting necessary-only through the site's
visible UI produced a new Consent Update with denied measurement permissions
in Tag Assistant. The previous analytics+advertising preference was restored
through the visible UI; no account/session was cleared.

These are real tag/consent diagnostics, **not verified request-conversion
receipt or attribution**. No production dummy request or fake conversion was
used to clear Google's inactive status. The login route recognized the owner's
existing admin session; anonymous registration/email completion was not claimed.

## Deployment and post-release checks

- Linux prebuild: 12 locales, 2472 source strings, zero clean-English fallbacks,
  **37/37** client-bundle tests. Production Turbopack compilation and TypeScript
  passed; **282/282** pages generated. Strict postbuild verified **69** required
  assets, compiled protected-route 401, synthetic PNG/PDF, zero external fetches.
- `bash scripts/vps/deploy.sh c08b842683bd` completed with exit 0. The old app
  remained running during the build; analyzer then application were switched
  only after the complete build passed. No rollback was required.
- App started `2026-09-12T21:05:44.778714986Z`, healthy, zero restarts; image
  `sha256:096a100608a7bc4b70e92cdca76a32f6a8972c555d7c7a6168f2c05b5da34867`.
- Analyzer started `2026-09-12T21:05:37.262003459Z`, healthy, zero restarts; image
  `sha256:d3665ff5c5945c5c9557477b4405cea6f6363671739994ed643197034300d51b`.
- Atomic release state matches the running `c08b842683bd` pair and records
  `511a22b48c7e` as previous. Both previous images were rechecked as available.
- Immediate anonymous post-release smoke at `2026-09-12T21:06:10.396Z`:
  **42/42 PASS**. Twelve localized home and service routes had correct initial
  HTML language and no error shell; login/register/request shells, readiness,
  `/en` redirect, protected anonymous rejection, four current and four previous
  hashed CSS/JS asset URLs passed. The two empty POST probes were rejected at
  authentication before processing and did not create data.
- Separate main-site app and Caddy retained their exact baseline start times,
  healthy states and zero restarts. `https://mgautotech.de/` remained HTTP 200.
- Authenticated Chrome opened the new-request form after deployment. EN, DE,
  TR and ZH headings/language switching and page-level overflow were checked at
  requested 1366x768 and 390x844 viewports. Document scroll width equalled client
  width (1366 laptop, 375 mobile with scrollbar); no captured console errors.
  A mobile screenshot was inspected. No inputs/files were supplied and the
  submit control remained disabled for the incomplete form. Original DE locale
  and default viewport were restored; no owner logout occurred.
- Tag Assistant debugging was stopped after the bounded consent test. The
  original analytics+advertising measurement choice was verified restored,
  while ad personalization stayed denied. These consent checks preceded the
  cutover; analytics code/configuration is unchanged by this release.

This scoped release is complete. Actual authenticated submission, notification
delivery, mobile registration/email completion and Google request-conversion
receipt were not manufactured or claimed. Page-view transport and passing code
tests are not substitutes for that remaining real commercial evidence.

## Recovery

For a critical regression, restore the retained complete previous image pair:

```bash
cd /opt/mgautotech/file-service/releases/c08b842683bd
bash scripts/vps/rollback.sh 511a22b48c7e
```

No database reversal/reset or volume deletion is required. Ignored HTTP receipts
are in `.autopilot/runtime/release-completion-20260912/`. A later documentation
commit does not change the deployed source SHA.
