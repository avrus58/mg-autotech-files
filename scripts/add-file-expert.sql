-- MG AutoTech AI File Expert MVP
-- Run this in Supabase SQL editor before using /dashboard/file-expert.

create extension if not exists pgcrypto;

create table if not exists public.file_expert_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  brand text,
  model text,
  engine text,
  ecu_type text,
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.file_expert_feedback (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.file_expert_jobs(id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete set null,
  actual_features jsonb,
  ai_correct boolean,
  quality_rating int check (quality_rating is null or (quality_rating between 1 and 5)),
  safety_rating text check (safety_rating is null or safety_rating in ('safe', 'aggressive', 'risky', 'unknown')),
  admin_notes text,
  created_at timestamptz default now()
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
  created_at timestamptz default now()
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
  created_at timestamptz default now()
);

create index if not exists file_expert_jobs_user_id_idx on public.file_expert_jobs(user_id);
create index if not exists file_expert_jobs_status_idx on public.file_expert_jobs(status);
create index if not exists file_expert_jobs_created_at_idx on public.file_expert_jobs(created_at desc);
create index if not exists file_expert_feedback_job_id_idx on public.file_expert_feedback(job_id);
create index if not exists known_file_patterns_feature_idx on public.known_file_patterns(feature_type);
create index if not exists file_expert_binary_fingerprints_job_id_idx on public.file_expert_binary_fingerprints(job_id);

create or replace function public.set_file_expert_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_file_expert_jobs_updated_at on public.file_expert_jobs;
create trigger set_file_expert_jobs_updated_at
before update on public.file_expert_jobs
for each row
execute function public.set_file_expert_updated_at();

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
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can manage file expert feedback" on public.file_expert_feedback;
create policy "Admins can manage file expert feedback"
on public.file_expert_feedback for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can manage known file patterns" on public.known_file_patterns;
create policy "Admins can manage known file patterns"
on public.known_file_patterns for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admins can manage file expert fingerprints" on public.file_expert_binary_fingerprints;
create policy "Admins can manage file expert fingerprints"
on public.file_expert_binary_fingerprints for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Customers can read fingerprints for own jobs" on public.file_expert_binary_fingerprints;
create policy "Customers can read fingerprints for own jobs"
on public.file_expert_binary_fingerprints for select
using (
  exists (
    select 1 from public.file_expert_jobs j
    where j.id = job_id and j.user_id = auth.uid()
  )
);

-- Admin UI and analyzer API use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- If your existing app uses direct admin RLS policies, add matching role-based policies here.

insert into storage.buckets (id, name, public)
values ('file-expert', 'file-expert', false)
on conflict (id) do nothing;

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
