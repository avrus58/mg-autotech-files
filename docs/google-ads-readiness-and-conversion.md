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

The Google tag is loaded only on the production hostname and only after an
applicable optional consent choice. Public page views use an explicit route
allowlist. Registration, auth callback, request and payment success routes are
measurement-only routes and never produce private page views.

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
SHA-256 transaction key derived from an anonymous attempt or provider seed. The
source seed is not sent to Google.

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

Avoid unsupported turnaround, compatibility, power, legality or guaranteed
result claims. Policy-sensitive service campaigns, including emissions-related
or diagnostic-code services, require separate Google Ads policy and legal review
before activation.

## Admin workflow

Open `/admin/ads-performance` with an account that has `orders.view`.

The center shows:

- GA4, Google Ads tag and conversion-label readiness;
- Consent Mode v2 and personalization state;
- paid source and campaign registrations, requests and verified revenue;
- approved campaign landing-page candidates;
- required account actions and known reporting limitations.

The report uses existing consented Growth attribution and verified business
records. No new database migration is required.

## Production verification

1. Create the three Google Ads conversion actions and record their labels.
2. Configure the five public environment variables for Production.
3. Deploy the matching application build.
4. Use a fresh browser profile and test Necessary only, Analytics only and Accept all.
5. In Google Tag Assistant, verify Consent Mode v2 defaults and updates.
6. Confirm public page views contain only normalized paths and content groups.
7. Complete one authorized test registration and verify one `sign_up` event.
8. Create one authorized non-customer test request and verify one `generate_lead` event.
9. Use a Stripe test environment for purchase validation; never create a live charge for smoke testing.
10. Reload each success page and confirm transaction-ID deduplication prevents another conversion.
11. Confirm `/api/admin/ads-performance` returns `401/403` anonymously.
12. Confirm `/admin/ads-performance` contains aggregate rows only.

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
