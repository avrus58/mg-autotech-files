# File Service Language Audit

## Scope

This audit applies only to `file.mgautotech.de`. It does not change or make claims about `mgautotech.de`.

## Confirmed Findings

1. English public pages had two indexable URL families: root paths and `/en` equivalents.
2. The sitemap and static locale generation could reinforce those duplicate English routes.
3. The language switcher could send an English-only resource to a localized route that did not exist or to a less relevant localized homepage.
4. New customer dashboard, order, File Expert, request, authentication and payment labels had uneven coverage, especially in Russian, Chinese and Albanian.
5. There was no permanent source-string gate to catch customer-facing English added after a translation pass.

## Implemented Standard

- Root URLs are the only English canonicals.
- `/en` and `/en/*` permanently redirect to root equivalents.
- Static localized route generation, sitemap entries and robots allowlists use only the 11 non-English locale prefixes.
- English hreflang and `x-default` resolve to the root canonical.
- The switcher preserves the current route when no reviewed server-localized equivalent exists.
- Critical customer surfaces share one typed translation registration layer for all non-English locales.
- Russian, Chinese and Albanian retain focused overrides for previously weak flows.
- `scripts/check-customer-i18n.ts` enforces exact translations for critical authentication/request entry text, complete compact-label mappings, stable technical identifiers and a non-regressing exact-translation baseline.
- Long text without a reviewed exact translation remains clean English; partial word replacement is deliberately blocked there so the portal never produces mixed-language sentences.

## Operational Check

Run:

```powershell
npm run check:i18n
```

The check validates SEO localization structure, encoding markers, canonical route ownership and customer-facing source-string coverage.

## Intentional Limits

- Admin routes remain outside customer/public localization scope.
- Official legal pages remain in their approved language until legal translations are reviewed.
- English-only long-form resources are not given fake locale URLs. They remain available at their canonical English path and may still use the private/runtime preference layer where appropriate.
- Vehicle, ECU, software, file and payment identifiers are not translated when that could alter technical meaning.
