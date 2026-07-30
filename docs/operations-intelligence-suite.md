# Operations Intelligence Suite

## Purpose

The Operations Intelligence Suite is an additive admin workspace at
`/admin/operations`. It brings existing operational signals into one place
without replacing the order desk, work-order detail, customer management,
payments, vehicle controls, email controls, or desktop release flows.

The workspace is read-only. It does not create orders, change statuses, alter
credits, publish vehicles, send email, or release desktop installers.

## Capabilities

### Production Health Center

The Health view reports the availability of existing order, customer,
notification, vehicle catalog, email, security, and desktop release signals.
It distinguishes unavailable optional data from an empty business queue.

### Queue And SLA

The Queue & SLA view summarizes:

- active, completed, and cancelled requests
- work that needs attention or customer input
- urgent/high-priority and unassigned work
- requests without an internal delivery estimate
- explicitly configured estimates that have elapsed
- status distribution

No delivery promise is generated. ETA metrics use only existing work-order
fields and are internal planning signals.

### Global Search

The search endpoint resolves orders and customers through an explicit result
allowlist. Searches are normalized, control characters are removed, and query
length is limited. Results never contain notes, payment data, storage paths,
signed URLs, AI evidence, hashes, or other private internals.

### Customer Profile Readiness

Profile readiness reuses the existing profile and `MGA-*` customer reference
fields. It highlights missing contact, invoice, address, account type, and
company fields. It does not invent or backfill customer data.

### Communications

The Communications view shows operational state from the existing
transactional email and notification systems:

- provider configured or unavailable
- dry-run or live mode
- recent email event counts and failures
- unread customer-safe notification count

It does not send email or expose message bodies.

### Security And Audit

Security presents an allowlisted recent staff audit summary to authorized
staff. It never returns secrets, credentials, request bodies, customer notes,
or storage references. Staff without the required permission receive only the
access summary they are allowed to see.

### Desktop Beta Release

Desktop release readiness is fail-closed. A public download is not available
unless all of these are explicitly true:

- public release flag enabled
- signed release status confirmed
- clean Windows test confirmed
- Defender/SmartScreen test confirmed
- HTTPS update URL configured
- HTTPS release notes URL configured

The Operations page links to `/admin/desktop-app` for the complete read-only
release checklist.

## Permissions

- `/admin/operations` is protected by the existing admin layout.
- `GET /api/admin/operations` requires `orders.view`.
- `GET /api/admin/operations/search` requires `orders.view`.
- Customer profile search requires `customers.view`.
- Sensitive staff audit visibility requires the existing staff-management
  permission boundary.
- Anonymous and normal customer sessions cannot use these endpoints.

## Data And Privacy

The suite reuses existing records and does not require a migration. API
responses are private and `no-store`. Customer-facing pages never receive:

- internal or admin notes
- audit metadata
- private storage paths or signed URLs
- payment-provider internals
- source references or confidence scores
- AI sample, cluster, or evidence internals
- installer storage locations

## Operational Smoke Checklist

1. Open `/admin/operations` as an authorized owner/admin.
2. Confirm Health shows current subsystem availability.
3. Confirm latest orders and Queue & SLA counts match the order desk.
4. Search by an order reference and a customer reference.
5. Confirm customer readiness reports missing fields without changing them.
6. Confirm Communications reports dry-run/provider state without sending mail.
7. Confirm Security shows only allowlisted audit summaries.
8. Confirm Desktop Beta remains blocked unless every release gate is met.
9. Open the page at phone, tablet, laptop, and desktop widths.
10. Confirm an anonymous request to the two admin APIs returns `401` or `403`.

