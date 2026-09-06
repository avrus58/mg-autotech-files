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

## Search Console access remains unresolved

The owner completed Google sign-in in the available in-app browser. Google denied
access to both `sc-domain:mgautotech.de` and `https://file.mgautotech.de/` for that
session. The owner was asked to switch to an authorized account. No property,
DNS record, verification or sharing change was made. No actual query, indexing,
click or registration-conversion metrics have been claimed from this session.

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

- Search Console authorization is required for actual search/indexing decisions.
- An intermittent 522 cannot be declared fixed from passing samples.
- Existing report row caps and missing/consent-limited events still prevent a
  complete visitor-level funnel. This patch does not invent attribution.
- Live report API compatibility/results need verification with authorized data
  access after an explicitly authorized release.
- No budget, campaign, pricing, legal text, database or Production changes.

Validation results are recorded in `.autopilot/STATUS.md` after completion.
