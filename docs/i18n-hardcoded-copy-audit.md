# MG AutoTech Hardcoded Copy Audit

Audit date: 2026-07-11

## Scope

Reviewed public and customer-facing areas under:

- `src/app`
- `src/components`
- `src/lib/seo.ts`
- `src/lib/seo-ui.ts`
- `src/lib/i18n.ts`
- `src/lib/howItWorksI18n.ts`

Admin/internal technical pages were not converted, because this task focuses on public/customer-facing website and dashboard UX and avoids changing admin business logic.

## Critical Findings Fixed

### Locale Home Route Rendering English Body

- File: `src/app/[locale]/page.tsx`
- Finding: localized metadata existed, but the route rendered the English root homepage component.
- Fix: render `LocalizedSeoHome` with the current locale.

### How It Works Copy Was Root-English Only

- Files:
  - `src/app/how-it-works/page.tsx`
  - `src/app/[locale]/how-it-works/page.tsx`
  - `src/lib/howItWorksI18n.ts`
  - `src/components/HowItWorksPageContent.tsx`
- Finding: new page had English body copy, FAQ and metadata only.
- Fix: copy moved into a typed locale module, German and Turkish body/FAQ content added, localized route added, metadata/JSON-LD/sitemap/hreflang updated.

### Language Switcher Missing How It Works Route

- Files:
  - `src/components/LanguageSwitcher.tsx`
  - `src/lib/i18nRoutes.ts`
- Finding: language switching knew home and service routes, but not `/how-it-works`.
- Fix: central route helper maps `/how-it-works` to `/{locale}/how-it-works`, preserves safe query strings, and leaves private/system routes alone.

## Known Hardcoded Public Copy

### Root English Homepage

- File: `src/app/page.tsx`
- Status: root English page is intentionally English canonical.
- Note: localized homepage route now uses `LocalizedSeoHome`.

### English-Only SEO Pages

- Files include:
  - `src/app/about/page.tsx`
  - `src/app/contact/page.tsx`
  - `src/app/brands/page.tsx`
  - `src/app/ecu-platforms/page.tsx`
  - `src/app/tools/page.tsx`
- Status: documented English-only public routes. Language switcher falls back to localized home for these rather than causing a 404.

### Customer Application Routes

- Files include:
  - `src/app/new-request/page.tsx`
  - `src/app/dashboard/**`
  - `src/app/login/page.tsx`
  - `src/app/register/page.tsx`
- Status: not full locale-prefixed routes. Some labels are handled by the runtime language switcher and existing translation maps.
- Recommendation: future sprint should move customer-app labels/errors into typed dictionaries if full app i18n is required.

### Legal Pages

- Files:
  - `src/app/impressum/page.tsx`
  - `src/app/datenschutz/page.tsx`
  - `src/app/agb/page.tsx`
  - `src/app/widerruf/page.tsx`
- Status: official German legal copy retained. Do not translate without legal review.

## Future Cleanup Recommendations

- Replace runtime DOM text replacement in customer-app screens with typed per-locale dictionaries.
- Add full professional body translations for all secondary locales on How It Works if those language markets become active.
- Add localized route variants for `/about`, `/contact`, `/brands`, `/ecu-platforms`, and `/tools` if they become SEO priorities.
- Fix historical mojibake in older translation files separately; this task avoided broad text churn to reduce risk.
