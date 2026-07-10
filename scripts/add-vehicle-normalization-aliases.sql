-- MG AutoTech Vehicle Normalization & Alias Framework
-- Safe, additive migration. No destructive operations.

create table if not exists public.vehicle_brand_aliases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.vehicle_brands(id) on delete cascade,
  alias_name text not null,
  normalized_alias text not null,
  source_type text default 'manual',
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, normalized_alias)
);

create table if not exists public.vehicle_model_aliases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.vehicle_brands(id) on delete cascade,
  model_id uuid not null references public.vehicle_models(id) on delete cascade,
  alias_name text not null,
  normalized_alias text not null,
  source_type text default 'manual',
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, normalized_alias)
);

create table if not exists public.vehicle_generation_aliases (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.vehicle_models(id) on delete cascade,
  generation_id uuid not null references public.vehicle_generations(id) on delete cascade,
  alias_name text not null,
  normalized_alias text not null,
  source_type text default 'manual',
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, normalized_alias)
);

create table if not exists public.vehicle_engine_aliases (
  id uuid primary key default gen_random_uuid(),
  engine_id uuid not null references public.vehicle_engines(id) on delete cascade,
  alias_name text not null,
  normalized_alias text not null,
  source_type text default 'manual',
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engine_id, normalized_alias)
);

create table if not exists public.vehicle_alias_review_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid null,
  alias_table text not null,
  alias_id uuid null,
  action text not null,
  old_value jsonb default '{}',
  new_value jsonb default '{}',
  actor_id uuid null references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_brand_aliases_alias_idx on public.vehicle_brand_aliases(normalized_alias) where active;
create index if not exists vehicle_model_aliases_brand_alias_idx on public.vehicle_model_aliases(brand_id, normalized_alias) where active;
create index if not exists vehicle_generation_aliases_model_alias_idx on public.vehicle_generation_aliases(model_id, normalized_alias) where active;
create index if not exists vehicle_engine_aliases_alias_idx on public.vehicle_engine_aliases(normalized_alias) where active;
create index if not exists vehicle_alias_review_events_entity_idx on public.vehicle_alias_review_events(entity_type, entity_id, created_at desc);

alter table public.vehicle_brand_aliases enable row level security;
alter table public.vehicle_model_aliases enable row level security;
alter table public.vehicle_generation_aliases enable row level security;
alter table public.vehicle_engine_aliases enable row level security;
alter table public.vehicle_alias_review_events enable row level security;

do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('vehicle brand aliases admin select', 'vehicle_brand_aliases', 'select'),
      ('vehicle brand aliases admin insert', 'vehicle_brand_aliases', 'insert'),
      ('vehicle brand aliases admin update', 'vehicle_brand_aliases', 'update'),
      ('vehicle model aliases admin select', 'vehicle_model_aliases', 'select'),
      ('vehicle model aliases admin insert', 'vehicle_model_aliases', 'insert'),
      ('vehicle model aliases admin update', 'vehicle_model_aliases', 'update'),
      ('vehicle generation aliases admin select', 'vehicle_generation_aliases', 'select'),
      ('vehicle generation aliases admin insert', 'vehicle_generation_aliases', 'insert'),
      ('vehicle generation aliases admin update', 'vehicle_generation_aliases', 'update'),
      ('vehicle engine aliases admin select', 'vehicle_engine_aliases', 'select'),
      ('vehicle engine aliases admin insert', 'vehicle_engine_aliases', 'insert'),
      ('vehicle engine aliases admin update', 'vehicle_engine_aliases', 'update'),
      ('vehicle alias review events admin select', 'vehicle_alias_review_events', 'select'),
      ('vehicle alias review events admin insert', 'vehicle_alias_review_events', 'insert')
    ) as t(policy_name, table_name, command_name)
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = item.table_name
        and policyname = item.policy_name
    ) then
      if item.command_name = 'select' then
        execute format(
          'create policy %I on public.%I for select to authenticated using (public.has_staff_permission(''vehicles.manage''))',
          item.policy_name,
          item.table_name
        );
      elsif item.command_name = 'insert' then
        execute format(
          'create policy %I on public.%I for insert to authenticated with check (public.has_staff_permission(''vehicles.manage''))',
          item.policy_name,
          item.table_name
        );
      else
        execute format(
          'create policy %I on public.%I for update to authenticated using (public.has_staff_permission(''vehicles.manage'')) with check (public.has_staff_permission(''vehicles.manage''))',
          item.policy_name,
          item.table_name
        );
      end if;
    end if;
  end loop;
end $$;
