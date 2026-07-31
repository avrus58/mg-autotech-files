# MG AutoTech SEO Excellence Checklist

The operational measurement contract for query, country, click and successful
request conversion reporting is documented in
`docs/seo-measurement-and-conversion-tracking.md`. Search Console remains the
query/country/search-click source; consented GA4 events cover public navigation
and the request funnel without private request metadata.

Use this checklist before every public content or language release.

## Technical SEO

- `/robots.txt` blocks private routes: `/admin`, `/dashboard`, `/api`, auth and payment routes.
- `/sitemap.xml` includes public home, service, tool, brand, ECU-platform and legal pages.
- `/workshop-guides` provides a compact, indexable knowledge hub without adding
  long answer libraries to the homepage.
- `/services/stage-2`, `/services/tcu-tuning` and `/services/ecu-file-check`
  cover distinct high-intent English searches without manufacturing translated
  alternates or extending the homepage.
- `/feed.xml` publishes public guidance updates and `/llms.txt` provides a
  customer-safe public route map. Neither document may include private portal,
  storage, customer, admin or source metadata.
- Localized pages include language alternates for all supported locales.
- Canonical URLs point to the intended public page.
- Public pages have a unique title and description.
- Open Graph metadata is present on public landing/service pages.
- No customer/dashboard/admin pages are indexed.

## Multilingual Quality

- Supported locales: NL, EN, DE, FR, IT, RU, ES, TR, PT, CN, PL, AL.
- Run `node scripts/check-i18n-seo.mjs` after translation edits.
- Do not mix customer-facing German, Turkish and English in the same locale page.
- Keep admin technical language in English only when it is intentional.
- Avoid automatic machine-translation wording that sounds unnatural.
- Check long labels on mobile after every translation batch.

## Service Page Standards

Each service page should clearly explain:

- what the service is
- when it is used
- what the customer should upload
- supported vehicle/ECU context
- credit information
- process and delivery expectations
- human verification and legal responsibility limits

Priority topics:

- ECU file service
- TCU file service
- Stage 1
- Stage 2
- DPF OFF
- EGR OFF
- AdBlue OFF
- DTC OFF
- VMAX OFF
- Start/Stop OFF
- TCU tuning
- ECU unlock
- BMW ECU unlock
- Mercedes ECU/TCU file service

## Workshop Knowledge Center

- Keep `/workshop-guides` focused on routing visitors to existing authoritative
  service, readiness, read-method, platform, vehicle and tool pages.
- Cornerstone articles live under `/workshop-guides/[slug]` and must answer one
  distinct workshop search intent instead of repeating a service landing page.
- Current cornerstone topics cover the online ECU workflow, TCU request
  preparation, OBD/bench/boot read methods, request readiness and exact HW/SW
  identification.
- Every guide must be reachable through a descriptive HTML link from the
  workshop index and must link back to relevant service, tool or platform pages.
- Use structured `CollectionPage`, `ItemList`, `FAQPage`, and breadcrumb data
  only when the visible page supports it. Article pages additionally use
  `TechArticle` with visible title, description, FAQ and related-resource data.
- Do not add hreflang alternates for an article until its main content has been
  professionally translated. A translated navigation shell is not enough.
- Do not duplicate large answer libraries on the homepage.
- Do not add thin doorway pages for keyword variants.
- Service-intent pages must answer a genuinely different workshop decision and
  link to the secure request route, relevant preparation tools and supporting
  technical guides.
- Keep FAQ answers visible when useful, but do not add `FAQPage` or `HowTo`
  structured data solely to chase discontinued or restricted rich results.
- Keep public guidance customer-safe: no private file inspection, MOD
  generation, account access, or internal data exposure.

## Safety And Trust

- Do not claim guaranteed search ranking.
- Do not claim universal vehicle support.
- Do not promise legal road use.
- Use careful language: support is confirmed after checking the submitted file, ECU/SW data and read method.
- Mention secure portal upload, customer account history, credits, file versions and revision workflow.

## Automated Checks

Run:

```bash
node scripts/check-i18n-seo.mjs
npm run build
```

The first script checks language coverage, core SEO files and common encoding/translation corruption markers. The build validates sitemap, robots and metadata generation through Next.js.

## Measurement And Authority

- Search ranking cannot be guaranteed by code or metadata alone.
- Track indexed pages, impressions, clicks, queries and countries in Google
  Search Console after each release.
- Prefer verified workshop case studies, original technical research and
  reputable automotive-industry links over bulk directory submissions or
  purchased backlink schemes.
- Expand a language only after the full service page has a professional native
  translation and can receive a correct reciprocal hreflang mapping.
- Review query data before creating another landing page; avoid near-duplicate
  city, brand or keyword variants that do not add useful first-hand content.
