-- Emergency compatibility compensation after migration 02451.
-- Apply only when the application must be rolled back to the immediately
-- preceding build. This does not remove hardened schema or rewrite customer
-- data. It restores narrow upload/order/financial entry points by delegating
-- financial writes to the claim-bound implementations installed by migrations
-- 02443-02446. Direct admin profile and delivery-ETA writes remain fail-closed;
-- this script never restores broad profiles/orders table grants.

begin;

create or replace function public.staff_adjust_customer_credits(
  p_customer_id uuid,
  p_amount numeric,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.has_staff_permission('credits.manage') then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  return public.staff_adjust_customer_credits(
    p_customer_id,
    p_amount,
    p_note,
    pg_catalog.gen_random_uuid()
  );
end;
$$;

create or replace function public.add_credits_from_stripe(
  p_user_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent text,
  p_customer_email text,
  p_package_id text,
  p_credits numeric,
  p_amount_total numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payment_records%rowtype;
  v_claim_token uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'This operation requires the service role.';
  end if;

  select payment.*
  into v_payment
  from public.payment_records as payment
  where payment.provider = 'stripe'
    and payment.external_id = pg_catalog.btrim(p_stripe_session_id)
  for update;

  if not found
    or v_payment.payment_type <> 'credit_purchase'
    or v_payment.user_id is distinct from p_user_id
    or v_payment.provider_payment_id
      is distinct from pg_catalog.btrim(p_stripe_payment_intent)
    or v_payment.package_id is distinct from p_package_id
    or v_payment.credits is distinct from p_credits
    or v_payment.amount_total::numeric is distinct from p_amount_total
    or pg_catalog.lower(v_payment.currency)
      is distinct from pg_catalog.lower(pg_catalog.btrim(p_currency)) then
    raise exception using
      errcode = '22023',
      message = 'Stripe reconciliation does not match the authoritative payment record.';
  end if;

  if v_payment.status = 'succeeded'
    and v_payment.credits_applied_at is not null
    and exists (
      select 1
      from public.credit_payments as applied
      where applied.stripe_session_id = v_payment.external_id
        and applied.user_id = v_payment.user_id
        and applied.stripe_payment_intent = v_payment.provider_payment_id
        and applied.package_id is not distinct from v_payment.package_id
        and applied.credits is not distinct from v_payment.credits
        and applied.amount_total::numeric is not distinct from v_payment.amount_total::numeric
        and pg_catalog.lower(applied.currency) = pg_catalog.lower(v_payment.currency)
        and applied.status = 'paid'
    ) then
    return;
  end if;

  if not (
    v_payment.status = 'pending' and v_payment.failure_code is null
    or v_payment.status = 'requires_review'
      and v_payment.failure_code = 'stripe_credit_processing'
  ) then
    raise exception 'The Stripe payment is not in a recoverable credit state.';
  end if;

  v_claim_token := coalesce(
    v_payment.processing_claim_token,
    pg_catalog.gen_random_uuid()
  );

  update public.payment_records
  set
    status = 'requires_review',
    failure_code = 'stripe_credit_processing',
    failure_message = null,
    processing_claim_token = v_claim_token,
    processing_started_at = coalesce(processing_started_at, pg_catalog.now())
  where id = v_payment.id;

  perform public.add_credits_from_stripe(
    p_user_id,
    p_stripe_session_id,
    p_stripe_payment_intent,
    p_customer_email,
    p_package_id,
    p_credits,
    p_amount_total,
    p_currency,
    v_claim_token
  );
end;
$$;

create or replace function public.admin_apply_payment_refund(
  p_actor_user_id uuid,
  p_payment_record_id uuid,
  p_provider_refund_id text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payment_records%rowtype;
  v_claim_token uuid;
  v_provider_refund_id text := pg_catalog.btrim(p_provider_refund_id);
  v_result jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'This operation requires the service role.';
  end if;

  select payment.*
  into v_payment
  from public.payment_records as payment
  where payment.id = p_payment_record_id
  for update;

  if not found
    or v_payment.provider <> 'stripe'
    or v_payment.payment_type <> 'credit_purchase'
    or v_provider_refund_id is null
    or pg_catalog.length(v_provider_refund_id) not between 3 and 255
    or v_payment.provider_refund_id is not null
      and v_payment.provider_refund_id <> v_provider_refund_id then
    raise exception using
      errcode = '22023',
      message = 'Refund recovery does not match the authoritative payment record.';
  end if;

  v_claim_token := coalesce(
    v_payment.refund_claim_token,
    pg_catalog.gen_random_uuid()
  );

  if v_payment.status <> 'refunded' then
    if not (
      v_payment.status = 'succeeded'
      or v_payment.status = 'requires_review'
        and v_payment.failure_code in (
          'refund_processing',
          'refund_provider_succeeded'
        )
    ) then
      raise exception 'The payment is not in a recoverable refund state.';
    end if;

    update public.payment_records
    set
      status = 'requires_review',
      failure_code = 'refund_provider_succeeded',
      failure_message = null,
      provider_refund_id = v_provider_refund_id,
      refund_claim_token = v_claim_token,
      refund_started_at = coalesce(refund_started_at, pg_catalog.now())
    where id = v_payment.id;
  end if;

  select public.admin_apply_payment_refund(
    p_actor_user_id,
    p_payment_record_id,
    v_provider_refund_id,
    p_note,
    v_claim_token
  ) into v_result;

  return v_result;
end;
$$;

alter function public.staff_adjust_customer_credits(uuid, numeric, text)
  owner to postgres;
alter function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) owner to postgres;
alter function public.admin_apply_payment_refund(uuid, uuid, text, text)
  owner to postgres;

revoke all privileges on function public.staff_adjust_customer_credits(
  uuid, numeric, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.admin_apply_payment_refund(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.staff_adjust_customer_credits(
  uuid, numeric, text
) to authenticated;
grant execute on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) to service_role;
grant execute on function public.admin_apply_payment_refund(
  uuid, uuid, text, text
) to service_role;
grant execute on function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) to authenticated;

drop policy if exists "MG customer files legacy owner insert" on storage.objects;
drop policy if exists "MG file expert legacy owner insert" on storage.objects;
drop policy if exists "MG protected buckets insert boundary" on storage.objects;

create policy "MG customer files legacy owner insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "MG file expert legacy owner insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'file-expert'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "MG protected buckets insert boundary"
on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id not in ('customer-files', 'file-expert')
  or (
    bucket_id = 'customer-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_staff_permission('files.upload')
    )
  )
  or (
    bucket_id = 'file-expert'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

comment on function public.staff_adjust_customer_credits(
  uuid, numeric, text
) is 'Emergency rollback compatibility wrapper; remove again after the hardened application is restored.';
comment on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) is 'Emergency rollback compatibility wrapper delegating to the durable Stripe claim implementation.';
comment on function public.admin_apply_payment_refund(
  uuid, uuid, text, text
) is 'Emergency rollback compatibility wrapper delegating to the durable refund claim implementation.';

commit;
