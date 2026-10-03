# Acquisition and revenue evidence — 3 October 2026

## Scope and decision

Owner requested acquisition work that produces paid business, without routine
technical handoffs. Work was limited to the existing File Service account and
the existing EN and UK/Ireland Search campaigns. Their average daily budgets
remain EUR 5 each; no new paid service, campaign or budget increase was made.
The unrelated dirty owner checkout was preserved. The registration fix is a
local candidate based on clean source `1075a75dc5138cdae299099f77b86dd9c8cb7386`;
it is not a Production release.

The first implementation addresses a reproducible registration-recovery defect,
not an unproven marketing redesign. More clicks are not equivalent to revenue.

## Fresh Google Ads observations

Authenticated Chrome account: MG AutoTech File Service, customer ID
`635-438-3417`. Reporting date selection: **1–3 October 2026**, account time zone
GMT+02:00. Reporting is not real-time.

| Campaign | Observed status | Average budget | Impressions | Clicks | Cost | Ads conversions |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| UK & Ireland / File Service Search | Enabled, Eligible | EUR 5/day | 103 | 10 | EUR 6.52 | 0 |
| EN / File Service Search | Enabled, Eligible | EUR 5/day | 0 | 0 | EUR 0 | 0 |

The existing Performance Max campaign remains paused. EN has no ad-schedule
restriction, eligible keywords, and a Maximize Clicks CPC cap of EUR 0.75.
The inspected EN negative list did not reveal a block of its main file-service
keywords. These observations do not establish the cause of zero delivery.
Audience exclusions were empty. All seven age categories, all three gender
categories and all seven household-income categories displayed Eligible with
no bid adjustment. No demographic restriction was found in those inspected
tables; this is not a claim that every account setting was verified.

Ad Preview and Diagnosis for `tuning file service`, Toronto / Ontario / Canada,
English / Mobile returned an unknown no-show reason for EN's exact keyword.
UK location mismatch in that preview is expected, not evidence of a UK fault.
No speculative bid increase was applied. Quality Score and below-average landing
page experience are signals, not a proven explanation for EN's zero delivery.

### UK search-term evidence and limits

The report exposed 14 search terms: **1 click, EUR 0.65, 20 impressions** in
total. The clicked visible term was `ecu remapping files`, which matches the
advertised service. The report's **Other search terms** row contained **9 clicks,
EUR 5.87 and 83 impressions**. Approximately 90% of spend therefore cannot be
classified using the exposed query list alone.

`remap check by reg` had 2 impressions, no clicks and no cost. Source review
found no registration-number remap lookup: File Check requires an actual file
and controller/read context. Added **only `[remap check by reg]`**, exact match,
at the UK/Ireland campaign level; the saved report visibly returned `Excluded`.
This is service matching, not evidence of recovered money. The rollback is to
remove this exact campaign negative; no positive keyword was paused. Saved
screen evidence: `.autopilot/runtime/uk-exact-negative-2026-10-03.jpg`.
`ecu cloning service` had one
impression and no cost; it was not rejected merely because there is no dedicated
cloning page, since recovery and special-request options exist.

No claim is made that all queries are relevant, that hidden terms are wasteful,
or that every click belongs to a workshop. No changes to prices, legal claims,
conversion goals, campaign geography or payment configuration were made.

The current UK responsive search ad was also verified enabled and eligible,
with Good asset strength. Its displayed descriptions explicitly identify
workshops, original ECU/TCU-file upload, request tracking and secure online
delivery. No copy rewrite was applied just to improve the asset-strength score.
Asset strength is not an acquisition or revenue result.

## Fresh aggregate website evidence

Authenticated `/admin/ads-performance` observed at **3 October 2026, 16:22 CEST**,
with **rolling 30 days** selected. No individual customer records were opened.

| Aggregate/cohort | Consented visitors | Registrations | Verified requests | Paying customers |
| --- | ---: | ---: | ---: | ---: |
| All channels | 117 | 12 | 2 | 2 |
| Paid `google / cpc` | 39 | 1 | 0 | 0 |
| `file_service_en` | 22 | 1 | 0 | 0 |
| `file_service_uk_ie_en` | 6 | 0 | 0 | 0 |

Paid cohorts displayed no verified revenue. The all-channel paying-customer
count is not evidence of Ads-attributed payments. Registration counts are not
necessarily verified completed registrations. Consent and first-touch coverage
limit the cohort; this is not an incremental-return measurement.

The rolling website window differs from the Ads calendar window above. Do not
divide these figures to report an October paid signup conversion rate. The
website screen exposes technical configuration, but explicitly does not verify
Google's receipt of conversions. A queued client callback is not receipt proof.

## Implemented registration fix

Before the fix, a verification resend error reset the created-account success
state. That reopened account creation instead of retaining the recovery action.
During successful account creation, both CAPTCHA widgets remained inside a
hidden form, preventing a visitor from completing a fresh interactive challenge
for resend.

The candidate keeps the created account in verification recovery after network
or API resend errors, exposes one active CAPTCHA in the recovery panel, unmounts
inactive form widgets, and preserves fail-closed checks and existing localized
copy. It does not weaken authentication or claim that email delivery is fixed.

Actual-handler regressions use synthetic SDK/widget responses. Browser checks
use actual page JSX, production CSS, icons/backdrop and catalogs with synthetic
transport/widget, on localhost only. They are not live signup, email-delivery,
real CAPTCHA, hydrated locale-switch or paid-checkout evidence.

EN/DE/TR/ZH error recovery was checked at 1366×768 and 390×844: correct language,
no horizontal overflow, one recovery challenge, an accessible error, no reopened
signup form and a visible resend action. EN created, missing-token, network,
pending and resent states retained recovery. Browser warning/error capture was
empty. Screenshots are ignored runtime outputs under
`.autopilot/runtime/recovery-browser-qa/`.

## Release and next acceptance criteria

The local registration candidate passed focused checks (52/52), full tests
(1812/1812), lint, web/desktop typecheck, the 12-locale i18n gate (37/37 bundle
cases), independent frozen-source review and the fresh standard
`npm run build -- --webpack`. The unchanged strict postbuild passed: 282 generated
pages, 43 required assets, compiled unauthenticated 401, valid synthetic PNG/PDF
and zero external fetches. Build ID: `aHsri9ykUbjB3pgGt5HPf`.

An initial build exited 1 because the supplied shared dependency junction left
`sharp` outside the standalone artifact. That failure remains recorded; matching
already-installed physical dependencies resolved the topology without installing
a package or changing a lockfile, source validator or production setting.
Consolidated receipt: `.autopilot/runtime/register-recovery-validation-receipt.json`.

Production publication still requires the owner's explicit release instruction
under the repository policy. No current publication is implied.

Commercial acceptance remains a real paid acquisition outcome: a verified signup,
first request and successful payment linked within a consistent date/cohort
definition. Ads enabled, clicks, a test pass or a higher optimization score cannot
replace that evidence. EN no-delivery and remote Google conversion receipt remain
separate unconfirmed external questions.
