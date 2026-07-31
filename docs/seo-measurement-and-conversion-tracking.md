# SEO Measurement and Request Conversion Tracking

## Purpose

MG AutoTech uses two separate measurement sources because Google search data and
on-site request events answer different questions:

- Google Search Console is the source of truth for search queries, countries,
  impressions, Google Search clicks, CTR and average position.
- Google Analytics 4 receives consented public page, navigation and request
  funnel events.

The website does not attempt to recover hidden Google search terms from a
referrer. Search Console intentionally omits some anonymized queries for user
privacy, so query totals and visible query rows may differ.

## Website Event Contract

The central implementation is in:

- `src/lib/publicAnalytics.ts`
- `src/components/analytics/PublicAnalytics.tsx`

Allowed events:

| Event | Meaning | Allowed data |
| --- | --- | --- |
| `page_view` | A public page was viewed | Public path, query-free first-party URL, content group |
| `public_navigation_click` | A public internal link was selected | Public source path, public destination path, query-free first-party URL, content group |
| `request_cta_click` | A public CTA opened `/new-request` | Public source path, fixed destination, query-free first-party URL, content group |
| `request_start` | An authenticated customer reached the request workspace | Static channel labels and fixed `/new-request` URL only |
| `generate_lead` | The order-creation RPC completed successfully | Static channel labels and fixed `/new-request` URL only |

`generate_lead` is emitted only after successful request creation. Validation
errors, upload errors and failed order creation do not produce a conversion.

## Privacy Boundary

The event type definitions do not accept arbitrary metadata. The following data
is never part of an analytics event:

- customer name, email, user ID or customer ID;
- order ID or request number;
- vehicle, ECU, TCU or service selection;
- file name, hash, binary data, storage path or signed URL;
- notes, messages, credits, payment data or admin metadata;
- AI, training, source-provider or confidence metadata;
- URL query strings or fragments.

The Google tag is not loaded until the visitor chooses **Allow analytics**.
Choosing **Necessary only** keeps the tag unloaded. Advertising storage, ad user
data, ad personalization and Google Signals stay disabled. Analytics runs only
on the exact production host `file.mgautotech.de`; localhost and Preview hosts
do not contaminate production reports. Moving from an allowed public/request
route into `/admin`, `/dashboard`, `/payment` or another private route sends an
explicit analytics-consent denial update, so the loaded tag cannot continue
measuring the private workspace. Event `page_location` values are rebuilt from
the allowlisted path and `page_referrer` is intentionally blank.

## Required Configuration

The public GA measurement identifier is configured at build time:

```text
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

This is a public measurement identifier, not a service credential. Never place
a Google private key, OAuth secret, Supabase service-role key or another secret
in a `NEXT_PUBLIC_*` variable.

If the variable is absent or malformed, the analytics component, consent panel
and event dispatch remain disabled. The website and request flow continue to
work normally.

The admin opportunity dashboard also supports read-only server reporting. Its
server-only variables are:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:mgautotech.de
GOOGLE_ANALYTICS_PROPERTY_ID
```

These values must never use a `NEXT_PUBLIC_` prefix. Missing server reporting
configuration leaves the public website and event collection unchanged; the
admin page shows a safe configuration-required state.

## Google Setup

1. Create or select the GA4 web data stream for
   `https://file.mgautotech.de`.
2. Add `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` to the approved Production deployment
   environment.
3. Deploy the reviewed code and verify consent-denied and consent-granted modes
   in GA4 DebugView or Realtime.
4. Keep Enhanced Measurement form interactions and automatic page views
   disabled for this stream; the application sends the reviewed event allowlist.
5. In GA4 Admin, open **Product links > Search Console Links**.
6. Link the `sc-domain:mgautotech.de` property to the production web stream.
7. Publish the Search Console report collection in GA4 Library if it is hidden.
8. Mark `generate_lead` as a key event.

The Search Console link requires GA Editor access and verified Search Console
ownership. Search Console data can take about 48 hours to appear and has its own
privacy and compatibility limits.

## Reporting Workflow

Use Search Console Performance for:

- queries by clicks, impressions, CTR and position;
- page performance;
- country and device comparisons;
- branded versus non-branded query trends.

Use GA4 for:

- public landing-page engagement;
- public navigation and request CTA clicks;
- `request_start` volume;
- `generate_lead` successful request conversions;
- country and landing-page conversion comparison.

The GA4 Search Console integration supports query reports with Search Console
dimensions and an organic traffic report combining landing pages with country
and device dimensions. Do not claim an exact user-level query-to-order match;
the reports are aggregated and Google applies privacy filtering.

## Admin View

`/admin/seo-performance` is a read-only opportunity and conversion center. It
shows:

- Search Console and GA4 source readiness;
- aggregate acquisition and request funnel metrics;
- query opportunities in average positions 4-20;
- low-CTR, content and page-level request-intent gaps based on aggregate CTA clicks;
- country and landing-page performance;
- canonical service, brand, platform, guide and tool coverage;
- a deterministic weekly review queue;
- direct links to Search Console and GA4;
- the customer/private data and attribution boundaries.

It does not expose a measurement ID, service-account identity, private key,
access token or any customer/request metadata. See
`docs/seo-opportunity-conversion-center.md` for setup and operation.

## Smoke Checklist

1. Open a public page with no analytics preference stored.
2. Confirm the optional analytics panel appears only when a valid measurement
   ID is configured.
3. Choose **Necessary only** and confirm no Google tag request is made.
4. Reopen analytics preferences and choose **Allow analytics**.
5. Confirm one public `page_view` appears in GA4 Realtime.
6. Click a public service link and confirm `public_navigation_click`.
7. Click a public request CTA and confirm `request_cta_click`.
8. Open `/admin` or `/dashboard` and confirm no private page-view event.
9. With a dedicated safe test customer, open the request flow and confirm one
   `request_start` event.
10. Complete only an approved harmless request smoke and confirm one
    `generate_lead` event without request/customer metadata.
11. Open `/admin/seo-performance` and confirm the configuration status is
    accurate.
12. Confirm the browser console has no analytics errors when consent is denied
    or the measurement ID is absent.
