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
- Default English also has prefixed SEO equivalents such as `/en` and `/en/services/stage-1`; `x-default` points to the root English path.

## Translation Sources

- Core locale definitions and runtime text replacement: `src/lib/i18n.ts`.
- SEO home/service metadata and localized service content: `src/lib/seo.ts`.
- Public SEO UI labels: `src/lib/seo-ui.ts`.
- How It Works page copy and FAQ JSON-LD copy: `src/lib/howItWorksI18n.ts`.
- Locale route switching helpers: `src/lib/i18nRoutes.ts`.

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

- `src/app/sitemap.ts` includes root and localized home, service and How It Works routes.
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

Customer/dashboard and request-flow routes are currently not locale-prefixed SEO routes. They rely on the global language switcher/runtime translation layer for some labels and remain functional private application routes. Future work should move customer-app labels into typed dictionaries if full dashboard i18n is required.

## Guardrails

- Do not add locale prefixes to admin/API/private routes.
- Do not expose admin/internal metadata in localized public content.
- Do not invent legal translations.
- Do not add a new page without metadata, sitemap and route-switch coverage.
