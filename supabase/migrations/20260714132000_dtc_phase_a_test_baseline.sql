-- Local-only baseline for DTC Phase A migration verification.
--
-- This is not a production schema migration. It recreates only the existing
-- public objects referenced by scripts/add-dtc-active-processing-phase-a.sql so
-- the Phase A migration can be applied and inspected in a disposable Supabase
-- database without production access.

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid
);

create table if not exists public.request_work_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade
);

alter table public.orders enable row level security;
alter table public.request_work_orders enable row level security;

create or replace function public.has_staff_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

revoke all on function public.has_staff_permission(text) from public, anon;
grant execute on function public.has_staff_permission(text) to authenticated;
grant all on public.orders to service_role;
grant all on public.request_work_orders to service_role;
