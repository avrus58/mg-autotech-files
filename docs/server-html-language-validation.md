# Initial public HTML language — 2026-09-07

## Scope and cause

Owner-reported mismatch confirmed by read-only public GETs at
`file.mgautotech.de/de`, `/de/file-service`, `/de/how-it-works` and `/tr`:
localized titles/content and Content-Language, but opening `<html lang="en">`.
The separate `mgautotech.de` homepage, AdBlue diagnosis and Ratgeber samples
already returned German HTML; that dirty repository was not changed.

The File Service server root layout hardcoded English. Its child locale layout
correctly rendered translated content, but an inline script only repaired the
document language after parsing. This was not evidence of a Google penalty.

## Change

- Server root metadata, fonts, analytics/consent order and server-rendered page
  children remain unchanged. A small `RootDocument` uses the complete Next
  router params during SSR/prerender to emit the correct opening HTML tag and
  seed the existing locale provider. This is not an effect-only DOM fix.
- Locale validation and the existing fixed-authored route language map are
  reused. Canonical/hreflang/content and all routes stay in place.
- Client preference writes use the same BCP-47 mapping, preserving `zh-CN`.
- No request header read was added to the root: public prerendering remains.
- Normal localization inventory entries were added, with no exemptions,
  catalog fallback, frozen-fingerprint changes or new dependencies.

## Validation

These are historical local receipts for candidate `a7827d8` on base `1916dcd`.
That ancestry also contains an unpublished customer guide. The scoped release
transplants only the language delta onto verified live source `9b78cf4` and
requires its own fresh validation receipt; the counts below do not certify it.

- Full i18n gate PASS: 12 locales, 2,471 reviewed strings per non-English locale,
  no clean English fallback, dynamic expression guard and 37/37 bundle tests.
- Full application tests PASS: 1,565/1,565. Subsequent checker-only URL/error-shell
  expectation refinements passed their expanded 10/10 targeted tests.
- Full web/uploader typecheck and lint PASS. Lint excludes only ignored generated
  QA files under `.autopilot/runtime`; no tracked source is exempted.
- Production-mode webpack build PASS, 282 generated pages. No environment files
  or customer credentials were copied into the clean worktree.
- Performance PASS: 139 prerendered routes; all 48 required public artifacts
  present with correct opening language; homepage initial gzip 15.7 KiB against
  the existing 80 KiB budget. Locale payload budgets remain unchanged.
- Counterfactual: the new artifact-language check fails on the previous build
  for all 44 required non-English pages, while the new build passes all 48.
- Actual local HTTP matrix PASS 122/122: 96 SEO page/locale combinations,
  preference conflicts, query-preserving redirects and 404 contract checks.
  All 200 SEO pages require exactly one HTML/body, correct initial language,
  localized heading/main, self canonical and all 13 hreflang alternatives.
  Equivalent origin URLs with/without their trailing slash are normalized;
  differing hosts, paths, query or fragments still fail.
- Isolated Chrome PASS 104/104: 72 JavaScript-disabled cases across all 12
  locales, 24 hydrated EN/DE/TR/ZH cases, and 8 real language-switch actions;
  both 390×844 mobile and 1366×768 laptop. Visible content/account links remain,
  no document overflow or hydration/runtime exception. Hydrated checks wait
  until locale loading settles. Representative screenshots reviewed.
- Independent Chrome review: real German same-locale SPA link (no document
  request), German-to-login link, three 404 recoveries and single document
  structure passed. No real sign-in was attempted.
- All browser backends were isolated: external requests blocked and local API
  requests replaced with test-only 503 responses. This does not certify payment,
  sign-in, production analytics or live backend success.

## Boundaries not solved by this bounded change

- Prefixless request-localized routes such as `/login`, `/dashboard`, `/about`
  and `/widget` still have an English raw document shell when their body locale
  comes from a cookie/header. Their existing request boundary and browser locale
  handling remain. German navigation to login settles correctly, but this is
  not a claim that its initial HTML is fixed. A complete solution needs a
  separate route/document architecture change without sacrificing public SSG.
- Next's early error shell for invalid locale/service paths is
  `<html id="__next_error__">` without lang. Actual HTTP comparison against the
  baseline build confirms the same behavior before and after this change.
  It remains 404/noindex and recovers correctly in the browser. The checker
  explicitly reports this boundary; it grants no exception to 200 SEO pages.
- No production deployment, push, Preview, database, auth policy, payment,
  legal-copy or customer-data mutation was performed.

## Repeat the checks

Use the normal i18n, test, typecheck, lint and production build commands, then
`npm run check:performance` to verify real prerender artifacts. With that build
running locally on port 3217, run `npm run check:html-language`; another loopback
origin may be supplied with `-- --base-url http://127.0.0.1:PORT`.
The HTTP checker rejects non-loopback targets and does not follow redirects.

Worktree: `mg-autotech-files-server-html-language`, branch
`codex/server-html-language-20260907`, base `1916dcd` (previous local onboarding
package). This language change does not itself publish that earlier package.
Runtime-only logs/screenshots are under `.autopilot/runtime/html-language`.
