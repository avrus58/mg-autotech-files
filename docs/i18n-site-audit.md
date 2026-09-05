# MG AutoTech i18n Site Audit

Audit date: 2026-08-31

## Current result

The public homepage and all 11 locale-prefixed home routes use the same `UnifiedHomePage` component tree. Locale changes alter reviewed copy, public links, metadata, JSON-LD and document language without creating a second or reduced page design.

The customer journey uses runtime localization on canonical private URLs. The
reviewed source audit reads the current source inventory instead of relying on a
fixed historical count. Registration, login, password recovery, new request,
dashboard, customer orders, delivery, File Expert, payments, widget billing,
technical guidance and settings all contribute dynamically to that inventory.
Every non-English locale resolves the complete current inventory through
reviewed translation or an intentional technical invariant; clean English
fallback is not accepted.

## Route matrix

| Route family | Localization model | Current status |
| --- | --- | --- |
| `/` and `/[locale]` | Server-localized, shared homepage tree | Parity across English plus 11 prefixed locales. |
| `/how-it-works` and `/[locale]/how-it-works` | Server-localized public SEO route | Localized metadata, body, FAQ and hreflang. |
| Core `/services/*` and localized equivalents | Server-localized public SEO route | Localized metadata and reviewed service copy where an equivalent exists. |
| Canonical brand, ECU, tools, workshop-guide and service-intent routes | Runtime-localized public surface | One stable, non-prefixed canonical; the selected locale renders reviewed body copy, metadata and structured data without inventing a locale-prefixed route. |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Runtime-localized private/auth flow | Exact 12-locale journey copy; URL stays canonical. |
| `/new-request`, `/dashboard/*` | Runtime-localized private customer flow | Exact reviewed journey copy; customer data remains scoped and private. |
| Official legal routes | German source of record | No unreviewed legal translation is invented. |
| `/admin/*`, `/api/*` | Internal/system | Never locale-prefixed or indexed. |

## Registration and account language

- The compact registration layout supports phone, tablet and short laptop viewports.
- Private and company accounts are explicit choices.
- Company name is required only for company accounts; VAT/tax fields cannot leak into a private profile.
- Google OAuth stores only the bounded validated registration draft needed after callback.
- The selected locale becomes the initial email preference for every supported language.
- Locale and user metadata never grant roles or permissions.

## Email parity

- Customer lifecycle and password-recovery templates render HTML and plain text in all 12 supported languages.
- Hosted Supabase Auth template sources contain deterministic language branches for all 12 languages and English fallback.
- Admin operations mail remains English.
- User-entered messages, request references, filenames, vehicle identifiers, IBAN/BIC and other technical values are preserved verbatim.
- Internal notes, storage paths, provider data, raw/hex data and confidence metadata are excluded from customer mail.

## Growth attribution

The admin-only Growth Center groups consented attribution by locale and reports locale-level visits, registrations, requests and successful payments. Search Console queries remain aggregate and are never joined to a customer. Locale rows contain no raw IP, email, notes, filenames or private request metadata.

## Permanent checks

- `npm run check:i18n` validates public SEO structure and audited customer source coverage.
- Production `npm run build` runs `npm run check:i18n` first and cannot start when localization coverage fails.
- The AST audit includes nested JSX conditionals, direct string/template operands of `&&`, `||` and `??`, dynamic accessibility attributes and visible custom component props, preventing hidden copy regressions that simpler text-node scans miss.
- Every Next.js App Router UI convention file is fail-closed across JS, JSX, TS and TSX: `page`, `layout`, `template`, `default`, `loading`, `error`, `global-error`, `not-found`, `global-not-found`, `forbidden`, `unauthorized`, `manifest`, `icon`, `apple-icon`, `opengraph-image`, `twitter-image` and numbered metadata variants.
- Co-located JS/JSX/TSX UI under `src/app`, shared JS/JSX/TSX UI under `src/lib`, and shared components also fail closed; there is no generic component, directory or app-segment bypass.
- A translator call is trusted only through an exact typed i18n module and reviewed export. Import aliases retain that provenance, shadowed bindings lose it, and local wrappers/providers are trusted only when they directly preserve it. Exact-source arguments and interpolation parameters inside translator calls are never blanket-exempted from the visible-copy audit.
- Internal admin and owner-approved legal exceptions are exact-file allowlists. A new sibling file or layout is not automatically exempt.
- The independently authored legacy `/file-service` source is fingerprint-frozen. Its fingerprint must not be refreshed: a future edit first moves it to a shared typed locale renderer/catalog and removes the freeze.
- Transactional email tests render every customer event in every supported language.
- Supabase Auth tests render every template preview and verify every hosted language branch.
- Registration tests cover company validation, private-profile cleanup, OAuth handoff and compact responsive layout.
- Growth tests verify locale aggregation from the existing privacy-safe attribution field.

## Remaining boundaries

- Admin UI is an internal English operational surface.
- Official legal copy remains German until legally reviewed translations exist.
- Canonical or non-prefixed public technical routes managed by the global language switcher are runtime-localized, not English-only. Any fixed-language public exception must be exact and explicitly reviewed or allowlisted; it cannot be inferred from URL shape.
- Repository-generated Supabase Auth templates do not change hosted Supabase settings by themselves.

## Local smoke checklist

1. Open `/`, `/de`, `/tr`, `/fr`, `/ru`, `/zh` and confirm the shared section tree, correct body language and no horizontal overflow.
2. Test `/register` at 390x844, 768x1024, 1366x768 and 1440x900.
3. Select company registration and confirm company name becomes required; return to private and confirm company-only fields disappear.
4. Switch language on login, password recovery, new request and dashboard gates without changing the private URL.
5. Preview customer and hosted Auth email templates in several Latin and non-Latin locales.
6. Confirm sitemap, canonical and hreflang checks remain clean.
