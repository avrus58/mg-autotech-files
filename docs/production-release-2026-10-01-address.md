# File Service operating-address release — 1 October 2026

## Authority and immutable scope

The owner requested that the address issue be completed (`adres isini hallet`)
after the two live websites were observed still publishing the former address.
The confirmed operating address is **Saarstraße 4, 71679 Asperg, Germany**.

- Source/archive commit: `dec7f5be3197f01e715265c9492c3b3e5bf412f4`.
- Branch: `codex/file-address-asperg-current-20261001`; remote SHA verified.
- Verified pre-release app/analyzer pair: `01ba96a9fe00`, both healthy.
- Source archive SHA256:
  `7cf6baa5aa7fc71e2a846393bbafe30c7682a38d992166b2382e17e584fa26e8`.
- Immutable VPS source: `/opt/mgautotech/file-service/releases/dec7f5be3197`.

The runtime scope is the shared company address, five legal address recipients,
Contact metadata and About operator-location copy in all 12 existing languages.
Separate Stuttgart jurisdiction, registration-authority and service-area facts
are not reinterpreted as business-address facts. Customer-entered information and
unrelated customer-address examples are not changed. The primary dirty checkout
and unrelated unpublished work were not used as the release source.

No migration, dependency, environment, payment, authentication, consent, Docker,
Caddy, DNS, Google Business Profile or other external-profile change.

## Completed local validation

- `npm run check:i18n`: 12 locales, 2,473 reviewed strings per non-English
  locale, zero clean English fallbacks, generated catalog freshness and 37/37
  client-bundle tests pass.
- `npm run lint` and `npm run typecheck`: pass (web and desktop uploader).
- Controlled full suite using the ordinary tests with `--test-concurrency=2`:
  **1,794/1,794**, zero failures/skips/cancellations, 359.7 seconds. The first
  heavily concurrent run reported 1,779/1,782 plus a failed test-file process;
  two wall-clock budget failures and that unchanged file pass 32/32 in isolation.
  The subsequent complete controlled run is the full-suite acceptance evidence;
  no assertion was changed to hide the first failure.
- Ordinary `npm run build` (Turbopack): 282/282 pages; strict postbuild checks
  include 43 required assets, valid PNG/PDF, protected compiled response 401 and
  zero external fetches.
- Existing `npm run build -- --webpack`: pass, 282/282 pages and the same strict
  43-asset postbuild checks. `npm run check:performance` passes against this
  builder: initial homepage 15.7 KB gzip / 80 KB budget; public worker 6.5 KB /
  12 KB budget; all 11 localized payloads below the 28/12 KB budgets; 139
  prerenders include all 48 required public routes, zero invalid languages.
- The unchanged performance worker filename matcher is Webpack-specific and
  initially failed on the ordinary Turbopack output. Actual Turbopack output
  contains compiled JavaScript worker bootstrap/module files; the separate raw
  TS media asset is not the active worker. The built-in seven-row synthetic
  example works on both the candidate and baseline. The gate, runtime and build
  contract were not weakened or rewritten for this urgent address correction.
- Physical local dependencies were used for the strict build-source boundary.
  The original dependency junction was recoverably moved to
  `C:/Users/gokka/AppData/Local/Temp/mg-address-junction-recovery-20261001/node_modules`;
  its target dependencies remain untouched. No package/lock change.
- Repository has no separate format script. Committed whitespace checks and
  ordinary ESLint pass; no formatter result is invented.

## Independent acceptance and explicit boundaries

Independent immutable review cleared exactly `dec7f5b` for the bounded address
scope. 65/65 actual public address/schema/native-copy checks and 39/39 mobile,
laptop, no-JavaScript and language-switch journeys pass. Existing raw-HTTP
`check:html-language` passes 122 checks, including 96 SEO URLs in 12 languages.

Two pre-existing issues remain separate follow-up work, not repaired or hidden:
22 non-English cookie/header variants of prefixless `/contact` and `/about`
publish a native body/metadata but initial `<html lang="en">`; six sampled
localized footer copyright contrast instances measure 4.12 rather than 4.5.
Direct baseline/candidate comparisons reproduce both, and the address node is
not the contrast failure. No blanket localization/accessibility perfection is
claimed. Anonymous tests did not exercise customer authentication, payments,
stored requests or real uploaded files.

## Publication and live verification

The unchanged `bash scripts/vps/deploy.sh dec7f5be3197` completed with **exit 0**
on 1 October 2026 around 02:49 Europe/Berlin. Its fresh Linux/Turbopack build
passed all mandatory i18n checks and 37 bundle tests, generated **282/282**
pages, and passed strict postbuild with **69 required assets**, protected
compiled POST 401, valid PNG/PDF and zero external fetches. The Webpack and
Turbopack asset counts differ by builder and are not treated as equivalent lists.

Both app and analyzer run the immutable `dec7f5be3197` pair, are healthy, and
have zero restarts. Atomic release state agrees and records `01ba96a9fe00` as
the previous pair. No rollback was needed; those prior images remain the
rollback target. The deployment script's health-rejection recovery was not
invoked or newly simulated in this release.

Immediate live proof:

- Separate anonymous GET-only release smoke **33/33** passes at
  `2026-10-01T00:53:19.656Z`, including 24 locale home/service responses,
  five legal pages, readiness, two protected GET 401/private/no-store responses
  and the correctly method-rejected report GET 405.
- Independent public address/schema/native-copy matrix **65/65** passes,
  including all 12 locales, actual Contact/About routes and legal recipients.
- Independent EN/DE/TR/ZH mobile/laptop/no-JavaScript/language-switch matrix
  **39/39** passes with zero horizontal overflow or page exceptions. Previously
  documented initial-lang and copyright-contrast findings remain unchanged.
- All **20/20** captured pre-release public asset URLs still return HTTP 200
  with exactly matching SHA256; open-page asset retention was checked directly.
- Root separately fetches live DE Contact: HTTP 200, Content-Language de-DE,
  new address present, former street/postcode absent.
- Read-only readiness is HTTP 200/no-store. Protected branding GET is 401 with
  private/no-store. POST-only service-report GET correctly returns 405, not
  401; its compiled protected POST evidence is separate. No live POST, customer
  authentication, payment or request mutation was performed.
- The built-in synthetic public CSV example still completes using the unchanged
  compiled worker. Its demo calculation is not a real vehicle/dyno proof.

Source publication and runtime activation identify `dec7f5b`; subsequent QA-only
documentation commits on the address branch do not redeploy or change that
runtime identity. The separate B2C address release is tracked in its own repo.

Selected runtime identity:

- App image `sha256:91f8b7cb739a28d4b202273098663748afa7cf1c28baca39fcd46bb8e0ac2213`,
  started `2026-10-01T00:48:50.474146529Z`.
- Analyzer image `sha256:3d863bc424fd7c0c78d53b2585e24ec0474dd025313d50f060e3025a07331da2`,
  started `2026-10-01T00:48:42.965330449Z`.

The selected SSH inspection reads image IDs, status/health, starts, restart
counts and image-only release-state fields, never environment values. The first
Windows here-string appended CR to a state path and failed that read; a safe
single-line repeat completed with exit 0 and verified the expected state.

Runtime logs and independent screenshots/JSON are kept in ignored local QA
directories, not bundled as customer data or asserted as production evidence.
