# Google Ads Campaign Launch Plan

## Scope

This is the operational launch plan for `file.mgautotech.de`. It deliberately
keeps ad spend, billing and campaign activation outside application code. The
website prepares measurable, useful destinations; the Ads account remains the
source of truth for budget, targeting, policy review and conversion receipt.

Official controls:

- Destination requirements: https://support.google.com/adspolicy/answer/16427615?hl=en
- Consent requirements for EEA traffic: https://support.google.com/google-ads/answer/13695607?hl=en
- Misrepresentation policy: https://support.google.com/adspolicy/answer/6020955?hl=en

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
and labels into the five documented Production variables.

| Action | Role | Count | Value |
| --- | --- | --- | --- |
| Verified payment | Primary | Every | Dynamic Stripe-confirmed value and currency |
| Verified request | Secondary | One | No invented revenue value |
| Verified registration | Observation only | One | No invented revenue value |

Do not also import the same GA4 events as Primary Google Ads actions. That would
double-count one business result. Bank-transfer selection, checkout start,
button clicks, form opens, internal notes and failed submissions are not
purchases or leads.

Enhanced Conversions and customer-list audiences remain disabled. No customer
email, phone, customer ID, order ID, vehicle, filename or technical file data is
sent to Google.

## Campaign structure

Start with Search campaigns separated by language, geography and service intent.
Do not combine languages in one ad group. Use a landing page in the same language
as the ad.

Initial review groups:

1. Stage 1 file service: localized `/services/stage-1`.
2. Broad ECU/TCU file service: localized `/file-service`.
3. Workflow/trust support: localized `/how-it-works`.
4. TCU context: English `/ecu-platforms/transmission-control-units` only until a
   localized destination exists.

Begin with exact and phrase match. Expand only after search-term quality and
verified requests are visible. Keep policy-sensitive diagnostic/emissions
service groups separate from general performance campaigns and review them
before activation.

## Naming and URLs

Use stable lowercase identifiers:

```text
campaign: stage1_de, file_service_en_us, stage1_fr_ca
creative: rsa_01, rsa_workshop_02
```

Allowed characters are lowercase letters, numbers, underscores and hyphens,
with a length of 3-64 characters. Build final URLs in
`/admin/ads-performance`; do not hand-edit customer identifiers or arbitrary
redirects into campaign URLs.

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

1. Confirm all five Production measurement variables are present without
   revealing their values.
2. Deploy the matching application build after the variables are configured.
3. Open a fresh browser profile and test Necessary only, Analytics only and
   Accept all.
4. Confirm default-denied Consent Mode v2 appears before granted updates.
5. Confirm no Google tag network request occurs under Necessary only.
6. Verify one authorized test registration and one non-customer test request.
7. Verify payment only in a Stripe test environment; do not create a live charge
   for measurement smoke testing.
8. Reload success states and confirm transaction deduplication.
9. Confirm payment is Primary, request Secondary and registration observation.
10. Confirm the final URL language, ad language and geographic target agree.
11. Confirm policy status, billing and owner-approved budget.
12. Enable a small controlled Search campaign only after all prior checks pass.

## First-week operations

- Inspect search terms and policy notices daily.
- Compare clicks with consented visitors, verified requests and verified revenue.
- Do not judge a campaign from clicks alone.
- Do not optimize toward registration when verified payment evidence exists.
- Pause misleading queries or destinations before increasing budget.
- Keep a change log for budget, targeting, conversion-goal and landing-page
  changes.

No ranking, approval, customer volume or profitability outcome is guaranteed.
