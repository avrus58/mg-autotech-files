# Growth & Customer Success Center

## Purpose

The admin-only Growth & Customer Success Center connects acquisition, customer activation, requests, successful payments, retention and transactional email reliability without creating a second CRM or exposing customer data publicly.

Admin route: `/admin/growth`

Required staff permission: `orders.view`. Sending a consented reminder additionally requires `orders.manage`.

Individual customer evidence is available through Customer Intelligence 360 at `/admin/growth/customers/[customer-user-id]`. It requires `customers.view` and is documented in `docs/customer-intelligence-360.md`.

## Data boundaries

The center deliberately separates two evidence classes:

1. Search Console and GA4 remain aggregate reporting sources. Search queries are never joined to an individual visitor or customer.
2. First-party attribution exists only after optional analytics consent. It stores a server-HMAC visitor fingerprint, first/last landing path, normalized source and medium, optional campaign labels, referrer hostname, coarse country code and locale.

The attribution store never contains raw IP addresses, the browser visitor UUID, full referrer URLs, query strings, email addresses, customer notes, vehicle details, order contents, filenames, storage paths, payment credentials or firmware data.

## Migration

Additive SQL:

`scripts/add-growth-customer-success-center.sql`

Read-only verification:

`scripts/verify-growth-customer-success-center.sql`

Customer data-quality extension:

- `scripts/add-growth-customer-classification.sql`
- `scripts/verify-growth-customer-classification.sql`
- `scripts/add-growth-customer-classification-bulk-review.sql`
- `scripts/verify-growth-customer-classification-bulk-review.sql`

The migration creates:

- `growth_attribution_sessions`: consented pseudonymous first/last-touch attribution.
- `growth_journey_events`: idempotent account/request/reminder milestones with strict safe metadata.
- `growth_customer_preferences`: customer-controlled unfinished-request reminder preference, default `false`.
- `growth_reminder_actions`: admin action and send outcome audit.

All four tables have RLS enabled. Anonymous access is revoked. Staff reads use `orders.view`; customer access is limited to the customer's own reminder preference; server writes use the service role. The public browser never receives table access or the service-role key.

The classification extension adds two private tables:

- `growth_customer_classifications`: one explicit admin decision per customer account.
- `growth_customer_classification_events`: application-append-only decision history with actor, old/new state, reason and timestamp.

The allowed states are `unreviewed`, `real_customer`, `internal_test` and `staff_operated`. Existing accounts receive no row and remain unreviewed. No email pattern, payment amount, activity, filename, country or account age is used to classify an account. The admin selects only the customer type; the application adds a deterministic audit marker so the database and event history remain complete without requiring typed evidence. `internal_test` and `staff_operated` are excluded from growth metrics and reminder candidates; account access, requests, credits, payments and stored business history remain unchanged.

The customer-type workspace stages selections in the browser and saves them through one bounded batch request. The server validates at most 100 unique customers and the database writes the batch atomically. Every row carries its expected `updated_at` value; if another admin changed any row after the page loaded, the complete batch is rejected instead of overwriting the newer decision. Each changed row creates an audit event linked by a batch ID. Existing rows are not rewritten automatically; selecting a new customer type records the standardized audit marker with the change.

## Funnel definitions

- **Consented visits:** unique pseudonymous first-touch rows created during the selected range.
- **Registrations:** customer profiles created during the selected range.
- **Customers with requests:** distinct customers with a request in the range.
- **First request customers:** customers whose earliest known request falls in the range.
- **Repeat customers:** customers with more than one known request who ordered in the range.
- **Paying customers:** distinct customers with successful payment records in the range.
- **Revenue per customer:** net ledger revenue after recorded refunds divided by distinct paying customers, calculated separately for every currency. Gross purchases, refunds and net revenue remain visible separately.
- **Reminder follow-through:** a request submitted within seven days after a recorded reminder. This is correlation, not proof of causation.
- **Locale funnel:** consented attribution rows grouped by the normalized existing locale field, with unique visits, linked registrations, request customers and successful paying customers. Unknown or missing locale remains explicit and is never guessed from country.

## Reminder workflow

There is no automatic reminder cron job.

A reminder candidate is visible only when all conditions hold:

- the customer explicitly enabled the optional reminder;
- a request-start event is between 24 hours and 14 days old;
- no later order exists;
- no reminder action exists for that start event;
- a valid customer email exists;
- the account is active and is not an admin/staff account.
- no reminder action exists for the customer inside the 30-day customer cooldown.

Only the newest eligible unfinished attempt per customer is shown. The admin confirms the action in `/admin/growth`. An advisory-lock database reservation, a 30-day customer cooldown and the transactional-email idempotency key prevent duplicate or concurrent sends. Suppression and provider safeguards from the existing email system still apply. The email contains only customer ID, a non-submitted status and a secure `/new-request` link. It never includes draft notes, file information, vehicle data or private metadata.

## Admin report

The center includes:

- acquisition-to-request funnel;
- repeat-order and inactivity indicators;
- successful revenue and revenue per paying customer by currency;
- source, country and landing-page performance for consented attribution;
- locale-level consented visits, registrations, request customers and paying customers;
- service and vehicle-brand demand from real requests;
- sent/delivered/delayed/bounced/complained/failed email outcomes;
- aggregate Search Console query visibility;
- a prioritized daily action list for eligible reminders, payment review, delivery issues, onboarding friction, SEO opportunities and aggregate retention risk.
- an audited real-customer classification workspace available only to staff with `customers.manage`;
- a strict Real Growth Snapshot containing explicitly verified real customers only;
- the first verified revenue journey from registration to request to payment, with acquisition source only when a consented first-touch record exists.
- a Customer Intelligence 360 link for each reviewed customer, joining existing profile, request, ledger, payment-state, communication, email and consented attribution evidence without adding another customer database.

Customer references may appear only inside the protected admin report. Public/customer APIs do not expose attribution, event IDs, reminder audits, revenue analysis, search queries or internal action metadata.

The standard report removes accounts explicitly marked `internal_test` or `staff_operated` from linked profile, request, payment, customer-email, attribution and journey-event calculations. Unreviewed accounts are not silently treated as test accounts. The Real Growth Snapshot is stricter: only `real_customer` accounts appear. If the first paying real customer has no consented attribution row, the source is shown as not captured and is never reconstructed from other data.

The 30-day report uses Search Console's 28-day window. Longer report ranges use the available 90-day Search Console window and label that window explicitly; query rows are never presented as individual-customer attribution.

## Graceful rollout

The application remains operational before the migration is applied:

- public attribution capture returns an accepted response without interrupting the page;
- account and request workflows never depend on growth-event success;
- the admin report continues showing core order, payment, retention, SEO and email metrics;
- attribution and reminder areas clearly show that the migration is required;
- no metric is fabricated to fill a missing source.

## Production smoke checklist

1. Apply the additive migration and run the SELECT-only verification script.
2. Open `/admin/growth` as owner/admin and verify each source status.
3. Confirm anonymous and normal customer requests to `/api/admin/growth` are denied.
4. Grant optional analytics on a public page and confirm the website remains usable if capture is blocked.
5. Register a controlled staging customer and confirm one idempotent `account_created` event.
6. Start, abandon and later submit a staging request; confirm start/create events use the same attempt ID.
7. Confirm reminder preference defaults off.
8. Enable the preference for a staging customer, age the synthetic start event in staging, and confirm it appears once in the action list.
9. In email dry-run mode, send the reminder and confirm one action/audit event and no real message.
10. Confirm Search Console query rows contain only aggregate values.
11. Inspect public and customer APIs for absence of attribution, visitor hashes, source metadata and reminder audit fields.
12. Check 390x844, 768x1024, 1366x768 and 1920x1080 layouts for horizontal overflow and console errors.
13. Apply the classification extension and then the bulk-review extension after the base Growth migration. Run both SELECT-only verification scripts.
14. In `/admin/growth`, select customer types for two synthetic accounts and save them with **Save changes**. Confirm no note is requested, one batch ID is used and one audit event exists per changed customer.
15. Mark one staging customer `real_customer` and confirm Real Growth Snapshot updates; confirm first revenue attribution says not captured when no consented source exists.
16. Confirm each completed review receives the standardized application audit marker without requiring the admin to type a note.
17. Load the same row in two admin sessions, save from one and confirm the second receives a stale-review response without partially writing its batch.
18. Confirm anonymous and normal customer requests to `/api/admin/growth/customers` and its PATCH routes are denied.
19. Open the Language tab and confirm totals reconcile with the consented attribution summary without exposing customer identifiers.
