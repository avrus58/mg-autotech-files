# MG AutoTech Transactional Email System

## Purpose

The transactional email system sends premium, customer-safe notifications for important MG AutoTech platform events. It is German-first, server-side only, and designed to avoid public relay abuse.

The system never sends raw ECU/TCU files, binary previews, hex data, private storage paths, provider/private sample metadata, internal notes, risk flags, audit logs, private offsets, or hidden customer messages.

## Provider And Dry-Run

Provider abstraction: `sendTransactionalEmail()`

Current provider: Resend

Environment:

- `RESEND_API_KEY`: enables real sending.
- `EMAIL_FROM`: optional sender, default `MG AutoTech <noreply@file.mgautotech.de>`.
- `ADMIN_NOTIFICATION_EMAIL` or `EMAIL_TO`: admin notification target.
- `SUPPORT_EMAIL`: footer contact email.
- `EMAIL_DRY_RUN=true`: logs/skips without sending real emails.

If `RESEND_API_KEY` is missing, emails are skipped safely and the request/payment/work-order flow continues.

## Email Event Log

Migration: `scripts/add-transactional-email-system.sql`

Table: `email_events`

Stores:

- event type
- recipient email
- recipient user
- related order/request
- idempotency key
- status: `pending`, `sent`, `failed`, `skipped`
- provider message id
- failure reason
- safe metadata only

The table has RLS enabled. Staff with `orders.view` can read logs; staff with `orders.manage` can manage logs. Customer/public direct access is not intended.

## Implemented Templates

Customer/request:

- `request_created`
- `request_received`
- `file_uploaded`
- `additional_file_requested`
- `request_in_review`
- `request_in_progress`
- `request_waiting_for_customer`
- `request_completed`
- `request_delivered`
- `request_cancelled`
- `request_rejected_or_not_possible`
- `customer_visible_message_added`
- `upload_permission_enabled`
- `upload_permission_disabled`
- `delivery_completed`

Payment/credits:

- `bank_transfer_instructions`
- `payment_received`
- `credits_added`
- `payment_failed`
- `payment_pending_review`
- `credit_purchase_started`

Admin:

- `customer_registered`
- `new_request_admin_notification`
- `payment_needs_review_admin_notification`
- `customer_replied_admin_notification`
- `file_uploaded_admin_notification`
- `failed_email_admin_alert`
- `admin_email_test`

## Integrated Triggers

- New request:
  - customer confirmation
  - admin notification

- Bank transfer selected:
  - authenticated customer-only bank transfer instruction email

- Stripe or bank credits added:
  - customer credits-added email

- Work-order meaningful status transitions:
  - file received
  - in review
  - in progress
  - waiting for customer
  - delivered/completed/cancelled

- Customer-visible note added:
  - customer gets an email only if the message is visible

- Internal note added:
  - no customer email

- Additional upload permission enabled:
  - customer upload instruction email

- Customer additional file uploaded:
  - admin notification

- Delivery completed:
  - customer delivery/completed email

## Security Rules

Customer emails may contain:

- request reference
- customer ID
- safe vehicle summary
- selected services
- payment reference
- bank details already configured for public/customer display
- dashboard link
- support contact

Customer emails must never contain:

- internal notes
- tuner notes
- admin risk flags
- audit logs
- raw binary
- hex preview
- private storage paths
- provider/source private names
- private AI sample IDs
- confidence internals
- private map offsets
- external source metadata
- hidden/archived customer messages

## Admin Email Page

Route: `/admin/email`

API: `/api/admin/email`

Shows:

- provider status
- dry-run status
- template list
- recent email event logs

Admin test email:

- requires `orders.manage`
- sends only to the authenticated admin's own email
- respects `EMAIL_DRY_RUN`

## Smoke Test Checklist

1. Apply `scripts/add-transactional-email-system.sql` in Supabase.
2. Set `EMAIL_DRY_RUN=true` in staging/local.
3. Open `/admin/email` as owner/admin.
4. Confirm provider status and template list load.
5. Send admin test email in dry-run.
6. Create a test request and confirm:
   - customer request email event is logged
   - admin new-request email event is logged
7. Add an internal note:
   - no customer email event should be created
8. Add a customer-visible note:
   - customer message email event should be created
9. Hide the message:
   - future customer API/message lists must not include it
10. Select bank transfer on credits page:
   - customer-only instruction email event is logged
11. Confirm no PayPal UI/email behavior appears.

## Production Deployment Checklist

1. Run tests/build/checks.
2. Apply `scripts/add-transactional-email-system.sql`.
3. Set production email env:
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `ADMIN_NOTIFICATION_EMAIL`
   - `SUPPORT_EMAIL`
4. Keep `EMAIL_DRY_RUN=true` until a controlled admin test passes.
5. Disable dry-run only after confirming sender domain/DNS.
6. Deploy.
7. Smoke test `/admin/email`, request creation, customer-visible note, bank transfer email and delivery completion.
