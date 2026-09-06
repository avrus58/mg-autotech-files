# File Service acquisition audit — 2026-09-06

Scope: owner-requested availability, Search Console and registration inspection.
Code baseline: `5ce42fbba3aba9331f0deef5b7d4e3d664da5b64` (deployed application
source `47ec45224470510b8ab15a4e9766727847842dea`). No new deployment authorized.

## Confirmed reporting defect and bounded fix

The Search Console country query lacked a page/host filter. A domain property
can therefore aggregate other subdomains into File Service country rows. Query
and page parsers already reject foreign origins, but only after Google's row
limit; that does not recover File Service rows displaced by another host.
All five GA4 reports also lacked `hostName` filtering: path and country dimensions
cannot distinguish sites sharing a property.

- Filter all three Search Console requests by the anchored exact HTTPS File
  Service origin before aggregation and row limiting. Keep `aggregationType:auto`.
- Filter all five GA4 requests by exact, case-insensitive `file.mgautotech.de`.
  Event reports retain the existing event allowlist through AND, never OR.
- Preserve public-path sanitization, read-only scopes, admin authorization,
  timeouts and failure behavior; no unfiltered fallback.
- Disclose that hostless GA4 events are excluded and bounded report summaries
  are not a complete visitor funnel. No new tracker, event, consent or credential.
- Synthetic fixtures exercise parent/preview/lookalike/local hosts, both Search
  Console property forms, country-only aggregation, event allowlists and failure.

This is a verified code-level isolation gap, **not proof that live figures were
contaminated**. The Production reporting property configuration was not read.

Primary references checked on 2026-09-06:

- [Search Console filters, aggregation and row limits](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- [GA4 hostname dimension](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
- [GA4 exact filters and AND expressions](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/FilterExpression)

## Availability observations, not a 522 resolution

At approximately 13:23 UTC, all four existing app/analyzer/proxy/main-site
containers were healthy with zero restarts. File Service and analyzer retained
the released image pair. VPS load was 0.26/0.12/0.10; about 2.35 GB RAM remained
available and disk use was 20%. This is a point-in-time sample, not a historical
capacity guarantee.

Twelve public read-only requests across readiness, home, file-service and register
returned HTTP 200 in 44–198 ms through Cloudflare MXP. VPS-to-public readiness also
returned 200. Direct-origin HTTPS returned 403; the inspected Caddy ingress rules
intentionally restrict File Service to Cloudflare IP ranges. No bypass applied.
Caddy's last-24-hour output contained no matched error/timeout lines; access
logging is not configured here, so this cannot disprove edge connection failures.

The intermittent 522 seen around the previous release was not reproduced today.
No cause has been established; no DNS/firewall/proxy/timeout changes were made.
Cloudflare origin connection analytics and a timestamp/ray correlated to a new
failure remain needed. [Cloudflare's 522 guidance](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/)
distinguishes origin connection failures from ordinary application errors.

## Search Console access resolved; actual observations

The owner's authorized account was open in a second Google session while the
first account remained selected. Switching to that existing account resolved
access without adding a property, DNS record, verification or sharing permission.
The earlier access-blocked observation is superseded.

Exact URL-prefix property `https://file.mgautotech.de/`, Web search:

- Three-month selector: 32 clicks, 928 impressions, 3.4% CTR, average position
  17.5; chart data June 18–September 4, 2026.
- 28-day selector: **23 clicks, 464 impressions, 5% CTR, average position 15.5**;
  August 8–September 4, 2026. These are organic search data, not Ads conversions.
- Top observed pages in that 28-day table: DTC service 6 clicks/71 impressions,
  homepage 3/51, Mercedes-Benz 3/41, HW/SW identification guide 1/52. Query rows
  expose only some clicks; anonymized queries must not be reconstructed.
- Country examples: Germany 4 clicks/63 impressions, US 2/56, Italy 2/15,
  Netherlands 1/14 and Ireland 1/7. These are not campaign targeting settings.

Index summary **last updated August 28**: 57 indexed, 89 not indexed comprising
85 discovered/currently not indexed, 3 redirects and 1 noindex. The noindex
example is `/download/windows`, not the registration or main service page.
The summary is stale: individual inspection of `/brands/bmw` shows **indexed**,
last successfully crawled September 1 at 10:03:11 AM by smartphone Googlebot,
crawl/indexing allowed and the selected canonical matching the inspected URL.
Do not describe all 85 as currently blocked or change intentional noindex rules.

Individual inspection of `/de/file-service` reports not indexed/unknown. Google's
**live test on September 6 at 3:42 PM** reports available to Google, indexable and
one valid breadcrumb item. Availability is not indexing. No indexing request
or validation submission was made, and the successful live fetch alone does
not establish why Google has not indexed this page.

Sitemap `/sitemap.xml`: Success, last read September 2, **138 discovered URLs**.
There is no evidence requiring a duplicate sitemap submission.

Crawl stats, last updated September 4: **4,941 requests / 90 days**, average
response 202 ms, host status no problems. The UI rounds successful requests to
100% while also reporting <1% 404 and <1% 301; do not report literally zero errors.
404 detail shows 13 requests, with inspected examples including old July/August
build assets and Apple association discovery URLs, not recent service pages.
No 5xx category was shown. This does not rule out the September 5 intermittent
522, which is after this report cutoff. Core Web Vitals has no field data.

## GA4 aggregate acquisition observations

Selected the existing **MG AutoTech File Service** property, not the unrelated
default property. Home's last-7-days card showed 37 active users, 42 sessions,
58 views and 215 events. The channel card placed all 42 sessions in Direct.

The full Events report has its own **August 9–September 5, 2026** range, distinct
from both the home card and Search Console. It showed 537 events / 61 total users:
180 page_view, 141 user_engagement, 108 session_start, 61 first_visit,
28 public_navigation_click (18 users), 13 request_cta_click (10 users),
5 request_start (1 user), and 1 generate_lead (1 user). All eight event rows were
visible; no sign_up or purchase row appeared. A recorded event is not proof of
a new, genuine paying customer; owner/test activity and business records were
not reconciled. Absence of sign_up does not prove zero registrations.

Source inspection confirms GA4 intentionally receives a canonical query-free
page location and empty page_referrer; the separate Ads tag retains its reviewed
click-signal handling. Thus GA4 Direct is not proof that Ads or organic traffic
is absent. No consent, referrer, campaign tracking or conversion definition was
changed. A full visitor funnel still requires permission-aware first-party
aggregate reconciliation, not ratios between mismatched report periods.

## Live anonymous registration inspection

Followed the existing hero CTA on `/file-service` to `/new-request`, then to
`/register?redirect=%2Fnew-request`. Empty-name validation displayed an alert and
moved focus visibly. With synthetic, unsubmitted form values, progressed through
all three steps. Turnstile completed on the login and final billing steps; the
final Create Account control became enabled. No horizontal overflow or console
warning/error was observed in this browser session. Test values were discarded
by leaving the page without submission.

This confirms the observed anonymous UI path, **not** successful account creation,
email delivery, authenticated request submission or Google's conversion receipt.
No customer, email, payment or database mutation was performed.

## Remaining evidence boundaries

- Search Console access is now resolved. Prioritize individually verified
  unindexed public URLs, not the stale summary count or speculative new pages.
- An intermittent 522 cannot be declared fixed from passing samples.
- Existing report row caps and missing/consent-limited events still prevent a
  complete visitor-level funnel. This patch does not invent attribution.
- Live report API compatibility/results need verification with authorized data
  access after an explicitly authorized release.
- No budget, campaign, pricing, legal text, database or Production changes.

## Local validation

Code candidate `a7d5b0ac6507e18ac0084fe1b7a6cd886f58286e`: targeted SEO tests
16/16; full tests 1504/1504 with no failures/skips; full lint; web and desktop
typecheck; i18n 12 locales/2448 strings plus 37 bundle tests; Production Webpack
build including mandatory prebuild and 280 generated routes; diff check all PASS.
Independent immutable source review found no actionable issues. This is a
verified local code candidate, not a Production deployment or an unattended OS
acceptance. Follow-up documentation records the newly obtained Google evidence.
