-- MG AutoTech ECU Intelligence Level 3: Map Definition Layer
-- Safe, additive migration. No destructive SQL.
-- Run in Supabase SQL editor before deploying Level 3 admin persistence/UI.

create extension if not exists pgcrypto;

create table if not exists public.ai_map_definition_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ecu_family text,
  ecu_type text,
  sw_number text,
  hw_number text,
  vehicle_brand text,
  vehicle_model text,
  engine text,
  source_type text not null default 'manual',
  source_reference text,
  confidence_score integer not null default 50 check (confidence_score >= 0 and confidence_score <= 100),
  human_verified boolean not null default false,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'confirmed', 'rejected', 'needs_review')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_map_definitions (
  id uuid primary key default gen_random_uuid(),
  definition_set_id uuid not null references public.ai_map_definition_sets(id) on delete cascade,
  map_name text not null,
  category text not null check (category in (
    'driver_wish',
    'torque_limiter',
    'boost_request',
    'boost_limiter',
    'rail_pressure',
    'duration',
    'lambda',
    'smoke_limiter',
    'ignition',
    'vanos',
    'egr',
    'dpf',
    'dtc',
    'vmax',
    'pop_bangs',
    'tcu_shift',
    'tcu_pressure',
    'tcu_lockup',
    'checksum',
    'axis',
    'metadata',
    'unknown'
  )),
  offset_start bigint not null check (offset_start >= 0),
  offset_end bigint not null check (offset_end >= offset_start),
  rows integer,
  cols integer,
  data_type text,
  endian text,
  factor numeric,
  unit text,
  axis_x jsonb,
  axis_y jsonb,
  description text,
  confidence_score integer not null default 50 check (confidence_score >= 0 and confidence_score <= 100),
  human_verified boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_map_attribution_results (
  id uuid primary key default gen_random_uuid(),
  file_expert_job_id uuid references public.file_expert_jobs(id) on delete cascade,
  training_sample_id uuid references public.ai_training_samples(id) on delete cascade,
  definition_set_id uuid references public.ai_map_definition_sets(id) on delete set null,
  changed_region_id text,
  offset_start bigint,
  offset_end bigint,
  size_bytes integer,
  matched_definition_id uuid references public.ai_map_definitions(id) on delete set null,
  map_category text not null default 'unknown',
  map_name text,
  overlap_ratio numeric,
  confidence_score integer check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
  attribution_status text,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_generation_readiness_reports (
  id uuid primary key default gen_random_uuid(),
  file_expert_job_id uuid references public.file_expert_jobs(id) on delete cascade,
  training_sample_id uuid references public.ai_training_samples(id) on delete cascade,
  readiness_status text not null,
  trust_level text not null,
  blocked_reasons jsonb not null default '[]'::jsonb,
  missing_safety_gates jsonb not null default '[]'::jsonb,
  evidence_summary jsonb not null default '{}'::jsonb,
  map_attribution_summary jsonb not null default '{}'::jsonb,
  export_allowed boolean not null default false,
  customer_visible boolean not null default false,
  created_at timestamptz not null default now(),
  check (export_allowed = false),
  check (customer_visible = false)
);

create table if not exists public.ai_synthetic_fixture_runs (
  id uuid primary key default gen_random_uuid(),
  fixture_type text not null,
  ecu_family text,
  ecu_type text,
  service_labels jsonb not null default '[]'::jsonb,
  safe_fake_binary boolean not null default true,
  generated_files jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (safe_fake_binary = true)
);

create index if not exists ai_map_definition_sets_ecu_idx
  on public.ai_map_definition_sets (ecu_family, ecu_type, sw_number);
create index if not exists ai_map_definition_sets_hw_idx
  on public.ai_map_definition_sets (hw_number);
create index if not exists ai_map_definitions_set_idx
  on public.ai_map_definitions (definition_set_id);
create index if not exists ai_map_definitions_category_idx
  on public.ai_map_definitions (category);
create index if not exists ai_map_definitions_offset_idx
  on public.ai_map_definitions (offset_start, offset_end);
create index if not exists ai_map_attribution_job_idx
  on public.ai_map_attribution_results (file_expert_job_id);
create index if not exists ai_map_attribution_sample_idx
  on public.ai_map_attribution_results (training_sample_id);
create index if not exists ai_generation_readiness_job_idx
  on public.ai_generation_readiness_reports (file_expert_job_id);
create index if not exists ai_generation_readiness_sample_idx
  on public.ai_generation_readiness_reports (training_sample_id);

alter table public.ai_map_definition_sets enable row level security;
alter table public.ai_map_definitions enable row level security;
alter table public.ai_map_attribution_results enable row level security;
alter table public.ai_generation_readiness_reports enable row level security;
alter table public.ai_synthetic_fixture_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_map_definition_sets'
      and policyname = 'Admins can manage AI map definition sets'
  ) then
    create policy "Admins can manage AI map definition sets"
    on public.ai_map_definition_sets
    for all
    to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_map_definitions'
      and policyname = 'Admins can manage AI map definitions'
  ) then
    create policy "Admins can manage AI map definitions"
    on public.ai_map_definitions
    for all
    to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_map_attribution_results'
      and policyname = 'Admins can manage AI map attribution results'
  ) then
    create policy "Admins can manage AI map attribution results"
    on public.ai_map_attribution_results
    for all
    to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_generation_readiness_reports'
      and policyname = 'Admins can manage AI generation readiness reports'
  ) then
    create policy "Admins can manage AI generation readiness reports"
    on public.ai_generation_readiness_reports
    for all
    to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_synthetic_fixture_runs'
      and policyname = 'Admins can manage AI synthetic fixture runs'
  ) then
    create policy "Admins can manage AI synthetic fixture runs"
    on public.ai_synthetic_fixture_runs
    for all
    to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;
end $$;

grant select, insert, update on public.ai_map_definition_sets to authenticated;
grant select, insert, update on public.ai_map_definitions to authenticated;
grant select, insert, update on public.ai_map_attribution_results to authenticated;
grant select, insert, update on public.ai_generation_readiness_reports to authenticated;
grant select, insert, update on public.ai_synthetic_fixture_runs to authenticated;
