begin;

-- Desktop request idempotency must be claimed in the same transaction as the
-- credit debit and order insert. An HTTP preflight alone is vulnerable to two
-- concurrent finalize requests.
create table public.desktop_request_idempotency (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  upload_session_id text not null,
  request_payload jsonb not null,
  order_id uuid references public.orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, idempotency_key),
  constraint desktop_request_idempotency_key_check
    check (
      pg_catalog.length(idempotency_key) between 12 and 96
      and idempotency_key ~ '^[A-Za-z0-9._-]+$'
    ),
  constraint desktop_request_upload_session_check
    check (pg_catalog.length(upload_session_id) between 12 and 140)
);

alter table public.desktop_request_idempotency enable row level security;
revoke all privileges on table public.desktop_request_idempotency
  from public, anon, authenticated;
grant all privileges on table public.desktop_request_idempotency to service_role;

-- The authenticated RPC is reachable through the Data API, so a successful
-- Next.js file/app/integrity check must mint an unguessable, single-use
-- approval before a new desktop claim can be created.
create table public.desktop_request_approvals (
  approval_token uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  request_payload jsonb not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint desktop_request_approval_key_check
    check (
      pg_catalog.length(idempotency_key) between 12 and 96
      and idempotency_key ~ '^[A-Za-z0-9._-]+$'
    ),
  constraint desktop_request_approval_expiry_check
    check (expires_at > created_at)
);

create index desktop_request_approvals_expiry_idx
  on public.desktop_request_approvals(expires_at)
  where consumed_at is null;

alter table public.desktop_request_approvals enable row level security;
revoke all privileges on table public.desktop_request_approvals
  from public, anon, authenticated;
grant all privileges on table public.desktop_request_approvals to service_role;

create or replace function public.create_desktop_order_with_credit_deduction(
  p_idempotency_key text,
  p_approval_token uuid,
  p_upload_session_id text,
  p_customer_email text,
  p_vehicle_brand text,
  p_vehicle_model text,
  p_vehicle_generation text,
  p_vehicle_engine text,
  p_service_type text,
  p_credits_required integer,
  p_notes text,
  p_ecu text,
  p_gearbox text,
  p_vehicle_year text,
  p_read_method text,
  p_license_plate text,
  p_hw_sw text,
  p_master_slave text,
  p_uploaded_file_name text,
  p_original_file_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_clean_key text := pg_catalog.btrim(p_idempotency_key);
  v_clean_session text := pg_catalog.btrim(p_upload_session_id);
  v_payload jsonb;
  v_claim public.desktop_request_idempotency%rowtype;
  v_approval public.desktop_request_approvals%rowtype;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if v_clean_key is null
    or pg_catalog.length(v_clean_key) not between 12 and 96
    or v_clean_key !~ '^[A-Za-z0-9._-]+$'
    or p_approval_token is null
    or v_clean_session is null
    or pg_catalog.length(v_clean_session) not between 12 and 140 then
    raise exception using
      errcode = '22023',
      message = 'Desktop idempotency input is invalid.';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'upload_session_id', v_clean_session,
    'customer_email', p_customer_email,
    'vehicle_brand', p_vehicle_brand,
    'vehicle_model', p_vehicle_model,
    'vehicle_generation', p_vehicle_generation,
    'vehicle_engine', p_vehicle_engine,
    'service_type', p_service_type,
    'credits_required', p_credits_required,
    'notes', p_notes,
    'ecu', p_ecu,
    'gearbox', p_gearbox,
    'vehicle_year', p_vehicle_year,
    'read_method', p_read_method,
    'license_plate', p_license_plate,
    'hw_sw', p_hw_sw,
    'master_slave', p_master_slave,
    'uploaded_file_name', p_uploaded_file_name,
    'original_file_path', p_original_file_path
  );

  insert into public.desktop_request_idempotency (
    user_id,
    idempotency_key,
    upload_session_id,
    request_payload
  )
  values (
    v_user_id,
    v_clean_key,
    v_clean_session,
    v_payload
  )
  on conflict (user_id, idempotency_key) do nothing
  returning * into v_claim;

  if not found then
    select claim.*
    into v_claim
    from public.desktop_request_idempotency as claim
    where claim.user_id = v_user_id
      and claim.idempotency_key = v_clean_key
    for update;

    if not found
      or v_claim.upload_session_id is distinct from v_clean_session
      or v_claim.request_payload is distinct from v_payload then
      raise exception using
        errcode = '22023',
        message = 'The idempotency key is already bound to another desktop request.';
    end if;

    if v_claim.order_id is null then
      raise exception using
        errcode = '55000',
        message = 'The desktop request claim is incomplete and requires review.';
    end if;

    return pg_catalog.jsonb_build_object(
      'order_id', v_claim.order_id,
      'duplicate', true
    );
  end if;

  select approval.*
  into v_approval
  from public.desktop_request_approvals as approval
  where approval.approval_token = p_approval_token
    and approval.user_id = v_user_id
    and approval.idempotency_key = v_clean_key
  for update;

  if not found
    or v_approval.request_payload is distinct from v_payload
    or v_approval.expires_at <= pg_catalog.now()
    or v_approval.consumed_at is not null then
    raise exception using
      errcode = '42501',
      message = 'A valid server-approved desktop request is required.';
  end if;

  update public.desktop_request_approvals
  set consumed_at = pg_catalog.now()
  where approval_token = p_approval_token
    and consumed_at is null;

  if not found then
    raise exception using
      errcode = '55P03',
      message = 'The desktop request approval is already being consumed.';
  end if;

  v_order_id := public.create_order_with_credit_deduction(
    p_customer_email,
    p_vehicle_brand,
    p_vehicle_model,
    p_vehicle_generation,
    p_vehicle_engine,
    p_service_type,
    p_credits_required,
    p_notes,
    p_ecu,
    p_gearbox,
    p_vehicle_year,
    p_read_method,
    p_license_plate,
    p_hw_sw,
    p_master_slave,
    p_uploaded_file_name,
    p_original_file_path
  );

  update public.desktop_request_idempotency
  set
    order_id = v_order_id,
    completed_at = pg_catalog.now()
  where user_id = v_user_id
    and idempotency_key = v_clean_key
    and order_id is null;

  if not found then
    raise exception 'The desktop request idempotency claim could not be finalized.';
  end if;

  return pg_catalog.jsonb_build_object(
    'order_id', v_order_id,
    'duplicate', false
  );
end;
$$;

alter function public.create_desktop_order_with_credit_deduction(
  text, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) owner to postgres;
revoke all privileges on function public.create_desktop_order_with_credit_deduction(
  text, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_desktop_order_with_credit_deduction(
  text, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) to authenticated;

-- Browser retries use a stable submission key and claim it in the same
-- transaction as the authoritative credit debit and order insert. This makes
-- a committed request safe to retry after a lost HTTP response.
create table public.web_request_idempotency (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  request_payload jsonb not null,
  order_id uuid references public.orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, idempotency_key),
  constraint web_request_idempotency_key_check
    check (
      pg_catalog.length(idempotency_key) between 12 and 96
      and idempotency_key ~ '^[A-Za-z0-9._-]+$'
    )
);

alter table public.web_request_idempotency enable row level security;
revoke all privileges on table public.web_request_idempotency
  from public, anon, authenticated;
grant all privileges on table public.web_request_idempotency to service_role;

create or replace function public.create_web_order_with_credit_deduction(
  p_idempotency_key text,
  p_customer_email text,
  p_vehicle_brand text,
  p_vehicle_model text,
  p_vehicle_generation text,
  p_vehicle_engine text,
  p_service_type text,
  p_credits_required integer,
  p_notes text,
  p_ecu text,
  p_gearbox text,
  p_vehicle_year text,
  p_read_method text,
  p_license_plate text,
  p_hw_sw text,
  p_master_slave text,
  p_uploaded_file_name text,
  p_original_file_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_clean_key text := pg_catalog.btrim(p_idempotency_key);
  v_payload jsonb;
  v_claim public.web_request_idempotency%rowtype;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if v_clean_key is null
    or pg_catalog.length(v_clean_key) not between 12 and 96
    or v_clean_key !~ '^[A-Za-z0-9._-]+$' then
    raise exception using
      errcode = '22023',
      message = 'Web request idempotency key is invalid.';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'customer_email', p_customer_email,
    'vehicle_brand', p_vehicle_brand,
    'vehicle_model', p_vehicle_model,
    'vehicle_generation', p_vehicle_generation,
    'vehicle_engine', p_vehicle_engine,
    'service_type', p_service_type,
    'credits_required', p_credits_required,
    'notes', p_notes,
    'ecu', p_ecu,
    'gearbox', p_gearbox,
    'vehicle_year', p_vehicle_year,
    'read_method', p_read_method,
    'license_plate', p_license_plate,
    'hw_sw', p_hw_sw,
    'master_slave', p_master_slave,
    'uploaded_file_name', p_uploaded_file_name,
    'original_file_path', p_original_file_path
  );

  insert into public.web_request_idempotency (
    user_id,
    idempotency_key,
    request_payload
  )
  values (
    v_user_id,
    v_clean_key,
    v_payload
  )
  on conflict (user_id, idempotency_key) do nothing
  returning * into v_claim;

  if not found then
    select claim.*
    into v_claim
    from public.web_request_idempotency as claim
    where claim.user_id = v_user_id
      and claim.idempotency_key = v_clean_key
    for update;

    if not found or v_claim.request_payload is distinct from v_payload then
      raise exception using
        errcode = '22023',
        message = 'The idempotency key is already bound to another web request.';
    end if;

    if v_claim.order_id is null then
      raise exception using
        errcode = '55000',
        message = 'The web request claim is incomplete and requires review.';
    end if;

    return pg_catalog.jsonb_build_object(
      'order_id', v_claim.order_id,
      'duplicate', true
    );
  end if;

  v_order_id := public.create_order_with_credit_deduction(
    p_customer_email,
    p_vehicle_brand,
    p_vehicle_model,
    p_vehicle_generation,
    p_vehicle_engine,
    p_service_type,
    p_credits_required,
    p_notes,
    p_ecu,
    p_gearbox,
    p_vehicle_year,
    p_read_method,
    p_license_plate,
    p_hw_sw,
    p_master_slave,
    p_uploaded_file_name,
    p_original_file_path
  );

  update public.web_request_idempotency
  set
    order_id = v_order_id,
    completed_at = pg_catalog.now()
  where user_id = v_user_id
    and idempotency_key = v_clean_key
    and order_id is null;

  if not found then
    raise exception 'The web request idempotency claim could not be finalized.';
  end if;

  return pg_catalog.jsonb_build_object(
    'order_id', v_order_id,
    'duplicate', false
  );
end;
$$;

alter function public.create_web_order_with_credit_deduction(
  text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) owner to postgres;
revoke all privileges on function public.create_web_order_with_credit_deduction(
  text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_web_order_with_credit_deduction(
  text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) to authenticated;

-- Keep the hardened base RPC available only to authenticated callers until
-- the new web/desktop wrappers are deployed. It is caller-bound, row-locked
-- and server-priced, so the short compatibility window does not restore the
-- former authority flaw. Migration 02449 removes this direct Data API entry.
revoke all privileges on function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) from public, anon, service_role;
grant execute on function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) to authenticated;

-- File Expert claims carry an owner token and recoverable lease. A crashed
-- worker cannot leave a job permanently stuck, and an older worker cannot
-- overwrite a claim that was safely recovered by a later request.
alter table public.file_expert_jobs
  add column if not exists analysis_claim_token uuid,
  add column if not exists analysis_started_at timestamptz;

create index if not exists file_expert_jobs_processing_lease_idx
  on public.file_expert_jobs(analysis_started_at)
  where status = 'processing';

-- Widget checkout attempts are recoverable and webhook state transitions carry
-- a monotonic Stripe event watermark.
alter table public.widget_clients
  add column if not exists stripe_checkout_session_id text,
  add column if not exists checkout_pending_until timestamptz,
  add column if not exists stripe_last_event_created bigint not null default 0,
  add column if not exists stripe_last_event_id text;

create index if not exists widget_clients_pending_checkout_idx
  on public.widget_clients(checkout_pending_until)
  where status = 'pending'
    and stripe_customer_id is null
    and stripe_subscription_id is null;

alter table public.widget_webhook_events
  add column if not exists processing_state text not null default 'processed',
  add constraint widget_webhook_events_processing_state_check
    check (processing_state in ('processing', 'processed'));

commit;
