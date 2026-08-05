# Widget SaaS Commercial Control Center

## Purpose

The Widget SaaS Control Center turns the existing vehicle selector widget into
an auditable commercial product. It keeps billing ownership, installation
security, domain approval, usage, lead delivery and customer setup in one
admin workflow.

This change does not alter the widget price, Stripe product behavior, payment
logic or public vehicle catalog.

## Surfaces

- `/admin/widget-clients`: portfolio health, action queue, setup progress,
  usage, lead delivery and commercial stage.
- `/admin/widget-clients/[id]`: customer configuration, installation key,
  domain reviews, leads, access evidence and sanitized audit activity.
- `/admin/widget-settings`: product availability, catalogue defaults,
  language support, delivery policy, runtime security readiness and the
  confirmed global stop control.
- `/dashboard/widget`: customer setup checklist, verified usage and lead
  delivery summary, installation code and customer-editable settings.

All admin routes require `widget.manage`. Customer APIs resolve the signed-in
owner and return explicit allowlisted fields. Public widget APIs never return
billing identifiers, audit records, raw request fingerprints or internal
security configuration.

## Commercial lifecycle

The control center derives a stage without changing the stored subscription:

- `Prospect`: checkout or account exists but subscription is not active.
- `Onboarding`: active commercial relationship with incomplete setup.
- `Ready`: setup is complete and waiting for first verified live request.
- `Live`: a verified allowed-origin request has been recorded.
- `Attention`: payment, delivery, security or usage risk needs action.
- `Paused`: access is suspended or locally disabled.
- `Churned`: the subscription is cancelled.

Health and onboarding are evidence based. The admin cannot manually mark a
domain verified. Verification is recorded only after a successful request from
the exact approved origin.

## Required database order

Apply in this order:

1. `scripts/add-vehicle-widget-saas.sql`
2. `scripts/add-widget-enquiries.sql`
3. `scripts/harden-widget-saas-commercial.sql`
4. Run `scripts/verify-widget-saas-commercial.sql` as read-only verification.

The hardening script is additive and does not delete or merge rows. It enables
RLS, removes direct public/customer table access, restricts privileged
functions to `service_role`, adds aggregate commercial metrics, lifecycle
audit triggers and atomic key/domain operations. The optional operational
retention helper is hardened when present, while older compatible installations
without that maintenance helper remain migratable. The legacy timestamp trigger
uses a fixed `search_path` and is not directly executable by public roles.
Ownership policies use init-plan-safe identity checks and audit foreign keys
have covering indexes for production-scale account activity.

### Required read-only preflight

The unique safety indexes intentionally stop the migration if historical
conflicts exist. Review these results before applying the migration:

```sql
select lower(allowed_domain) as domain, count(*)
from public.widget_clients
where status <> 'cancelled'
group by lower(allowed_domain)
having count(*) > 1;

select client_id, count(*)
from public.widget_api_keys
where is_active = true and revoked_at is null
group by client_id
having count(*) > 1;

select client_id, count(*)
from public.widget_domain_change_requests
where status = 'pending'
group by client_id
having count(*) > 1;
```

All three queries must return zero rows. Conflicts require manual business
review; the migration never chooses a winner automatically.

## Required server configuration

Set both values to separate random strings of at least 32 characters:

```text
WIDGET_SESSION_SECRET=
WIDGET_IP_HASH_SALT=
```

Neither value may use the Supabase service-role key. Secret values never leave
the server; the settings page shows readiness booleans only.

Distributed rate limiting is recommended for production:

```text
SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED=true
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Without the dedicated widget secrets, public widget session and privacy
fingerprint creation fail closed. Without distributed rate limiting, the local
in-process guard remains active and the admin security panel reports the
incomplete production readiness state.

## Security guarantees

- Exact public hostnames only; localhost, private/link-local/metadata ranges,
  IP literals, wildcards and internal suffixes are rejected.
- One non-cancelled client per normalized domain.
- One active installation key per client.
- One pending domain request per client.
- Key rotation is atomic: the old key and new key cannot remain active together.
- Domain approval is atomic: client assignment and request resolution either
  both succeed or both roll back.
- Commercial delivery cannot remain enabled while domain allowlisting, usage
  logging or every installation mode is disabled.
- Lead channels cannot be enabled without their corresponding e-mail address
  or WhatsApp number. Every e-mail lead must be persisted before delivery is
  attempted; an unavailable lead ledger fails closed.
- Customer and admin language settings accept only the supported exact locale
  allowlist, and the default language must remain enabled.
- Suspension, cancellation, key actions, domain replacement and rejection need
  an operator reason.
- Stripe-backed subscriptions cannot be cancelled or repriced locally.
- A typed confirmation is required to disable all widgets.
- Access logs shown in admin omit IP fingerprints and user-agent strings.
- Customer output omits Stripe IDs, admin suspension flags, audit notes and
  domain review notes.

## Daily operating workflow

1. Open `/admin/widget-clients` and work the critical action queue first.
2. Open an onboarding client and confirm subscription, approved domain,
   installation key and at least one lead destination.
3. Review pending domain requests; approve only the exact customer-owned domain.
4. Ask the customer to install the generated snippet on that domain.
5. Wait for the first successful origin request to establish live verification.
6. Monitor usage, blocked requests and failed lead deliveries.
7. Use suspension or key rotation only with an audit reason.
8. Manage Stripe-backed cancellation and pricing in Stripe, not in local fields.

## Release order

1. Confirm the three preflight queries return zero rows.
2. Apply `scripts/harden-widget-saas-commercial.sql`.
3. Run `scripts/verify-widget-saas-commercial.sql` and confirm:
   - RLS is enabled on every widget table.
   - `anon` and `authenticated` have no direct table access.
   - internal functions are not executable by public roles.
   - `service_role` can run the commercial aggregate and atomic operations.
   - all three unique indexes exist.
4. Configure the dedicated widget secrets and distributed limiter.
5. Deploy the application.

## Production smoke checklist

- Anonymous admin client/settings APIs return 401 or 403.
- A customer sees only their own widget workspace.
- Admin list loads portfolio totals and does not expose raw Stripe IDs.
- Existing Stripe-linked price fields are read-only.
- A duplicate live domain is rejected.
- A private, localhost or metadata hostname is rejected.
- Key rotation leaves exactly one active key and invalidates the previous key.
- Domain approval resets verification and first live origin restores it.
- A lead increments the monthly metric and a delivery failure enters Attention.
- Disabling the lead table or its rate-limit query returns a safe unavailable
  response and sends no untracked enquiry e-mail.
- Customer payload contains no admin note, audit details, IP fingerprint,
  user-agent or Stripe customer/subscription ID.
- Global stop requires the exact typed confirmation.
- Browser console has no errors at desktop, small laptop, tablet and mobile sizes.
