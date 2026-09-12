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

## Owner-authorized bounded restart — 12 September 2026

The owner explicitly requested reopening Ads after the unverified Google
conversion receipt had been disclosed. This supersedes the earlier paused-only
operational outcome above, but does not certify the measurement gates as passed.

Completed and verified in the authenticated MG AutoTech File Service Ads UI:

- Existing EN Search campaign `24152497129`: **Enabled / Eligible**. Its one
  standard ad group and responsive search ad also show **Enabled / Eligible**.
- Its dedicated average daily budget remains **EUR 5.00** and Maximize Clicks
  maximum CPC bid limit remains **EUR 0.75**. No budget/bid increase, targeting
  expansion, ad-copy, conversion-action or billing change was made.
- Saved campaign end date **13 September 2026**; reopened the editor and verified
  the persisted date. Google ends it at 23:59 in account time, currently
  GMT+02:00 Central European Time. Inspected controls contain no automatic
  extension/re-enable.
- Replaced the existing EN rule version `61693959` (hourly, all-time cost
  >= EUR 73.03) with saved version **`61689299`**, named
  `Safety: EN Search pause at EUR8 today (Sep12-13 test)`. It pauses only the
  selected EN campaign when **today's cost >= EUR 8**, checks hourly, and keeps
  the existing changes/errors-only email preference. Preview showed zero
  immediate changes. Save confirmation and enabled rule row verified.
- UK/Ireland rule `61492052` is unchanged. Rules list contained only these two
  pause rules; no scripts were configured. Auto-apply recommendations showed
  **0/7** and **0/14** selected. No automatic budget increase was enabled.
- Today's change history showed the earlier exact negatives and no budget
  change. Today's account report showed EUR 0.00 before activation. Reporting
  is delayed, so this is bounded UI evidence rather than a real-time ledger.
- Final all-campaign table: EN enabled; **Campaign #1 (PMax)** and
  **UK & Ireland Search** both still paused.

Spending interpretation: unchanged EUR 5/day across at most the two account
calendar days September 12–13 implies at most **EUR 20 additional billable
advertising media cost** under Google's ordinary Search 2x daily spending limit.
This is not a tax/fee-inclusive invoice guarantee or an exact served-cost UI
limit. The EUR 8 rule is an earlier best-effort stop, **not** a hard EUR 8 cap:
hourly execution and reporting can lag. Do not extend the end date or increase
the budget automatically. A new spending decision is required for continuation.

Sources: [Google spending limits](https://support.google.com/google-ads/answer/10486637?hl=en),
[highest budget on a changed-budget day](https://support.google.com/google-ads/answer/10487143),
[campaign end-date timezone](https://support.google.com/google-ads/answer/6328?hl=en).

Recovery: pause EN immediately for an incident; retain its finite end date.
The older rule is recorded above for audit, not a recommendation to reinstate
an already-consumed lifetime threshold during this test. No other campaign or
negative list needs resetting.

This short reopening is not statistical proof of acquisition quality,
profitability, customer acquisition or Google conversion receipt. The reviewed
local completion hotfix remains at `c08b842`, unpublished; deployed application
source remains `511a22b`. No new application release, customer mutation, fake
conversion, live payment/email test or credential change occurred. This turn
changed only the Ads controls described here and these operational receipts;
it did not rerun or re-label the earlier engineering suite as live evidence.

## Scoped completion release and fresh Ads check — 12 September, 23:06 CEST

This later owner-approved release supersedes the unpublished runtime status
above: **c08b842683bd is now live**, with 1651/1651 fresh tests, successful Linux
build and 42/42 post-release checks. Main-site and Caddy runtimes were untouched.
See `production-release-2026-09-12-completion-deadline.md` for immutable source,
rollback and exact validation evidence.

Refreshing Google Ads at approximately 22:59 CEST showed September 12 totals of
**22 impressions, 4 clicks, EUR 2.89 cost, 0 conversions**. EN remains enabled at
EUR 5/day; PMax and UK/Ireland remain paused. No campaign, bid, budget, rule,
conversion-action or end-date change was made during this release.

Tag Assistant connected and showed GA4/Ads tags and page-view hits. Necessary-only
consent changed measurement permissions to denied in Google's own diagnostic;
the previous analytics+advertising choice was then restored through the UI and
verified. Ad personalization stayed denied; debugging was stopped. These checks
preceded cutover and the analytics code/configuration did not change.

The verified-file-request action still showed Tag inactive, last activity
August 31. Registration showed No recent conversions; purchase was Inactive.
The website's always-emitted `external_verification_required` warning is not a
live Google status detector. Neither source tests, page-view hits nor a gtag
callback proves real request-conversion receipt or advertising profitability.
No fake order, signup, payment, email or conversion was generated to change those
statuses. Authenticated request-form entry passed post-release EN/DE/TR/ZH mobile
and laptop checks; actual submission was intentionally not performed.
