# Email Delivery Reliability Operations

## Scope

This layer tracks delivery outcomes for MG AutoTech transactional and Supabase
Auth email routed through Resend. It does not create a public email relay and
does not store full email content or raw webhook payloads.

## Data Boundary

Private tables:

- `email_delivery_events`: signed event ID, provider message ID, allowlisted
  status, normalized recipient, bounded reason, timestamps and payload digest.
- `email_suppressions`: normalized recipient, suppression reason and audit
  timestamps.

Public and customer APIs expose neither table. Authenticated direct reads are
RLS-restricted to staff with `orders.view`; writes use server-only credentials.

Never store:

- email HTML or plain-text body
- webhook payload
- auth tokens or confirmation URLs
- passwords or credentials
- customer file paths or binary data
- internal notes, AI evidence or payment data

## Event Policy

Tracked Resend events:

- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.complained`
- `email.failed`
- `email.suppressed`

Automatic suppression applies only to permanent bounce events, complaints and
provider suppressions. Delayed and failed events create admin visibility but do
not automatically mark an address invalid. Unknown event types are acknowledged
without being stored.

## Setup

1. Apply `scripts/add-email-delivery-reliability.sql` after the base
   transactional email migration.
2. Run `scripts/verify-email-delivery-reliability.sql`; it contains SELECT only.
3. Create an HTTPS Resend webhook pointing to
   `https://file.mgautotech.de/api/webhooks/resend`.
4. Select the seven tracked events listed above.
5. Store the signing secret as `RESEND_WEBHOOK_SECRET` in the matching server
   environment. Do not expose it to the browser.
6. Keep `EMAIL_DRY_RUN=true` during staging verification.

## Admin Workflow

`/admin/email` shows recent outcomes, bounded failure reasons, active
suppressions, provider configuration and safe template previews. The global
admin notification bell shows a privacy-safe delivery issue signal and links to
the Email Control Center.

Admin template preview uses fixed sample data in a sandboxed frame. Admin test
send is restricted to staff with `orders.manage`, can target only the current
admin's account address and still respects dry-run mode.

## Recovery

- Delayed: monitor; do not suppress.
- Failed: inspect provider reason and configuration; do not suppress blindly.
- Bounced: verify or correct the customer's address before any future manual
  resolution workflow.
- Complained: keep suppressed and do not retry.
- Provider suppressed: inspect the provider suppression reason before deciding
  whether an address can be safely restored in a future audited admin workflow.

There is intentionally no public or customer self-service suppression override
in this release.
