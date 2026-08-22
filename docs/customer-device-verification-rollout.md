# Customer trusted-device verification rollout

This release adds an application-level e-mail code for a new or untrusted
customer browser. It is deliberately installed in `shadow` mode. Applying the
migration alone must not interrupt existing customer sessions.

The code is six digits, expires after ten minutes, is single-use, and permits
five attempts. A successful verification authorizes only the matching Supabase
Auth session. The optional `Trust this device for 30 days` choice stores a
random token in a `Secure`, `HttpOnly`, `SameSite=Lax`, host-only cookie; the
database stores only its HMAC. The raw token is never included in an API JSON
body. The choice is off by default.

This control is not Supabase native MFA and does not raise the JWT to AAL2. IP
addresses are used only as a supplemental request-rate-limit input and are not
stored as device identity. A bearer token stolen from an already verified
session remains equivalent to that verified session; full token/device binding
would require a different authentication architecture.

The assurance boundary protects MG AutoTech application APIs, Data API rows,
protected Storage, and order RPCs. It does not sit in front of Supabase GoTrue's
own `/auth/v1/user` endpoint. Therefore a pending bearer may still attempt Auth
user/password or user-metadata mutations if the Supabase Auth project settings
allow them. Production activation requires Secure Password Change/current-
password controls, and full Auth-layer enforcement requires Supabase native MFA
or another Auth-layer design; the custom e-mail step must not be represented as
protection against every stolen-token scenario.

## Required configuration

- Set `CUSTOMER_DEVICE_HMAC_SECRET` only in the server environment. It must be
  an independently generated secret of at least 32 bytes and must never use the
  Supabase JWT secret, service-role key, Turnstile secret, or an e-mail API key.
- Keep the current HMAC key version at `1`. Rotating the secret without a
  versioned migration invalidates every saved device and active code. Use the
  account-security revocation path before a planned rotation.
- Real verification requires Resend to return a provider message ID. Dry-run,
  skipped, or non-Resend delivery fails closed and does not activate a code.
- Configure Supabase Auth password strength and leaked-password protection to
  match or exceed the application rule (12 characters with upper/lowercase,
  number, and symbol). Enable Secure Password Change/current-password
  protection for credential changes where supported.
- Preview must use the isolated staging Supabase project and its own HMAC
  secret. Never copy Production credentials or customer data into staging.

## Staging gates

1. Freeze the application commit and migration checksum. Apply
   `20260823000000_customer_device_verification.sql` to isolated staging. Confirm
   the config row remains `shadow`.
2. Run `scripts/verify-customer-device-verification.sql`. Every row must return
   `ok = true`; its output contains only schema/ACL/config aggregates.
3. Deploy the matching application with a staging HMAC secret and real staging
   e-mail delivery. Do not activate enforcement yet.
4. With disposable customers, verify password login, Google OAuth, confirmed
   registration, callback resume, wrong-code attempts, expiry, resend cooldown,
   simultaneous resend, and provider failure. An old sent code must remain valid
   until a replacement message is accepted and atomically activated.
5. Verify both choices: without trust, a later new session requests a code;
   with trust, that browser may authorize a new session for at most 30 days.
   Incognito/another browser must still request a code.
6. Revoke the current device, one other device, and all other devices. Confirm
   affected app sessions lose customer-data access immediately. Reset a
   password and use the admin password-replacement flow; both must revoke saved
   devices and app assurance.
7. While a customer session is pending, test direct Data API reads, protected
   Storage operations, server customer endpoints, File Expert, and all web and
   desktop order RPCs. Every path must fail closed. Staff access must remain on
   the existing staff-permission boundary.
8. Confirm the current desktop client receives an explicit HTTP 428 fail-closed
   message. Do not activate while an unsupported desktop version is allowed to
   serve customers; either publish a compatible client or keep desktop customer
   access disabled/minimum-version blocked.
9. Call `activate_customer_device_assurance(24)` with service-role authority.
   The function performs its own policy, ACL, RLS, and order-wrapper preflight.
   Repeat the verifier and all authenticated smokes in enforced mode.

## Production sequence

1. Require a passing staging rehearsal for the same application and migration
   checksums. Confirm e-mail capacity, rate-limit storage, rollback operator,
   and immediate smoke ownership.
2. Configure the server-only HMAC secret (the previous build ignores it), apply
   the migration, and confirm `shadow`. Run the read-only verifier. Only then
   deploy the matching application; deploying it before the RPCs exist makes
   customer API guards fail closed with 503.
3. Smoke status/start/verify against a controlled Production test account. Do
   not use a real customer account or log the code, token, bearer, e-mail, or
   device cookie.
4. Activate with a bounded legacy grace window of 0-48 hours (normally 24):

   ```sql
   select public.activate_customer_device_assurance(24);
   ```

5. Re-run the verifier immediately. Test a fresh untrusted browser, a trusted
   browser, one protected customer API, protected Storage, and an order RPC.
   Monitor verification delivery failures, 428/401/429/5xx rates, and support
   reports without recording security codes or raw device tokens.

## Recovery

For a critical login, e-mail, RLS, Storage, or order regression, disable
enforcement before rolling back the application:

```sql
select public.disable_customer_device_assurance();
```

Confirm the config is `shadow`, repeat the prior-build smoke, and fix forward.
Disabling enforcement preserves tables and revocation evidence and does not
delete customer data. Explicitly revoked sessions and a password-change session
that is waiting for its forced e-mail code remain blocked in `shadow`; rollback
must not resurrect them. Never drop the restrictive policies first: an
application rollback while mode remains `enforced` can lock customers out.

Mailbox compromise defeats an e-mail factor, and this custom step does not
replace native phishing-resistant MFA for staff/admin accounts. Admin MFA and
the existing Turnstile/brute-force controls remain separate requirements.
