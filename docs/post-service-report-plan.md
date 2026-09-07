# Post-service customer PDF report

Status: **In Progress** — owner explicitly approved the required PDF/image/font dependencies;
implementation and local validation are under way. Not released.
Discovery date: 2026-09-07. Clean live-derived baseline: `454ddac`.
Fingerprint: `orders|completed-service-report|missing-shareable-pdf-and-optional-branding|localized-owner-authorized-download`.

## Owner scope

- A detailed PDF report a workshop can keep or hand to its own customer.
- Optional profile photo/company logo from customer settings, included when supplied.
- Vehicle, ECU, order reference, services and before/after power/torque where supported.
- Visible but disabled download control before completion; enabled after completion.
- Existing compact red/black UI and all 12 supported locales preserved.
- No current authorization to deploy this new feature to Production.

## Verified code findings

- `src/lib/customerOrderDelivery.ts` contains customer-safe order and delivery
  projections plus ownership/staff permission helpers. It has no order-specific
  measured before/after values or independently confirmed completed-services list.
- `src/app/api/requests/[id]/route.ts` and `deliveries/route.ts` demonstrate current
  fresh-user/device authorization, protected order loading and private responses.
- Completion has multiple entry points. A report endpoint must check the current
  authoritative order status, not rely solely on a completion event or disabled UI.
- `src/app/dashboard/settings/page.tsx` persists existing profile fields, but no
  implemented profile-image upload was found. OAuth avatar metadata is not a
  trusted report-image source.
- `src/lib/vehicleControl/types.ts` has catalogue stage profiles. These are not
  evidence of measured results for an individual completed order.
- Root and desktop lockfiles and analyzer requirements contain no PDF renderer.
  Historical commit `003bf78` downloaded an SVG dyno report, not a PDF. A local QA
  browser/runtime dependency is not a shipped Production renderer.

## Implementation contract

1. Explicit report data records completed services and optional before/after
   metrics, with provenance and units. Staff entries confirm optional report content;
   requested services alone must not become unsupported measured-work claims.
   Missing values remain missing. Catalogue estimates are identified as estimates,
   never displayed as dyno measurements or invented gains. Any order with current
   `orders.status = completed` can obtain a report without a separate publish
   gate or admin data entry. Unconfirmed performed services remain empty.
2. A versioned report snapshot prevents later profile/logo/detail edits from
   silently rewriting historical issued reports. Changed canonical input creates
   a new revision on the next download; unchanged downloads reuse the same
   report ID, revision and issue timestamp. The issue date is not presented as
   an independently known completion date.
3. Add optional image upload with bounded bytes/pixels, JPEG/PNG decoding,
   re-encoding and metadata stripping, private owner-scoped storage and removal.
   Do not fetch arbitrary URLs, reuse firmware upload paths, or put image bytes
   into auth metadata/JWTs. Review additive schema/storage requirements first.
4. Generate the PDF through a protected server route. Recheck account access,
   order ownership and completed status for every generation/download. Incomplete,
   reopened, cancelled and other-customer orders cannot obtain a new report.
   Apply bounded generation, rate limits and private/no-store responses.
5. Default shareable content excludes wholesale credits/prices, internal notes,
   staff-only analysis, raw storage URLs and technical file fingerprints. Include
   workshop identity, optional logo, vehicle/ECU context, confirmed service scope,
   report reference/revision/date and clearly sourced performance data.
6. Add a compact download control and localized pending/loading/retry states in
   customer order details. Translate report labels and all new UI across all
   supported locales, including Unicode font embedding and locale-aware numbers.

## Approved dependency decision

The owner explicitly approved the necessary dependencies after the initial
blocked discovery. The application now pins `@react-pdf/renderer` **4.9.0** and
`sharp` **0.35.0**. Licensed Unicode fonts are bundled locally, with sources,
SHA-256 hashes and static CJK generation documented in
`assets/report-fonts/README.md`. The renderer supports real server-generated PDFs:

- https://react-pdf.org/docs/v4/node
- https://react-pdf.org/docs/v4/fonts
- https://github.com/diegomura/react-pdf/blob/master/LICENSE

This is the specific owner-authorized exception, not a general permission to add
unrelated packages. No external PDF service is used. Next standalone font/runtime
bundling, the final dependency audit and rendered output remain release checks.

## Implemented persistence and authorization

- Migration `supabase/migrations/20260907111225_service_report_snapshots.sql` adds
  only `service_report_details`, `service_report_snapshots` and
  `customer_report_branding`, plus narrowly granted helper/RPC functions.
- All three tables have RLS enabled and no anonymous/authenticated direct grants.
  Server-role report details and snapshots are append-only. Branding updates
  change the current pointer; old normalized image objects remain available to
  issued snapshots. Existing table grants and business rules are unchanged.
- Admin optional details use `/api/admin/requests/[id]/service-report`, existing
  `orders.view`/`orders.manage` permissions, bounded input and expected-revision
  compare-and-swap. Saving details does not alter the order's completion status.
- Issuance locks the order row, checks fresh ownership and completed status, and
  serializes against detail saves. Customer downloads are owner-only; delegated
  staff require `files.download`. Access is rechecked after PDF rendering.
- Performance numbers are optional. Any recorded value, including zero, requires
  its source and an explanation. Source/customer notes are limited to 2000
  characters and 30 logical lines. Oversized legacy requested scopes are rejected
  before a snapshot is created, not silently truncated.
- Frozen report fields exclude credits/prices, internal notes, customer email,
  file paths, HW/SW strings and training/analysis metadata. The internal customer
  ID is used for safe logo loading, not printed as report content.

## Reproducible disposable SQL verification

The tracked runner is `scripts/check-service-report-database.mjs`; its synthetic
bootstrap is `tests/fixtures/service-reports/database.sql`. It accepts **no target
URL or credential**, imports the pinned QA-only PGlite installation, and always
creates a new in-memory database. Never run the fixture SQL against an existing,
linked, staging or Production database.

```powershell
# QA-only prerequisite in an ignored directory, not in the app dependencies.
npm install --prefix .autopilot/runtime/service-reports/sql-tools --no-save --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8
node scripts/check-service-report-database.mjs
```

The runner writes only its result receipt to
`.autopilot/runtime/service-reports/sql-rehearsal.json`. The current run passed
**22/22** scenarios on PGlite 0.5.8 / PostgreSQL 18.3 WASM: actual migration
execution, table/RPC grants, forged staff flag denial, old completed orders,
ownership/status rejection, provenance, CAS, append-only history, late branding,
profile revisions, reopening, reassignment and input bounds. Docker's Linux
engine was unavailable; this single-connection test does **not** prove real
multi-session lock contention or validate the live schema.

Focused model/server/SQL-contract tests passed **13/13**; scoped lint passed.
These receipts are partial validation, not full-release completion.

## Migration and recovery boundary

No staging or Production migration has been applied. Before an authorized release,
verify the real prerequisite order/profile columns and canonical storage
immutability controls, review the additive migration, and apply only the approved
scope. This is not an authorization to run the disposable bootstrap there.
Code rollback uses the previous application version while retaining additive
tables and immutable report history; rollback must not delete issued reports or
their logo objects.

## Remaining verification before completion/release

- Cross-account, unauthenticated, incomplete/reopened/cancelled status denial.
- Every existing completion path and repeated downloads/revisions.
- Missing metrics, estimated versus measured values, and no internal-data leakage.
- Invalid/oversized/malicious images, remove/replace and account switching.
- All-locale PDF extraction and rendered-page checks, especially TR/RU/ZH;
  long vehicle names, page breaks and readable printable output.
- EN/DE/TR/ZH mobile and compact-laptop UI states and accessibility.
- Targeted tests, i18n gate, lint, typecheck, full suite, Production build,
  independent review and disposable database verification if migrations are added.

Implementation and synthetic local PDF/SQL work have now run; the initial
discovery-only receipt is historical. Final UI/PDF edge-case review, the full
quality suite/build, standalone artifact checks and independent review are still
pending at this checkpoint. No push, deployment, live database/customer mutation
or real authenticated business transaction is claimed. Production requires a new
explicit owner release instruction and its scoped verification.
