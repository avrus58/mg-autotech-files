begin;

-- The canonical catalog intentionally includes zero-credit combinations:
-- `Only Options` can be submitted alone or with the zero-credit
-- `Special Request / Other` extra. Migration 02443 accidentally rejected that
-- existing product contract after resolving the authoritative catalog total.
-- Keep the same parser and catalog authority, but allow an exact total of zero.
create or replace function public.resolve_request_service_credits(
  p_service_summary text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_remaining text := pg_catalog.btrim(p_service_summary);
  v_match public.request_service_catalog%rowtype;
  v_seen_extra_ids text[] := '{}'::text[];
  v_total integer := 0;
begin
  if v_remaining is null
    or pg_catalog.length(v_remaining) = 0
    or pg_catalog.length(v_remaining) > 4096 then
    raise exception using
      errcode = '22023',
      message = 'A valid service selection is required.';
  end if;

  select catalog.*
  into v_match
  from public.request_service_catalog as catalog
  where catalog.active
    and catalog.service_kind = 'primary'
    and (
      v_remaining = catalog.service_title
      or pg_catalog.left(
        v_remaining,
        pg_catalog.length(catalog.service_title) + 3
      ) = catalog.service_title || ' + '
    )
  order by pg_catalog.length(catalog.service_title) desc
  limit 1;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'The primary service is not in the server catalog.';
  end if;

  v_total := v_match.credits;
  if v_remaining = v_match.service_title then
    v_remaining := '';
  else
    v_remaining := pg_catalog.substr(
      v_remaining,
      pg_catalog.length(v_match.service_title) + 4
    );
  end if;

  while pg_catalog.length(v_remaining) > 0 loop
    select catalog.*
    into v_match
    from public.request_service_catalog as catalog
    where catalog.active
      and catalog.service_kind = 'extra'
      and (
        v_remaining = catalog.service_title
        or pg_catalog.left(
          v_remaining,
          pg_catalog.length(catalog.service_title) + 3
        ) = catalog.service_title || ' + '
      )
    order by pg_catalog.length(catalog.service_title) desc
    limit 1;

    if not found then
      raise exception using
        errcode = '22023',
        message = 'A selected extra service is not in the server catalog.';
    end if;

    if v_match.service_id = any(v_seen_extra_ids) then
      raise exception using
        errcode = '22023',
        message = 'Duplicate extra services are not allowed.';
    end if;

    if v_total > 100000 - v_match.credits then
      raise exception using
        errcode = '22003',
        message = 'The calculated credit amount is outside the supported range.';
    end if;

    v_seen_extra_ids := pg_catalog.array_append(
      v_seen_extra_ids,
      v_match.service_id
    );
    v_total := v_total + v_match.credits;

    if v_remaining = v_match.service_title then
      v_remaining := '';
    else
      v_remaining := pg_catalog.substr(
        v_remaining,
        pg_catalog.length(v_match.service_title) + 4
      );
    end if;
  end loop;

  if v_total < 0 then
    raise exception using
      errcode = '22023',
      message = 'The selected services have an invalid negative credit amount.';
  end if;

  return v_total;
end;
$$;

comment on function public.resolve_request_service_credits(text) is
  'Private resolver for exact web/desktop service summaries. Catalog-valid totals may be zero; negative totals are rejected.';

-- A zero-credit order is an operational request, not a financial event. The
-- trigger therefore writes no zero-delta usage row. Positive orders preserve
-- the exact 02443 debit marker, balance projection and one-row ledger contract.
create or replace function public.log_order_credit_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance_after integer;
begin
  if coalesce(
    pg_catalog.current_setting(
      'mg_autotech.order_credit_debit',
      true
    ),
    ''
  ) <> 'authorized' then
    return new;
  end if;

  if new.customer_id is null
    or new.credits_required is null
    or new.credits_required < 0
    or new.credits_required > 100000
    or new.credits_required <> pg_catalog.trunc(new.credits_required) then
    raise exception using
      errcode = '22023',
      message = 'Order credit usage is invalid.';
  end if;

  if new.credits_required = 0 then
    return new;
  end if;

  select profile.credit_balance::integer
  into v_balance_after
  from public.profiles as profile
  where profile.id = new.customer_id
    and profile.role = 'customer';

  if not found then
    raise exception 'Customer profile was not found for the order ledger.';
  end if;

  insert into public.credit_transactions (
    user_id,
    type,
    source_type,
    source_id,
    credits_delta,
    balance_after,
    description,
    metadata,
    created_by,
    created_at
  )
  values (
    new.customer_id,
    'usage',
    'order',
    new.id::text,
    -new.credits_required::integer,
    v_balance_after,
    'File request: '
      || coalesce(new.vehicle_brand, 'Vehicle')
      || ' '
      || coalesce(new.vehicle_model, '')
      || case
        when new.service_type is not null
          then ' - ' || new.service_type
        else ''
      end,
    pg_catalog.jsonb_build_object(
      'order_id', new.id,
      'vehicle_brand', new.vehicle_brand,
      'vehicle_model', new.vehicle_model,
      'service_type', new.service_type,
      'status', new.status
    ),
    new.customer_id,
    coalesce(new.created_at, pg_catalog.now())
  );

  return new;
end;
$$;

-- Preserve every caller, identity, e-mail, Storage, catalog, account and
-- balance check from the hardened core. Only the exact catalog-authoritative
-- zero branch skips the profile UPDATE and debit marker.
create or replace function public.create_order_with_credit_deduction(
  p_customer_email text,
  p_vehicle_brand text,
  p_vehicle_model text,
  p_vehicle_generation text,
  p_vehicle_engine text,
  p_service_type text,
  p_credits_required integer,
  p_notes text,
  p_ecu text default null,
  p_gearbox text default null,
  p_vehicle_year text default null,
  p_read_method text default null,
  p_license_plate text default null,
  p_hw_sw text default null,
  p_master_slave text default null,
  p_uploaded_file_name text default null,
  p_original_file_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_customer_email text;
  v_email_confirmed_at timestamptz;
  v_account_status text;
  v_balance numeric;
  v_allow_negative boolean;
  v_negative_limit numeric;
  v_expected_credits integer;
  v_new_balance numeric;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if p_credits_required is null
    or p_credits_required < 0
    or p_credits_required > 100000 then
    raise exception using
      errcode = '22023',
      message = 'The client credit amount is outside the supported range.';
  end if;

  if p_vehicle_brand is null
    or pg_catalog.length(pg_catalog.btrim(p_vehicle_brand)) not between 1 and 200
    or p_vehicle_model is null
    or pg_catalog.length(pg_catalog.btrim(p_vehicle_model)) not between 1 and 200
    or p_vehicle_engine is null
    or pg_catalog.length(pg_catalog.btrim(p_vehicle_engine)) not between 1 and 240 then
    raise exception using
      errcode = '22023',
      message = 'Valid vehicle brand, model and engine values are required.';
  end if;

  if pg_catalog.length(coalesce(p_vehicle_generation, '')) > 240
    or pg_catalog.length(coalesce(p_notes, '')) > 20000
    or pg_catalog.length(coalesce(p_ecu, '')) > 200
    or pg_catalog.length(coalesce(p_gearbox, '')) > 200
    or pg_catalog.length(coalesce(p_vehicle_year, '')) > 32
    or pg_catalog.length(coalesce(p_read_method, '')) > 120
    or pg_catalog.length(coalesce(p_license_plate, '')) > 80
    or pg_catalog.length(coalesce(p_hw_sw, '')) > 500
    or pg_catalog.length(coalesce(p_master_slave, '')) > 16
    or pg_catalog.length(coalesce(p_uploaded_file_name, '')) > 255
    or pg_catalog.length(coalesce(p_original_file_path, '')) > 1024 then
    raise exception using
      errcode = '22023',
      message = 'One or more request fields exceed their supported length.';
  end if;

  if nullif(pg_catalog.btrim(coalesce(p_master_slave, '')), '') is not null
    and pg_catalog.lower(pg_catalog.btrim(p_master_slave)) not in ('master', 'slave') then
    raise exception using
      errcode = '22023',
      message = 'Master/slave selection is invalid.';
  end if;

  if p_original_file_path is not null
    and pg_catalog.btrim(p_original_file_path) <> ''
    and pg_catalog.left(
      p_original_file_path,
      pg_catalog.length(v_user_id::text) + 1
    ) <> (v_user_id::text || '/') then
    raise exception using
      errcode = '42501',
      message = 'The uploaded file path is not bound to the authenticated user.';
  end if;

  if p_original_file_path is not null
    and pg_catalog.btrim(p_original_file_path) <> ''
    and not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'customer-files'
        and object.name = pg_catalog.btrim(p_original_file_path)
    ) then
    raise exception using
      errcode = '22023',
      message = 'The uploaded file does not exist in private storage.';
  end if;

  v_expected_credits := public.resolve_request_service_credits(p_service_type);
  if p_credits_required <> v_expected_credits then
    raise exception using
      errcode = '22023',
      message = 'The request credits do not match the server catalog.';
  end if;

  select
    coalesce(profile.credit_balance, 0),
    coalesce(profile.allow_negative_credits, false),
    coalesce(profile.negative_credit_limit, 0),
    coalesce(profile.account_status, 'active'),
    coalesce(
      nullif(pg_catalog.btrim(auth_user.email), ''),
      nullif(pg_catalog.btrim(profile.email), '')
    ),
    coalesce(auth_user.email_confirmed_at, auth_user.confirmed_at)
  into
    v_balance,
    v_allow_negative,
    v_negative_limit,
    v_account_status,
    v_customer_email,
    v_email_confirmed_at
  from public.profiles as profile
  left join auth.users as auth_user on auth_user.id = profile.id
  where profile.id = v_user_id
    and profile.role = 'customer'
  for update of profile;

  if not found then
    raise exception 'Customer profile was not found.';
  end if;

  if v_customer_email is null or v_email_confirmed_at is null then
    raise exception using
      errcode = '42501',
      message = 'The authenticated account has no verified e-mail address.';
  end if;

  if p_customer_email is not null
    and pg_catalog.btrim(p_customer_email) <> ''
    and pg_catalog.lower(pg_catalog.btrim(p_customer_email))
      <> pg_catalog.lower(v_customer_email) then
    raise exception using
      errcode = '42501',
      message = 'The request e-mail is not bound to the authenticated user.';
  end if;

  if v_account_status <> 'active' then
    raise exception using
      errcode = '42501',
      message = 'The customer account is not active.';
  end if;

  if v_balance <> pg_catalog.trunc(v_balance)
    or v_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The customer balance requires financial reconciliation.';
  end if;

  if v_negative_limit <> pg_catalog.trunc(v_negative_limit)
    or v_negative_limit not between 0 and 100000 then
    raise exception using
      errcode = '22003',
      message = 'The negative credit limit requires financial reconciliation.';
  end if;

  if not v_allow_negative and v_balance < v_expected_credits then
    raise exception 'Insufficient credits.';
  end if;

  if v_allow_negative
    and v_balance - v_expected_credits < 0 - v_negative_limit then
    raise exception 'Negative credit limit exceeded.';
  end if;

  v_new_balance := v_balance - v_expected_credits;
  if v_new_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The resulting credit balance is outside the supported range.';
  end if;

  if v_expected_credits > 0 then
    perform pg_catalog.set_config(
      'mg_autotech.profile_financial_write',
      'order_debit',
      true
    );
    update public.profiles
    set credit_balance = v_new_balance
    where id = v_user_id;
    perform pg_catalog.set_config(
      'mg_autotech.profile_financial_write',
      '',
      true
    );

    perform pg_catalog.set_config(
      'mg_autotech.order_credit_debit',
      'authorized',
      true
    );
  end if;

  insert into public.orders (
    customer_id,
    customer_email,
    vehicle_brand,
    vehicle_model,
    vehicle_generation,
    vehicle_engine,
    service_type,
    credits_required,
    status,
    notes,
    ecu,
    gearbox,
    vehicle_year,
    read_method,
    license_plate,
    hw_sw,
    master_slave,
    uploaded_file_name,
    original_file_path
  )
  values (
    v_user_id,
    v_customer_email,
    pg_catalog.btrim(p_vehicle_brand),
    pg_catalog.btrim(p_vehicle_model),
    nullif(pg_catalog.btrim(p_vehicle_generation), ''),
    pg_catalog.btrim(p_vehicle_engine),
    pg_catalog.btrim(p_service_type),
    v_expected_credits,
    'new_request',
    coalesce(nullif(pg_catalog.btrim(p_notes), ''), '-'),
    nullif(pg_catalog.btrim(p_ecu), ''),
    nullif(pg_catalog.btrim(p_gearbox), ''),
    nullif(pg_catalog.btrim(p_vehicle_year), ''),
    nullif(pg_catalog.btrim(p_read_method), ''),
    nullif(pg_catalog.btrim(p_license_plate), ''),
    nullif(pg_catalog.btrim(p_hw_sw), ''),
    nullif(pg_catalog.btrim(p_master_slave), ''),
    nullif(pg_catalog.btrim(p_uploaded_file_name), ''),
    nullif(pg_catalog.btrim(p_original_file_path), '')
  )
  returning id into v_order_id;

  if v_expected_credits > 0 then
    perform pg_catalog.set_config(
      'mg_autotech.order_credit_debit',
      '',
      true
    );
  end if;

  return v_order_id;
end;
$$;

comment on function public.create_order_with_credit_deduction(
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) is
  'Private caller-bound order core. Catalog-valid zero totals create an order without a profile debit or usage ledger row.';

alter function public.resolve_request_service_credits(text) owner to postgres;
alter function public.log_order_credit_usage() owner to postgres;
alter function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) owner to postgres;

revoke all privileges on function public.resolve_request_service_credits(text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.log_order_credit_usage()
  from public, anon, authenticated, service_role;

-- Deliberately do not change the core function ACL here. CREATE OR REPLACE
-- preserves it: selected live pre-02452 release keeps the authenticated legacy
-- app grant, while existing staging or fresh lexical replay after 02452 keeps
-- that grant revoked. Only migration 02452 owns the authenticated cutover.

commit;
