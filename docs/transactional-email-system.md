# MG AutoTech Transactional Email System

## Purpose

The transactional email system sends premium, customer-safe notifications for important MG AutoTech platform events. It is server-side only, language-aware, and designed to avoid public relay abuse.

The system never sends raw ECU/TCU files, binary previews, hex data, private storage paths, provider/private sample metadata, internal notes, risk flags, audit logs, private offsets, or hidden customer messages.

## Provider And Dry-Run

Provider abstraction: `sendTransactionalEmail()`

Current provider: Resend

Environment:

- `RESEND_API_KEY`: enables real sending.
- `RESEND_WEBHOOK_SECRET`: verifies signed Resend delivery events.
- `EMAIL_FROM`: optional sender, default `MG AutoTech <noreply@file.mgautotech.de>`.
- `ADMIN_NOTIFICATION_EMAIL` or `EMAIL_TO`: admin notification target.
- `SUPPORT_EMAIL`: footer contact email.
- `EMAIL_DRY_RUN=true`: logs/skips without sending real emails.

Real sending is explicit opt-in: the application remains in dry-run unless
`EMAIL_DRY_RUN=false` is configured. If the `email_events` log is unavailable,
live sending fails closed so idempotency cannot be bypassed.

If `RESEND_API_KEY` is missing, emails are skipped safely and the request/payment/work-order flow continues.

## Customer Email Language

Customer transactional templates are available in all website languages:
English, German, Turkish, Dutch, French, Italian, Spanish, Portuguese, Polish,
Russian, Chinese and Albanian.

Resolution order:

1. The customer's explicit `E-mail Language` choice in `/dashboard/settings`.
2. The locale selected during account registration or verification.
3. Safe default: English.

Malformed or unsupported locale values receive the English email version. They
never fall back to German automatically. The preference is stored as
`email_language` in Supabase Auth user metadata and is used only for content
localization, never for authorization or RLS decisions.

Admin notifications use English until a separate staff notification preference
is introduced. Existing accounts without a stored preference receive English.
Customers can choose any supported website language from customer settings.

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

## Delivery Reliability

Additive migration: `scripts/add-email-delivery-reliability.sql`

Read-only verification: `scripts/verify-email-delivery-reliability.sql`

Signed provider events arrive at `POST /api/webhooks/resend`. The route accepts
only the reviewed delivery event allowlist, verifies the Svix signature with
`RESEND_WEBHOOK_SECRET`, limits the raw request to 64 KB and stores only bounded
delivery metadata plus a SHA-256 payload digest. It never stores the webhook
payload or email body.

Admin-visible delivery states are `sent`, `delivered`, `delayed`, `bounced`,
`complained`, `failed` and `suppressed`. Permanent bounces, complaints and
provider suppressions add the normalized recipient to the private suppression
registry. Future application email attempts to that address are skipped. A
temporary delay or generic provider failure does not suppress the recipient.

The suppression check fails closed for real sending if the reliability table
cannot be checked. Dry-run remains usable without a database connection so
template QA never sends a real message.

## Implemented Templates

Customer/request:

- `customer_welcome` after verified registration
- `customer_password_reset` for the audited admin customer-recovery action
- `request_created`
- `request_received`
- `file_uploaded`
- `additional_file_requested`
- `additional_file_uploaded_customer`
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
- `revision_requested_admin_notification`
- `file_uploaded_admin_notification`
- `failed_email_admin_alert`
- `admin_email_test`

## Integrated Triggers

- Account lifecycle:
  - Supabase Auth sends signup verification and password recovery links.
  - A verified new account receives the MG AutoTech welcome email.
  - Admin registration notification is sent only after authenticated verification.
  - Signup confirmation can be resent from the registration success screen.

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
  - customer receipt confirmation
  - admin notification

- Customer reply or revision request:
  - admin notification with a bounded customer-safe message preview

- Legacy admin order status and Work Order status:
  - both use the same allowlisted lifecycle mapping
  - repeated saves do not send duplicate mail

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
- sent/delivered/delayed/bounced/complained/suppressed health metrics
- latest signed provider delivery event per message
- private active suppression list
- safe 12-language template previews in a sandboxed frame
- Supabase Auth mail routes
- exact request/work-order lifecycle coverage

Admin test email:

- requires `orders.manage`
- sends only to the authenticated admin's own email
- respects `EMAIL_DRY_RUN`

Delivery failures also appear in the existing admin notification bell without
recipient details. The full recipient and bounded provider reason remain only
inside the permission-protected Email Control Center.

## Supabase Auth Email Templates

Authentication links are issued by Supabase Auth, not by a public MG AutoTech
relay endpoint. Repository-managed template sources cover signup confirmation,
password recovery, invitations, magic links, email changes, reauthentication
and all supported security notifications. The complete mapping, subject
template and file name are recorded in `docs/email-templates/manifest.json`.

Every template selects one of the 12 reviewed languages from the
`email_language` user metadata. Missing or unsupported metadata uses English.
The language value affects content only; it is never an authorization input.
Regenerate reviewed sources with:

`tsx scripts/generate-supabase-auth-email-templates.ts`

For hosted Supabase, apply each reviewed subject/body pair to its matching
Authentication > Email Templates entry. Keep
`https://file.mgautotech.de/auth/callback` in the Auth redirect allowlist and
configure production SMTP in Authentication > SMTP Settings. Enable the
reviewed security notifications at project level. Never put a service-role key
or SMTP credential into a template. Repository generation alone does not alter
the hosted Supabase project.

## Smoke Test Checklist

1. Apply `scripts/add-transactional-email-system.sql` in Supabase.
2. Apply `scripts/add-email-delivery-reliability.sql` and run its read-only verification SQL.
3. Keep `EMAIL_DRY_RUN=true` in staging/local.
4. Open `/admin/email` as owner/admin.
5. Preview one platform and one Supabase Auth template in EN, DE, TR, FR and one non-Latin locale.
6. Send an admin test email in dry-run and confirm no provider delivery occurs.
7. Configure a signed staging Resend webhook and verify sent/delivered events.
8. Use provider test events to verify delayed/bounced/complained admin states.
9. Confirm a bounced test recipient is suppressed and a delayed recipient is not.
10. Confirm the admin bell contains the issue without recipient information.
11. Create a test request and confirm customer/admin event logs are idempotent.
12. Add an internal note and confirm no customer email event is created.
13. Add a customer-visible note and confirm one customer email event is created.
14. Confirm hidden messages and PayPal behavior are absent.

## Production Deployment Checklist

1. Run tests/build/checks.
2. Apply `scripts/add-transactional-email-system.sql` if not already present.
3. Apply and verify `scripts/add-email-delivery-reliability.sql`.
4. Set production email env:
   - `RESEND_API_KEY`
   - `RESEND_WEBHOOK_SECRET`
   - `EMAIL_FROM`
   - `ADMIN_NOTIFICATION_EMAIL`
   - `SUPPORT_EMAIL`
5. Apply all reviewed 12-language Auth subjects and bodies in hosted Supabase.
6. Register the HTTPS Resend webhook for the seven tracked delivery events.
7. Keep `EMAIL_DRY_RUN=true` until controlled template, log and webhook tests pass.
8. Disable dry-run only after confirming sender domain/DNS and suppression behavior.
9. Deploy.
10. Smoke test `/admin/email`, Auth email languages, request creation, customer-visible note, bank transfer email and delivery completion.
