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

Customer/dashboard, authentication, payment and request-flow routes are not locale-prefixed SEO routes. They preserve their private URL and use the global language switcher with the customer portal dictionary. Critical authentication and request-entry sentences require exact translations for every non-English locale. Compact labels may use deterministic term mappings; unmapped long technical or compliance guidance stays as clean English instead of producing mixed-language sentences. The baseline is enforced by `npm run check:i18n`.

Technical identifiers and user-entered examples remain unchanged where translation would reduce accuracy, including ECU, TCU, DTC, ORI, MOD, HW/SW, IBAN/BIC, OBD/Bench/Boot, addresses and example vehicle identifiers.

## Route Matrix

- Fully server-localized: home, How It Works, File Service and the core Stage 1/DPF/EGR/AdBlue/DTC service routes.
- Runtime-localized private flows: dashboard, order detail, new request, authentication and payment.
- English-only public resources: additional service-intent, brand, ECU platform, workshop guide and preparation-tool pages until complete reviewed translations exist.

The language switcher only changes the URL when a true equivalent localized route exists. It does not send users to a localized homepage or a 404 when the current English-only resource has no translated route.

## Guardrails

- Do not add locale prefixes to admin/API/private routes.
- Do not create `/en` duplicates; English stays on root canonical URLs.
- Do not expose admin/internal metadata in localized public content.
- Do not invent legal translations.
- Do not claim an English-only public resource is translated; keep its URL stable until reviewed copy exists.
- Do not add a new page without metadata, sitemap and route-switch coverage.
