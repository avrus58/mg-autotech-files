# Customer activation audit — 2026-09-07

Scope: owner-requested acquisition, registration, confirmation and first-request
inspection, plus the optional new-customer guide. This report contains only
aggregates. No customer identifiers, contact details, files, credentials or raw
SQL results are included. No campaign, consent, price, payment or live database
setting was changed.

## Current evidence and populations

Read-only Production aggregate queries observed on September 7, 2026, around
00:56–01:00 UTC (02:56–03:00 Europe/Berlin). Rolling 28-day cohort starts August
10; rolling 7-day cohort starts August 31. Outcomes are limited to the observation
time and accounts created within each cohort, not unrelated event totals.

Existing administrator classifications distinguish verified real customers from
unreviewed accounts. Staff and explicitly excluded internal/test accounts are
not counted below; no classification was inferred from personal data or behavior.

| Signup cohort | Accounts | Confirmation present / signed in | First request | Successful live credit payment recorded |
| --- | ---: | ---: | ---: | ---: |
| 28 days: verified real customers | 4 | 4 | 1 | 1 |
| 28 days: unreviewed accounts | 6 | 5 | 0 | 0 |
| 7 days: unreviewed accounts | 1 | 1 | 0 | 0 |

No verified-real signup occurred in the 7-day cohort. The real payer and
requester are the same customer; successful credit application preceded the
first request. Payment evidence requires a persisted successful live-checkout
record with a positive amount and a credits-applied timestamp. This inspection
did not independently contact Stripe or inspect bank settlement.

Three verified real customers, each more than seven days old, confirmed/signed
in but made no request. All three currently have no usable credits. Two have
consented request-start events and opened a credit checkout. Three distinct real
cohort customers have a cancelled checkout record, but one later paid
successfully: cancellation alone is not evidence of a technical payment failure.

The largest evidenced post-signup gap is credit activation / first request.
The cohort is small; it does not prove interface confusion, pricing or a payment
error caused every abandonment. Six unreviewed accounts must not be presented
as six genuine new customers.

## Measurement and access limits

- Confirmation timestamps may include OAuth confirmation. They do not prove
  that every customer received a verification email. Five welcome emails have
  delivered status in the last 28 days; welcome and verification are different.
- Of 33 raw request-start events in 28 days, 17 belong to staff and 2 to an
  excluded internal account. Verified-real customers account for 11 events from
  3 users; unreviewed accounts account for 3 events from 3 users. Events are not
  unique attempts or a complete customer census.
- First-party consented, paid-labelled attribution precedes registration for
  2 verified-real and 2 unreviewed accounts. One verified-real account requested
  and paid. This is not a Google Ads conversion receipt or proof of causality.
- Journey reporting is consent-limited. Missing events are not proof of missing
  activity; anonymous attribution rows cannot all be certified as real people.
- No browser was connected during this audit, so current GA4/Ads reports,
  campaign state, spend and cost per acquisition were not verified. Previous
  Google observations remain historical, not refreshed evidence.

## Bounded implementation

`src/components/dashboard/DashboardClient.tsx` previously selected optional
profile completion ahead of the existing credit action. The change promotes
the existing localized credit guidance only when the dashboard has loaded
successfully, the unfiltered customer order history is empty, and the balance
is exactly zero. Urgent requests for customer information still come first.
Customers with any order history, including cancelled requests, retain their
previous priorities. Nonzero balances, loading/error handling, payment rules,
request gates and supported-language copy are unchanged.

The requested optional guide can explain original-file preparation, credits,
request creation and status/messages without turning optional billing details
into a gate. The request page already displays credit-shortfall recovery near
the top and opens Buy Credits separately to preserve the in-progress form;
that existing behavior was not replaced.

Dedicated tests execute the actual dashboard next-action callback and compare
its priority matrix with the previous contract. Final validation and release
status belong to the enclosing task; this report is not a deployment receipt
or a promise of increased conversions.
