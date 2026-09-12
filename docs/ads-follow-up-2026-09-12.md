# Acquisition follow-up — 12 September 2026

Owner request: begin the proposed funnel verification, evidence-led search-term
cleanup and conditional limited EN Search restart. No campaign restart or new
application deployment was performed in this turn.

## Current account evidence

Authenticated Chrome inspection of **MG AutoTech File Service**, approximately
15:49–15:55 Europe/Berlin:

- All three campaigns are **Paused**. The word `Active` in the EN campaign name
  is not its delivery status. Active account budget displayed EUR 0/day.
- For **5–11 September**, EN Search reported 497 impressions, 27 clicks,
  EUR 20.07 cost and zero conversions. The other two campaigns had zero cost
  in this period. Billing balance is not the period's advertising cost.
- `MG Verified File Request`: Primary / Every / Needs attention, specifically
  Tag inactive, last activity 31 August. Registration: Secondary / One /
  No recent conversions. Verified purchase: Primary / Every / Inactive.
- These labels and zero attributed conversions do not prove zero customers or
  a broken registration flow. Actual Google receipt is still unverified.

The search-term report discloses only **4 clicks / EUR 2.99** by named terms;
**23 clicks / EUR 17.08** are aggregated under Other search terms. It is not
possible to classify the intent of those undisclosed clicks from this report.

## Exact live advertising changes

Only the following two **campaign-level exact-match negatives** were added to
`EN | File Service | Search | Active`:

- `[ecu remapping]`: 1 disclosed click, EUR 0.75.
- `[remap stage 1]`: 1 disclosed click, EUR 0.74.

Reason: narrow the controlled workshop/file-service acquisition test away from
generic remapping searches that do not express file-service intent. This is a
targeting judgment, not proof that every such searcher is irrelevant. Exact
matching preserves longer explicitly file-service queries. The save completed
and both search-term rows visibly changed to **Excluded**. `remap my car` was
already excluded and was not duplicated. `my genius tuning files` and relevant
file-service queries were left unchanged.

No budget, bid strategy, geography, ad copy, assets, conversion action, account
access or campaign status changed. Recovery: remove just these two exact
negative entries from this campaign. No other negative list needs resetting.

## Site report is a different evidence source

The existing authenticated site's Ads Readiness page loaded successfully and
showed **9/9 technical configuration controls**, explicitly **not launch-ready**
and **Google Ads delivery not verified**.

For its selected **30-day** range, the first-party site report displayed:

| Scope | Consented visitors | Registrations | Verified requests | Verified revenue |
| --- | ---: | ---: | ---: | ---: |
| google / cpc | 150 | 5 | 2 | EUR 135.00 |
| file_service_en | 75 | 3 | 2 | EUR 135.00 |
| file_service_uk_ie_en | 14 | 1 | 0 | None |

These are displayed first-party attribution aggregates, not a fresh audit of
individual customers or transactions, Google receipt proof, incremental ad
revenue, profit or a valid ROAS calculation against the seven-day Ads spend.
They establish that the two reporting surfaces disagree, not the cause.
No individual customer data is reproduced here.

## Local completion hotfix

The successful request handler awaited its optional new-order email response
without a deadline before opening `/measurement/complete` or the dashboard.
A rejected response was caught; a response that never settled was not.
Actual-handler synthetic reproduction demonstrated this remaining hang.

The bounded fix places a four-second deadline around the existing notification
attempt. It preserves the endpoint/body and aborts outstanding transport when
possible. Completion is single-use after a confirmed order so retrying the
completed form cannot create a fresh submission. A persisted browser-history
restore resumes the existing measurement bridge/dashboard rather than leaving
the accepted form disabled. Unfinished forms remain untouched. No notification retry, new
conversion, price, credit policy, auth, DB schema, dependency or copy change.

Final full tests **1651/1651 PASS**, no failures/skips; full lint and web/desktop
typecheck PASS. Prebuild localization gates passed 12 locales, 2472 strings and
37/37 bundle checks. Production-mode webpack build generated 282/282 pages;
strict postbuild verified 43 assets, protected compiled route 401 and synthetic
PNG/PDF without external fetches. A synthetic `.invalid` configuration was used,
not a real Supabase connection. Actual-handler/effect tests 24/24; independent
frozen-source review found no P0/P1/P2 issue. Final source hashes are in STATUS.

The earlier deployed source remains `511a22b48c7e`; this local hotfix is not yet
published. Prior source validation must not be substituted for final-candidate
checks.

## Remaining boundaries

- The live registration URL redirected to the already authenticated owner's
  admin panel. The session was preserved; it was not logged out to manufacture
  an anonymous registration. No complete mobile live registration/email/request
  E2E was claimed. Temporary viewport settings were reset.
- Internal/staff test classification in Growth reports does not currently
  suppress Google conversion dispatch. No fake production registration, file
  request, payment, email or conversion was created to turn a diagnostic green.
- Real Google receipt needs a genuine consented completion, or a deliberately
  isolated diagnostic destination. Synthetic local callbacks are not receipt.
- The campaign restart remains gated. A EUR 5 average daily budget is not an
  exact daily ceiling, and a delayed pause rule is not a guaranteed EUR 25 hard
  cap. No new spending limit or scheduling rule was configured here.
- A separate source-only responsive observation remains deferred: request
  credit-warning visibility changes at `lg` while the two-column layout starts
  at `xl`, leaving the warning lower in 1024–1279px layouts. Not part of this
  notification-completion hotfix and not browser-reproduced in this turn.
