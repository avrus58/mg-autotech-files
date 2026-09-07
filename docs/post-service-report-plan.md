# Post-service customer PDF report

Status: implementation blocked pending explicit approval for a PDF runtime dependency.
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

## Proposed implementation contract (not implemented)

1. Add explicit report data for completed services and optional before/after
   metrics, with provenance and units. Staff review confirms the report content;
   requested services alone must not become unsupported measured-work claims.
   Missing values remain missing. Catalogue estimates are identified as estimates,
   never displayed as dyno measurements or invented gains.
2. Use a versioned report snapshot so later catalogue/profile edits do not silently
   rewrite historical issued reports. Corrections create a new report revision.
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

## Dependency decision

Recommend evaluating `@react-pdf/renderer` with locally bundled licensed Unicode
fonts, and explicitly declaring the already Next-transitive `sharp` image decoder
as an application dependency rather than relying on accidental hoisting. The PDF
renderer supports real server-generated PDFs and uses the MIT license:

- https://react-pdf.org/docs/v4/node
- https://react-pdf.org/docs/v4/fonts
- https://github.com/diegomura/react-pdf/blob/master/LICENSE

No library, font, package or external service has been installed or configured.
The repository and MG AutoTech engineering skill prohibit adding a new dependency
without an exception. Ask the owner to approve this specific free PDF library
and image-processing dependency before installation; assess pinned versions, transitive dependencies, font license,
all-locale output and Next standalone bundling after approval.

## Required verification after implementation

- Cross-account, unauthenticated, incomplete/reopened/cancelled status denial.
- Every existing completion path and repeated downloads/revisions.
- Missing metrics, estimated versus measured values, and no internal-data leakage.
- Invalid/oversized/malicious images, remove/replace and account switching.
- All-locale PDF extraction and rendered-page checks, especially TR/RU/ZH;
  long vehicle names, page breaks and readable printable output.
- EN/DE/TR/ZH mobile and compact-laptop UI states and accessibility.
- Targeted tests, i18n gate, lint, typecheck, full suite, Production build,
  independent review and disposable database verification if migrations are added.

Only source/documentation discovery has run. No feature, PDF preview, deployment,
live database operation or authenticated business-transaction test is claimed.
