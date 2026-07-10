-- MG AutoTech AI Dataset Import Workbench
-- Safe additive migration with no destructive statements.
-- Run manually in Supabase before enabling persistent dataset import review queues.

create extension if not exists pgcrypto;

create table if not exists public.ai_dataset_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_name text,
  source_reference text,
  provider_name text,
  import_mode text not null default 'dry_run',
  dry_run boolean not null default true,
  status text not null default 'pending',
  total_files integer not null default 0,
  candidate_pairs integer not null default 0,
  confirmed_pairs integer not null default 0,
  duplicates integer not null default 0,
  rejected integer not null default 0,
  needs_review integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_dataset_file_candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.ai_dataset_import_batches(id) on delete cascade,
  filename text not null,
  file_role_guess text not null default 'unknown',
  file_extension text,
  file_size bigint,
  fingerprint text,
  safe_storage_reference text,
  raw_storage_path text,
  ecu_family_guess text,
  ecu_type_guess text,
  sw_number_guess text,
  hw_number_guess text,
  vehicle_guess jsonb not null default '{}'::jsonb,
  service_label_guess jsonb not null default '[]'::jsonb,
  provider_metadata jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending',
  privacy_status text not null default 'pending',
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_dataset_pair_candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.ai_dataset_import_batches(id) on delete cascade,
  ori_candidate_id uuid references public.ai_dataset_file_candidates(id) on delete set null,
  mod_candidate_id uuid references public.ai_dataset_file_candidates(id) on delete set null,
  pair_confidence integer not null default 0 check (pair_confidence >= 0 and pair_confidence <= 100),
  pairing_reasons jsonb not null default '[]'::jsonb,
  ecu_match_score integer not null default 0 check (ecu_match_score >= 0 and ecu_match_score <= 100),
  file_size_relation text,
  sw_hw_match boolean not null default false,
  service_label_guess jsonb not null default '[]'::jsonb,
  actual_service_labels jsonb not null default '[]'::jsonb,
  changed_region_summary jsonb not null default '{}'::jsonb,
  map_attribution_summary jsonb not null default '{}'::jsonb,
  quality_score integer not null default 0 check (quality_score >= 0 and quality_score <= 100),
  quality_reasons jsonb not null default '[]'::jsonb,
  learning_recommendation text not null default 'needs_review',
  review_status text not null default 'pending_review',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_dataset_review_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.ai_dataset_import_batches(id) on delete cascade,
  pair_candidate_id uuid references public.ai_dataset_pair_candidates(id) on delete cascade,
  file_candidate_id uuid references public.ai_dataset_file_candidates(id) on delete cascade,
  action text not null,
  old_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_negative_learning_examples (
  id uuid primary key default gen_random_uuid(),
  source_type text,
  related_training_sample_id uuid references public.ai_training_samples(id) on delete set null,
  related_pair_candidate_id uuid references public.ai_dataset_pair_candidates(id) on delete set null,
  negative_type text not null,
  service_labels jsonb not null default '[]'::jsonb,
  reason text,
  evidence jsonb not null default '{}'::jsonb,
  human_confirmed boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_dataset_file_candidates_batch_idx on public.ai_dataset_file_candidates(batch_id);
create index if not exists ai_dataset_file_candidates_fingerprint_idx on public.ai_dataset_file_candidates(fingerprint);
create index if not exists ai_dataset_file_candidates_ecu_idx on public.ai_dataset_file_candidates(ecu_family_guess, ecu_type_guess, sw_number_guess);
create index if not exists ai_dataset_pair_candidates_batch_idx on public.ai_dataset_pair_candidates(batch_id);
create index if not exists ai_dataset_pair_candidates_review_idx on public.ai_dataset_pair_candidates(review_status);
create index if not exists ai_dataset_review_events_batch_idx on public.ai_dataset_review_events(batch_id);
create index if not exists ai_negative_learning_examples_type_idx on public.ai_negative_learning_examples(negative_type);
create index if not exists ai_negative_learning_examples_active_idx on public.ai_negative_learning_examples(active);

alter table public.ai_dataset_import_batches enable row level security;
alter table public.ai_dataset_file_candidates enable row level security;
alter table public.ai_dataset_pair_candidates enable row level security;
alter table public.ai_dataset_review_events enable row level security;
alter table public.ai_negative_learning_examples enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_dataset_import_batches' and policyname = 'Admins can manage AI dataset import batches') then
    create policy "Admins can manage AI dataset import batches"
    on public.ai_dataset_import_batches for all to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_dataset_file_candidates' and policyname = 'Admins can manage AI dataset file candidates') then
    create policy "Admins can manage AI dataset file candidates"
    on public.ai_dataset_file_candidates for all to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_dataset_pair_candidates' and policyname = 'Admins can manage AI dataset pair candidates') then
    create policy "Admins can manage AI dataset pair candidates"
    on public.ai_dataset_pair_candidates for all to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_dataset_review_events' and policyname = 'Admins can manage AI dataset review events') then
    create policy "Admins can manage AI dataset review events"
    on public.ai_dataset_review_events for all to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_negative_learning_examples' and policyname = 'Admins can manage AI negative learning examples') then
    create policy "Admins can manage AI negative learning examples"
    on public.ai_negative_learning_examples for all to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;
end $$;

grant select, insert, update on public.ai_dataset_import_batches to authenticated;
grant select, insert, update on public.ai_dataset_file_candidates to authenticated;
grant select, insert, update on public.ai_dataset_pair_candidates to authenticated;
grant select, insert, update on public.ai_dataset_review_events to authenticated;
grant select, insert, update on public.ai_negative_learning_examples to authenticated;
