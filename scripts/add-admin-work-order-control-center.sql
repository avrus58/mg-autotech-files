-- MG AutoTech Admin Work Order Control Center
-- Safe additive migration. No destructive operations.

begin;

create extension if not exists pgcrypto;

create table if not exists public.request_work_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.orders(id) on delete cascade,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  admin_status text not null default 'new'
    check (admin_status in (
      'new', 'waiting_for_payment', 'payment_review', 'waiting_for_file',
      'file_received', 'in_analysis', 'waiting_for_customer', 'in_progress',
      'quality_check', 'ready_for_delivery', 'delivered', 'completed',
      'cancelled', 'needs_review'
    )),
  tuner_status text not null default 'unassigned'
    check (tuner_status in ('unassigned', 'assigned', 'reviewing', 'working', 'paused', 'ready_for_qc', 'done')),
  payment_review_status text not null default 'not_checked'
    check (payment_review_status in ('not_checked', 'pending', 'paid', 'requires_review', 'refunded', 'cancelled')),
  delivery_status text not null default 'not_ready'
    check (delivery_status in ('not_ready', 'waiting_final_file', 'ready', 'delivered', 'revision_requested', 'blocked')),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  assigned_tuner_id uuid references auth.users(id) on delete set null,
  internal_notes text,
  customer_visible_notes text,
  estimated_turnaround_minutes int check (estimated_turnaround_minutes is null or estimated_turnaround_minutes >= 0),
  eta_note text,
  risk_flags text[] not null default '{}'::text[],
  quality_check_status text not null default 'pending'
    check (quality_check_status in ('pending', 'passed', 'failed', 'needs_review')),
  quality_check_json jsonb not null default '{}'::jsonb,
  final_file_status text not null default 'not_ready'
    check (final_file_status in ('not_ready', 'uploaded', 'qc_pending', 'approved', 'blocked')),
  delivery_method text not null default 'portal'
    check (delivery_method in ('portal', 'manual', 'external')),
  last_admin_activity_at timestamptz,
  last_customer_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id)
);

create table if not exists public.request_work_order_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.orders(id) on delete cascade,
  work_order_id uuid references public.request_work_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  old_value jsonb,
  new_value jsonb,
  customer_visible boolean not null default false,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.request_internal_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.orders(id) on delete cascade,
  work_order_id uuid references public.request_work_orders(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  note_type text not null default 'internal'
    check (note_type in ('internal', 'tuner', 'customer_visible', 'pinned')),
  body text not null,
  pinned boolean not null default false,
  customer_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists request_work_orders_request_idx
  on public.request_work_orders(request_id);
create index if not exists request_work_orders_status_idx
  on public.request_work_orders(admin_status, priority, updated_at desc);
create index if not exists request_work_orders_assigned_idx
  on public.request_work_orders(assigned_admin_id, assigned_tuner_id);
create index if not exists request_work_order_events_request_idx
  on public.request_work_order_events(request_id, created_at desc);
create index if not exists request_work_order_events_type_idx
  on public.request_work_order_events(event_type, created_at desc);
create index if not exists request_internal_notes_request_idx
  on public.request_internal_notes(request_id, created_at desc)
  where deleted_at is null;

create or replace function public.touch_request_work_order_updated_at()
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
    select 1 from pg_trigger
    where tgname = 'request_work_orders_touch_updated_at'
  ) then
    create trigger request_work_orders_touch_updated_at
    before update on public.request_work_orders
    for each row execute function public.touch_request_work_order_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'request_internal_notes_touch_updated_at'
  ) then
    create trigger request_internal_notes_touch_updated_at
    before update on public.request_internal_notes
    for each row execute function public.touch_request_work_order_updated_at();
  end if;
end $$;

alter table public.request_work_orders enable row level security;
alter table public.request_work_order_events enable row level security;
alter table public.request_internal_notes enable row level security;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'has_staff_permission') then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'request_work_orders'
        and policyname = 'Staff can read request work orders'
    ) then
      create policy "Staff can read request work orders"
      on public.request_work_orders for select to authenticated
      using (public.has_staff_permission('orders.view'));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'request_work_orders'
        and policyname = 'Staff can manage request work orders'
    ) then
      create policy "Staff can manage request work orders"
      on public.request_work_orders for all to authenticated
      using (public.has_staff_permission('orders.manage'))
      with check (public.has_staff_permission('orders.manage'));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'request_work_order_events'
        and policyname = 'Staff can read request work order events'
    ) then
      create policy "Staff can read request work order events"
      on public.request_work_order_events for select to authenticated
      using (public.has_staff_permission('orders.view'));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'request_work_order_events'
        and policyname = 'Staff can create request work order events'
    ) then
      create policy "Staff can create request work order events"
      on public.request_work_order_events for insert to authenticated
      with check (public.has_staff_permission('orders.manage'));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'request_internal_notes'
        and policyname = 'Staff can read request internal notes'
    ) then
      create policy "Staff can read request internal notes"
      on public.request_internal_notes for select to authenticated
      using (public.has_staff_permission('orders.view'));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'request_internal_notes'
        and policyname = 'Staff can manage request internal notes'
    ) then
      create policy "Staff can manage request internal notes"
      on public.request_internal_notes for all to authenticated
      using (public.has_staff_permission('orders.manage'))
      with check (public.has_staff_permission('orders.manage'));
    end if;
  end if;
end $$;

comment on table public.request_work_orders is
  'Admin-only operational work-order state for MG AutoTech file requests.';
comment on table public.request_work_order_events is
  'Admin work-order timeline and audit events. Customer APIs must expose only customer-visible safe events.';
comment on table public.request_internal_notes is
  'Admin and tuner notes for work orders. Internal notes must never be exposed to customers.';

commit;

-- Verification:
-- select table_name from information_schema.tables where table_schema = 'public' and table_name like 'request_work_order%';
-- select tablename, policyname from pg_policies where schemaname = 'public' and tablename like 'request_%order%';
