# Payment Setup

## Vercel Production Environment

Add these values in Vercel project settings, then redeploy.

### Site

- `NEXT_PUBLIC_SITE_URL=https://file.mgautotech.de`

### SumUp

- `SUMUP_API_KEY`
- `SUMUP_MERCHANT_CODE`
- `SUMUP_API_BASE=https://api.sumup.com`

Return URL used by the app:

- `https://file.mgautotech.de/payment/success?provider=sumup`

### PayPal

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_API_BASE=https://api-m.paypal.com`

Return URL used by the app:

- `https://file.mgautotech.de/payment/success?provider=paypal`

### Stripe

- `STRIPE_SECRET_KEY=sk_live_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

Stripe webhook endpoint:

- `https://file.mgautotech.de/api/stripe/webhook`

Event:

- `checkout.session.completed`

### Bank Transfer

- `NEXT_PUBLIC_BANK_ACCOUNT_NAME`
- `NEXT_PUBLIC_BANK_NAME`
- `NEXT_PUBLIC_BANK_IBAN`
- `NEXT_PUBLIC_BANK_BIC`

Bank transfer stays manual. SumUp, PayPal and Stripe are automatic credit top-up flows.

## Local Check

Run:

```bash
npm run check:payments
```
