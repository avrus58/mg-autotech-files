-- MG AutoTech Payment & Revenue Control Center
-- Additive, idempotent and non-destructive. Run in Supabase SQL Editor.

begin;

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'paypal', 'bank')),
  external_id text not null,
  provider_payment_id text,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in (
    'pending', 'succeeded', 'failed', 'cancelled', 'requires_review', 'refunded'
  )),
  payment_type text not null default 'credit_purchase' check (payment_type in (
    'credit_purchase', 'manual_bank'
  )),
  credits numeric(12,2) not null default 0 check (credits >= 0),
  amount_total bigint,
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  customer_email text,
  package_id text,
  purchase_type text,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  credits_applied_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table if not exists public.payment_event_log (
  id uuid primary key default gen_random_uuid(),
  payment_record_id uuid references public.payment_records(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'paypal', 'bank')),
  external_event_id text,
  event_type text not null,
  status text not null check (status in ('received', 'processed', 'failed', 'info')),
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists payment_event_log_provider_event_unique
  on public.payment_event_log(provider, external_event_id)
  where external_event_id is not null;
create index if not exists payment_records_created_idx
  on public.payment_records(created_at desc);
create index if not exists payment_records_status_idx
  on public.payment_records(status, created_at desc);
create index if not exists payment_records_user_idx
  on public.payment_records(user_id, created_at desc);
create index if not exists payment_event_log_created_idx
  on public.payment_event_log(created_at desc);

create or replace function public.set_payment_record_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_payment_record_updated_at_trigger on public.payment_records;
create trigger set_payment_record_updated_at_trigger
before update on public.payment_records
for each row execute function public.set_payment_record_updated_at();

alter table public.payment_records enable row level security;
alter table public.payment_event_log enable row level security;

drop policy if exists "Finance staff can read payment records" on public.payment_records;
create policy "Finance staff can read payment records"
on public.payment_records for select to authenticated
using (public.has_staff_permission('credits.manage'));

drop policy if exists "Finance staff can read payment event log" on public.payment_event_log;
create policy "Finance staff can read payment event log"
on public.payment_event_log for select to authenticated
using (public.has_staff_permission('credits.manage'));

create or replace function public.admin_record_bank_payment(
  p_actor_user_id uuid,
  p_customer_user_id uuid,
  p_reference text,
  p_credits numeric,
  p_amount_total bigint,
  p_currency text default 'eur',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance numeric;
  next_balance numeric;
  new_payment_id uuid;
  new_ledger_id uuid;
  clean_reference text := trim(p_reference);
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_user_id
      and ((role = 'admin' and staff_role = 'owner')
        or (role = 'staff' and 'credits.manage' = any(staff_permissions)))
  ) then
    raise exception 'Credit management permission is required.';
  end if;
  if clean_reference = '' or length(clean_reference) < 3 then
    raise exception 'A valid bank reference is required.';
  end if;
  if p_credits <= 0 or p_amount_total <= 0 then
    raise exception 'Credits and payment amount must be positive.';
  end if;

  select coalesce(credit_balance, 0)
  into current_balance
  from public.profiles
  where id = p_customer_user_id
  for update;
  if not found then raise exception 'Customer was not found.'; end if;

  insert into public.payment_records (
    provider, external_id, provider_payment_id, user_id, status, payment_type,
    credits, amount_total, currency, credits_applied_at, reviewed_at,
    reviewed_by, review_note, metadata
  ) values (
    'bank', clean_reference, clean_reference, p_customer_user_id, 'succeeded',
    'manual_bank', p_credits, p_amount_total, lower(p_currency), now(), now(),
    p_actor_user_id, nullif(trim(p_note), ''),
    jsonb_build_object('recorded_by', p_actor_user_id)
  )
  returning id into new_payment_id;

  next_balance := current_balance + p_credits;
  update public.profiles set credit_balance = next_balance where id = p_customer_user_id;

  insert into public.credit_transactions (
    user_id, type, source_type, source_id, credits_delta, balance_after,
    description, amount_total, currency, metadata, created_by
  ) values (
    p_customer_user_id, 'purchase', 'bank_transfer', clean_reference,
    p_credits, next_balance, coalesce(nullif(trim(p_note), ''), 'Credits purchased via bank transfer.'),
    p_amount_total, lower(p_currency), jsonb_build_object('payment_record_id', new_payment_id),
    p_actor_user_id
  ) returning id into new_ledger_id;

  insert into public.payment_event_log (
    payment_record_id, provider, event_type, status, message, payload
  ) values (
    new_payment_id, 'bank', 'bank_payment_recorded', 'processed',
    'Bank payment matched and credits applied.',
    jsonb_build_object('ledger_id', new_ledger_id, 'actor_id', p_actor_user_id)
  );

  return jsonb_build_object(
    'payment_id', new_payment_id,
    'ledger_id', new_ledger_id,
    'balance_after', next_balance
  );
exception
  when unique_violation then
    raise exception 'This bank reference has already been recorded.';
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
set search_path = public
as $$
declare
  payment public.payment_records%rowtype;
  current_balance numeric;
  next_balance numeric;
  new_ledger_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_user_id
      and ((role = 'admin' and staff_role = 'owner')
        or (role = 'staff' and 'credits.manage' = any(staff_permissions)))
  ) then
    raise exception 'Credit management permission is required.';
  end if;

  select * into payment
  from public.payment_records
  where id = p_payment_record_id
  for update;
  if not found then raise exception 'Payment record was not found.'; end if;
  if payment.status = 'refunded' then raise exception 'Payment is already refunded.'; end if;
  if payment.status <> 'succeeded' then raise exception 'Only successful payments can be refunded.'; end if;
  if payment.user_id is null or payment.credits <= 0 then
    raise exception 'Payment has no reversible credit allocation.';
  end if;

  select coalesce(credit_balance, 0)
  into current_balance
  from public.profiles
  where id = payment.user_id
  for update;
  if not found then raise exception 'Customer was not found.'; end if;

  next_balance := current_balance - payment.credits;
  update public.profiles set credit_balance = next_balance where id = payment.user_id;

  insert into public.credit_transactions (
    user_id, type, source_type, source_id, credits_delta, balance_after,
    description, amount_total, currency, metadata, created_by
  ) values (
    payment.user_id, 'refund', payment.provider || '_refund',
    coalesce(nullif(trim(p_provider_refund_id), ''), payment.id::text),
    -payment.credits, next_balance,
    coalesce(nullif(trim(p_note), ''), 'Payment refunded and purchased credits reversed.'),
    case when payment.amount_total is null then null else -abs(payment.amount_total) end,
    payment.currency,
    jsonb_build_object('payment_record_id', payment.id, 'provider_refund_id', p_provider_refund_id),
    p_actor_user_id
  ) returning id into new_ledger_id;

  update public.payment_records
  set status = 'refunded', refunded_at = now(), reviewed_at = now(),
      reviewed_by = p_actor_user_id, review_note = nullif(trim(p_note), '')
  where id = payment.id;

  insert into public.payment_event_log (
    payment_record_id, provider, event_type, status, message, payload
  ) values (
    payment.id, payment.provider, 'payment_refunded', 'processed',
    'Provider refund completed and credits reversed.',
    jsonb_build_object('ledger_id', new_ledger_id, 'provider_refund_id', p_provider_refund_id)
  );

  return jsonb_build_object('ledger_id', new_ledger_id, 'balance_after', next_balance);
end;
$$;

revoke all on function public.admin_record_bank_payment(uuid, uuid, text, numeric, bigint, text, text) from public;
revoke all on function public.admin_apply_payment_refund(uuid, uuid, text, text) from public;
grant execute on function public.admin_record_bank_payment(uuid, uuid, text, numeric, bigint, text, text) to service_role;
grant execute on function public.admin_apply_payment_refund(uuid, uuid, text, text) to service_role;

commit;

-- Verification:
-- select provider, status, count(*) from public.payment_records group by provider, status;
-- select event_type, status, created_at from public.payment_event_log order by created_at desc limit 20;
