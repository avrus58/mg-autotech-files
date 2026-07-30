# Admin Customer Password Security

## Purpose

The customer detail view includes secure account-recovery controls for staff who
hold `customers.manage`. Existing passwords are never displayed because Supabase
Auth stores password verifiers as one-way hashes, not reversible plaintext.

## Supported actions

### Password reset email

- Available to authorized staff with `customers.manage`.
- Sends the recovery link to the email address attached to the customer's Auth
  account.
- Returns through `/auth/callback?next=/reset-password` so the customer chooses
  the new password in the existing secure reset flow.
- Subject to the Auth provider's reset-email rate limits.

### Direct password replacement

- Available only to the Primary Owner.
- Requires a password between 12 and 128 characters with uppercase, lowercase,
  number and symbol characters.
- Replaces the credential server-side through the Supabase Admin Auth API.
- The submitted password is never returned by the API and is never copied into
  audit metadata.
- The reset-email workflow should remain the default recovery method.

## Security boundaries

- The endpoint is admin-only: `POST /api/admin/customers/[id]/password`.
- Staff must have `customers.manage`; direct replacement has an additional
  Primary Owner gate.
- Admin and staff credentials are rejected by this customer workflow.
- There is no endpoint for retrieving a password or password hash.
- The service-role credential remains server-only.
- Responses use `Cache-Control: no-store`.
- The credential action fails closed when the audit record cannot be created.
- Audit records contain actor, target, action, method and completion state only.
- No customer-facing API exposes these controls or their audit records.

## Audit events

The existing `staff_audit_log` table records one of these actions:

- `customer_password_reset_email_requested`
- `customer_password_replacement_requested`

The audit state moves from `requested` to `completed` or `failed`. Password
values, password hashes and reset tokens are never recorded.

## Deployment and smoke test

No SQL migration is required because the feature reuses `staff_audit_log`.

1. Sign in as an authorized staff member and open a customer detail view.
2. Confirm the current-password field is masked and explicitly marked as not
   retrievable.
3. Confirm reset email is available to `customers.manage` staff.
4. Confirm direct replacement is disabled for non-owner staff.
5. As Primary Owner, verify weak or mismatched replacement values remain blocked.
6. Use a dedicated test customer before testing either real credential action.
7. Confirm the customer can complete the reset flow and that no password value is
   present in API responses, browser logs or `staff_audit_log`.
8. Confirm anonymous and normal customer requests to the admin endpoint return
   `401` or `403`.
