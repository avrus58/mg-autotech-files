# Payment Methods

Current supported customer credit purchase methods:

- Stripe card payment: automatic checkout and automatic credit reconciliation.
- Bank transfer: manual SEPA transfer and admin credit approval.

Legacy provider records may still exist in payment audit tables for historical accounting. They must remain readable, but they are not available for new customer purchases, customer-specific payment policies, global payment settings or automated refunds.

Environment requirements:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_BANK_ACCOUNT_NAME`
- `NEXT_PUBLIC_BANK_NAME`
- `NEXT_PUBLIC_BANK_IBAN`
- `NEXT_PUBLIC_BANK_BIC`

No additional provider credentials are required for the active credit purchase flow.
