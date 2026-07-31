# SEO Opportunity and Conversion Center

## Purpose

`/admin/seo-performance` turns aggregate Google Search Console and consented
GA4 reporting into a review queue for MG AutoTech. It is an internal decision
surface, not an automatic SEO publisher.

The center answers four operational questions:

1. Which queries already rank between positions 4 and 20?
2. Which high-impression results have a weak click-through rate?
3. Which existing service, brand, ECU platform or workshop pages have traffic
   but no completed-request signal in the same reporting period?
4. Which evidence-backed SEO work should be reviewed this week?

The homepage is not expanded by this feature. Content work is directed to the
existing canonical route whenever possible.

## Data Sources

### Search Console

The read-only Search Analytics API supplies:

- query and page;
- page totals;
- country totals;
- clicks, impressions, CTR and average position.

The center requests finalized web-search data and ends the period three days
before the current date. Google can omit anonymized and low-volume queries, so
the query rows are not treated as a complete search log.

### Google Analytics 4

The GA4 Data API supplies aggregate, consented data for:

- landing-page sessions, users, views and engagement;
- the fixed public event allowlist;
- request CTA, request-start and successful request events;
- aggregate country rows.

The system does not join a Search Console query to a person or order. Page
opportunities use only aggregate sessions and request CTA clicks. Completed
request events remain a separate site-wide funnel metric.

## Server Configuration

The public browser measurement ID remains separate:

```text
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
```

Server reporting uses these server-only variables:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:mgautotech.de
GOOGLE_ANALYTICS_PROPERTY_ID
```

Never prefix the service-account values with `NEXT_PUBLIC_`. Never expose the
private key in an API response, browser bundle, screenshot, support message or
log.

Setup procedure:

1. Enable the Search Console API and Google Analytics Data API in the approved
   Google Cloud project.
2. Create a dedicated reporting service account.
3. Give that account the minimum Search Console permission that can read the
   `sc-domain:mgautotech.de` performance report.
4. Add the account as a GA4 Viewer for the production property.
5. Configure the four server-only variables in the intended deployment
   environment.
6. Keep the private key newline-safe. A value with escaped `\n` is normalized
   server-side.
7. Redeploy the reviewed application and verify both source badges.

If the configuration is absent or invalid, the report fails closed and shows a
configuration notice. Public pages, request creation and customer workflows are
not affected.

## Opportunity Scoring

The deterministic opportunity engine considers:

- average position from 4 through 20;
- a minimum of eight reported impressions;
- directional CTR benchmark gap;
- impression volume;
- existing landing-page sessions and completed-request events.

Opportunity states:

- `quick_win`: page-one visibility with a useful improvement opportunity;
- `ctr_rewrite`: page-one visibility with a material CTR gap;
- `content_expansion`: position 11-20 where the existing page needs a stronger
  answer;
- `conversion_gap`: the page has enough consented sessions but no completed
  request event in the period.

Scores prioritize review; they do not guarantee rankings, clicks or sales. CTR
benchmarks are directional and must not be presented as a Google standard.

## Weekly Action Queue

Each task contains:

- a priority;
- the exact query and/or canonical page;
- the evidence behind the task;
- a bounded next action.

The queue favors improving existing canonical pages. It does not create thin
location pages, duplicate service pages, unsupported vehicle claims or
automatically published text.

## Content Inventory

The center inventories the existing public routes for:

- core hubs;
- ECU/TCU services;
- service-intent pages;
- vehicle-brand guides;
- ECU-platform guides;
- workshop guides;
- public preparation tools.

Each route is classified as performing, visible without a conversion signal,
low visibility or no reported data. No database table or SQL migration is
required.

## Security and Privacy

The admin API is `GET /api/admin/seo-performance` and requires a verified staff
session with `orders.view`. It is read-only, private, `no-store` and limited to
the fixed `28d` and `90d` ranges. Reports are cached in server memory for 15
minutes to protect Google quotas.

The response excludes:

- Google credentials and access tokens;
- customer names, email addresses and account IDs;
- order/request IDs;
- vehicle, ECU, TCU or selected service details from orders;
- file names, hashes, storage paths, signed URLs, raw/hex data;
- payment, credit, message, note, admin or AI metadata.

Search queries that resemble an email address or long phone number are dropped
before they reach the report. Only safe first-party public paths are accepted
from Google responses. Admin, dashboard, payment and API paths are rejected.

## Smoke Checklist

1. Open `/admin/seo-performance` as an owner or permitted staff account.
2. Confirm 28-day and 90-day controls load without clearing existing data.
3. Confirm Search Console and GA4 source badges match configuration state.
4. Confirm refresh does not expose a credential in the URL, response or UI.
5. Confirm anonymous API access returns `401` and a customer token returns
   `403`.
6. Confirm query opportunities include only positions 4-20.
7. Confirm request-intent gaps are labelled as page-level inference and use
   CTA clicks rather than completed-request attribution.
8. Confirm country and landing-page tables contain aggregate rows only.
9. Confirm content inventory links point to current canonical public pages.
10. Confirm no action edits or publishes a page.
11. Check mobile, tablet, laptop and desktop layouts for horizontal page
    overflow. The opportunity table may scroll inside its own container.
12. Confirm the browser console has no errors.

## Operational Limitations

- Search Console reporting is sampled/top-row oriented and privacy filtered.
- GA4 contains only consented measurement.
- In-memory report cache is per application instance and is not a durable data
  warehouse.
- There is no automatic Search Console indexing submission.
- There is no user-level query-to-request attribution.
- Content changes still require human review, factual verification and the
  normal release process.
