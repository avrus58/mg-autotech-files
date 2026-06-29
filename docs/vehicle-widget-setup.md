# MG AutoTech Vehicle Selector Widget Setup

## 1. Database

Run `scripts/add-vehicle-widget-saas.sql` once in the Supabase SQL Editor.

The migration creates global settings, plans, widget clients, public keys, access logs, domain-change requests, webhook idempotency, audit logs, rate-limit buckets, and vehicle source/duplicate tracking.

The application fails closed before this migration is installed: the sales demo remains visible, checkout is disabled, and public widget requests return only the generic unavailable message.

## 2. Vercel environment variables

Add these values to Production and Preview:

```text
WIDGET_SESSION_SECRET=<at least 32 random bytes>
WIDGET_IP_HASH_SALT=<a different random value>
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
- `/admin/widget-clients` for subscriptions, domains, keys, permissions, usage, and block logs.

## 5. Verification

1. Keep the product enabled and price at EUR 4.99.
2. Complete a Stripe test subscription from `/widget`.
3. Sign in with the same email and open `/dashboard/widget`.
4. Paste the script code on the allowed domain.
5. Copy it to a second domain and confirm that it shows only the generic unavailable message.
6. Suspend the client in admin and confirm that the original domain also stops working.

