# MG AutoTech Vehicle Selector Widget Setup

## 1. Database

Apply the widget database scripts in this order:

1. `scripts/add-vehicle-widget-saas.sql`
2. `scripts/add-widget-enquiries.sql`
3. `scripts/harden-widget-saas-commercial.sql`
4. `supabase/migrations/20260816002443_financial_authority_hardening.sql`
5. `supabase/migrations/20260816002444_security_state_hardening.sql`
6. Run `scripts/verify-widget-saas-commercial.sql`,
   `scripts/verify-financial-authority-hardening.sql` and
   `scripts/verify-security-state-hardening.sql` as read-only verification.

The migrations create global settings, plans, widget clients, public keys,
access logs, enquiries, domain-change requests, webhook idempotency, audit logs,
rate-limit buckets and the commercial operations aggregate. The hardening steps
also apply RLS/grant restrictions, recoverable checkout leases, monotonic Stripe
event watermarks, uniqueness gates and atomic key/domain operations.

The application fails closed before this migration is installed: the sales demo remains visible, checkout is disabled, and public widget requests return only the generic unavailable message.

## 2. Vercel environment variables

Add these values to Production and Preview:

```text
WIDGET_SESSION_SECRET=<at least 32 random characters>
WIDGET_IP_HASH_SALT=<a separate value of at least 32 random characters>
STRIPE_WIDGET_WEBHOOK_SECRET=whsec_...
```

Existing values are reused:

```text
STRIPE_SECRET_KEY
NEXT_PUBLIC_SITE_URL=https://file.mgautotech.de
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
EMAIL_FROM
```

Generate random values locally with:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Production widget traffic fails closed unless the distributed limiter described
in `docs/bot-and-data-exfiltration-defense.md` is configured and reachable.
Never reuse
`SUPABASE_SERVICE_ROLE_KEY` as a widget session secret or privacy salt.

## 3. Stripe webhook

Create a Stripe webhook endpoint:

```text
https://file.mgautotech.de/api/stripe/widget-webhook
```

Subscribe it to:

- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the endpoint signing secret to `STRIPE_WIDGET_WEBHOOK_SECRET`, then redeploy.

## 4. Admin setup

The Primary Owner automatically has widget access. For another staff member, enable `Manage widget clients and settings` under `/admin/team`.

Open:

- `/admin/widget-settings` for global product, pricing, language, branding, and security controls.
- `/admin/widget-clients` for commercial health, subscriptions, domains, keys,
  onboarding, usage, lead delivery and sanitized activity.

The complete commercial operating and release procedure is in
`docs/widget-saas-commercial-control-center.md`.

## 5. Verification

1. Keep the product enabled and price at EUR 4.99.
2. Complete a Stripe test subscription from `/widget`.
3. Sign in with the same email and open `/dashboard/widget`.
4. Paste the script code on the allowed domain.
5. Copy it to a second domain and confirm that it shows only the generic unavailable message.
6. Suspend the client in admin and confirm that the original domain also stops working.
