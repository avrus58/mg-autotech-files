# Panel follow-up review — 2026-09-05

Owner request: inspect the local preview for remaining gaps. Read-only product
review at `71ade32`; no application changes, release or live-service calls.

## Confirmed findings

1. **P2 — Admin laptop navigation and order status readability.** At 1366 × 768,
   navigation labels split inside words (`Conversion`, `Readiness`) because the
   fixed badges leave little label space and `overflow-wrap: anywhere` permits
   arbitrary breaks. The latest-order desk also truncates `Completed` / `In
   Progress` to short fragments. Relevant sources: `src/app/globals.css:53`,
   `src/app/admin/page.tsx:1869`, `:1881`, `:3515`. Keep destinations and status
   semantics, but allocate space without splitting ordinary words or hiding
   the status. Tooltips alone do not solve touch readability.

2. **P2 — Mobile balance splits individual digits.** At 390 × 844, a synthetic
   balance of 12345 in German renders `12.34` and `5` on separate lines; the
   unit is also split. Source: `src/components/dashboard/DashboardClient.tsx:915`.
   The icon, padding and two-column grid leave too little room for the large
   breakable value. Keep the number intact; place the unit separately or adapt
   the card layout. This is an edge-case layout reproduction, not customer data.

3. **P2 — Unavailable pricing can look like a zero price.** Opening the synthetic
   admin customer dialog produces the intended pricing-load error and disables
   editing, but package rows still show `Global EUR 0.00` / `Inherits EUR 0.00`.
   `Number("")` turns the uninitialized global price into zero. Sources:
   `src/app/admin/page.tsx:517`, `:3006`, `:3023`. The footer also claims no
   customer-specific row exists when it has not loaded (`:3097`). Display
   unavailable/unknown instead until the pricing request succeeds. This does
   **not** demonstrate a free checkout or a real production pricing outage.

4. **P2 — Notification live indicator is unconditional.**
   `src/app/dashboard/notifications/page.tsx:156` always renders `On`; the
   subscription at `:117` does not connect subscription status to that label.
   A failed channel could therefore still look connected. Source-confirmed
   indicator issue; no actual service outage was simulated or observed. Derive
   the indicator from real connection state, or avoid making a live-state claim.

5. **P3 — Overview category links do not select their category.** Pending and
   In Progress both open the same active-order view
   (`src/components/dashboard/DashboardClient.tsx:862`, `:877`). That view includes
   several statuses (`src/app/dashboard/orders/page.tsx:112`). A zero pending
   count can thus lead to a non-empty list of in-progress requests. Provide exact
   category deep links or make the shared destination explicit.

6. **P3 — Incomplete profile descriptions sound complete.** The readiness
   helper uses positive descriptions such as contact details being ready even
   when its `complete` flag is false. The UI changes the icon/color but not the
   description (`src/app/dashboard/settings/page.tsx:93`, `:103`, `:110`, `:433`).
   Show what is missing and the next step instead. Notification copy such as
   `Customer-owned realtime channel` is also unnecessarily technical for a
   customer. Any copy correction must preserve all supported locales.

## Verification in this review

- Local synthetic preview only, `127.0.0.1:3198`; real React components with
  fixture adapters, not a fully authenticated Next.js integration environment.
- Browser inspection: dashboard, loaded active orders, credits, settings,
  notifications, admin orders/customers/customer dialog, vehicle editor.
- Laptop 1366 × 768 and mobile 390 × 844. EN/DE/TR/ZH dashboard checks, actual
  DE → TR selector interaction, German mobile credits, empty/error dashboard
  states. No document-width overflow in measured screens; this does not rule
  out internal truncation, which findings 1 and 2 demonstrate.
- The latest browser warning/error log query returned no entries. Expected
  synthetic pricing failure is an application error state, not a proven backend
  failure.
- `tsx --test tests/panel-readability.test.ts tests/ui-ux-safety.test.ts`:
  **76 passed, 0 failed**. These source/regression checks do not catch every
  visual issue. The full build and 1493-test receipts are from the earlier
  unchanged implementation; not rerun or represented as new results here.

## Boundaries and next step

Unsupported preview routes can fall back to the dashboard. Request creation,
order detail, real payments, email delivery, authentication and reconnect
behavior were not validated end to end. Fixture customer reference `QA-10001`
is rejected by the production reference formatter, explaining the preview's
`Not available`; it is not evidence that real customer IDs are broken.

At the end of the read-only review, these six findings remained open. The owner
subsequently approved their implementation. The follow-up below is separate
from the original review evidence.

## Owner-approved implementation follow-up

Code candidate: `ea449c6e6062e5500f6af012c5ee069db1d70a5d`, based on `71ade32`.

- Admin navigation badges use a separate grid row, leaving normal word wrapping
  for labels. Latest-order statuses get more space and may wrap without truncation.
- Mobile balance values occupy the card width; digits stay together and the
  localized unit can wrap separately.
- Unknown/unconfirmed pricing displays dashes and an unavailable message, not
  a fabricated zero price or an unverified assertion that no policy exists.
  Existing disabled-write guards and actual pricing rules are unchanged.
- Notifications derive connection labels from subscription callbacks and browser
  connectivity. Reconnection refreshes missed notifications. A short offline /
  online interval preserves the last subscription outcome without assuming that
  a new subscription callback must arrive.
- Pending and In Progress overview links select their exact status sets. URL
  changes update the selected view. Stale responses cannot replace a newer view,
  and a failed first load for a new view provides a retry even if an earlier view
  had loaded. Existing categories, ownership filters and pagination remain.
- Profile readiness shows neutral field descriptions and explicit Complete /
  Missing information labels. Technical customer copy was simplified across all
  12 supported locales. Actual browser-catalog tests cover the new translations.
- Removed obsolete DOM translation rows through the existing shrink-only
  tombstones. No source ceiling, fingerprint or performance budget was relaxed.
  The order-detail timeline also consumes the existing typed In Progress label.

Independent read-only source review: GO for the code candidate. It first found
two race/connection issues; the corrected callback was then executed against
synthetic deferred responses. Verified: superseded foreground plus failed silent
request shows retry; retry clears the error; same-view silent failure retains
good data; short offline/online restores a joined channel; failed channel remains
disconnected until a real successful callback. These are local state-machine
checks, not live Supabase integration claims.
The source-extracted timeline passed another 72 cases (four locales, nine
statuses, both delivery-readiness states) with unchanged keys, sequence,
descriptions and active index, and the correct localized progress label.

Browser checks use only the existing synthetic preview. The final four-locale /
two-viewport matrix passed 32/32 checks, with an additional 8/8 order-view checks
after translation deduplication. The checked new copy had no non-English fallback
and measured screens had no document-width overflow or unexpected alerts.
Admin pricing failure displays unavailable values with writes disabled; category
navigation showed 1 in-progress, 0 pending and 4 completed fixture rows.
Subscription callback disconnect/reconnect controls changed the displayed state.
The last console warning/error query was empty. The temporary test tab was closed,
viewport override reset and the owner's local preview refreshed.

Final full suite: **1499 passed, 0 failed, 0 skipped**. Passed on frozen application source:
lint; web/desktop typecheck; targeted tests (87/87); generated-catalog freshness;
the 2448-source / 11 non-English locale audit; all 36 prebuild client-catalog
tests; Production Webpack build (280/280 pages); performance and all emitted
locale bundle budgets (1/1 post-build test). Homepage initial gzip is 15.5 KB
against 80 KB; all 48 required public routes are present. Earlier failed and
mixed-snapshot runs are not final passing receipts.

No push, Preview or Production deployment. No dependency, database schema,
authentication policy, customer data, real payment or e-mail changes. Real
authenticated backend, checkout and delivery E2E remain outside this local
synthetic preview's coverage.

Local ignored logs: `.autopilot/runtime/panel-follow-up-{build,performance,
emitted,lint,typecheck,test}-frozen.log`; targeted receipt is
`panel-follow-up-targeted-frozen.log`. No live credentials are included.
