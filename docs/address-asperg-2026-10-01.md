# File Service address correction — 1 October 2026

Owner-confirmed operating address from 1 October 2026:
**Saarstraße 4, 71679 Asperg, Germany**.

## Scope and baseline

- Clean implementation branch: `codex/file-address-asperg-current-20261001`.
- Local baseline `abae4b3bd079bca57ae28d2208b35b8c269b54e8` differs from
  verified running source `01ba96a9fe008ea164415ee1cee58408597ad1a6` only in
  documentation. The root release agent verified the healthy app/analyzer pair
  and release state before implementation.
- The shared company address feeds public footers, contact information and
  Organization JSON-LD. Legal provider, controller and withdrawal-recipient
  addresses will use the same object.
- Contact metadata and About operator-location copy will identify Asperg in
  all 12 supported languages, preserving their existing technical meaning.
- Existing Stuttgart service-area, registration-authority and jurisdiction
  statements are not new address claims and remain unchanged. Customer address
  values and example placeholders are outside this company-address change.
- No migration, environment, dependency, payment, authentication, consent or
  customer-data change. Unrelated unpublished changes are excluded.

## Acceptance plan

- [x] Shared address, exact legal recipients and all localized public location
  references agree with the owner-confirmed address.
- [x] Regression checks verify Organization JSON-LD for every supported locale,
  actual server-rendered legal recipients, localized footers and metadata.
- [ ] Mandatory i18n, lint, typecheck, full tests and production build pass.
- [ ] Anonymous mobile/laptop checks verify initial HTML, address visibility,
  language, overflow and unchanged contact links.
- [ ] Root records the immutable review, actual release and retained rollback
  pair; immediate live address/readiness checks pass after publication.

## Local implementation evidence

- Shared address and five legal pages now render the same owner-confirmed
  address. Legal page update dates are 1 October 2026; policy meaning and
  separate jurisdiction/registration statements are preserved.
- Contact metadata and About operator-location source and all 11 non-English
  translation rows have been updated together. Asperg's name is naturally
  inflected/transliterated in Polish, Russian and Chinese copy; the postal
  address itself retains its original spelling in every locale.
- Added only `Asperg` and `Saarstraße 4` as exact proper-name invariants. The
  existing customer-address example invariants remain applicable because those
  unrelated form examples and entered values are unchanged.
- Focused verification: `node node_modules/tsx/dist/cli.mjs --test
  tests/business-address.test.ts tests/runtime-public-ssr-i18n.test.ts
  tests/server-localized-core-copy.test.ts tests/privacy-consent-disclosure.test.ts`
  passed **15/15**, zero failures/skips. Tests include actual server-rendered
  legal recipients and all 12 localized footers/Organization schemas, exact
  contact links, metadata and About location with no English fallback.
- `git diff --check` passed. Source inspection finds no former street/postcode
  in the scoped provider/contact/About/Organization surfaces.
- `npm run check:i18n` passed in full: public SEO check covers 12 locales and
  43 source files; 2,473 reviewed source strings have zero clean English
  fallbacks in all 11 non-English languages; the dynamic guard covers 24
  occurrences/21 signatures. The generated catalog freshness check and
  **37/37** client-bundle tests passed. No generated files need regeneration.

Full validation, independent review and actual publication remain root-agent
release steps. This document is not yet a completed deployment receipt.
