# Web performance budget

## Goal

MG AutoTech keeps the public first screen responsive on ordinary phones and
laptops while preserving the full vehicle selector, multilingual routes,
customer notifications, workshop tools and indexable page content.

The performance budget is a regression gate, not a promise about a visitor's
network. Production Core Web Vitals still depend on hosting, geography,
browser extensions and the visitor's device.

## Homepage budget

Run after a production build:

```bash
npm run build
npm run check:performance
```

The check reads Next.js' generated homepage client manifest and enforces:

- no more than 80 KB gzip of initial homepage JavaScript;
- no Supabase runtime in the initial public homepage entry;
- no Framer Motion runtime in the initial public homepage entry;
- no complete multilingual panel dictionary in the initial public homepage
  entry.

Measured before this work:

- initial homepage JavaScript: about 241 KB gzip;
- six initial JavaScript chunks.

Measured after this work:

- initial homepage JavaScript: about 54 KB gzip;
- three initial JavaScript chunks;
- reduction: about 78 percent.

Chunk names are content-addressed and will change between builds. The budget
script calculates sizes from the generated manifest rather than pinning names.

## Runtime strategy

- The small locale/config list is part of the initial runtime. Large runtime
  translation dictionaries load only when a non-localized route actually
  needs DOM translation. Locale-prefixed SEO routes remain server-rendered.
- Customer notifications load immediately in authenticated customer workspaces
  and during idle time on public routes. Admin and embed routes do not load the
  customer notification runtime.
- Homepage session synchronization loads after the first paint. Logout still
  uses the existing stable auth helper and confirmed sessions still update the
  homepage actions.
- Performance tools load when their section approaches the viewport. A fixed
  loading surface prevents layout jumps.
- The vehicle brand selector keeps its customer-safe canonical seed in the
  first render, then refreshes through the existing cache-first API.
- Below-the-fold homepage sections use `content-visibility: auto` so the browser
  can defer their layout and paint without removing them from HTML or search
  indexing.
- Decorative motion uses lightweight CSS and respects reduced-motion settings.

## Release checks

1. Run lint, full typecheck and all tests.
2. Run a production build.
3. Run `npm run check:performance` after that build.
4. Run i18n/SEO and payment schema-only checks.
5. Test `/`, `/de`, `/new-request` and `/api/vehicles?type=brands` locally.
6. Verify phone, tablet, laptop and desktop widths have no horizontal overflow.
7. Scroll to the performance tools and confirm they load before interaction.
8. Confirm the browser console has no errors.

## Boundaries

This optimization does not change pricing, payments, customer authorization,
vehicle catalog records, request workflow, AI behavior or production data. It
adds no dependency and requires no SQL migration.
