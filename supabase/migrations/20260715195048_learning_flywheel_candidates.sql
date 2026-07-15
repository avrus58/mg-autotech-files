-- MG AutoTech general ECU learning flywheel candidate layer.
-- Additive/private metadata only. No firmware bytes, no customer-safe exposure,
-- no automatic learning approval, and no destructive statements.

create extension if not exists pgcrypto;

create table if not exists public.ai_learning_authorization_terms (
  id uuid primary key default gen_random_uuid(),
  terms_key text not null unique,
  terms_version text not null,
  title text not null,
  body text,
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_learning_file_candidates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.orders(id) on delete cascade,
  customer_id uuid,
  source_type text not null default 'customer_upload'
    check (source_type in ('customer_upload', 'desktop_upload', 'additional_upload', 'modified_output', 'historical_backfill', 'manual_review')),
  file_role_candidate text not null default 'unknown'
    check (file_role_candidate in ('ori', 'mod', 'single', 'unknown')),
  storage_bucket text not null default 'customer-files',
  storage_path text not null,
  file_name text,
  file_size bigint,
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  supplier text,
  ecu_family text,
  ecu_type text,
  hw_number text,
  sw_number text,
  calibration_id text,
  representation_type text,
  read_method text,
  identity_confidence numeric not null default 0 check (identity_confidence >= 0 and identity_confidence <= 1),
  identity_conflicts jsonb not null default '[]'::jsonb,
  requested_service_labels jsonb not null default '{}'::jsonb,
  dtc_codes jsonb not null default '[]'::jsonb,
  stock_or_modified_guess text not null default 'unknown'
    check (stock_or_modified_guess in ('likely_stock', 'likely_modified', 'unknown')),
  learning_authorization_status text not null default 'not_granted'
    check (learning_authorization_status in ('not_granted', 'granted', 'revoked', 'unknown')),
  learning_authorization_terms_version text,
  analysis_status text not null default 'pending'
    check (analysis_status in ('pending', 'enriched', 'failed', 'needs_review')),
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review', 'needs_review', 'confirmed', 'quarantined', 'excluded')),
  quality_score integer not null default 0 check (quality_score >= 0 and quality_score <= 100),
  quality_reasons jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, storage_bucket, storage_path)
);

create table if not exists public.ai_learning_pair_candidates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.orders(id) on delete cascade,
  customer_id uuid,
  ori_file_candidate_id uuid references public.ai_learning_file_candidates(id) on delete set null,
  mod_file_candidate_id uuid references public.ai_learning_file_candidates(id) on delete set null,
  linked_training_sample_id uuid,
  ori_sha256 text check (ori_sha256 is null or ori_sha256 ~ '^[a-f0-9]{64}$'),
  mod_sha256 text check (mod_sha256 is null or mod_sha256 ~ '^[a-f0-9]{64}$'),
  pair_identity_key text,
  pair_confidence integer not null default 0 check (pair_confidence >= 0 and pair_confidence <= 100),
  pair_type text not null default 'uncertain'
    check (pair_type in ('single_service_clean', 'multi_service', 'checksum_only_noop', 'uncertain', 'already_modified_source')),
  requested_service_labels jsonb not null default '{}'::jsonb,
  performed_service_labels jsonb not null default '{}'::jsonb,
  dtc_codes jsonb not null default '[]'::jsonb,
  changed_region_summary jsonb not null default '{}'::jsonb,
  pattern_signature jsonb not null default '{}'::jsonb,
  quality_score integer not null default 0 check (quality_score >= 0 and quality_score <= 100),
  quality_reasons jsonb not null default '[]'::jsonb,
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review', 'needs_review', 'human_verified', 'approved', 'quarantined', 'excluded')),
  learning_use_status text not null default 'pending'
    check (learning_use_status in ('pending', 'approved_for_learning', 'excluded')),
  learning_authorization_status text not null default 'not_granted'
    check (learning_authorization_status in ('not_granted', 'granted', 'revoked', 'unknown')),
  learning_authorization_terms_version text,
  provenance jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, ori_sha256, mod_sha256)
);

create table if not exists public.ai_learning_review_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.orders(id) on delete cascade,
  file_candidate_id uuid references public.ai_learning_file_candidates(id) on delete cascade,
  pair_candidate_id uuid references public.ai_learning_pair_candidates(id) on delete cascade,
  action text not null,
  old_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists ai_learning_file_candidates_request_idx on public.ai_learning_file_candidates(request_id, created_at desc);
create index if not exists ai_learning_file_candidates_customer_idx on public.ai_learning_file_candidates(customer_id, created_at desc);
create index if not exists ai_learning_file_candidates_sha_idx on public.ai_learning_file_candidates(sha256);
create index if not exists ai_learning_file_candidates_identity_idx on public.ai_learning_file_candidates(ecu_family, ecu_type, sw_number, hw_number);
create index if not exists ai_learning_file_candidates_review_idx on public.ai_learning_file_candidates(review_status, analysis_status);

create index if not exists ai_learning_pair_candidates_request_idx on public.ai_learning_pair_candidates(request_id, created_at desc);
create index if not exists ai_learning_pair_candidates_customer_idx on public.ai_learning_pair_candidates(customer_id, created_at desc);
create index if not exists ai_learning_pair_candidates_hash_idx on public.ai_learning_pair_candidates(ori_sha256, mod_sha256);
create index if not exists ai_learning_pair_candidates_identity_idx on public.ai_learning_pair_candidates(pair_identity_key);
create index if not exists ai_learning_pair_candidates_review_idx on public.ai_learning_pair_candidates(review_status, learning_use_status);

create index if not exists ai_learning_review_events_request_idx on public.ai_learning_review_events(request_id, created_at desc);
create index if not exists ai_learning_review_events_pair_idx on public.ai_learning_review_events(pair_candidate_id, created_at desc);
create index if not exists ai_learning_review_events_file_idx on public.ai_learning_review_events(file_candidate_id, created_at desc);

alter table public.ai_learning_authorization_terms enable row level security;
alter table public.ai_learning_file_candidates enable row level security;
alter table public.ai_learning_pair_candidates enable row level security;
alter table public.ai_learning_review_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_learning_authorization_terms' and policyname = 'Admins can manage AI learning authorization terms') then
    create policy "Admins can manage AI learning authorization terms"
    on public.ai_learning_authorization_terms for all to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_learning_file_candidates' and policyname = 'Admins can manage AI learning file candidates') then
    create policy "Admins can manage AI learning file candidates"
    on public.ai_learning_file_candidates for all to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_learning_pair_candidates' and policyname = 'Admins can manage AI learning pair candidates') then
    create policy "Admins can manage AI learning pair candidates"
    on public.ai_learning_pair_candidates for all to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_learning_review_events' and policyname = 'Admins can manage AI learning review events') then
    create policy "Admins can manage AI learning review events"
    on public.ai_learning_review_events for all to authenticated
    using (public.has_staff_permission('ai_training.manage'))
    with check (public.has_staff_permission('ai_training.manage'));
  end if;
end $$;

grant select, insert, update on public.ai_learning_authorization_terms to authenticated;
grant select, insert, update on public.ai_learning_file_candidates to authenticated;
grant select, insert, update on public.ai_learning_pair_candidates to authenticated;
grant select, insert, update on public.ai_learning_review_events to authenticated;
grant select, insert, update on public.ai_learning_authorization_terms to service_role;
grant select, insert, update on public.ai_learning_file_candidates to service_role;
grant select, insert, update on public.ai_learning_pair_candidates to service_role;
grant select, insert, update on public.ai_learning_review_events to service_role;

comment on table public.ai_learning_file_candidates is 'Private metadata-only customer upload learning candidates. Never stores firmware bytes and never auto-approves learning.';
comment on table public.ai_learning_pair_candidates is 'Private metadata-only ORI/MOD learning pair candidates. Review-first gate before ai_training_samples/similarity.';
comment on table public.ai_learning_authorization_terms is 'Configurable learning authorization terms versions; historical uploads remain not_granted until explicit evidence exists.';
