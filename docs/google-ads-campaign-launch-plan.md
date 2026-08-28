# Google Ads Campaign Launch Plan

## Scope

This is the operational launch plan for `file.mgautotech.de`. It deliberately
keeps ad spend, billing and campaign activation outside application code. The
website prepares measurable, useful destinations; the Ads account remains the
source of truth for budget, targeting, policy review and conversion receipt.

Official controls:

- Destination requirements: https://support.google.com/adspolicy/answer/16427615?hl=en
- Consent requirements for EEA traffic: https://support.google.com/google-ads/answer/13695607?hl=en
- Google Ads data-collection and consent-message policy: https://support.google.com/adspolicy/answer/6020956?hl=en
- Misrepresentation policy: https://support.google.com/adspolicy/answer/6020955?hl=en
- Average daily budget overdelivery: https://support.google.com/google-ads/answer/10486637?hl=en
- Automated rule timing: https://support.google.com/google-ads/answer/2497710?hl=en
- Paused campaign billing: https://support.google.com/google-ads/answer/2375373?hl=en
- Google Ads legal requirements: https://support.google.com/adspolicy/answer/6023676?hl=en-GB
- UK unsafe/illegal vehicle reporting guidance: https://www.gov.uk/guidance/report-someone-making-or-selling-unsafe-or-illegal-vehicles-or-parts
- UK DPF guidance: https://www.gov.uk/government/publications/diesel-particulate-filters-guidance-note/diesel-particulate-filters
- Ireland AdBlue/emissions-control guidance: https://www.rsa.ie/road-safety/road-users/vehicle-components/adblue-or-diesel-exhaust-fluid
- Ireland NCT tester manual: https://www.rsa.ie/docs/default-source/services/nct-manual-2023.pdf

## Account boundary

Use a dedicated MG AutoTech File Service Google Ads account. Do not mix the new
file-service funnel with conversion goals from an unrelated local-business,
directions or contact campaign. Before spend is enabled, confirm:

- owner/admin access;
- billing profile and payment method;
- account country, currency and time zone;
- only the intended conversion actions are campaign goals;
- daily budget and geographic scope are owner-approved;
- ads.google.com and Tag Assistant are not blocked by a browser extension during
  setup and diagnostics.

## Conversion actions

Create direct website conversion actions and copy the generated public tag ID
and labels into the five documented Production variables. Production also
requires the dedicated server-only `GROWTH_ATTRIBUTION_HMAC_SECRET`; the three
conversion labels must be pairwise distinct. The attribution secret must not
equal any service-role, upload, device, analyzer, proxy, rate-limit or widget
secret, including the optional legacy attribution HMAC. The reviewed Growth
migration labels historical hashes as ambiguous
pre-v2 values because they may have used either the former dedicated key or the
service-role fallback. The server dual-reads candidates only to find
already-existing rows; all new hashes use the dedicated key. Preserve the
optional legacy HMAC value across a later service-role rotation until the
documented compatibility window is retired.

| Action | Account role | Count | Initial campaign use | Value |
| --- | --- | --- | --- | --- |
| Verified request | Primary | Every | The only bidding goal for the first Search campaign | No invented revenue value |
| Verified payment | Primary | Every | Excluded from initial bidding until a real transaction receipt is proven | Dynamic provider-confirmed value and currency |
| Verified registration | Secondary / observation | One | Observation only | No invented revenue value |

Do not also import the same GA4 events as Primary Google Ads actions. That would
double-count one business result. Bank-transfer selection, checkout start,
button clicks, form opens, internal notes and failed submissions are not
purchases or leads.

Enhanced Conversions and customer-list audiences remain disabled. No customer
email, phone, customer ID, order ID, vehicle, filename or technical file data is
intentionally included in the application's Google measurement payloads. This
payload contract does not erase the separately documented same-origin vendor
trust boundary.

## Campaign structure

Start with the existing UK and Ireland Search campaign only. Keep the historical
English Search campaign and Performance Max campaign paused. Separate any later
campaign by language, geography and service intent. Do not combine languages in
one ad group. Use a landing page in the same language as the ad.

Initial review groups:

1. Stage 1 file service: localized `/services/stage-1`.
2. Broad ECU/TCU file service: localized `/file-service`.
3. Workflow/trust support: localized `/how-it-works`.
4. TCU file service: English `/services/tcu-tuning` only until a
   localized destination exists.

Begin with exact and phrase match. Expand only after search-term quality and
verified requests are visible. Keep policy-sensitive diagnostic/emissions
service groups separate from general performance campaigns and review them
before activation.

The current public destination also describes emissions-control modification
services. A customer-responsibility disclaimer is not independent legal or
Google destination-policy clearance. UK/Ireland activation therefore remains
blocked until a qualified review covers the complete crawlable destination and
the services advertised in both target countries. Do not hide content only from
Ads crawlers; that would create a separate destination-policy problem.

## Naming and URLs

Use stable lowercase identifiers:

```text
campaign: file_service_uk_ie_en, stage1_de, stage1_fr_ca
```

Campaign codes are limited to the business-owned namespaces `file_service`,
`stage1`, `stage2`, `tcu`, `ecu_file_check`, `ecu_platforms` and
`how_it_works`, followed by one to four two-letter market/language segments.
This includes the current and historical codes above and
`file_service_eu_en`, while rejecting arbitrary names, account references and
other query-string values. Build final URLs in `/admin/ads-performance`; do not
hand-edit customer identifiers or arbitrary redirects into campaign URLs.

The first-party Growth report aggregates results by campaign. Review responsive
ad and sitelink asset performance in Google Ads; the application URL builder does
not present an unobserved creative or `utm_content` dimension.

The six audited UK/Ireland sitelink destinations are:

| Sitelink | Canonical destination |
| --- | --- |
| Stage 1 | `/services/stage-1` |
| Stage 2 | `/services/stage-2` |
| ECU File Check | `/services/ecu-file-check` |
| ECU Platforms | `/ecu-platforms` |
| TCU | `/services/tcu-tuning` |
| How It Works | `/how-it-works` |

All six are represented by the allowlisted URL builder. ECU Platforms and TCU
are English-only until matching localized destinations exist.

## Audited paused-account snapshot

The last operator audit covered Google Ads customer `635-438-3417`. This is an
audit record, not permission to spend:

- `UK & Ireland Search` (campaign ID `24173830682`): paused; the sole
  controlled launch candidate.
- historical English Search: paused and excluded from launch.
- Performance Max: paused and excluded from launch.
- automated rule `61492052`: enabled hourly pause backstop at EUR 20 total;
  delayed execution means it is not a hard real-time cap.

The 2026-08-28 follow-up audit still showed the account-wide banner `None of
your ads are running`. The controlled campaign remained paused and showed the
following saved settings: Search only, Search Partners off, Display off,
UK/Ireland presence-only targeting, English, Maximize Clicks, EUR 0.75 maximum
CPC, EUR 5 average daily budget, and AI Max, final-URL expansion, broad match,
automatically created assets and text customization off. Its 22 positive
keywords were phrase/exact only and it had 47 negatives.

The 2026-08-29 account-level all-time reconciliation explained the reported
EUR 100+ spend. This is historical evidence, not a forecast or permission to
restart anything:

| Campaign | Type | Clicks | Cost | Verified conversions |
| --- | --- | ---: | ---: | ---: |
| `Campaign #1` | Performance Max | 398 | EUR 54.25 | 0 |
| `EN | File Service | Search | Active` | Search | 74 | EUR 53.03 | 0 |
| `UK & Ireland | File Service | Search` | Search | 6 | EUR 4.03 | 0 |
| **Account total** |  | **478** | **EUR 111.31** | **0** |

The Performance Max spend was not search acquisition: EUR 31.75 went to
YouTube, EUR 20.13 to Google Display Network and EUR 2.31 to Discover, while
Google Search spent EUR 0. Its campaign status also reported incomplete
conversion tracking. It must remain excluded from this launch. Across both
Search campaigns, Google disclosed only EUR 11.00 of EUR 57.06 at individual
search-term level; EUR 46.06 and 65 clicks were grouped under `Other search
terms`. The hidden majority cannot be represented as proven workshop intent.
The controlled UK/Ireland campaign's six clicks were also not individually
disclosed.

The saved asset report was readable: one responsive Search ad, six sitelinks
and a business name under review. No business logo or image asset was present;
Google recommended images. Asset upload or any live-account edit requires a
separate owner-confirmed operator action. The current ad editor showed the main
ad and all six sitelinks on `utm_campaign=file_service_uk_ie_en`; the sitelinks
also used non-sensitive `utm_content` asset labels. Historical landing-page rows
still contained the former `file_service_eu_en` campaign code, so reporting
must use a post-change date boundary rather than treating old rows as a current
URL mismatch. The TCU sitelink correctly targets the dedicated English
`/services/tcu-tuning` conversion page. The first-party report intentionally
aggregates at campaign level; asset-level performance remains Google Ads'
responsibility.

Google Ads conversion diagnostics remained `Misconfigured`: Verified Credit
Purchase and Verified File Request were inactive Primary actions, Verified
Registration was an inactive Secondary action, and a legacy inactive Secondary
action remained present. No conversion receipt had been observed. Google Ads
also continued to display `Turn off ad blockers` despite no known blocker being
enabled. This warning must be resolved or independently excluded with Tag
Assistant and network evidence; it is not permission to bypass consent or to
activate spend.

The live account settings audit on 28 August 2026 confirmed that auto-tagging
is enabled, account-level tracking templates are unset and automatic
recommendation application is disabled. The same screen showed no data
protection contact. A responsible owner must supply and verify that contact in
Google Ads before launch; this repository cannot invent legal contact details.

The search-terms report showed no clicks on its 23 individually disclosed
queries; all six historical clicks (EUR 4.03 total) were grouped by Google under
`Other search terms`. Therefore those clicks cannot be treated as proven query
quality, and the campaign has no verified registration, request or payment
result yet.

Before any activation, re-check campaign ID `24173830682` against the visible
`UK & Ireland Search` name. Name-only selection is not an acceptable activation
control. Keep all campaigns paused if the identity, conversion receipt or any
prior launch gate is unresolved.

## Prepared account-edit pack (not applied)

The following narrowly scoped changes are prepared for an action-time owner
confirmation. They were not saved to the live Google Ads account during this
audit:

- replace `Professional Tuning Files` with `Chiptuning File Service`;
- replace the duplicate `Workshop File Service` headline with
  `ECU Remap File Service`;
- review these callouts: `Secure Customer Portal`, `Vehicle-Specific Review`,
  `Request Tracking`, `Private File Delivery`, `ECU & TCU Support`, and
  `Workshop-Focused Workflow`;
- review a `Services` structured snippet containing `Stage 1 File Service`,
  `Stage 2 File Service`, `TCU File Service`, and `ECU File Check`.

The review pack under `docs/assets/google-ads/` contains a corrected square
MG AutoTech business-logo export and four unbranded image candidates. The image
files remain local and the campaign remains paused. Upload requires owner
confirmation of commercial-use rights, AI-origin disclosure where Google asks
for it, exact campaign association and a final policy review.

## Negative-keyword starting review

Review these concepts before launch and adapt them per language. They are a
starting review list, not an automatic permanent exclusion list:

- free, cracked, torrent, keygen, serial, pirated;
- job, salary, training, course, school, tutorial;
- software download, database download, map pack;
- DIY, definition, meaning, calculator-only searches;
- hardware for sale, used ECU sale, repair parts;
- unrelated consumer products sharing ECU/TCU abbreviations.

Search terms must be reviewed regularly. Never block a proven commercial query
only because it resembles an informational phrase.

## Copy and policy controls

Ad copy must match the destination and current business capability. Do not claim:

- guaranteed power, compatibility, legality or approval;
- guaranteed same-day or fixed turnaround unless the order workflow supports it;
- official manufacturer affiliation;
- inspection, emissions or road-use outcomes that are not established;
- services or vehicle coverage absent from the published catalog.

The landing page must remain crawlable, functional, mobile-friendly and useful
without requiring an ad click. Login may be required only when the user enters
the secure customer workflow.

## Pre-spend verification

1. Confirm all five public Production measurement variables and the dedicated
   server-side growth attribution HMAC secret are present without revealing
   their values. Confirm the attribution secret is distinct from every other
   protected secret. Never fall back to a provider service key for attribution,
   Pre-v2 hashes may be dual-read only for existing-row continuity; verify the
   hash-version constraints and server-only rollback bridge. An application
   rollback is an availability recovery, not proof of attribution continuity;
   keep Ads paused until the v2-aware build and complete report are restored.
2. Deploy the matching application build after the variables are configured.
3. Open a fresh browser profile and test Necessary only, Analytics only and
   Accept all.
4. Confirm default-denied Consent Mode v2 appears before granted updates.
5. On a test ad-click landing, confirm an undecided visitor cannot leave through
   the registration/login/request CTA until they make an equal-choice privacy
   decision. Necessary only must continue without Ads linker storage. With Ads
   consent, the browser makes a bounded linker attempt before navigation; if a
   blocker or network failure prevents it, navigation fails open and only a
   coarse, identifier-free reliability category is recorded. A sanitized
   first-party touch may retry for at most 30 minutes, but this is not proof that
   Google received attribution. Never persist or append raw `gclid`, `dclid`,
   `wbraid`, `gbraid` or `_gl` values in application data.
6. Confirm no Google tag network request occurs under Necessary only.
7. Verify one authorized test registration and one disposable test request.
8. Verify payment only in a Stripe test environment; do not create a live charge
   for measurement smoke testing.
9. Reload success flows and confirm same-browser receipt suppression. Treat
   Google Ads transaction IDs as an additional provider defense; do not claim
   client-side exactly-once GA4 delivery across devices or after an ambiguous
   timeout.
10. Confirm request and payment are Primary/Every, registration is
    Secondary/One, and the initial campaign uses only Verified request.
11. Confirm the final URL language, ad language and UK/Ireland presence-only
    geographic target agree; Search Partners and Display must remain off.
12. Confirm phrase/exact keywords, negatives, auto-tagging, UTM naming and all
    six sitelinks. Broad match, AI Max, final URL expansion, automatically
    created assets and auto-apply must remain off.
    The 28 August 2026 read-only audit found auto-tagging on, no account-level
    tracking template and auto-apply off; re-check them immediately before
    activation because account settings can change independently of code.
13. Confirm EUR 5/day, Maximize Clicks with a EUR 0.75 CPC cap, and the enabled
    all-time EUR 20 automatic pause rule. EUR 5/day is an average budget, not a
    hard daily cap: eligible campaigns can spend up to twice the average daily
    budget on a day. Scheduled rules may run after their nominal trigger time,
    so the EUR 20 rule is a backstop rather than an exact hard cap. The rule may
    pause but must never automatically re-enable a campaign. Record the owner's
    explicit acceptance of this possible overdelivery before enabling spend.
14. Confirm responsive-ad, sitelink, business-name and logo policy review is
    approved, and Google Ads diagnostics received the expected conversion tag.
15. Publish an owner/legal-approved English privacy disclosure that accurately
    names the current VPS hosting and optional Google Analytics/Ads purposes,
    storage, vendors and withdrawal path. Decide whether that material change
    requires a new consent-version prompt; the current German-only/outdated
    disclosure is not a launch pass. The consent interface is localized but
    both of its privacy links currently resolve to the German-only
    `/datenschutz` route, so the UK/Ireland English funnel has no matching
    English disclosure. The consent notice must also include a
    prominent link to Google's Business Data Responsibility information as
    required by Google's EU user-consent audit guidance; the existing generic
    privacy-policy link alone does not satisfy this external launch gate.
    Verify the Cloudflare/Caddy access-log policy as part of that review:
    auto-tagged landing requests can contain click identifiers in the initial
    query before the browser replaces it with a clean URL. Confirm query
    redaction, retention and access controls in the live edge configuration;
    application tests cannot prove an external proxy's log settings.
16. Record qualified UK/Ireland legal and Google destination-policy clearance
    for the complete public destination, including emissions-related services.
17. Have the owner confirm that the public `~15-30 min`, `~30 min`, "usually
    around 30 minutes" and same-day processing statements are currently and
    consistently supportable. If not, obtain owner-approved neutral wording
    before using those destinations in ads; code review cannot invent or certify
    an operational turnaround promise.
18. Record an explicit owner decision on the documented same-origin Google-tag
    trust boundary. If technical isolation from browser-origin storage is
    required, design and verify a separate-origin or server/offline conversion
    path before activation.
19. Enable only the controlled UK/Ireland Search campaign after all prior checks
    pass. Enabling spend remains a separate owner-authorized action.

## First-week operations

- Inspect search terms and policy notices daily.
- Compare clicks with consented visitors, verified requests and verified revenue.
- Do not judge a campaign from clicks alone.
- Do not optimize toward registration when verified payment evidence exists.
- Never restart the historical Performance Max or English Search campaigns as
  part of the controlled test. Only campaign ID `24173830682` is eligible after
  every launch gate passes.
- Treat EUR 20 total controlled-campaign spend without a verified registration
  or request as a mandatory pause-and-review boundary. Do not expand geography,
  loosen match types or raise budget to escape a failed test.
- Pause misleading queries or destinations before increasing budget.
- Keep a change log for budget, targeting, conversion-goal and landing-page
  changes.

No ranking, approval, customer volume or profitability outcome is guaranteed.

Pausing prevents new ad delivery but does not cancel an existing outstanding
Google Ads balance or a payment already due under the billing threshold.
