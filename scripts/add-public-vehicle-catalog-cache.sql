-- MG AutoTech public vehicle catalog cache
-- Safe additive migration. No destructive data operations are used.

create table if not exists public.public_vehicle_catalog_cache (
  id text primary key,
  payload jsonb not null,
  version integer not null default 1,
  source_hash text,
  brand_count integer not null default 0,
  model_count integer not null default 0,
  generation_count integer not null default 0,
  engine_count integer not null default 0,
  generated_at timestamptz not null default now(),
  generated_by uuid null references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_vehicle_catalog_cache_active_idx
  on public.public_vehicle_catalog_cache(is_active, generated_at desc);

alter table public.public_vehicle_catalog_cache enable row level security;

revoke all on table public.public_vehicle_catalog_cache from anon;
revoke all on table public.public_vehicle_catalog_cache from authenticated;
revoke all on table public.public_vehicle_catalog_cache from service_role;
grant select, insert, update on table public.public_vehicle_catalog_cache to authenticated;
grant select, insert, update on table public.public_vehicle_catalog_cache to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'public_vehicle_catalog_cache'
      and policyname = 'public vehicle catalog cache admin select'
  ) then
    create policy "public vehicle catalog cache admin select"
      on public.public_vehicle_catalog_cache
      for select
      to authenticated
      using (public.has_staff_permission('vehicles.manage'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'public_vehicle_catalog_cache'
      and policyname = 'public vehicle catalog cache admin insert'
  ) then
    create policy "public vehicle catalog cache admin insert"
      on public.public_vehicle_catalog_cache
      for insert
      to authenticated
      with check (public.has_staff_permission('vehicles.manage'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'public_vehicle_catalog_cache'
      and policyname = 'public vehicle catalog cache admin update'
  ) then
    create policy "public vehicle catalog cache admin update"
      on public.public_vehicle_catalog_cache
      for update
      to authenticated
      using (public.has_staff_permission('vehicles.manage'))
      with check (public.has_staff_permission('vehicles.manage'));
  end if;
end $$;
