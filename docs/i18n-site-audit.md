# MG AutoTech i18n Site Audit

Audit date: 2026-07-11

## Summary

The site uses English root public pages plus locale-prefixed SEO pages for localized home and service content. The audit found one major mismatch: locale-prefixed home routes had localized metadata but rendered the English root homepage body. This is now fixed by rendering `LocalizedSeoHome` for `/[locale]`.

The new How It Works page was root-English only. It now has locale-prefixed route support, localized metadata, localized German and Turkish body/FAQ content, localized nav/footer links, sitemap entries and hreflang alternates.

## Route Audit

| Route | Languages available | Status |
| --- | --- | --- |
| `/` | English root | Existing rich homepage retained. |
| `/[locale]` | `nl`, `en`, `de`, `fr`, `it`, `ru`, `es`, `tr`, `pt`, `zh`, `pl`, `sq` | Fixed: now renders localized SEO homepage instead of English root homepage. |
| `/services/[slug]` | English root | Existing public service pages retained. |
| `/[locale]/services/[slug]` | All supported locales | Existing localized service pages with localized metadata/hreflang. |
| `/how-it-works` | English root | Fixed: central i18n copy source and hreflang alternates. |
| `/[locale]/how-it-works` | All supported locales | Added. German and Turkish have complete localized page body/FAQ per request. Other locales have localized route metadata/nav labels and can be expanded further. |
| `/about`, `/contact`, `/brands`, `/ecu-platforms`, `/tools` | English root | Documented as English-only SEO routes. Language switcher sends these to localized home rather than a missing route. |
| `/new-request` | Private/customer application route | Not locale-prefixed. Existing flow preserved. Runtime language switcher remains active. |
| `/dashboard/*` | Private/customer application routes | Not locale-prefixed. Existing flow preserved. Language switcher does not rewrite private route paths. |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Customer auth routes | Not locale-prefixed. Runtime language switcher remains active. |
| `/impressum`, `/datenschutz`, `/agb`, `/widerruf` | Official German legal pages | Not loosely translated. Kept as root legal pages. |
| `/widget`, `/embed/vehicle-selector` | Public/widget surfaces | Existing behavior retained. Widget/embed routes are not localized SEO routes. |

## Issues Fixed

- `/[locale]` no longer renders the English root homepage body.
- `/[locale]/how-it-works` now exists and has localized metadata, canonical URL, OpenGraph locale and FAQ JSON-LD.
- Sitemap includes localized How It Works URLs.
- Robots allows root and localized How It Works URLs.
- Localized SEO homepage and footer now link to localized How It Works pages.
- Language switcher route mapping now understands `/how-it-works`, preserves safe query strings, and avoids rewriting private routes.
- i18n/SEO health script now checks the How It Works localization files and sitemap entries.

## Remaining Limitations

- Dashboard, auth, and request-flow routes are still application routes rather than full locale-prefixed SEO routes.
- German and Turkish How It Works content is fully localized. Some secondary locale body sections intentionally use shared baseline copy until professionally reviewed translations are added.
- Legal pages remain official German legal copy only.
- The global runtime language switcher still includes text replacement behavior for customer-app labels; a future typed dashboard dictionary would be cleaner.

## Smoke Checklist

- Open `/de` and confirm the body is German/localized SEO home, not the English root homepage.
- Open `/tr` and confirm Turkish home content appears.
- Open `/de/how-it-works` and `/tr/how-it-works`.
- Confirm `/how-it-works` remains English.
- Switch language from `/how-it-works` to German and Turkish.
- Switch language from `/de/services/stage-1` to English and Turkish.
- Confirm `/dashboard` is not rewritten into a localized SEO path.
- Confirm sitemap contains `/de/how-it-works`, `/tr/how-it-works`, and service alternates.
