-- Durable Stripe reconciliation and refund recovery.
-- Additive state columns plus service-role-only, claim-bound financial RPCs.

begin;

alter table public.payment_records
  add column if not exists processing_claim_token uuid,
  add column if not exists processing_started_at timestamptz,
  add column if not exists provider_refund_id text,
  add column if not exists refund_claim_token uuid,
  add column if not exists refund_started_at timestamptz;

alter table public.payment_records
  drop constraint if exists payment_records_processing_claim_pair_check;
alter table public.payment_records
  add constraint payment_records_processing_claim_pair_check
  check (
    (processing_claim_token is null and processing_started_at is null)
    or (processing_claim_token is not null and processing_started_at is not null)
  );

alter table public.payment_records
  drop constraint if exists payment_records_refund_claim_pair_check;
alter table public.payment_records
  add constraint payment_records_refund_claim_pair_check
  check (
    (refund_claim_token is null and refund_started_at is null)
    or (refund_claim_token is not null and refund_started_at is not null)
  );

create index if not exists payment_records_processing_lease_idx
  on public.payment_records(processing_started_at)
  where processing_claim_token is not null;

create index if not exists payment_records_refund_lease_idx
  on public.payment_records(refund_started_at)
  where refund_claim_token is not null;

create unique index if not exists payment_records_provider_refund_unique
  on public.payment_records(provider, provider_refund_id)
  where provider_refund_id is not null;

create or replace function public.add_credits_from_stripe(
  p_user_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent text,
  p_customer_email text,
  p_package_id text,
  p_credits numeric,
  p_amount_total numeric,
  p_currency text,
  p_processing_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payment_records%rowtype;
  v_applied_payment public.credit_payments%rowtype;
  v_ledger public.credit_transactions%rowtype;
  v_current_balance numeric;
  v_next_balance numeric;
  v_applied_at timestamptz;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'This operation requires the service role.';
  end if;

  if p_user_id is null
    or p_processing_claim_token is null
    or p_stripe_session_id is null
    or pg_catalog.length(pg_catalog.btrim(p_stripe_session_id)) not between 3 and 255
    or p_stripe_payment_intent is null
    or pg_catalog.length(pg_catalog.btrim(p_stripe_payment_intent)) not between 3 and 255
    or p_credits is null
    or p_credits <= 0
    or p_credits <> pg_catalog.trunc(p_credits)
    or p_credits > 100000
    or p_amount_total is null
    or p_amount_total < 0
    or p_amount_total <> pg_catalog.trunc(p_amount_total)
    or p_amount_total > 2147483647
    or p_currency is null
    or pg_catalog.lower(pg_catalog.btrim(p_currency)) !~ '^[a-z]{3}$' then
    raise exception using
      errcode = '22023',
      message = 'Stripe credit reconciliation input is invalid.';
  end if;

  select payment.*
  into v_payment
  from public.payment_records as payment
  where payment.provider = 'stripe'
    and payment.external_id = pg_catalog.btrim(p_stripe_session_id)
  for update;

  if not found then
    raise exception 'The Stripe payment record was not found.';
  end if;

  if v_payment.status <> 'requires_review'
    or v_payment.failure_code <> 'stripe_credit_processing'
    or v_payment.processing_claim_token is distinct from p_processing_claim_token
    or v_payment.processing_started_at is null
    or v_payment.credits_applied_at is not null
    or v_payment.payment_type <> 'credit_purchase'
    or v_payment.user_id is distinct from p_user_id
    or v_payment.credits is distinct from p_credits
    or v_payment.amount_total::numeric is distinct from p_amount_total
    or pg_catalog.lower(v_payment.currency)
      is distinct from pg_catalog.lower(pg_catalog.btrim(p_currency))
    or v_payment.provider_payment_id
      is distinct from pg_catalog.btrim(p_stripe_payment_intent)
    or v_payment.package_id is distinct from p_package_id then
    raise exception using
      errcode = '22023',
      message = 'Stripe reconciliation does not match the authoritative payment claim.';
  end if;

  select applied.*
  into v_applied_payment
  from public.credit_payments as applied
  where applied.stripe_session_id = v_payment.external_id
  for update;

  if found then
    if v_applied_payment.user_id is distinct from v_payment.user_id
      or v_applied_payment.stripe_payment_intent
        is distinct from v_payment.provider_payment_id
      or v_applied_payment.package_id is distinct from v_payment.package_id
      or v_applied_payment.credits is distinct from v_payment.credits
      or v_applied_payment.amount_total::numeric
        is distinct from v_payment.amount_total::numeric
      or pg_catalog.lower(v_applied_payment.currency)
        is distinct from pg_catalog.lower(v_payment.currency)
      or v_applied_payment.status is distinct from 'paid' then
      raise exception using
        errcode = '22023',
        message = 'The existing Stripe credit application requires financial reconciliation.';
    end if;

    select ledger.*
    into v_ledger
    from public.credit_transactions as ledger
    where ledger.source_type = 'stripe_checkout'
      and ledger.source_id = v_payment.external_id
    limit 1;

    if not found
      or v_ledger.user_id is distinct from v_payment.user_id
      or v_ledger.credits_delta::numeric is distinct from v_payment.credits
      or v_ledger.amount_total::numeric is distinct from v_payment.amount_total::numeric
      or pg_catalog.lower(v_ledger.currency) is distinct from pg_catalog.lower(v_payment.currency)
      or v_ledger.metadata ->> 'payment_record_id' is distinct from v_payment.id::text then
      raise exception using
        errcode = '22023',
        message = 'The existing Stripe ledger requires financial reconciliation.';
    end if;
  else
    if exists (
      select 1
      from public.credit_transactions as ledger
      where ledger.source_type = 'stripe_checkout'
        and ledger.source_id = v_payment.external_id
    ) then
      raise exception using
        errcode = '22023',
        message = 'A Stripe ledger row exists without its credit payment record.';
    end if;

    select coalesce(profile.credit_balance, 0)
    into v_current_balance
    from public.profiles as profile
    where profile.id = v_payment.user_id
      and profile.role = 'customer'
    for update;

    if not found then
      raise exception 'Customer was not found.';
    end if;

    if v_current_balance <> pg_catalog.trunc(v_current_balance)
      or v_current_balance not between -2147483648 and 2147483647 then
      raise exception using
        errcode = '22003',
        message = 'The customer balance requires financial reconciliation.';
    end if;

    v_next_balance := v_current_balance + v_payment.credits;
    if v_next_balance not between -2147483648 and 2147483647 then
      raise exception using
        errcode = '22003',
        message = 'The resulting balance is outside the supported range.';
    end if;

    insert into public.credit_payments (
      user_id,
      stripe_session_id,
      stripe_payment_intent,
      customer_email,
      package_id,
      credits,
      amount_total,
      currency,
      status
    )
    values (
      v_payment.user_id,
      v_payment.external_id,
      v_payment.provider_payment_id,
      coalesce(v_payment.customer_email, p_customer_email),
      v_payment.package_id,
      v_payment.credits,
      v_payment.amount_total,
      v_payment.currency,
      'paid'
    );

    update public.profiles
    set credit_balance = v_next_balance
    where id = v_payment.user_id;

    insert into public.credit_transactions (
      user_id,
      type,
      source_type,
      source_id,
      credits_delta,
      balance_after,
      description,
      amount_total,
      currency,
      metadata
    )
    values (
      v_payment.user_id,
      'purchase',
      'stripe_checkout',
      v_payment.external_id,
      v_payment.credits::integer,
      v_next_balance::integer,
      v_payment.credits::text || ' credits purchased via Stripe.',
      v_payment.amount_total::integer,
      v_payment.currency,
      pg_catalog.jsonb_build_object(
        'payment_record_id', v_payment.id,
        'stripe_session_id', v_payment.external_id,
        'stripe_payment_intent', v_payment.provider_payment_id,
        'package_id', v_payment.package_id,
        'purchase_type', v_payment.purchase_type
      )
    );
  end if;

  update public.payment_records
  set
    status = 'succeeded',
    credits_applied_at = coalesce(credits_applied_at, pg_catalog.now()),
    failure_code = null,
    failure_message = null,
    processing_claim_token = null,
    processing_started_at = null
  where id = v_payment.id
    and status = 'requires_review'
    and failure_code = 'stripe_credit_processing'
    and processing_claim_token = p_processing_claim_token
  returning credits_applied_at into v_applied_at;

  if not found then
    raise exception 'The Stripe payment claim changed during reconciliation.';
  end if;

  return pg_catalog.jsonb_build_object(
    'payment_id', v_payment.id,
    'credits_applied_at', v_applied_at,
    'duplicate', v_applied_payment.id is not null
  );
end;
$$;

create or replace function public.claim_payment_refund(
  p_actor_user_id uuid,
  p_payment_record_id uuid,
  p_refund_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payment_records%rowtype;
  v_stale_before timestamptz := pg_catalog.now() - interval '10 minutes';
  v_purchase_ledger_count bigint;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'This operation requires the service role.';
  end if;

  if p_actor_user_id is null or p_payment_record_id is null or p_refund_claim_token is null then
    raise exception using
      errcode = '22023',
      message = 'Refund claim input is invalid.';
  end if;

  perform 1
  from public.profiles as actor
  where actor.id = p_actor_user_id
    and (
      (actor.role = 'admin' and actor.staff_role = 'owner')
      or (
        actor.role = 'staff'
        and 'credits.manage' = any(actor.staff_permissions)
      )
    )
  for share;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  select payment.*
  into v_payment
  from public.payment_records as payment
  where payment.id = p_payment_record_id
  for update;

  if not found then
    raise exception 'Payment record was not found.';
  end if;

  if v_payment.provider <> 'stripe'
    or v_payment.payment_type <> 'credit_purchase' then
    raise exception 'Only Stripe credit purchases support automatic refunds.';
  end if;

  if v_payment.status = 'refunded' then
    if v_payment.provider_refund_id is null
      or not exists (
        select 1
        from public.credit_transactions as ledger
        where ledger.user_id = v_payment.user_id
          and ledger.type = 'refund'
          and ledger.source_type = v_payment.provider || '_refund'
          and ledger.source_id = v_payment.provider_refund_id
          and ledger.metadata ->> 'payment_record_id' = v_payment.id::text
      ) then
      raise exception 'The refunded payment requires ledger reconciliation.';
    end if;

    return pg_catalog.jsonb_build_object(
      'state', 'refunded',
      'payment_id', v_payment.id,
      'provider_refund_id', v_payment.provider_refund_id
    );
  end if;

  if v_payment.user_id is null
    or v_payment.external_id is null
    or v_payment.provider_payment_id is null
    or v_payment.credits <= 0
    or v_payment.credits <> pg_catalog.trunc(v_payment.credits)
    or v_payment.credits > 100000
    or v_payment.credits_applied_at is null
    or v_payment.amount_total is null
    or v_payment.amount_total <= 0
    or v_payment.amount_total > 2147483647
    or v_payment.currency is null
    or pg_catalog.lower(v_payment.currency) !~ '^[a-z]{3}$' then
    raise exception 'Payment has no valid reversible credit allocation.';
  end if;

  select pg_catalog.count(*)
  into v_purchase_ledger_count
  from public.credit_transactions as ledger
  where ledger.user_id = v_payment.user_id
    and ledger.type = 'purchase'
    and ledger.source_type = 'stripe_checkout'
    and ledger.source_id = v_payment.external_id
    and ledger.credits_delta::numeric = v_payment.credits
    and ledger.amount_total::numeric = v_payment.amount_total::numeric
    and pg_catalog.lower(ledger.currency) = pg_catalog.lower(v_payment.currency)
    and ledger.metadata ->> 'payment_record_id' = v_payment.id::text;

  if v_purchase_ledger_count <> 1 then
    raise exception 'The original payment ledger requires reconciliation before a provider refund.';
  end if;

  if exists (
    select 1
    from public.credit_transactions as ledger
    where ledger.type = 'refund'
      and ledger.metadata ->> 'payment_record_id' = v_payment.id::text
  ) then
    raise exception 'A refund ledger already exists and requires reconciliation before a provider refund.';
  end if;

  if v_payment.status = 'succeeded' then
    if v_payment.refund_claim_token is not null
      or v_payment.refund_started_at is not null
      or v_payment.provider_refund_id is not null then
      raise exception 'The refund state requires reconciliation.';
    end if;
  elsif v_payment.status = 'requires_review'
    and v_payment.failure_code in (
      'refund_processing',
      'refund_provider_failed',
      'refund_provider_pending',
      'refund_provider_succeeded',
      'refund_reconciliation_failed'
    ) then
    if v_payment.refund_claim_token is not null
      and v_payment.refund_started_at >= v_stale_before then
      raise exception using
        errcode = '55P03',
        message = 'This refund is already being processed.';
    end if;
  else
    raise exception 'Only successful or recoverable refund payments can be claimed.';
  end if;

  update public.payment_records
  set
    status = 'requires_review',
    failure_code = 'refund_processing',
    failure_message = null,
    refund_claim_token = p_refund_claim_token,
    refund_started_at = pg_catalog.now()
  where id = v_payment.id;

  return pg_catalog.jsonb_build_object(
    'state', 'claimed',
    'payment_id', v_payment.id,
    'provider', v_payment.provider,
    'external_id', v_payment.external_id,
    'provider_payment_id', v_payment.provider_payment_id,
    'provider_refund_id', v_payment.provider_refund_id,
    'user_id', v_payment.user_id,
    'credits', v_payment.credits,
    'amount_total', v_payment.amount_total,
    'currency', v_payment.currency,
    'payment_type', v_payment.payment_type,
    'credits_applied_at', v_payment.credits_applied_at
  );
end;
$$;

create or replace function public.admin_apply_payment_refund(
  p_actor_user_id uuid,
  p_payment_record_id uuid,
  p_provider_refund_id text,
  p_note text,
  p_refund_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payment_records%rowtype;
  v_purchase_ledger public.credit_transactions%rowtype;
  v_current_balance numeric;
  v_next_balance numeric;
  v_new_ledger_id uuid;
  v_existing_ledger_id uuid;
  v_existing_balance integer;
  v_provider_refund_id text := pg_catalog.btrim(p_provider_refund_id);
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'This operation requires the service role.';
  end if;

  if p_actor_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  perform 1
  from public.profiles as actor
  where actor.id = p_actor_user_id
    and (
      (actor.role = 'admin' and actor.staff_role = 'owner')
      or (
        actor.role = 'staff'
        and 'credits.manage' = any(actor.staff_permissions)
      )
    )
  for share;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  if p_payment_record_id is null
    or p_refund_claim_token is null
    or v_provider_refund_id is null
    or pg_catalog.length(v_provider_refund_id) not between 3 and 255
    or pg_catalog.length(coalesce(p_note, '')) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'Refund input is invalid.';
  end if;

  select payment.*
  into v_payment
  from public.payment_records as payment
  where payment.id = p_payment_record_id
  for update;

  if not found then
    raise exception 'Payment record was not found.';
  end if;

  if v_payment.provider <> 'stripe'
    or v_payment.payment_type <> 'credit_purchase' then
    raise exception 'Only Stripe credit purchases support automatic refunds.';
  end if;

  if v_payment.status = 'refunded' then
    if v_payment.provider_refund_id is distinct from v_provider_refund_id then
      raise exception 'The provider refund reference does not match the refunded payment.';
    end if;

    select ledger.id, ledger.balance_after
    into v_existing_ledger_id, v_existing_balance
    from public.credit_transactions as ledger
    where ledger.user_id = v_payment.user_id
      and ledger.type = 'refund'
      and ledger.source_type = v_payment.provider || '_refund'
      and ledger.source_id = v_provider_refund_id
      and ledger.metadata ->> 'payment_record_id' = v_payment.id::text
    limit 1;

    if not found then
      raise exception 'The refunded payment requires ledger reconciliation.';
    end if;

    return pg_catalog.jsonb_build_object(
      'ledger_id', v_existing_ledger_id,
      'balance_after', v_existing_balance,
      'duplicate', true
    );
  end if;

  if v_payment.status <> 'requires_review'
    or v_payment.failure_code <> 'refund_provider_succeeded'
    or v_payment.refund_claim_token is distinct from p_refund_claim_token
    or v_payment.refund_started_at is null
    or v_payment.provider_refund_id is distinct from v_provider_refund_id then
    raise exception 'The authoritative refund claim does not match.';
  end if;

  if v_payment.user_id is null
    or v_payment.credits <= 0
    or v_payment.credits <> pg_catalog.trunc(v_payment.credits)
    or v_payment.credits > 100000
    or v_payment.credits_applied_at is null
    or v_payment.amount_total is null
    or v_payment.amount_total <= 0
    or v_payment.amount_total > 2147483647 then
    raise exception 'Payment has no valid reversible credit allocation.';
  end if;

  select ledger.*
  into v_purchase_ledger
  from public.credit_transactions as ledger
  where ledger.user_id = v_payment.user_id
    and ledger.type = 'purchase'
    and ledger.metadata ->> 'payment_record_id' = v_payment.id::text
  limit 1;

  if not found
    or v_purchase_ledger.source_type is distinct from 'stripe_checkout'
    or v_purchase_ledger.source_id is distinct from v_payment.external_id
    or v_purchase_ledger.credits_delta::numeric is distinct from v_payment.credits
    or v_purchase_ledger.amount_total::numeric is distinct from v_payment.amount_total::numeric
    or pg_catalog.lower(v_purchase_ledger.currency) is distinct from pg_catalog.lower(v_payment.currency) then
    raise exception 'The original payment ledger requires reconciliation.';
  end if;

  if exists (
    select 1
    from public.credit_transactions as ledger
    where ledger.type = 'refund'
      and ledger.metadata ->> 'payment_record_id' = v_payment.id::text
  ) then
    raise exception 'A refund ledger already exists for this payment.';
  end if;

  select coalesce(profile.credit_balance, 0)
  into v_current_balance
  from public.profiles as profile
  where profile.id = v_payment.user_id
    and profile.role = 'customer'
  for update;

  if not found then
    raise exception 'Customer was not found.';
  end if;

  if v_current_balance <> pg_catalog.trunc(v_current_balance)
    or v_current_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The customer balance requires financial reconciliation.';
  end if;

  v_next_balance := v_current_balance - v_payment.credits;
  if v_next_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The resulting balance is outside the supported range.';
  end if;

  update public.profiles
  set credit_balance = v_next_balance
  where id = v_payment.user_id;

  insert into public.credit_transactions (
    user_id,
    type,
    source_type,
    source_id,
    credits_delta,
    balance_after,
    description,
    amount_total,
    currency,
    metadata,
    created_by
  )
  values (
    v_payment.user_id,
    'refund',
    v_payment.provider || '_refund',
    v_provider_refund_id,
    -v_payment.credits::integer,
    v_next_balance::integer,
    coalesce(
      nullif(pg_catalog.btrim(p_note), ''),
      'Payment refunded and purchased credits reversed.'
    ),
    -v_payment.amount_total::integer,
    v_payment.currency,
    pg_catalog.jsonb_build_object(
      'payment_record_id', v_payment.id,
      'provider_refund_id', v_provider_refund_id
    ),
    p_actor_user_id
  )
  returning id into v_new_ledger_id;

  update public.payment_records
  set
    status = 'refunded',
    refunded_at = pg_catalog.now(),
    reviewed_at = pg_catalog.now(),
    reviewed_by = p_actor_user_id,
    review_note = nullif(pg_catalog.btrim(p_note), ''),
    failure_code = null,
    failure_message = null,
    refund_claim_token = null,
    refund_started_at = null
  where id = v_payment.id
    and status = 'requires_review'
    and failure_code = 'refund_provider_succeeded'
    and refund_claim_token = p_refund_claim_token;

  if not found then
    raise exception 'The refund claim changed during reconciliation.';
  end if;

  insert into public.payment_event_log (
    payment_record_id,
    provider,
    event_type,
    status,
    message,
    payload
  )
  values (
    v_payment.id,
    v_payment.provider,
    'payment_refunded',
    'processed',
    'Provider refund completed and credits reversed.',
    pg_catalog.jsonb_build_object(
      'ledger_id', v_new_ledger_id,
      'provider_refund_id', v_provider_refund_id
    )
  );

  return pg_catalog.jsonb_build_object(
    'ledger_id', v_new_ledger_id,
    'balance_after', v_next_balance,
    'duplicate', false
  );
end;
$$;

-- Preserve the currently deployed server during the migration-first phase.
-- These overloads were hardened in 02443: both require service_role, lock the
-- authoritative payment row, and ignore caller-supplied financial authority.
-- They remain service-role-only until migration 02449 performs the post-deploy
-- cutover to the durable claim-bound signatures.
alter function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) owner to postgres;
alter function public.admin_apply_payment_refund(
  uuid, uuid, text, text
) owner to postgres;

revoke all privileges on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) from public, anon, authenticated;
revoke all privileges on function public.admin_apply_payment_refund(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) to service_role;
grant execute on function public.admin_apply_payment_refund(
  uuid, uuid, text, text
) to service_role;

alter function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text, uuid
) owner to postgres;
alter function public.claim_payment_refund(uuid, uuid, uuid) owner to postgres;
alter function public.admin_apply_payment_refund(
  uuid, uuid, text, text, uuid
) owner to postgres;

revoke all privileges on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text, uuid
) from public, anon, authenticated, service_role;
revoke all privileges on function public.claim_payment_refund(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all privileges on function public.admin_apply_payment_refund(
  uuid, uuid, text, text, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text, uuid
) to service_role;
grant execute on function public.claim_payment_refund(
  uuid, uuid, uuid
) to service_role;
grant execute on function public.admin_apply_payment_refund(
  uuid, uuid, text, text, uuid
) to service_role;

comment on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) is
  'Temporary service-role compatibility entry point using locked authoritative payment data. Revoke with migration 02449 after application deployment.';
comment on function public.admin_apply_payment_refund(
  uuid, uuid, text, text
) is
  'Temporary service-role compatibility entry point with explicit staff actor verification and locked authoritative rows. Revoke with migration 02449 after application deployment.';
comment on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text, uuid
) is
  'Service-role-only Stripe reconciliation bound to a durable claim; applies credits, ledger, and payment finalization atomically.';
comment on function public.claim_payment_refund(uuid, uuid, uuid) is
  'Service-role-only, staff-authorized refund claim with a ten-minute stale lease.';
comment on function public.admin_apply_payment_refund(
  uuid, uuid, text, text, uuid
) is
  'Service-role-only refund reversal bound to a verified provider refund and durable claim.';

commit;
