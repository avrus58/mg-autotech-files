-- MG AutoTech Vehicle Database Control Center
-- Safe additive migration. Destructive data operations are intentionally not used.

create extension if not exists pgcrypto;

create table if not exists public.vehicle_data_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'manual',
  source_name text not null,
  source_reference text,
  source_url text,
  trust_level text not null default 'imported'
    check (trust_level in ('imported', 'manual', 'verified', 'partner')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_name)
);

create table if not exists public.vehicle_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.vehicle_data_sources(id) on delete set null,
  source_type text not null default 'carecufile_import',
  mode text not null default 'dry_run' check (mode in ('dry_run', 'import')),
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  dry_run boolean not null default true,
  requested_by uuid references auth.users(id) on delete set null,
  total_rows int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  error_count int not null default 0,
  duplicate_count int not null default 0,
  warning_count int not null default 0,
  summary_json jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  external_id text,
  display_order int not null default 1000,
  active boolean not null default true,
  published boolean not null default true,
  source_type text not null default 'manual',
  source_reference text,
  confidence_score numeric not null default 60 check (confidence_score >= 0 and confidence_score <= 100),
  verification_status text not null default 'imported'
    check (verification_status in ('imported', 'unverified', 'needs_review', 'verified', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create table if not exists public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.vehicle_brands(id) on delete restrict,
  name text not null,
  slug text not null,
  external_id text,
  display_order int not null default 1000,
  active boolean not null default true,
  published boolean not null default true,
  source_type text not null default 'manual',
  source_reference text,
  confidence_score numeric not null default 60 check (confidence_score >= 0 and confidence_score <= 100),
  verification_status text not null default 'imported'
    check (verification_status in ('imported', 'unverified', 'needs_review', 'verified', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table if not exists public.vehicle_generations (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.vehicle_models(id) on delete restrict,
  name text not null,
  slug text not null,
  external_id text,
  year_from int,
  year_to int,
  facelift_label text,
  is_lci boolean not null default false,
  active boolean not null default true,
  published boolean not null default true,
  source_type text not null default 'manual',
  source_reference text,
  confidence_score numeric not null default 60 check (confidence_score >= 0 and confidence_score <= 100),
  verification_status text not null default 'imported'
    check (verification_status in ('imported', 'unverified', 'needs_review', 'verified', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, slug)
);

create table if not exists public.vehicle_engines (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.vehicle_generations(id) on delete restrict,
  vehicle_key text not null,
  engine_name text not null,
  display_name text,
  external_id text,
  fuel_type text,
  displacement_cc int,
  stock_hp int,
  stock_nm int,
  year_from int,
  year_to int,
  customer_safe_notes text,
  admin_technical_notes text,
  active boolean not null default true,
  published boolean not null default false,
  source_type text not null default 'manual',
  source_reference text,
  confidence_score numeric not null default 60 check (confidence_score >= 0 and confidence_score <= 100),
  verification_status text not null default 'unverified'
    check (verification_status in ('imported', 'unverified', 'needs_review', 'verified', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_key)
);

create table if not exists public.vehicle_ecu_variants (
  id uuid primary key default gen_random_uuid(),
  engine_id uuid not null references public.vehicle_engines(id) on delete cascade,
  ecu_family text,
  ecu_type text,
  ecu_hardware text,
  ecu_software text,
  ecu_notes text,
  protection_notes text,
  unlock_notes text,
  gearbox_type text,
  tcu_type text,
  tcu_notes text,
  active boolean not null default true,
  published boolean not null default true,
  source_type text not null default 'manual',
  source_reference text,
  confidence_score numeric not null default 60 check (confidence_score >= 0 and confidence_score <= 100),
  verification_status text not null default 'imported'
    check (verification_status in ('imported', 'unverified', 'needs_review', 'verified', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_service_capabilities (
  id uuid primary key default gen_random_uuid(),
  engine_id uuid not null references public.vehicle_engines(id) on delete cascade,
  service_key text not null,
  available boolean not null default false,
  customer_safe_note text,
  admin_note text,
  source_type text not null default 'manual',
  confidence_score numeric not null default 60 check (confidence_score >= 0 and confidence_score <= 100),
  verification_status text not null default 'imported'
    check (verification_status in ('imported', 'unverified', 'needs_review', 'verified', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engine_id, service_key)
);

create table if not exists public.vehicle_performance_profiles (
  id uuid primary key default gen_random_uuid(),
  engine_id uuid not null references public.vehicle_engines(id) on delete cascade,
  stage text not null check (stage in ('stock', 'stage1', 'stage2', 'stage3')),
  stock_hp int,
  stock_nm int,
  tuned_hp int,
  tuned_nm int,
  gain_hp int,
  gain_nm int,
  active boolean not null default true,
  published boolean not null default true,
  source_type text not null default 'manual',
  confidence_score numeric not null default 60 check (confidence_score >= 0 and confidence_score <= 100),
  verification_status text not null default 'imported'
    check (verification_status in ('imported', 'unverified', 'needs_review', 'verified', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engine_id, stage)
);

create table if not exists public.vehicle_change_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_validation_results (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  vehicle_key text,
  severity text not null check (severity in ('info', 'warning', 'error')),
  code text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists vehicle_models_brand_idx on public.vehicle_models (brand_id);
create index if not exists vehicle_generations_model_idx on public.vehicle_generations (model_id);
create index if not exists vehicle_engines_generation_idx on public.vehicle_engines (generation_id);
create index if not exists vehicle_engines_published_idx on public.vehicle_engines (published, active);
create index if not exists vehicle_engines_vehicle_key_idx on public.vehicle_engines (vehicle_key);
create index if not exists vehicle_ecu_variants_engine_idx on public.vehicle_ecu_variants (engine_id);
create index if not exists vehicle_service_capabilities_engine_idx on public.vehicle_service_capabilities (engine_id);
create index if not exists vehicle_service_capabilities_key_idx on public.vehicle_service_capabilities (service_key, available);
create index if not exists vehicle_performance_profiles_engine_idx on public.vehicle_performance_profiles (engine_id);
create index if not exists vehicle_audit_entity_idx on public.vehicle_change_audit_log (entity_type, entity_id, created_at desc);
create index if not exists vehicle_validation_status_idx on public.vehicle_validation_results (status, severity, created_at desc);
create index if not exists vehicle_import_batches_created_idx on public.vehicle_import_batches (created_at desc);

alter table public.vehicle_data_sources enable row level security;
alter table public.vehicle_import_batches enable row level security;
alter table public.vehicle_brands enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_generations enable row level security;
alter table public.vehicle_engines enable row level security;
alter table public.vehicle_ecu_variants enable row level security;
alter table public.vehicle_service_capabilities enable row level security;
alter table public.vehicle_performance_profiles enable row level security;
alter table public.vehicle_change_audit_log enable row level security;
alter table public.vehicle_validation_results enable row level security;

do $$
declare
  v_policy_name text;
  v_table_name text;
begin
  if exists (select 1 from pg_proc where proname = 'has_staff_permission') then
    for v_policy_name, v_table_name in
      select *
      from (values
        ('vehicle admin data sources', 'vehicle_data_sources'),
        ('vehicle admin import batches', 'vehicle_import_batches'),
        ('vehicle admin brands', 'vehicle_brands'),
        ('vehicle admin models', 'vehicle_models'),
        ('vehicle admin generations', 'vehicle_generations'),
        ('vehicle admin engines', 'vehicle_engines'),
        ('vehicle admin ecu variants', 'vehicle_ecu_variants'),
        ('vehicle admin service capabilities', 'vehicle_service_capabilities'),
        ('vehicle admin performance profiles', 'vehicle_performance_profiles'),
        ('vehicle admin audit log', 'vehicle_change_audit_log'),
        ('vehicle admin validation results', 'vehicle_validation_results')
      ) as policies(policy_name, table_name)
    loop
      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = v_table_name
          and policyname = v_policy_name
      ) then
        execute format(
          'create policy %I on public.%I for all using (public.has_staff_permission(''vehicles.manage'')) with check (public.has_staff_permission(''vehicles.manage''))',
          v_policy_name,
          v_table_name
        );
      end if;
    end loop;
  end if;
end $$;
