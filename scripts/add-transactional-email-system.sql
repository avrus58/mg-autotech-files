-- MG AutoTech Transactional Email System
-- Safe additive migration. No destructive operations.

begin;

create extension if not exists pgcrypto;

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  recipient_email text not null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  related_order_id uuid references public.orders(id) on delete set null,
  related_request_id uuid references public.orders(id) on delete set null,
  idempotency_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider text not null default 'resend',
  provider_message_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists email_events_event_type_idx
  on public.email_events(event_type, created_at desc);
create index if not exists email_events_recipient_user_idx
  on public.email_events(recipient_user_id, created_at desc);
create index if not exists email_events_related_order_idx
  on public.email_events(related_order_id, created_at desc);
create index if not exists email_events_status_idx
  on public.email_events(status, created_at desc);

create or replace function public.touch_email_events_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'email_events_touch_updated_at'
  ) then
    create trigger email_events_touch_updated_at
    before update on public.email_events
    for each row execute function public.touch_email_events_updated_at();
  end if;
end $$;

alter table public.email_events enable row level security;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'has_staff_permission') then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'email_events'
        and policyname = 'Staff can read transactional email events'
    ) then
      create policy "Staff can read transactional email events"
      on public.email_events for select to authenticated
      using (public.has_staff_permission('orders.view'));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'email_events'
        and policyname = 'Staff can manage transactional email events'
    ) then
      create policy "Staff can manage transactional email events"
      on public.email_events for all to authenticated
      using (public.has_staff_permission('orders.manage'))
      with check (public.has_staff_permission('orders.manage'));
    end if;
  end if;
end $$;

comment on table public.email_events is
  'Server-side transactional email event log. Stores safe metadata only, not full email bodies.';
comment on column public.email_events.metadata is
  'Safe operational metadata. Do not store raw binary, private file paths, internal notes, hidden messages or full email bodies.';

commit;

-- Verification:
-- select table_name from information_schema.tables where table_schema = 'public' and table_name = 'email_events';
-- select tablename, policyname from pg_policies where schemaname = 'public' and tablename = 'email_events';
