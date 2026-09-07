# Customer activation integration

Scope: integrate the already implemented customer guide onto verified live
source `65a53b606b5fd64f84ebff15725a92f619c26024`, preserving the current HTML
language and service-report features. Original guide source was `8a44b05`;
the earlier feature had not been released. This document is a local validation
receipt, not a deployment or customer-conversion claim.

Validated application candidate: `fff11e4e613d3ee9eb171396d3bcf9e2249b4b32`.
The final packet also includes the separately observed
[Google Ads follow-up](reports/2026-09-07-google-ads-customer-followup.md).
Independent immutable review of this exact candidate found no actionable
P0-P2 issue; the reviewer independently passed 35 focused tests on the same source.

## Customer behavior

- A new customer can follow an optional introduction to preparing an original
  file, choosing credits, making a request and finding order messages/delivery.
- An existing customer is not silently enrolled. Completing or skipping the
  guide saves only that authenticated account's terminal guide preference.
- A loaded customer with no order history and exactly zero credits sees the
  existing credit guidance before optional profile completion. Urgent replies
  remain higher priority; the actual payment/request rules are unchanged.
- When a customer already has `/new-request` open, guide links to Buy Credits
  or My Orders open a separate tab. The original request keeps its selected
  file and typed details. Other guide navigation keeps its previous behavior.
- The new-tab icon has a screen-reader description in all 12 supported
  languages. The guide remains optional, non-modal and dismissible; save errors
  retain retry and session-only dismissal options.

## Safety and integration boundaries

No new dependency, schema/migration, price, payment setting, consent,
advertising conversion event, firmware behavior or customer record change.
No production connection, push or deployment was performed for this package.
The existing exact-user/device-assurance guard protects the preference API.
The server writes only `customer_guide_v1` in app metadata; the enrollment flag
is never used as an authorization claim.

The integration conflict was only the start of `.autopilot/STATUS.md`; current
history was retained. Typed i18n additions merged with the existing report
catalog/inventory. No legacy translation exemption or fingerprint was changed.

## Verification

Fresh source checks all passed: full tests 1627/1627 (zero failures/skips),
87 targeted tests and two actual-component navigation tests, full lint and
web/uploader typecheck, 12-locale i18n with 37 client-bundle tests, and a
282-page Production webpack build. Performance passed with 15.7 KiB initial
homepage gzip against the 80 KiB budget and all 48 required public routes and
document languages present. The strict standalone postbuild verified 43 assets,
Sharp PNG/PDF generation and anonymous protected-route rejection without external
fetches. The new compiled guide endpoint also returned private/no-store 401.

The first local artifact failed its strict dependency-containment guard because
Next copied the shared node_modules junction into standalone output. Replacing
only local junctions with a physical copy of identical installed dependencies
resolved that environment issue; the complete mandatory pipeline was rerun and
passed. No source configuration, lockfile or guard was weakened. No package was
installed. The unsuccessful log remains diagnostic history, not passing evidence.

The browser fixture uses the real guide, hook, controller and translations,
synthetic authentication/persistence adapters and a deliberately synthetic
underlying request form. Native browser popup navigation is exercised. It is
not an authenticated production or full request-upload E2E transaction.

The matrix covers all 12 guide languages at 1366x768, 390x844, 320x568 and
844x390, plus persistence/error/retry/remount behavior. Eight additional cases
cover EN/DE/TR/ZH at mobile and laptop sizes and verify that both auxiliary
links preserve the original form's controlled text and selected File object.
All 64 cases passed. No form unmount, horizontal overflow or browser console
exception occurred. EN laptop and DE mobile screenshots were visually reviewed.

Synthetic QA scripts, screenshots and logs remain under the ignored
`.autopilot/runtime/` directory of this worktree. Their local server listens
only on `127.0.0.1:3217`; no third-party resources or customer credentials are
used. Historical aggregate acquisition evidence is separately recorded in
`.autopilot/reports/2026-09-07-customer-activation.md` with its own observation
time and uncertainty. It is not a new observation from this integration.

Supabase's changelog and current
[server-side updateUserById reference](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
were checked while integrating the existing preference writer. No applicable
breaking change was identified; no SDK change was made.

## Release boundary

After explicit scoped publication, verify the deployed source and anonymous
access rejection before any authenticated customer-flow claims. Do not replay
the historical payment or synthesize advertising conversions to test this UI.
This package helps customers find their next step; it does not promise sales.
