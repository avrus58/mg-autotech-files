# Customer acquisition: bounded actions, 5 October 2026

## Subsequent owner-approved Production release

After the local implementation handoff recorded below, the owner explicitly
approved publication of only the prepared registration correction. Source
`b4c22314d60f` is now live as a healthy, zero-restart app/analyzer pair; fresh
Linux production build and anonymous pre57/post58 release checks passed.
IAB render/localization QA16/16 passed, with third-party console warnings
recorded rather than suppressed. This subsequent release did not edit
Ads, budgets, payment, schema or authentication policy. Complete receipt:
`docs/production-release-2026-10-05-register-locale.md`.

## Scope and authority

Owner requested a concrete customer-acquisition improvement, not another
unsubstantiated readiness claim. Existing authenticated Chrome was used for the
MG AutoTech File Service Ads account. This change keeps existing campaigns,
markets, budgets, bidding, conversion definitions and payment settings intact.
No individual customer records/PII or credential contents were accessed; no
customer account, email or payment operation was performed. Aggregate funnel
counts were used only as bounded business evidence.

The clean engineering candidate starts at `9caefda5a1f9`, a documentation-only
descendant of published runtime `61d8284`, on
`codex/acquisition-register-locale-20261005`. Unrelated owner work in the primary
checkout is preserved. At the implementation handoff this correction was
local only; later scoped owner publication approval and its result are
recorded in the subsequent-release section above.

## Observed baseline (not new revenue)

Google Ads date range **1-5 October 2026**, account UI observed on 5 October:

| Existing campaign | Impressions | Clicks | Cost | Reported conversions |
| --- | ---: | ---: | ---: | ---: |
| UK & Ireland / File Service / Search | 152 | 14 | EUR 9.52 | 0 |
| EN / File Service / Search / Active | 2 | 0 | EUR 0.00 | 0 |

Both Search campaigns are enabled, Eligible (Learning), with EUR 5/day average
daily budgets, Maximize clicks and EUR 0.75 maximum CPC limits. Campaign #1
(Performance Max) remains paused. Budgets, status and bidding were not edited.
An unchanged average daily budget is not a guarantee of unchanged actual spend.

EN Locations currently lists Canada, Ireland, United Kingdom and United States.
UK/IE overlap with the other campaign is recorded, not silently changed.
EN's lower settings pane did not expose all language/schedule settings reliably;
the low EN delivery is not claimed to be resolved by adding keywords.

The visible search-term report accounts for 1 click / EUR 0.65; Google groups
the other 13 clicks / EUR 8.87 under Other search terms. The hidden portion must
not be called proven irrelevant traffic. The clicked visible term was
`ecu remapping files`.

The live site's refreshed aggregate acquisition report (5 October 00:22 CEST,
rolling 30 days) showed 42 Google CPC consented visitors, 1 registration and
0 verified file requests. Its all-channel 2 paying customers are not proven
Ads-attributed customers. Different periods and consented site visitors are
not interchangeable with Ads clicks.

## Saved and verified in live Ads

Added these **campaign-level exact negatives** only to UK & Ireland campaign
`24173830682`:

- `[map my car]`
- `[remap my car]`
- `[remap my car stage 1]`

Each was present in observed consumer-intent search terms, with zero clicks and
zero cost in this period. This is preventive intent filtering, not recovered
past spend or verified sales lift. Existing similar negatives were preserved.
No broad `ECU`, `remap`, `stage` or `files` negative was introduced.

Added four **exact positive keywords** to existing `Ad group 1` in each of
UK & Ireland `24173830682` and EN `24152497129` (eight entries total):

- `[ecu remapping files]`
- `[ecu tuning files]`
- `[remap files]`
- `[buy remap files]`

The original 22 keywords in each campaign were inspected before adding these;
each server-backed list subsequently showed 26. All eight additions were
verified as Enabled / Exact match in the correct campaign and ad group after
Save. At first save they were Pending / Under review; subsequent EN list
already showed Eligible for some entries. Status can progress after this
point-in-time receipt; approval is not evidence of traffic or a sale.

These are observed professional file-service query variants, not a new service
or broad-match expansion. Exact positive matching can include close variants;
exact negatives do not block the same phrase with additional words. See
[Google positive close variants](https://support.google.com/google-ads/answer/9342105?hl=en-GB)
and [Google negative exact matching](https://support.google.com/google-ads/answer/7302926?hl=en).

Saved browser proof artifacts (local, not customer data):

- `C:/Users/gokka/.codex/visualizations/2026/10/05/ads-ukie-exact-keywords.jpg`
- `C:/Users/gokka/.codex/visualizations/2026/10/05/ads-ukie-my-car-negatives.jpg`
- `C:/Users/gokka/.codex/visualizations/2026/10/05/ads-en-keyword-save.jpg`

Rollback: remove only these eight exact positive entries from their specified
ad groups and the three specified UK/IE campaign negatives in the Ads UI.
Do not bulk-remove existing keywords or alter budget/campaign state.

## Concrete registration obstruction corrected locally

The real registration submit handler could throw before SDK `signUp` when
the browser denied optional locale storage or the cookie getter. This was
reproduced using actual compiled RegisterPage handlers/JSX, the real locale
preference helper and real pure email-language resolver, with isolated SDKs.
Unmodified runtime failed all 48 locale/denial cases (23/71 focused tests
passed). It is not evidence that every lost Ads visitor had this condition.
The reproduction verifies optional locale/cookie preflight only; it does not
prove the complete real SDK signup/session-storage flow succeeds when browser
storage is denied.

`src/app/register/page.tsx` now uses the existing safe `readStoredLocale()` and
a guarded raw cookie-header read. Existing stored/cookie/browser precedence,
legacy malformed-cookie behavior, all twelve locale choices, callback target,
fresh CAPTCHA and single-account recovery are preserved. No Auth policy,
SDK signature, session persistence, copy, layout, price, dependency or schema
was changed. The actual component body is unchanged after line-ending
normalization. This is not a fix/proof for the separate remote-computer login
incident or for actual email delivery.

Checks so far: actual RegisterPage 71/71; combined relevant auth/preferences
100/100; targeted i18n 109/109; mandatory check:i18n (12 locales, 2473 reviewed
rows per non-English locale, zero clean English fallback, client bundle37/37);
lint; web/uploader typecheck; full test1866/1866; diff whitespace check. Frozen
source/test independent review by `/root/acquisition_review` and root found no
blocking source change. Fresh `npm run build -- --webpack` exited 0 at
2026-10-04 23:15:25 UTC: 282/282 pages, build `nAJGvAzp76TQIlzv9otkX`, prebuild
i18n37/37 and unchanged strict postbuild passed (43 assets, five report fonts,
30 PDFKit and eight sharp files, compiled auth401, valid PNG/PDF, zero checker
external fetches). Windows native SWC warnings were handled by Next's supported
fallback; no dependency or platform protection was weakened. Final validation
is also recorded in `.autopilot/STATUS.md` and ignored runtime receipt
`register-locale-storage-validation-2026-10-05.json`. At the implementation
handoff no new-source deployment or Production smoke had occurred; the
subsequent scoped release is recorded above. No real browser signup/session-
storage end-to-end test was performed in either turn.

## Remaining evidence boundaries

Live Goals / All conversions still reports Needs attention for verified file
request and credit purchase actions. The tooltip says Tag inactive, last
activity 26 September (9 days ago). Registration is Secondary with No recent
conversions; the legacy action is Secondary / Inactive. The signup summary's
Misconfigured badge is not by itself proof that an intentionally secondary
action should become a bidding goal. No conversion definition was changed,
no fake conversion was sent and Google receipt is not declared proven.

Independent read-only measurement source review found the dispatch chain present
and unchanged from published `61d8284`, not a demonstrated missing integration.
Ads consent, allowed measurement routes and valid configuration are required
(`publicAnalytics.ts:1983`). File-request conversion follows RPC success and a
verified order ID (`new-request/page.tsx:1975`); browser Stripe purchase follows
owned paid-session validation and credit reconciliation
(`api/stripe/confirm-session/route.ts:84`). Registration requires completed
customer eligibility, not an ordinary login (`registrationEligibility.ts:65`).
Script-load callback/queue handoff is not Google delivery proof
(`googleAds/readiness.ts:451`). Actual Production configuration values, tag
receipt and individual customer events were not inspected in this review.

A separate catalogue-selection stale-response race was reproduced by the
read-only reviewer; it is deferred, not implemented or marked resolved here.
The site's authenticated current-machine session does not prove the reported
other-machine login issue is resolved. New real registrations, verified
requests, Ads-attributed paid customers and revenue need observed business
evidence after release; no new revenue is claimed from this work.
