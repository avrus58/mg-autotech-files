-- MG AutoTech Growth & Customer Success Center
-- Additive and non-destructive. Stores privacy-minimized attribution and workflow metadata only.

begin;

create extension if not exists pgcrypto;

create table if not exists public.growth_attribution_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_hash text not null unique check (visitor_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid references auth.users(id) on delete set null,
  first_landing_path text not null check (first_landing_path ~ '^/' and length(first_landing_path) <= 180),
  last_landing_path text not null check (last_landing_path ~ '^/' and length(last_landing_path) <= 180),
  first_source text not null check (length(first_source) between 1 and 120),
  last_source text not null check (length(last_source) between 1 and 120),
  first_medium text not null check (length(first_medium) between 1 and 48),
  last_medium text not null check (length(last_medium) between 1 and 48),
  first_campaign text check (length(first_campaign) <= 80),
  last_campaign text check (length(last_campaign) <= 80),
  first_term text check (length(first_term) <= 80),
  last_term text check (length(last_term) <= 80),
  first_referrer_host text check (length(first_referrer_host) <= 120),
  last_referrer_host text check (length(last_referrer_host) <= 120),
  first_country_code text check (first_country_code is null or first_country_code ~ '^[A-Z]{2}$'),
  last_country_code text check (last_country_code is null or last_country_code ~ '^[A-Z]{2}$'),
  locale text check (locale is null or locale ~ '^[a-z]{2}(-[a-z]{2})?$'),
  consent_version text not null check (length(consent_version) between 1 and 40),
  touch_count integer not null default 1 check (touch_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  identified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_journey_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'account_created',
    'request_started',
    'request_created',
    'abandoned_reminder_sent',
    'abandoned_reminder_skipped'
  )),
  event_key text not null unique check (length(event_key) between 8 and 220),
  visitor_hash text check (visitor_hash is null or visitor_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  channel text not null default 'web' check (channel in ('web', 'desktop', 'admin')),
  safe_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (jsonb_typeof(safe_metadata) = 'object')
);

create table if not exists public.growth_customer_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  abandoned_request_reminders boolean not null default false,
  consent_version text check (consent_version is null or length(consent_version) <= 40),
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_reminder_actions (
  id uuid primary key default gen_random_uuid(),
  source_event_id uuid not null unique references public.growth_journey_events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 220),
  status text not null default 'pending' check (status in ('pending', 'sent', 'dry_run', 'skipped', 'failed')),
  reason text check (reason is null or length(reason) <= 160),
  acted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists growth_attribution_user_idx
  on public.growth_attribution_sessions(user_id, first_seen_at desc);
create index if not exists growth_attribution_first_seen_idx
  on public.growth_attribution_sessions(first_seen_at desc);
create index if not exists growth_attribution_source_idx
  on public.growth_attribution_sessions(first_source, first_seen_at desc);
create index if not exists growth_journey_user_event_idx
  on public.growth_journey_events(user_id, event_type, occurred_at desc);
create index if not exists growth_journey_order_idx
  on public.growth_journey_events(order_id, occurred_at desc)
  where order_id is not null;
create index if not exists growth_journey_reminder_candidates_idx
  on public.growth_journey_events(occurred_at desc, user_id)
  where event_type = 'request_started';
create index if not exists growth_reminder_status_idx
  on public.growth_reminder_actions(status, created_at desc);

alter table public.growth_attribution_sessions enable row level security;
alter table public.growth_journey_events enable row level security;
alter table public.growth_customer_preferences enable row level security;
alter table public.growth_reminder_actions enable row level security;

revoke all on table public.growth_attribution_sessions from anon, authenticated;
revoke all on table public.growth_journey_events from anon, authenticated;
revoke all on table public.growth_reminder_actions from anon, authenticated;
revoke all on table public.growth_customer_preferences from anon, authenticated;

grant select on table public.growth_attribution_sessions to authenticated;
grant select on table public.growth_journey_events to authenticated;
grant select on table public.growth_reminder_actions to authenticated;
grant select on table public.growth_customer_preferences to authenticated;
grant all on table public.growth_attribution_sessions to service_role;
grant all on table public.growth_journey_events to service_role;
grant all on table public.growth_customer_preferences to service_role;
grant all on table public.growth_reminder_actions to service_role;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'has_staff_permission') then
    if not exists (
      select 1 from pg_policies where schemaname = 'public'
      and tablename = 'growth_attribution_sessions'
      and policyname = 'Growth staff can read attribution'
    ) then
      create policy "Growth staff can read attribution"
      on public.growth_attribution_sessions for select to authenticated
      using ((select public.has_staff_permission('orders.view')));
    end if;

    if not exists (
      select 1 from pg_policies where schemaname = 'public'
      and tablename = 'growth_journey_events'
      and policyname = 'Growth staff can read journey events'
    ) then
      create policy "Growth staff can read journey events"
      on public.growth_journey_events for select to authenticated
      using ((select public.has_staff_permission('orders.view')));
    end if;

    if not exists (
      select 1 from pg_policies where schemaname = 'public'
      and tablename = 'growth_reminder_actions'
      and policyname = 'Growth staff can read reminder actions'
    ) then
      create policy "Growth staff can read reminder actions"
      on public.growth_reminder_actions for select to authenticated
      using ((select public.has_staff_permission('orders.view')));
    end if;

    if not exists (
      select 1 from pg_policies where schemaname = 'public'
      and tablename = 'growth_customer_preferences'
      and policyname = 'Growth staff can read reminder preferences'
    ) then
      create policy "Growth staff can read reminder preferences"
      on public.growth_customer_preferences for select to authenticated
      using ((select public.has_staff_permission('orders.view')));
    end if;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
    and tablename = 'growth_customer_preferences'
    and policyname = 'Customers can read own growth preferences'
  ) then
    create policy "Customers can read own growth preferences"
    on public.growth_customer_preferences for select to authenticated
    using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  end if;

end $$;

create or replace function public.touch_growth_customer_success_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_growth_customer_success_updated_at() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'growth_attribution_touch_updated_at') then
    create trigger growth_attribution_touch_updated_at
    before update on public.growth_attribution_sessions
    for each row execute function public.touch_growth_customer_success_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'growth_preferences_touch_updated_at') then
    create trigger growth_preferences_touch_updated_at
    before update on public.growth_customer_preferences
    for each row execute function public.touch_growth_customer_success_updated_at();
  end if;
end $$;

create or replace function public.record_growth_attribution_touch(
  p_visitor_hash text,
  p_user_id uuid,
  p_landing_path text,
  p_source text,
  p_medium text,
  p_campaign text,
  p_term text,
  p_referrer_host text,
  p_country_code text,
  p_locale text,
  p_consent_version text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  result_id uuid;
begin
  insert into public.growth_attribution_sessions (
    visitor_hash, user_id,
    first_landing_path, last_landing_path,
    first_source, last_source,
    first_medium, last_medium,
    first_campaign, last_campaign,
    first_term, last_term,
    first_referrer_host, last_referrer_host,
    first_country_code, last_country_code,
    locale, consent_version, identified_at
  ) values (
    p_visitor_hash, p_user_id,
    p_landing_path, p_landing_path,
    p_source, p_source,
    p_medium, p_medium,
    p_campaign, p_campaign,
    p_term, p_term,
    p_referrer_host, p_referrer_host,
    p_country_code, p_country_code,
    p_locale, p_consent_version,
    case when p_user_id is null then null else now() end
  )
  on conflict (visitor_hash) do update set
    user_id = coalesce(growth_attribution_sessions.user_id, excluded.user_id),
    last_landing_path = excluded.last_landing_path,
    last_source = excluded.last_source,
    last_medium = excluded.last_medium,
    last_campaign = excluded.last_campaign,
    last_term = excluded.last_term,
    last_referrer_host = excluded.last_referrer_host,
    last_country_code = excluded.last_country_code,
    locale = coalesce(excluded.locale, growth_attribution_sessions.locale),
    consent_version = excluded.consent_version,
    touch_count = growth_attribution_sessions.touch_count + 1,
    last_seen_at = now(),
    identified_at = case
      when growth_attribution_sessions.user_id is null and excluded.user_id is not null then now()
      else growth_attribution_sessions.identified_at
    end
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.record_growth_attribution_touch(text, uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_growth_attribution_touch(text, uuid, text, text, text, text, text, text, text, text, text) to service_role;

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
    source_event_id,
    user_id,
    idempotency_key,
    status,
    acted_by
  ) values (
    p_source_event_id,
    p_user_id,
    p_idempotency_key,
    'pending',
    p_actor_user_id
  )
  on conflict do nothing
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.reserve_growth_reminder_action(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_growth_reminder_action(uuid, uuid, text, uuid) to service_role;

comment on table public.growth_attribution_sessions is
  'Consented, pseudonymous first/last-touch acquisition metadata. Never stores raw IP, raw visitor UUID, full referrer URL, email or customer content.';
comment on table public.growth_journey_events is
  'Idempotent operational journey milestones. safe_metadata must remain allowlisted and contain no PII, file data, notes or payment credentials.';
comment on table public.growth_customer_preferences is
  'Customer-controlled growth communication preferences. Abandoned request reminders default to false.';
comment on table public.growth_reminder_actions is
  'Admin-triggered abandoned-request reminder audit. No automatic send job is created by this migration.';

commit;
