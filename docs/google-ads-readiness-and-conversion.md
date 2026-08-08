# Google Ads Readiness and Verified Conversion Measurement

## Purpose

This layer makes paid acquisition measurable without turning the customer portal
into an advertising data source. It builds on the existing GA4, Search Console
and privacy-safe Growth attribution architecture.

It does not promise ranking or campaign profitability. It provides the controls
needed to distinguish a click from a verified business result.

## Conversion hierarchy

| Business event | GA4 event | Google Ads role | Trigger boundary |
| --- | --- | --- | --- |
| Verified registration | `sign_up` | Observation | Supabase confirms a new or newly confirmed customer account |
| Request created | `generate_lead` | Secondary | The order RPC succeeds and returns without an error |
| Payment completed | `purchase` | Primary | Stripe returns `paid` and the idempotent credit completion succeeds |

Measurement calls are fail-soft. A blocked tag, missing label or browser privacy
control never blocks account creation, request creation, payment confirmation or
credit allocation.

Do not import the same GA4 event into Google Ads as another Primary conversion
when the direct Google Ads conversion action is active. That would double-count
the same result.

## Consent Mode v2

The public consent control offers:

- Accept all: analytics and advertising measurement.
- Analytics only: public analytics and first-party consented attribution.
- Necessary only: no optional measurement.
- Customize: independent analytics and advertising measurement controls.

`ad_personalization` and Google Signals remain disabled in every mode. Existing
legacy analytics consent is migrated as analytics-only; it never silently grants
advertising consent. An existing denial remains denied.

Before any Google configuration command, the browser queue receives one
default-denied Consent Mode v2 command with a short `wait_for_update` window.
The saved customer choice is applied afterwards with an update command. The
default is never reset to granted and is never emitted more than once per page
runtime.

The Google tag is loaded only on the production hostname and only after an
applicable optional consent choice. Public page views use an explicit route
allowlist. Registration, auth callback, request and payment success routes are
measurement-only routes and never produce private page views.

The initial public landing touch is captured as sanitized, ephemeral in-memory
data before a choice is made. It is not written to browser storage and is not
sent over the network until analytics consent is granted. This preserves the
real first landing page and campaign when a visitor navigates before deciding.
After consent, the initial and current public touches are sent in order. A
temporary network failure receives at most three exponential retries plus an
online retry; successful touches are deduplicated for the current app session.

## Production configuration

The following values are public tag configuration, not server secrets:

```text
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-...
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-...
NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL=...
NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL=...
NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL=...
```

Create three website conversion actions in the MG AutoTech Google Ads account.
Use verified payment as Primary. Keep request creation as Secondary until enough
clean payment volume exists. Keep registration as observation-only.

The admin page `/admin/ads-performance` shows booleans only. It never returns the
tag ID, labels, credentials or private reporting configuration.

## Privacy boundary

Google measurement never receives:

- customer name, email, phone or customer ID;
- order or request ID;
- Stripe session or provider identifier;
- filename, storage path, signed URL or uploaded content;
- vehicle, ECU, service selection or customer notes;
- admin, File Expert, AI or work-order metadata.

Registration, request and payment duplicate protection uses a browser-side
SHA-256 transaction key. Request conversion uses the successfully created order
result when available; payment uses the Stripe session confirmed as paid;
registration uses the registration attempt retained through verification. The
source seed is never sent to Google. Registration creates no optional dedupe
storage when neither analytics nor advertising measurement has been granted.

`gclid`, `gbraid` and `wbraid` presence can classify a consented first-party visit
as `google / cpc`. Their values are not stored in the Growth tables or admin
report. Enhanced Conversions and customer-list audiences are not enabled.

## Landing page strategy

Initial Search campaign review should use existing canonical destinations:

- `/services/stage-1` for Stage 1 file-service intent;
- `/file-service` for broad ECU/TCU online file-service intent;
- `/ecu-platforms/transmission-control-units` for TCU/gearbox context;
- `/how-it-works` as a supporting trust and workflow destination.

Create separate campaigns by language, country and exact service intent. Start
with exact and phrase match. Review search terms and negative keywords before
expanding match types. Ad language must match the landing page language.

The admin Ads center includes an allowlisted campaign URL builder for all 12
supported website languages. It accepts only a known MG AutoTech destination and
restricted campaign/creative codes, then adds `utm_source=google`,
`utm_medium=cpc`, `utm_campaign` and optional `utm_content`. It cannot generate an
external redirect or add customer data.

Avoid unsupported turnaround, compatibility, power, legality or guaranteed
result claims. Policy-sensitive service campaigns, including emissions-related
or diagnostic-code services, require separate Google Ads policy and legal review
before activation.

## Admin workflow

Open `/admin/ads-performance` with an account that has `orders.view`.

The center shows:

- GA4, Google Ads tag and conversion-label readiness;
- Consent Mode v2 and personalization state;
- observed funnel health, separately from configuration readiness;
- consented visitor, registration, verified request and paying-customer counts;
- paid source and campaign registrations, requests and verified revenue;
- approved campaign landing-page candidates;
- a language-matched, allowlisted campaign URL builder;
- required account actions and known reporting limitations.

The report uses existing consented Growth attribution and verified business
records. No new database migration is required.

## Production verification

1. Create the three Google Ads conversion actions and record their labels.
2. Configure the five public environment variables for Production.
3. Deploy the matching application build.
4. Use a fresh browser profile and test Necessary only, Analytics only and Accept all.
5. In Google Tag Assistant, verify Consent Mode v2 defaults and updates.
6. Land on a tagged public URL, navigate once before accepting analytics, then
   confirm the first-touch campaign and landing page remain the original values.
7. Confirm public page views contain only normalized paths and content groups.
8. Complete one authorized test registration and verify one `sign_up` event.
9. Create one authorized non-customer test request and verify one `generate_lead` event.
10. Use a Stripe test environment for purchase validation; never create a live charge for smoke testing.
11. Reload each success page and confirm transaction-ID deduplication prevents another conversion.
12. Confirm `/api/admin/ads-performance` returns `401/403` anonymously.
13. Confirm `/admin/ads-performance` contains aggregate rows only and distinguishes
    configured measurement from an observed funnel.

Google Ads conversion diagnostics can take time to update. A delayed Ads UI does
not justify bypassing consent, emitting duplicate events or exposing identifiers.

## Release gate

Campaign activation remains blocked until:

- all five configuration checks are ready;
- Tag Assistant confirms consent behavior;
- conversion actions have the intended Primary/Secondary setting;
- country, language, landing page and ad copy match;
- billing, daily budget and account access are owner-approved;
- policy-sensitive service groups have been reviewed separately.

The site can prove that a conversion was queued after a verified business
success. It cannot prove that Google accepted the event. Tag Assistant and the
Google Ads conversion diagnostics are the external source of truth for receipt.
See `docs/google-ads-campaign-launch-plan.md` for the account and campaign setup.
