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
| Verified registration | `sign_up` | Secondary / One (observation) | Supabase confirms a new or newly confirmed customer account |
| Request created | `generate_lead` | Primary / Every | The order RPC succeeds and returns without an error |
| Payment completed | `purchase` | Primary / Every | Stripe returns `paid` and the idempotent credit completion succeeds |

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

A narrower saved choice is authoritative immediately. App-owned pending queues,
dedupe markers, the exact Google linker local-storage key and affected Google
cookies are cleared for the revoked
destination. If a Google script has already executed, the browser replaces the
current document with the same normalized, query-free path so an executed tag
cannot remain active in memory. This replacement also applies to same-tab,
cross-tab and back/forward-cache consent changes; blocked browser storage must
fail closed instead of preventing the withdrawal UI from completing.

The Google tag is loaded only on the production hostname, only after an
applicable optional consent choice, and only on the explicit public allowlist
or the dedicated `/measurement/complete` document. Registration, auth callback,
request, dashboard and payment-success documents do not load or call Google.
The homepage, `/tools` and `/widget` are also deliberately excluded because
they host session-aware or free-form customer inputs. Public-to-private and
public-to-excluded navigation uses a fresh document so a previously loaded tag
does not remain resident on the destination page.
Before an external Google script is inserted, the application has already
captured the bounded first-party touch and replaces the browser location with
the normalized path. Advertising consent may retain only one validated value
per documented Google click-signal key; analytics-only consent retains no
query. If location sanitization fails, provider loading fails closed. A
navigation that would introduce a new query while Google is resident crosses a
fresh-document boundary and is sanitized before the provider can load there.
Verified registration, request and payment outcomes retain only a bounded
anonymous transaction hash, cross a full-document boundary to the dedicated
completion document, and then return to the allowlisted private destination.
The completion route is `noindex`, carries no form, customer, order or payment
query, and never emits a page view.

This boundary prevents the application from intentionally sending account,
order, payment or form fields to Google, but it is not a cryptographic sandbox.
On an allowlisted page or the completion document, Google's script executes as
a same-origin third party and therefore shares the browser origin's technical
privileges. The current architecture treats that provider execution as an
explicit trust boundary. A stricter guarantee requires a separately authorized
separate-origin or server/offline conversion architecture; documentation and
tests must not claim that same-origin vendor code is technically incapable of
reading browser storage.

If a verified request or payment finishes on a private route before the visitor
makes an optional-measurement choice, it remains memory-only. An explicit later
grant promotes only the newly consented anonymous destinations into the bounded
durable queue before the completion-document handoff. A denied or withdrawn
destination remains excluded and cannot be resurrected by that promotion.

The initial public landing touch is captured as sanitized, ephemeral in-memory
data before a choice is made. It is not written to browser storage and is not
sent over the network until analytics consent is granted. This preserves the
real first landing page and campaign when a visitor navigates before deciding.
On a recognized paid landing, the first safe same-origin navigation is held by
the equal-choice consent gate rather than persisting the raw click identifier:
Necessary or analytics-only continues without Ads linker transfer, while an
advertising grant gets a bounded linker-readiness window before the same hard
navigation. Ordinary organic visits are not gated by this control.
After consent, the initial and current public touches are sent in order. A
temporary network failure is retained only in a sanitized first-party outbox:
maximum six normalized touches, maximum age 30 minutes, no raw click ID or URL,
no persisted `utm_term`, and only bounded source/medium/campaign tokens,
and the original enqueue time is never extended by retries. Delivery resumes on
the next eligible route or online event, deletes only after an explicit server
acknowledgement, and is erased immediately when analytics consent is withdrawn.
Concurrent and sequential recovery share acknowledgement receipts so one touch
is not posted twice by the same page runtime.

When that consented visitor later authenticates through password, Google, e-mail
confirmation or a restored session, a central first-party runtime links only the
existing pseudonymous visitor to the verified account. This operation is
fail-soft, sends no Google event, and is reported separately from registration.
Paid source/campaign registration counts require real account-creation evidence;
returning-customer logins, requests and purchases cannot inflate them.

## Production configuration

The following values are public tag configuration, not server secrets:

```text
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-...
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-...
NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL=...
NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL=...
NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL=...
```

Production also requires a dedicated server-only
`GROWTH_ATTRIBUTION_HMAC_SECRET` of 32-512 characters. Its value must never be
returned to a browser or readiness response, and new hashes must never fall
back to a Supabase/provider service key. It must also be distinct from the service-role,
upload-integrity, device, analyzer, proxy, rate-limit and widget secrets; both
the application readiness gate and VPS environment preflight fail closed on
reuse without printing either value. The reviewed Growth migration versions
ambiguous pre-v2 hashes and the server dual-reads current and former-key
candidates only to find an already-existing row; new rows always use the
dedicated key and raw visitor IDs are never stored. Preserve
`GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET` when rotating the service-role key until
the documented legacy-hash window is retired. The
three conversion labels must each be valid
and pairwise distinct so one event cannot be sent to the wrong conversion
action.

Create three website conversion actions in the MG AutoTech Google Ads account.
Keep verified request and verified payment as Primary / Every. Keep registration
as Secondary / One for observation. The initial UK/Ireland Search campaign uses
only Verified request as its campaign-specific bidding goal; Verified payment
stays out of that campaign goal until real delivery is proven.

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

Registration, request and payment delivery uses a browser-side SHA-256
transaction key. Request conversion uses the opaque seed returned by the
successfully created order; payment uses the Stripe session confirmed as paid;
registration uses the opaque `growth_journey_events.id` returned only after the
authenticated account-created gate accepts a completed customer registration.
The source seed is never sent to Google. Registration creates no optional queue
or dedupe storage when neither analytics nor advertising measurement has been
granted. Browser claims and provider transaction IDs reduce repeat delivery,
but the admin report remains the business source of truth; the control does not
claim that GA4 deduplicates arbitrary non-purchase events across different
devices.

Within one browser profile, GA4 conversion dispatch uses an exclusive Web Lock
keyed by the anonymous event transaction, with a bounded same-origin storage
lease only where Web Locks are unavailable. Consent is rechecked before and
inside the claim, and failed or timed-out delivery stays recoverable after the
short lease without allowing an immediate second-tab duplicate. This is a
same-browser coordination control, not a cross-device delivery guarantee.

`gclid`, `gbraid` and `wbraid` presence can classify a consented first-party visit
as `google / cpc`. Their values are not stored in the Growth tables or admin
report. The browser can validate only the documented bounded URL-safe transport
shape; Google does not expose a client-side authenticity check for an opaque
click ID. It is therefore released only after explicit advertising consent,
never treated as identity evidence and never persisted by the application.
Enhanced Conversions and customer-list audiences are not enabled.

## Landing page strategy

Initial Search campaign review should use existing canonical destinations. The
broad primary ad-group destination is `/file-service`; the audited sitelink set
uses the six destinations below:

- `/services/stage-1` for Stage 1 file-service intent;
- `/services/stage-2` for Stage 2 file-service intent;
- `/services/ecu-file-check` for ECU file-check intent;
- `/ecu-platforms` for supporting ECU platform context;
- `/services/tcu-tuning` for TCU/gearbox file-service intent;
- `/how-it-works` as a supporting trust and workflow destination.

Create separate campaigns by language, country and exact service intent. Start
with exact and phrase match. Review search terms and negative keywords before
expanding match types. Ad language must match the landing page language.

The admin Ads center includes an allowlisted campaign URL builder for all 12
supported website languages. It accepts only a known MG AutoTech destination and
a restricted business-namespace campaign code with bounded two-letter
market/language suffixes, then adds `utm_source=google`, `utm_medium=cpc` and
`utm_campaign`. The attribution parser uses the same validator. It cannot
generate an external redirect or add customer data.
Creative and asset performance is reviewed in Google Ads; the first-party Growth
report deliberately aggregates at campaign level and does not claim to observe an
asset or `utm_content` dimension.

Avoid unsupported turnaround, compatibility, power, legality or guaranteed
result claims. Policy-sensitive service campaigns, including emissions-related
or diagnostic-code services, require separate Google Ads policy and legal review
before activation.

## Admin workflow

Open `/admin/ads-performance` with an account that has `orders.view`.

The center shows:

- GA4, Google Ads tag, conversion-label, pairwise-label and attribution-signing readiness;
- Consent Mode v2 and personalization state;
- observed funnel health, separately from configuration readiness;
- consented visitor, registration, verified request and paying-customer counts;
- paid source and campaign registrations, requests and verified revenue;
- campaign landing-page candidates with an explicit ready-for-manual-review status;
- a language-matched, allowlisted campaign URL builder;
- required account actions and known reporting limitations.

The configuration badge is deliberately labelled **Technical configuration
complete - not launch-ready** when all nine code and environment controls pass.
It never represents campaign approval. A separate read-only launch-gate section
keeps all of the following items at `manual_unverified`:

- owner/legal-approved English privacy information that reflects the current
  VPS, explains Google Analytics/Ads processing, prominently links Google's
  Business Data Responsibility information and records the consent-version
  decision;
- the responsible data protection contact in the exact Google Ads account;
- live Cloudflare/Caddy query-log redaction, retention and access controls;
- owner evidence for turnaround statements or owner-approved neutral wording;
- qualified UK and Irish legal and Google destination-policy clearance for the
  complete crawlable destination, including emissions-related services;
- owner acceptance of possible Google daily-budget overdelivery and the fact
  that a scheduled pause rule is not a real-time hard cap;
- the documented same-origin Google-tag trust decision;
- post-deploy Tag Assistant and network evidence for an authorized test
  conversion receipt; and
- action-time review and authorization of Google Ads assets and live-account
  edits, including asset rights and required AI-origin disclosure.

The panel has no checkbox or persistence path for these decisions. They remain
manual and unverified until evidence is reviewed by the responsible owner,
legal reviewer or external platform, and every campaign remains paused until
the complete release gate passes.

The report uses consented Growth attribution and verified business records.
Apply the additive `20260828000000_growth_attribution_integrity.sql` migration
to isolated staging before the matching application build, verify its RLS,
grants, reminder-preference flow and idempotent attribution receipts there,
then apply the reviewed migration before the Production application release.

## Production verification

1. Create the three Google Ads conversion actions and record their labels.
2. Configure the five public environment variables and a dedicated, non-reused
   server-only attribution HMAC secret for Production; confirm all labels are
   distinct and record the attribution-continuity decision before rotation.
3. Deploy the matching application build.
4. Use a fresh browser profile and test Necessary only, Analytics only and Accept all.
5. In Google Tag Assistant, verify Consent Mode v2 defaults and updates.
6. Land on a tagged public URL, navigate once before accepting analytics, then
   confirm the first-touch campaign and landing page remain the original values.
7. Confirm public page views contain only normalized paths and content groups.
8. Complete one authorized test registration and verify one `sign_up` event.
9. Create one authorized disposable customer test request and verify one `generate_lead` event.
10. Use a Stripe test environment for purchase validation; never create a live charge for smoke testing.
11. Reload each success flow and confirm same-browser receipts suppress an
    immediate repeat. Treat Google Ads transaction IDs as an additional provider
    defense; do not claim client-side exactly-once delivery across devices or a
    timed-out GA4 command.
12. Confirm `/api/admin/ads-performance` returns `401/403` anonymously.
13. Confirm `/admin/ads-performance` contains aggregate rows only and distinguishes
    configured measurement from an observed funnel.

Google Ads conversion diagnostics can take time to update. A delayed Ads UI does
not justify bypassing consent, emitting duplicate events or exposing identifiers.

## Release gate

Campaign activation remains blocked until:

- all nine configuration controls are ready (five public tag/label controls,
  attribution signing, distinct labels, Consent Mode v2 and personalized ads off);
- Tag Assistant confirms consent behavior;
- request and payment are Primary / Every, registration is Secondary / One, and
  the initial Search campaign bids only on Verified request;
- country, language, landing page and ad copy match;
- billing, daily budget and account access are owner-approved;
- policy-sensitive service groups have been reviewed separately.
- the owner has either explicitly accepted the documented same-origin Google
  tag trust boundary or authorized and verified a separate-origin/server-side
  conversion design.

The site can prove that a conversion was queued after a verified business
success. It cannot prove that Google accepted the event. Tag Assistant and the
Google Ads conversion diagnostics are the external source of truth for receipt.
See `docs/google-ads-campaign-launch-plan.md` for the account and campaign setup.
