begin;

-- A widget checkout owns one durable attempt token from the database claim
-- through the Stripe-session bind. The token is also the Stripe idempotency
-- key, so concurrent requests can only create/reuse the same provider object.
alter table public.widget_clients
  add column if not exists checkout_claim_token uuid,
  add column if not exists checkout_claimed_at timestamptz;

-- A pre-migration unbound attempt could already have created an open Stripe
-- session whose response was lost. It has no durable idempotency key to recover,
-- so fail closed until its original provider expiry passes instead of risking a
-- second live session during rollout.
do $$
begin
  if exists (
    select 1
    from public.widget_clients as client
    where client.status = 'pending'
      and client.stripe_customer_id is null
      and client.stripe_subscription_id is null
      and client.stripe_checkout_session_id is null
      and coalesce(
        client.checkout_pending_until,
        client.created_at + interval '31 minutes'
      ) > pg_catalog.now()
  ) then
    raise exception using
      errcode = '55000',
      message = 'Unbound legacy widget checkout attempts must expire before atomic checkout claims are enabled.';
  end if;
end;
$$;

-- Preserve recoverability for attempts created before this migration. A
-- cancelled row can still carry an open legacy Stripe session, so it receives
-- a token as well and must pass the same exact release contract.
update public.widget_clients
set
  checkout_claim_token = coalesce(checkout_claim_token, gen_random_uuid()),
  checkout_claimed_at = coalesce(checkout_claimed_at, created_at, now()),
  checkout_pending_until = coalesce(
    checkout_pending_until,
    created_at + interval '31 minutes',
    now()
  )
where stripe_customer_id is null
  and stripe_subscription_id is null
  and (
    status = 'pending'
    or (status = 'cancelled' and stripe_checkout_session_id is not null)
  );

alter table public.widget_clients
  drop constraint if exists widget_clients_checkout_claim_state_check;
alter table public.widget_clients
  add constraint widget_clients_checkout_claim_state_check
  check (
    (checkout_claim_token is null) = (checkout_claimed_at is null)
    and (
      checkout_claim_token is null
      or (
        stripe_customer_id is null
        and stripe_subscription_id is null
        and checkout_pending_until is not null
      )
    )
  );

create unique index if not exists widget_clients_checkout_claim_token_idx
  on public.widget_clients(checkout_claim_token)
  where checkout_claim_token is not null;

create index if not exists widget_clients_checkout_claim_recovery_idx
  on public.widget_clients(checkout_pending_until, checkout_claimed_at)
  where checkout_claim_token is not null
    and stripe_customer_id is null
    and stripe_subscription_id is null;

create or replace function public.claim_widget_checkout_attempt(
  p_existing_client_id uuid,
  p_user_id uuid,
  p_email text,
  p_canonical_domain text,
  p_company_name text,
  p_website_domain text,
  p_plan text,
  p_monthly_price numeric,
  p_currency text,
  p_default_language text,
  p_allowed_languages jsonb,
  p_monthly_usage_limit integer,
  p_claim_token uuid,
  p_checkout_pending_until timestamptz
)
returns table (
  client_id uuid,
  claim_token uuid,
  claim_expires_at timestamptz,
  checkout_company_name text,
  checkout_email text,
  checkout_website_domain text,
  checkout_canonical_domain text,
  checkout_plan text,
  checkout_monthly_price numeric,
  checkout_currency text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client public.widget_clients%rowtype;
begin
  if p_user_id is null
    or p_claim_token is null
    or p_email is null
    or p_email <> pg_catalog.lower(pg_catalog.btrim(p_email))
    or pg_catalog.length(p_email) not between 3 and 250
    or p_canonical_domain is null
    or p_canonical_domain <> pg_catalog.lower(pg_catalog.btrim(p_canonical_domain))
    or pg_catalog.length(p_canonical_domain) not between 3 and 253
    or p_company_name is null
    or pg_catalog.length(pg_catalog.btrim(p_company_name)) not between 2 and 120
    or p_website_domain is null
    or pg_catalog.length(pg_catalog.btrim(p_website_domain)) not between 3 and 253
    or p_plan is distinct from 'starter'
    or p_monthly_price is null
    or p_monthly_price < 0
    or p_currency is null
    or p_currency !~ '^[a-z]{3}$'
    or p_default_language is null
    or pg_catalog.length(p_default_language) not between 2 and 5
    or p_allowed_languages is null
    or pg_catalog.jsonb_typeof(p_allowed_languages) is distinct from 'array'
    or p_monthly_usage_limit is null
    or p_monthly_usage_limit < 0
    or p_checkout_pending_until is null
    or p_checkout_pending_until <= pg_catalog.now() + interval '30 minutes'
    or p_checkout_pending_until > pg_catalog.now() + interval '35 minutes'
  then
    raise exception using
      errcode = '22023',
      message = 'Widget checkout claim input is invalid.';
  end if;

  -- Lock any live domain allocation first. The only reusable live state is an
  -- unbound attempt owned by the exact same authenticated account. Returning
  -- its original snapshot keeps Stripe idempotency parameters byte-for-byte
  -- stable across concurrent/retried requests.
  select client.*
  into v_client
  from public.widget_clients as client
  where client.canonical_domain = p_canonical_domain
    and client.status is distinct from 'cancelled'
  order by client.created_at desc
  limit 1
  for update;

  if found then
    if v_client.status = 'pending'
      and v_client.user_id = p_user_id
      and pg_catalog.lower(v_client.email) = p_email
      and v_client.stripe_customer_id is null
      and v_client.stripe_subscription_id is null
      and v_client.stripe_checkout_session_id is null
      and v_client.checkout_claim_token is not null
      and v_client.checkout_claimed_at is not null
      and v_client.checkout_pending_until > pg_catalog.now()
    then
      return query select
        v_client.id,
        v_client.checkout_claim_token,
        v_client.checkout_pending_until,
        v_client.company_name,
        pg_catalog.lower(v_client.email),
        v_client.website_domain,
        v_client.canonical_domain,
        v_client.plan,
        v_client.monthly_price,
        v_client.currency;
    end if;
    return;
  end if;

  select client.*
  into v_client
  from public.widget_clients as client
  where client.status = 'cancelled'
    and client.user_id = p_user_id
    and pg_catalog.lower(client.email) = p_email
    and client.canonical_domain = p_canonical_domain
    and (p_existing_client_id is null or client.id = p_existing_client_id)
  order by client.created_at desc
  limit 1
  for update;

  if not found and p_existing_client_id is not null then
    return;
  end if;

  if found then
    update public.widget_clients as client
    set
      company_name = pg_catalog.btrim(p_company_name),
      website_domain = pg_catalog.btrim(p_website_domain),
      allowed_domain = p_canonical_domain,
      plan = p_plan,
      monthly_price = p_monthly_price,
      currency = p_currency,
      default_language = p_default_language,
      allowed_languages = p_allowed_languages,
      monthly_usage_limit = p_monthly_usage_limit,
      status = 'pending',
      widget_enabled = false,
      stripe_checkout_session_id = null,
      checkout_pending_until = p_checkout_pending_until,
      checkout_claim_token = p_claim_token,
      checkout_claimed_at = pg_catalog.now()
    where client.id = v_client.id
      and client.status = 'cancelled'
      and client.stripe_customer_id is null
      and client.stripe_subscription_id is null
      and client.stripe_checkout_session_id is null
      and client.checkout_pending_until is null
      and client.checkout_claim_token is null
      and client.checkout_claimed_at is null
    returning client.* into v_client;

    if not found then
      return;
    end if;
  else
    begin
      insert into public.widget_clients (
        user_id,
        company_name,
        email,
        website_domain,
        allowed_domain,
        plan,
        monthly_price,
        currency,
        default_language,
        allowed_languages,
        monthly_usage_limit,
        status,
        widget_enabled,
        stripe_checkout_session_id,
        checkout_pending_until,
        checkout_claim_token,
        checkout_claimed_at
      ) values (
        p_user_id,
        pg_catalog.btrim(p_company_name),
        p_email,
        pg_catalog.btrim(p_website_domain),
        p_canonical_domain,
        p_plan,
        p_monthly_price,
        p_currency,
        p_default_language,
        p_allowed_languages,
        p_monthly_usage_limit,
        'pending',
        false,
        null,
        p_checkout_pending_until,
        p_claim_token,
        pg_catalog.now()
      )
      returning * into v_client;
    exception
      when unique_violation then
        -- A concurrent request won the live-domain insert. It may only be
        -- shared when it is the exact same unbound owner attempt.
        select client.*
        into v_client
        from public.widget_clients as client
        where client.canonical_domain = p_canonical_domain
          and client.status = 'pending'
        order by client.created_at desc
        limit 1
        for update;

        if not found
          or v_client.user_id is distinct from p_user_id
          or pg_catalog.lower(v_client.email) is distinct from p_email
          or v_client.stripe_customer_id is not null
          or v_client.stripe_subscription_id is not null
          or v_client.stripe_checkout_session_id is not null
          or v_client.checkout_claim_token is null
          or v_client.checkout_claimed_at is null
          or v_client.checkout_pending_until <= pg_catalog.now()
        then
          return;
        end if;
    end;
  end if;

  return query select
    v_client.id,
    v_client.checkout_claim_token,
    v_client.checkout_pending_until,
    v_client.company_name,
    pg_catalog.lower(v_client.email),
    v_client.website_domain,
    v_client.canonical_domain,
    v_client.plan,
    v_client.monthly_price,
    v_client.currency;
end;
$$;

create or replace function public.bind_widget_checkout_session(
  p_client_id uuid,
  p_user_id uuid,
  p_claim_token uuid,
  p_stripe_checkout_session_id text,
  p_session_expires_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bound_id uuid;
begin
  if p_client_id is null
    or p_user_id is null
    or p_claim_token is null
    or p_stripe_checkout_session_id is null
    or p_stripe_checkout_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$'
    or p_session_expires_at is null
  then
    return null;
  end if;

  update public.widget_clients as client
  set stripe_checkout_session_id = p_stripe_checkout_session_id
  where client.id = p_client_id
    and client.user_id = p_user_id
    and client.status = 'pending'
    and client.stripe_customer_id is null
    and client.stripe_subscription_id is null
    and client.checkout_claim_token = p_claim_token
    and client.checkout_claimed_at is not null
    and client.checkout_pending_until = p_session_expires_at
    and client.checkout_pending_until > pg_catalog.now()
    and client.stripe_checkout_session_id is null
  returning client.id into v_bound_id;

  if v_bound_id is not null then
    return 'bound';
  end if;

  -- Concurrent retries share one Stripe idempotency key. Treat an already
  -- persisted exact binding as success; never overwrite a different session.
  if exists (
    select 1
    from public.widget_clients as client
    where client.id = p_client_id
      and client.user_id = p_user_id
      and client.status = 'pending'
      and client.stripe_customer_id is null
      and client.stripe_subscription_id is null
      and client.checkout_claim_token = p_claim_token
      and client.checkout_pending_until = p_session_expires_at
      and client.stripe_checkout_session_id = p_stripe_checkout_session_id
  ) then
    return 'already_bound';
  end if;

  return null;
end;
$$;

create or replace function public.release_widget_checkout_attempt(
  p_client_id uuid,
  p_user_id uuid,
  p_claim_token uuid,
  p_expired_stripe_checkout_session_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_released_id uuid;
begin
  if p_client_id is null
    or p_user_id is null
    or p_claim_token is null
    or (
      p_expired_stripe_checkout_session_id is not null
      and p_expired_stripe_checkout_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$'
    )
  then
    return false;
  end if;

  update public.widget_clients as client
  set
    status = 'cancelled',
    widget_enabled = false,
    stripe_checkout_session_id = null,
    checkout_pending_until = null,
    checkout_claim_token = null,
    checkout_claimed_at = null
  where client.id = p_client_id
    and client.user_id = p_user_id
    and client.status in ('pending', 'cancelled')
    and client.stripe_customer_id is null
    and client.stripe_subscription_id is null
    and client.checkout_claim_token = p_claim_token
    and (
      (
        p_expired_stripe_checkout_session_id is null
        and client.stripe_checkout_session_id is null
        and client.checkout_pending_until <= pg_catalog.now()
      )
      or (
        p_expired_stripe_checkout_session_id is not null
        and (
          client.stripe_checkout_session_id is null
          or client.stripe_checkout_session_id = p_expired_stripe_checkout_session_id
        )
      )
    )
  returning client.id into v_released_id;

  return v_released_id is not null;
end;
$$;

revoke all privileges on function public.claim_widget_checkout_attempt(
  uuid, uuid, text, text, text, text, text, numeric, text, text,
  jsonb, integer, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.claim_widget_checkout_attempt(
  uuid, uuid, text, text, text, text, text, numeric, text, text,
  jsonb, integer, uuid, timestamptz
) to service_role;

revoke all privileges on function public.bind_widget_checkout_session(
  uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.bind_widget_checkout_session(
  uuid, uuid, uuid, text, timestamptz
) to service_role;

revoke all privileges on function public.release_widget_checkout_attempt(
  uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.release_widget_checkout_attempt(
  uuid, uuid, uuid, text
) to service_role;

commit;
