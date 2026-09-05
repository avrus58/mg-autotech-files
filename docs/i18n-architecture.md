# MG AutoTech i18n Architecture

## Current Standard

- Default locale: `en`.
- Supported locales: `nl`, `en`, `de`, `fr`, `it`, `ru`, `es`, `tr`, `pt`, `zh`, `pl`, `sq`.
- Public SEO routes use locale prefixes for localized copies:
  - Root English canonical: `/`
  - Localized home: `/de`, `/tr`, `/fr`, etc.
  - Root English service page: `/services/stage-1`
  - Localized service page: `/de/services/stage-1`
  - Root English How It Works: `/how-it-works`
  - Localized How It Works: `/de/how-it-works`, `/tr/how-it-works`, etc.
- English has one canonical URL family at the root. Legacy `/en` and `/en/*` URLs permanently redirect to their root equivalents.
- `x-default` and the English hreflang both point to the same root English canonical URL.
- Only the 11 non-English locales generate prefixed static routes and sitemap entries.

## Translation Sources

- Core locale definitions and runtime text replacement: `src/lib/i18n.ts`.
- Critical customer portal coverage and typed 11-locale tuples: `src/lib/customerPortalTranslations.ts`.
- Reviewed customer-journey copy for auth, registration, request creation and dashboard flows: `src/lib/customerJourneyTranslations.ts`.
- Extended customer-surface copy for orders, delivery, File Expert, payments, vehicle context and technical guidance: `src/lib/customerSurfaceTranslations.ts`.
- Transactional email locale vocabulary and lifecycle labels: `src/lib/email/localeCopy.ts`.
- Hosted Supabase Auth copy for the extended locale set: `src/lib/email/authLocaleCopy.ts`.
- SEO home/service metadata and localized service content: `src/lib/seo.ts`.
- Public SEO UI labels: `src/lib/seo-ui.ts`.
- How It Works page copy and FAQ JSON-LD copy: `src/lib/howItWorksI18n.ts`.
- Locale route switching helpers: `src/lib/i18nRoutes.ts`.
- Customer source-string coverage gate: `scripts/check-customer-i18n.ts`.

## Metadata, Canonicals and Hreflang

- `src/lib/seo.ts` owns:
  - `localizedPath()`
  - `localizedUrl()`
  - `languageAlternates()`
  - `hreflangByLocale`
- Public localized pages should set:
  - localized title and description
  - canonical for the current locale
  - `languageAlternates(path)` for hreflang
  - localized OpenGraph locale
  - localized JSON-LD where page content has FAQ or structured data

## Sitemap and Robots

- `src/app/sitemap.ts` includes root English plus non-English localized home, service and How It Works routes. It never emits `/en` duplicates.
- `src/app/robots.ts` allows public SEO routes and blocks private/admin/system routes including `/admin`, `/api`, `/dashboard`, `/login`, `/register`, `/new-request`, `/payment`, and `/embed`.

## How To Add A New Public Localized Page

1. Add route files for root and locale-prefixed versions if it is a public SEO page.
2. Put reusable copy in a central `src/lib/*I18n.ts` or the existing SEO copy module.
3. Generate metadata from the same copy source.
4. Add localized sitemap entries and hreflang alternates.
5. Update `src/lib/i18nRoutes.ts` if language switching should preserve the equivalent path.
6. Add tests for route, metadata, sitemap and language-switch mapping.

## Legal Pages

Legal pages currently use official German copy on root paths:

- `/impressum`
- `/datenschutz`
- `/agb`
- `/widerruf`

They should not be loosely translated without a legal review. Navigation can link to these root legal pages from localized surfaces while documentation notes that the official legal text is German.

## Customer Dashboard Routes

Customer/dashboard, authentication, payment and request-flow routes are not locale-prefixed SEO routes. They preserve their private URL and use the global language switcher with the customer portal dictionary. The fail-closed source audit derives its inventory from the current public/customer routes, co-located application UI, shared components and shared JSX modules instead of relying on a fixed historical string count. Every non-English locale requires an exact reviewed translation or intentional technical invariant for the complete current inventory; `npm run check:i18n` fails on any clean English fallback, unclassified visible copy or escaped UI source.

The registration form uses the same locale for its visible copy, stored account preference and transactional email language. Company registration requires a company name. The validated profile draft is preserved through email/password registration and Google OAuth without using user metadata for authorization.

Customer transactional and hosted Auth email content supports the same 12 locale codes. Missing, malformed or unsupported metadata falls back to English. Admin notification email remains English. Email language metadata controls presentation only and must never be used for authorization or RLS decisions.

Technical identifiers and user-entered examples remain unchanged where translation would reduce accuracy, including ECU, TCU, DTC, ORI, MOD, HW/SW, IBAN/BIC, OBD/Bench/Boot, addresses and example vehicle identifiers.

## Route Matrix

- Fully server-localized: home, How It Works, File Service and the core Stage 1/DPF/EGR/AdBlue/DTC service routes.
- Runtime-localized private flows: dashboard, order detail, new request, authentication and payment.
- Runtime-localized single-URL public surfaces: additional service-intent, brand, ECU platform, workshop guide and preparation-tool pages keep one canonical, non-prefixed URL while rendering the selected locale from reviewed catalogs.

The language switcher changes the URL only when a true locale-prefixed equivalent exists. On canonical single-URL public surfaces it preserves the path and applies the selected locale on that same route; it does not substitute a localized homepage or send users to a 404.

## Guardrails

- Do not add locale prefixes to admin/API/private routes.
- Do not translate user-entered notes, vehicle identifiers, filenames, bank references or technical evidence.
- Do not use locale or email-language metadata as an authorization claim.
- Do not create `/en` duplicates; English stays on root canonical URLs.
- Do not expose admin/internal metadata in localized public content.
- Do not invent legal translations.
- Do not equate a canonical or non-prefixed URL with English-only presentation. Global-language-switcher-managed public surfaces must render reviewed selected-locale copy at that stable URL; only exact, explicitly reviewed fixed-language exceptions, including owner/legal-approved routes, may remain outside this contract.
- Do not add a new page without metadata, sitemap and route-switch coverage.
