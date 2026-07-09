# Admin Work Order Control Center

MG AutoTech Admin Work Order Control Center is an internal operations layer for file-service requests. It does not replace the existing customer request flow. It adds admin-only work-order state, notes, events and decision support around existing `orders`.

## Pages

- `/admin/requests` lists recent requests with work-order status, priority, file state, credits, customer and AI indicators.
- `/admin/requests/[id]` shows the full internal workbench for one request.
- Existing `/admin` remains available and links to the new control center.

## Data Model

The migration is additive:

- `request_work_orders`: admin status, priority, tuner/payment/delivery/quality state, assignment and admin-only work-order fields.
- `request_work_order_events`: audit/timeline entries for admin mutations.
- `request_internal_notes`: internal, tuner, pinned and customer-visible notes.

The existing `orders`, file upload, customer dashboard, delivery, credits and payment flows remain unchanged.

## Status Model

Admin work-order statuses:

- `new`
- `waiting_for_payment`
- `payment_review`
- `waiting_for_file`
- `file_received`
- `in_analysis`
- `waiting_for_customer`
- `in_progress`
- `quality_check`
- `ready_for_delivery`
- `delivered`
- `completed`
- `cancelled`
- `needs_review`

Legacy order statuses are mapped for display. The migration does not destructively rewrite existing `orders.status` values.

## Permissions

Admin APIs use the existing bearer-token staff guard:

- `orders.view`: list/detail read access.
- `orders.manage`: work-order updates and note creation.

Anonymous users receive `401`. Normal customers receive `403`.

## Customer Visibility

Customers must never receive:

- internal notes
- tuner notes
- admin risk flags
- work-order audit log
- private storage paths
- File Expert private metadata
- AI provider/source/sample IDs
- raw binary, raw hex or private offsets

Customer-visible notes are copied into the existing `request_messages` channel as admin messages. Internal notes remain in `request_internal_notes` only.

## AI Evidence Rules

The admin detail page shows AI evidence as read-only operational context:

- linked training samples for this request
- similarity run counts and best score
- cluster membership count
- warnings when samples are not approved/confirmed/quality gated

It does not generate MOD files, suggest write-ready byte changes or expose raw binary data.

## Payment Display

Payment and credit information is read-only:

- credits required
- customer balance
- latest credit ledger rows count
- latest payment records count
- payment status summary

The Work Order Control Center does not mutate payments, credits, Stripe, bank transfer or refunds.

## Vehicle DB Integration

The admin detail page tries to match the request against Vehicle Database Control Center records by vehicle data. If the Vehicle DB migration is absent or empty, the request detail still works and shows a warning.

Customer-facing pages only continue to use customer-safe vehicle fields.

## Smoke Test Checklist

1. Run `scripts/add-admin-work-order-control-center.sql` in Supabase.
2. Deploy the app.
3. Open `/admin/requests` as owner/admin.
4. Open one request detail at `/admin/requests/[id]`.
5. Change priority and confirm an event appears.
6. Add an internal note and confirm it does not appear in the customer dashboard.
7. Add a customer-visible note and confirm it appears in request messages.
8. Open `/api/admin/requests` in incognito and confirm `401` or `403`.
9. Use a normal customer session against `/api/admin/requests` and confirm `403`.
10. Confirm `/dashboard/orders/[id]` still shows only customer-safe request data.
11. Confirm no browser console errors.

## Known Limitations

- File Expert jobs are matched by customer and vehicle context because existing jobs do not have a hard `request_id` relation.
- Payment summary is customer-level read-only context unless future records include a direct request reference.
- Vehicle DB matching is best-effort when old requests do not store `vehicle_key`.
