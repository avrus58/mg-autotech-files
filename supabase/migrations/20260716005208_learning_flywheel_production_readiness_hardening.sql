-- Learning flywheel production-readiness hardening.
-- Metadata and control-plane state only: no firmware bytes, customer data copy,
-- automatic approval, or automatic historical backfill.

create table if not exists public.ai_learning_authorization_records (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  authorization_status text not null
    check (authorization_status in ('granted', 'denied', 'revoked')),
  terms_version text not null,
  terms_url text not null check (terms_url ~ '^https://'),
  capture_source text not null check (capture_source in ('web', 'desktop', 'admin')),
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_learning_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_id uuid not null references public.orders(id) on delete cascade,
  job_type text not null check (job_type in ('file_candidate', 'pair_candidate')),
  source_type text not null,
  storage_path text,
  file_name text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'timed_out')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  duplicate_hits integer not null default 0 check (duplicate_hits >= 0),
  candidate_id uuid,
  engine_version text not null,
  last_error_code text,
  last_error_message text,
  next_attempt_at timestamptz,
  started_at timestamptz,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  recovered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_learning_authorization_request_idx
  on public.ai_learning_authorization_records(request_id, terms_version, captured_at desc);
create index if not exists ai_learning_authorization_customer_idx
  on public.ai_learning_authorization_records(customer_id, captured_at desc);
create index if not exists ai_learning_ingestion_jobs_status_idx
  on public.ai_learning_ingestion_jobs(status, next_attempt_at, created_at);
create index if not exists ai_learning_ingestion_jobs_request_idx
  on public.ai_learning_ingestion_jobs(request_id, job_type, created_at desc);

alter table public.ai_learning_authorization_records enable row level security;
alter table public.ai_learning_ingestion_jobs enable row level security;

revoke all on public.ai_learning_authorization_terms from public, anon, authenticated;
revoke all on public.ai_learning_file_candidates from public, anon, authenticated;
revoke all on public.ai_learning_pair_candidates from public, anon, authenticated;
revoke all on public.ai_learning_review_events from public, anon, authenticated;
grant select, insert, update on public.ai_learning_authorization_terms to authenticated;
grant select, insert, update on public.ai_learning_file_candidates to authenticated;
grant select, insert, update on public.ai_learning_pair_candidates to authenticated;
grant select, insert, update on public.ai_learning_review_events to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_learning_authorization_records'
      and policyname = 'Staff can manage AI learning authorization records'
  ) then
    create policy "Staff can manage AI learning authorization records"
    on public.ai_learning_authorization_records for all to authenticated
    using ((select public.has_staff_permission('ai_training.manage')))
    with check ((select public.has_staff_permission('ai_training.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_learning_ingestion_jobs'
      and policyname = 'Staff can manage AI learning ingestion jobs'
  ) then
    create policy "Staff can manage AI learning ingestion jobs"
    on public.ai_learning_ingestion_jobs for all to authenticated
    using ((select public.has_staff_permission('ai_training.manage')))
    with check ((select public.has_staff_permission('ai_training.manage')));
  end if;
end $$;

revoke all on public.ai_learning_authorization_records from public, anon, authenticated;
revoke all on public.ai_learning_ingestion_jobs from public, anon, authenticated;
grant select, insert, update on public.ai_learning_authorization_records to authenticated;
grant select, insert, update on public.ai_learning_ingestion_jobs to authenticated;
grant select, insert, update on public.ai_learning_authorization_records to service_role;
grant select, insert, update on public.ai_learning_ingestion_jobs to service_role;

-- Preserve the former permissive-policy OR semantics while avoiding a repeated
-- auth.uid() init-plan and a multiple-permissive-policy planner warning.
drop policy if exists "Customers can read own DTC status projection"
  on public.dtc_request_status_public;
drop policy if exists "Staff can read DTC status projection"
  on public.dtc_request_status_public;
drop policy if exists "Customers or staff can read DTC status projection"
  on public.dtc_request_status_public;
create policy "Customers or staff can read DTC status projection"
on public.dtc_request_status_public for select to authenticated
using (
  (select auth.uid()) = user_id
  or (select public.has_staff_permission('ai_training.manage'))
);

revoke all on public.dtc_request_status_public from authenticated;
grant select on public.dtc_request_status_public to authenticated;

comment on table public.ai_learning_authorization_records is
  'Private, versioned customer learning authorization evidence. Never implies service purchase consent and never stores firmware bytes.';
comment on table public.ai_learning_ingestion_jobs is
  'Private durable retry and idempotency state for metadata-only learning candidate ingestion.';
