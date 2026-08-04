-- MG AutoTech Growth Customer Classification
-- Additive, non-destructive and admin-only. Existing customers are never auto-classified.

begin;

create extension if not exists pgcrypto;

create table if not exists public.growth_customer_classifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  classification text not null default 'unreviewed' check (classification in (
    'unreviewed', 'real_customer', 'internal_test', 'staff_operated'
  )),
  analytics_excluded boolean not null default false,
  reason text check (reason is null or length(reason) <= 240),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (classification in ('internal_test', 'staff_operated') and analytics_excluded = true)
    or
    (classification in ('unreviewed', 'real_customer') and analytics_excluded = false)
  ),
  check (
    classification not in ('internal_test', 'staff_operated')
    or length(trim(coalesce(reason, ''))) between 3 and 240
  )
);

create table if not exists public.growth_customer_classification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  previous_classification text check (previous_classification is null or previous_classification in (
    'unreviewed', 'real_customer', 'internal_test', 'staff_operated'
  )),
  new_classification text not null check (new_classification in (
    'unreviewed', 'real_customer', 'internal_test', 'staff_operated'
  )),
  previous_analytics_excluded boolean,
  new_analytics_excluded boolean not null,
  reason text check (reason is null or length(reason) <= 240),
  created_at timestamptz not null default now()
);

create index if not exists growth_customer_classification_state_idx
  on public.growth_customer_classifications(classification, updated_at desc);
create index if not exists growth_customer_classification_excluded_idx
  on public.growth_customer_classifications(updated_at desc)
  where analytics_excluded = true;
create index if not exists growth_customer_classification_events_user_idx
  on public.growth_customer_classification_events(user_id, created_at desc);

alter table public.growth_customer_classifications enable row level security;
alter table public.growth_customer_classification_events enable row level security;

revoke all on table public.growth_customer_classifications from public, anon, authenticated;
revoke all on table public.growth_customer_classification_events from public, anon, authenticated;
grant all on table public.growth_customer_classifications to service_role;
grant all on table public.growth_customer_classification_events to service_role;

create or replace function public.set_growth_customer_classification(
  p_user_id uuid,
  p_classification text,
  p_reason text,
  p_actor_user_id uuid
)
returns public.growth_customer_classifications
language plpgsql
security invoker
set search_path = public
as $$
declare
  previous_row public.growth_customer_classifications%rowtype;
  saved_row public.growth_customer_classifications%rowtype;
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
  next_excluded boolean;
  target_role text;
begin
  if p_classification not in ('unreviewed', 'real_customer', 'internal_test', 'staff_operated') then
    raise exception 'invalid_growth_customer_classification';
  end if;

  next_excluded := p_classification in ('internal_test', 'staff_operated');
  if next_excluded and length(coalesce(clean_reason, '')) < 3 then
    raise exception 'growth_customer_classification_reason_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(role, 'customer') into target_role
  from public.profiles
  where id = p_user_id;

  if target_role is null then
    raise exception 'growth_customer_not_found';
  end if;
  if target_role in ('admin', 'staff') then
    raise exception 'staff_accounts_are_already_excluded';
  end if;

  select * into previous_row
  from public.growth_customer_classifications
  where user_id = p_user_id
  for update;

  insert into public.growth_customer_classifications (
    user_id, classification, analytics_excluded, reason,
    verified_by, verified_at, updated_at
  ) values (
    p_user_id, p_classification, next_excluded, clean_reason,
    p_actor_user_id,
    case when p_classification = 'unreviewed' then null else now() end,
    now()
  )
  on conflict (user_id) do update set
    classification = excluded.classification,
    analytics_excluded = excluded.analytics_excluded,
    reason = excluded.reason,
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    updated_at = now()
  returning * into saved_row;

  insert into public.growth_customer_classification_events (
    user_id, actor_user_id,
    previous_classification, new_classification,
    previous_analytics_excluded, new_analytics_excluded,
    reason
  ) values (
    p_user_id, p_actor_user_id,
    previous_row.classification, saved_row.classification,
    previous_row.analytics_excluded, saved_row.analytics_excluded,
    clean_reason
  );

  return saved_row;
end;
$$;

revoke all on function public.set_growth_customer_classification(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_growth_customer_classification(uuid, text, text, uuid)
  to service_role;

create or replace function public.reserve_growth_reminder_action(
  p_source_event_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  started_at timestamptz;
  result_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select occurred_at into started_at
  from public.growth_journey_events
  where id = p_source_event_id
    and user_id = p_user_id
    and event_type = 'request_started'
  for update;

  if started_at is null
    or started_at > now() - interval '24 hours'
    or started_at < now() - interval '14 days' then
    return null;
  end if;

  if exists (
    select 1 from public.growth_customer_classifications
    where user_id = p_user_id
      and analytics_excluded = true
  ) then
    return null;
  end if;

  if not exists (
    select 1 from public.growth_customer_preferences
    where user_id = p_user_id
      and abandoned_request_reminders = true
      and consent_version = 'abandoned-request-v1'
      and consented_at is not null
      and revoked_at is null
  ) then
    return null;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_user_id
      and email is not null
      and coalesce(role, 'customer') not in ('admin', 'staff')
      and coalesce(account_status, 'active') not in ('blocked', 'disabled', 'suspended')
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.orders
    where customer_id = p_user_id
      and created_at >= started_at
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.growth_reminder_actions
    where user_id = p_user_id
      and created_at >= now() - interval '30 days'
  ) then
    return null;
  end if;

  insert into public.growth_reminder_actions (
    source_event_id, user_id, idempotency_key, status, acted_by
  ) values (
    p_source_event_id, p_user_id, p_idempotency_key, 'pending', p_actor_user_id
  )
  on conflict do nothing
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.reserve_growth_reminder_action(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_growth_reminder_action(uuid, uuid, text, uuid)
  to service_role;

commit;
