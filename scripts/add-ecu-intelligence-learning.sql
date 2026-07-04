-- MG AutoTech ECU Intelligence & Learning Engine
-- Safe, additive and idempotent. Run in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- Align the existing File Expert schema without removing existing data.
create table if not exists public.file_expert_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  brand text,
  model text,
  engine text,
  ecu_type text,
  ecu_family text,
  sw_number text,
  hw_number text,
  read_method text,
  customer_notes text,
  ori_file_path text,
  mod_file_path text,
  ori_file_name text,
  mod_file_name text,
  ori_sha256 text,
  mod_sha256 text,
  ori_file_size bigint,
  mod_file_size bigint,
  result_json jsonb,
  ai_report text,
  executive_summary text,
  detected_features jsonb,
  confidence_score numeric,
  risk_level text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.file_expert_feedback (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.file_expert_jobs(id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete set null,
  actual_features jsonb,
  ai_correct boolean,
  quality_rating int check (quality_rating is null or quality_rating between 1 and 5),
  safety_rating text check (safety_rating is null or safety_rating in ('unknown', 'safe', 'aggressive', 'risky', 'bad')),
  admin_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.known_file_patterns (
  id uuid primary key default gen_random_uuid(),
  ecu_family text,
  ecu_type text,
  sw_number text,
  hw_number text,
  feature_type text,
  pattern_signature jsonb not null,
  source_job_id uuid references public.file_expert_jobs(id) on delete set null,
  human_confirmed boolean default false,
  confidence numeric default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.file_expert_binary_fingerprints (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.file_expert_jobs(id) on delete cascade,
  file_role text not null check (file_role in ('ori', 'mod', 'single')),
  sha256 text not null,
  file_size bigint not null,
  ecu_strings jsonb,
  ascii_strings jsonb,
  ff_ratio numeric,
  zero_ratio numeric,
  entropy numeric,
  active_regions jsonb,
  fingerprint_json jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.file_expert_jobs add column if not exists ecu_family text;
alter table if exists public.file_expert_jobs add column if not exists sw_number text;
alter table if exists public.file_expert_jobs add column if not exists hw_number text;

create table if not exists public.ai_training_samples (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  ori_file_path text not null,
  mod_file_path text not null,
  ori_file_name text,
  mod_file_name text,
  ori_sha256 text,
  mod_sha256 text,
  ori_file_size bigint,
  mod_file_size bigint,
  brand text,
  model text,
  engine text,
  ecu_type text,
  ecu_family text,
  sw_number text,
  hw_number text,
  read_method text,
  service_labels jsonb,
  provider text,
  revision_label text,
  source_metadata jsonb,
  diff_json jsonb,
  pattern_signature jsonb,
  auto_label_confidence numeric,
  auto_labels_correct boolean,
  human_verified boolean not null default false,
  human_verification_status text not null default 'unverified'
    check (human_verification_status in ('unverified', 'confirmed', 'rejected', 'needs_review')),
  quality_rating int check (quality_rating is null or quality_rating between 1 and 5),
  data_quality_score numeric check (data_quality_score is null or (data_quality_score >= 0 and data_quality_score <= 100)),
  data_quality_reasons jsonb,
  safety_rating text check (safety_rating is null or safety_rating in ('unknown', 'safe', 'aggressive', 'risky', 'bad')),
  outcome text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.ai_training_samples add column if not exists auto_labels_correct boolean;
alter table if exists public.ai_training_samples add column if not exists data_quality_score numeric;
alter table if exists public.ai_training_samples add column if not exists data_quality_reasons jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_training_samples_data_quality_score_check'
      and conrelid = 'public.ai_training_samples'::regclass
  ) then
    alter table public.ai_training_samples
      add constraint ai_training_samples_data_quality_score_check
      check (data_quality_score is null or (data_quality_score >= 0 and data_quality_score <= 100));
  end if;
end;
$$;

create table if not exists public.ai_ecu_knowledge_profiles (
  id uuid primary key default gen_random_uuid(),
  ecu_family text,
  ecu_type text,
  sw_number text,
  hw_number text,
  total_samples int not null default 0,
  human_verified_samples int not null default 0,
  unverified_samples int not null default 0,
  rejected_samples int not null default 0,
  stage1_samples int not null default 0,
  stage2_samples int not null default 0,
  stage3_samples int not null default 0,
  dpf_off_samples int not null default 0,
  egr_off_samples int not null default 0,
  adblue_off_samples int not null default 0,
  dtc_off_samples int not null default 0,
  vmax_off_samples int not null default 0,
  pop_bangs_samples int not null default 0,
  tcu_tune_samples int not null default 0,
  tcu_shift_samples int not null default 0,
  tcu_lockup_samples int not null default 0,
  learning_level int not null default 0 check (learning_level between 0 and 5),
  detection_confidence numeric not null default 0,
  pattern_confidence numeric not null default 0,
  map_candidate_confidence numeric not null default 0,
  generation_readiness text not null default 'not_ready'
    check (generation_readiness in ('not_ready', 'detection_ready', 'pattern_ready', 'map_candidate_ready', 'suggestion_ready', 'draft_ready')),
  profile_json jsonb,
  last_updated_at timestamptz not null default now()
);

create table if not exists public.ai_pattern_signatures (
  id uuid primary key default gen_random_uuid(),
  training_sample_id uuid references public.ai_training_samples(id) on delete cascade,
  ecu_family text,
  ecu_type text,
  sw_number text,
  feature_type text,
  signature_json jsonb not null,
  human_confirmed boolean not null default false,
  confidence numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_training_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  request_id uuid,
  training_sample_id uuid references public.ai_training_samples(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_model_runs (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid,
  provider text not null,
  model_name text,
  prompt_version text,
  input_json jsonb,
  output_text text,
  output_json jsonb,
  latency_ms int,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ai_training_samples_request_idx
  on public.ai_training_samples(request_id, created_at desc);
create index if not exists ai_training_samples_ecu_idx
  on public.ai_training_samples(ecu_family, ecu_type, sw_number, hw_number);
create index if not exists ai_training_samples_verification_idx
  on public.ai_training_samples(human_verification_status, created_at desc);
create index if not exists ai_training_samples_data_quality_idx
  on public.ai_training_samples(data_quality_score desc, created_at desc);
create unique index if not exists ai_training_samples_request_hash_unique
  on public.ai_training_samples(request_id, ori_sha256, mod_sha256)
  where request_id is not null and ori_sha256 is not null and mod_sha256 is not null;
create unique index if not exists ai_training_samples_hash_unique_without_request
  on public.ai_training_samples(ori_sha256, mod_sha256)
  where request_id is null and ori_sha256 is not null and mod_sha256 is not null;
create unique index if not exists ai_ecu_knowledge_profile_identity_unique
  on public.ai_ecu_knowledge_profiles (
    coalesce(ecu_family, ''),
    coalesce(ecu_type, ''),
    coalesce(sw_number, ''),
    coalesce(hw_number, '')
  );
create index if not exists ai_pattern_signatures_sample_idx
  on public.ai_pattern_signatures(training_sample_id);
create index if not exists ai_pattern_signatures_lookup_idx
  on public.ai_pattern_signatures(ecu_family, ecu_type, sw_number, feature_type);
create index if not exists ai_training_events_request_idx
  on public.ai_training_events(request_id, created_at desc);
create index if not exists ai_training_events_sample_idx
  on public.ai_training_events(training_sample_id, created_at desc);
create index if not exists ai_model_runs_source_idx
  on public.ai_model_runs(source_type, source_id, created_at desc);
create index if not exists file_expert_binary_fingerprints_job_idx
  on public.file_expert_binary_fingerprints(job_id);
create index if not exists known_file_patterns_lookup_idx
  on public.known_file_patterns(ecu_family, ecu_type, sw_number, feature_type);

create or replace function public.set_ai_learning_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai_training_samples_updated_at on public.ai_training_samples;
create trigger set_ai_training_samples_updated_at
before update on public.ai_training_samples
for each row execute function public.set_ai_learning_updated_at();

drop trigger if exists set_file_expert_jobs_updated_at on public.file_expert_jobs;
create trigger set_file_expert_jobs_updated_at
before update on public.file_expert_jobs
for each row execute function public.set_ai_learning_updated_at();

alter table public.ai_training_samples enable row level security;
alter table public.ai_ecu_knowledge_profiles enable row level security;
alter table public.ai_pattern_signatures enable row level security;
alter table public.ai_training_events enable row level security;
alter table public.ai_model_runs enable row level security;
alter table public.file_expert_jobs enable row level security;
alter table public.file_expert_feedback enable row level security;
alter table public.known_file_patterns enable row level security;
alter table public.file_expert_binary_fingerprints enable row level security;

drop policy if exists "Customers can read own file expert jobs" on public.file_expert_jobs;
create policy "Customers can read own file expert jobs"
on public.file_expert_jobs for select
using (auth.uid() = user_id);

drop policy if exists "Customers can create own file expert jobs" on public.file_expert_jobs;
create policy "Customers can create own file expert jobs"
on public.file_expert_jobs for insert
with check (auth.uid() = user_id);

drop policy if exists "Admins can manage file expert jobs" on public.file_expert_jobs;
create policy "Admins can manage file expert jobs"
on public.file_expert_jobs for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can manage file expert feedback" on public.file_expert_feedback;
create policy "Admins can manage file expert feedback"
on public.file_expert_feedback for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can manage known file patterns" on public.known_file_patterns;
create policy "Admins can manage known file patterns"
on public.known_file_patterns for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can manage file expert fingerprints" on public.file_expert_binary_fingerprints;
create policy "Admins can manage file expert fingerprints"
on public.file_expert_binary_fingerprints for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Customers can read fingerprints for own jobs" on public.file_expert_binary_fingerprints;
create policy "Customers can read fingerprints for own jobs"
on public.file_expert_binary_fingerprints for select
using (exists (
  select 1 from public.file_expert_jobs j
  where j.id = job_id and j.user_id = auth.uid()
));

-- Admin browser access is intentionally limited to role=admin. Staff dashboard APIs use
-- the service role after checking granular permissions in src/lib/apiAuth.ts.
drop policy if exists "Admins can manage AI training samples" on public.ai_training_samples;
create policy "Admins can manage AI training samples"
on public.ai_training_samples for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can manage AI knowledge profiles" on public.ai_ecu_knowledge_profiles;
create policy "Admins can manage AI knowledge profiles"
on public.ai_ecu_knowledge_profiles for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can manage AI pattern signatures" on public.ai_pattern_signatures;
create policy "Admins can manage AI pattern signatures"
on public.ai_pattern_signatures for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can read AI training events" on public.ai_training_events;
create policy "Admins can read AI training events"
on public.ai_training_events for select
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can read AI model runs" on public.ai_model_runs;
create policy "Admins can read AI model runs"
on public.ai_model_runs for select
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into storage.buckets (id, name, public)
values ('ai-training', 'ai-training', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('file-expert', 'file-expert', false)
on conflict (id) do update set public = false;

drop policy if exists "Customers can upload own file expert objects" on storage.objects;
create policy "Customers can upload own file expert objects"
on storage.objects for insert
with check (
  bucket_id = 'file-expert'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Customers can read own file expert objects" on storage.objects;
create policy "Customers can read own file expert objects"
on storage.objects for select
using (
  bucket_id = 'file-expert'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- No customer storage policies are created for ai-training. The application accesses
-- it only through server-side service-role code.
