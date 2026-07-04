-- Align admin credit adjustments and safety ratings with the live schema.
-- Safe to run repeatedly in the Supabase SQL editor.

begin;

alter table public.file_expert_feedback
  drop constraint if exists file_expert_feedback_safety_rating_check;

alter table public.file_expert_feedback
  add constraint file_expert_feedback_safety_rating_check
  check (safety_rating is null or safety_rating in ('unknown', 'safe', 'aggressive', 'risky', 'bad'))
  not valid;

alter table public.file_expert_feedback
  validate constraint file_expert_feedback_safety_rating_check;

create or replace function public.staff_adjust_customer_credits(
  p_customer_id uuid,
  p_amount numeric,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance numeric;
  next_balance numeric;
  transaction_id text := gen_random_uuid()::text;
begin
  if not public.has_staff_permission('credits.manage') then
    raise exception 'Credit management permission is required.';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'Credit amount must not be zero.';
  end if;

  select coalesce(credit_balance, 0)
  into current_balance
  from public.profiles
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer was not found.';
  end if;

  next_balance := current_balance + p_amount;

  update public.profiles
  set credit_balance = next_balance
  where id = p_customer_id;

  insert into public.credit_transactions (
    user_id, type, source_type, source_id, credits_delta, balance_after,
    description, amount_total, currency, metadata
  ) values (
    p_customer_id,
    case when p_amount > 0 then 'admin_topup' else 'admin_adjustment' end,
    'staff_adjustment',
    transaction_id,
    p_amount,
    next_balance,
    coalesce(nullif(trim(p_note), ''), 'Staff credit adjustment'),
    null,
    null,
    jsonb_build_object('actor_id', auth.uid())
  );

  return next_balance;
end;
$$;

revoke all on function public.staff_adjust_customer_credits(uuid, numeric, text) from public;
grant execute on function public.staff_adjust_customer_credits(uuid, numeric, text) to authenticated;

commit;
