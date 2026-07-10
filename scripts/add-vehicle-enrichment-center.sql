create extension if not exists pgcrypto;

create table if not exists public.vehicle_external_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text,
  source_type text not null default 'manual',
  source_url text,
  source_reference text,
  policy_status text not null default 'manual_assisted'
    check (policy_status in ('manual_assisted', 'approved_reference', 'blocked', 'needs_review')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_external_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.vehicle_external_sources(id) on delete set null,
  source_name text,
  source_url text,
  mode text not null default 'dry_run' check (mode in ('dry_run', 'draft_create', 'review')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'reviewed', 'archived', 'rejected')),
  modern_only boolean not null default true,
  year_cutoff integer not null default 2020,
  total_entries integer not null default 0,
  normalized_groups integer not null default 0,
  engine_candidates integer not null default 0,
  draft_generations_created integer not null default 0,
  draft_engines_created integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_external_entries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.vehicle_external_import_batches(id) on delete cascade,
  raw_title text,
  raw_model text,
  raw_generation text,
  raw_body_type text,
  raw_year_range text,
  raw_power_range text,
  platform_codes jsonb not null default '[]'::jsonb,
  parsed_year_from integer,
  parsed_year_to integer,
  source_url text,
  inclusion_status text not null default 'pending'
    check (inclusion_status in ('pending', 'included', 'excluded', 'ignored', 'rejected')),
  exclusion_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_external_generation_groups (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.vehicle_external_import_batches(id) on delete cascade,
  brand text,
  model text,
  internal_generation_label text,
  customer_display_label text,
  year_from integer,
  year_to integer,
  platform_codes jsonb not null default '[]'::jsonb,
  body_variants jsonb not null default '[]'::jsonb,
  included_entry_ids jsonb not null default '[]'::jsonb,
  excluded_entry_ids jsonb not null default '[]'::jsonb,
  confidence_score integer not null default 50 check (confidence_score >= 0 and confidence_score <= 100),
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'draft', 'verified', 'published', 'ignored', 'rejected', 'archived')),
  matched_existing_generation_id uuid,
  draft_generation_id uuid,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_external_engine_candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.vehicle_external_import_batches(id) on delete cascade,
  generation_group_id uuid references public.vehicle_external_generation_groups(id) on delete cascade,
  engine_display_name text,
  engine_code text,
  fuel_type text,
  displacement_cc integer,
  stock_hp integer,
  stock_kw integer,
  stock_nm integer,
  stage1_hp_estimate integer,
  stage1_nm_estimate integer,
  estimate_source text,
  estimate_confidence text,
  drivetrain text,
  transmission text,
  hybrid_type text,
  body_variant_availability jsonb not null default '[]'::jsonb,
  year_from integer,
  year_to integer,
  source_url text,
  confidence_score integer not null default 50 check (confidence_score >= 0 and confidence_score <= 100),
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'draft', 'verified', 'published', 'ignored', 'rejected', 'archived')),
  matched_existing_engine_id uuid,
  draft_engine_id uuid,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_external_diffs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.vehicle_external_import_batches(id) on delete cascade,
  entity_type text,
  entity_id uuid,
  candidate_id uuid,
  field_name text,
  existing_value jsonb,
  candidate_value jsonb,
  diff_type text,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error')),
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed', 'ignored', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_external_review_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  entity_type text,
  entity_id uuid,
  action text,
  old_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_external_batches_created_idx on public.vehicle_external_import_batches (created_at desc);
create index if not exists vehicle_external_batches_status_idx on public.vehicle_external_import_batches (status, created_at desc);
create index if not exists vehicle_external_entries_batch_idx on public.vehicle_external_entries (batch_id);
create index if not exists vehicle_external_groups_batch_idx on public.vehicle_external_generation_groups (batch_id);
create index if not exists vehicle_external_groups_brand_model_idx on public.vehicle_external_generation_groups (brand, model);
create index if not exists vehicle_external_groups_review_idx on public.vehicle_external_generation_groups (review_status);
create index if not exists vehicle_external_engines_batch_idx on public.vehicle_external_engine_candidates (batch_id);
create index if not exists vehicle_external_engines_group_idx on public.vehicle_external_engine_candidates (generation_group_id);
create index if not exists vehicle_external_engines_review_idx on public.vehicle_external_engine_candidates (review_status);
create index if not exists vehicle_external_diffs_batch_idx on public.vehicle_external_diffs (batch_id, severity);
create index if not exists vehicle_external_review_events_batch_idx on public.vehicle_external_review_events (batch_id, created_at desc);

alter table public.vehicle_external_sources enable row level security;
alter table public.vehicle_external_import_batches enable row level security;
alter table public.vehicle_external_entries enable row level security;
alter table public.vehicle_external_generation_groups enable row level security;
alter table public.vehicle_external_engine_candidates enable row level security;
alter table public.vehicle_external_diffs enable row level security;
alter table public.vehicle_external_review_events enable row level security;

do $$
declare
  v_policy_name text;
  v_table_name text;
begin
  if exists (select 1 from pg_proc where proname = 'has_staff_permission') then
    for v_policy_name, v_table_name in
      select *
      from (values
        ('vehicle enrichment admin sources', 'vehicle_external_sources'),
        ('vehicle enrichment admin batches', 'vehicle_external_import_batches'),
        ('vehicle enrichment admin entries', 'vehicle_external_entries'),
        ('vehicle enrichment admin generation groups', 'vehicle_external_generation_groups'),
        ('vehicle enrichment admin engine candidates', 'vehicle_external_engine_candidates'),
        ('vehicle enrichment admin diffs', 'vehicle_external_diffs'),
        ('vehicle enrichment admin review events', 'vehicle_external_review_events')
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
