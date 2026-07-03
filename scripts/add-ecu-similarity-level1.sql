-- MG AutoTech ECU Intelligence Level 1: evidence-only similarity search.
-- Additive, idempotent and safe to run more than once.

begin;

create table if not exists public.ai_similarity_results (
  id uuid primary key default gen_random_uuid(),
  source_type text not null
    check (source_type in ('file_expert_job', 'training_sample')),
  source_id uuid not null,
  compared_sample_id uuid references public.ai_training_samples(id) on delete set null,
  ecu_match_score numeric not null default 0,
  file_size_score numeric not null default 0,
  identifier_score numeric not null default 0,
  pattern_score numeric not null default 0,
  feature_label_score numeric not null default 0,
  overall_similarity_score numeric not null default 0,
  match_reasons jsonb,
  mismatch_reasons jsonb,
  compared_features jsonb,
  created_at timestamptz not null default now(),
  constraint ai_similarity_scores_check check (
    ecu_match_score between 0 and 100
    and file_size_score between 0 and 100
    and identifier_score between 0 and 100
    and pattern_score between 0 and 100
    and feature_label_score between 0 and 100
    and overall_similarity_score between 0 and 100
  )
);

create index if not exists ai_similarity_results_source_idx
  on public.ai_similarity_results(source_type, source_id, overall_similarity_score desc);
create index if not exists ai_similarity_results_compared_sample_idx
  on public.ai_similarity_results(compared_sample_id);
create index if not exists ai_similarity_results_score_idx
  on public.ai_similarity_results(overall_similarity_score desc);
create unique index if not exists ai_similarity_results_unique_comparison
  on public.ai_similarity_results(source_type, source_id, compared_sample_id);

alter table if exists public.ai_ecu_knowledge_profiles
  add column if not exists approved_samples integer not null default 0,
  add column if not exists pending_samples integer not null default 0,
  add column if not exists excluded_samples integer not null default 0,
  add column if not exists average_quality_score numeric not null default 0,
  add column if not exists similarity_readiness text not null default 'no_data';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_ecu_profiles_similarity_readiness_check'
      and conrelid = 'public.ai_ecu_knowledge_profiles'::regclass
  ) then
    alter table public.ai_ecu_knowledge_profiles
      add constraint ai_ecu_profiles_similarity_readiness_check
      check (similarity_readiness in ('no_data', 'weak', 'usable', 'strong'));
  end if;
end;
$$;

alter table public.ai_similarity_results enable row level security;

-- Customers receive only a sanitized aggregate from the server API. They never
-- receive direct table access or another customer's training-sample identifiers.
drop policy if exists "Admins can manage AI similarity results" on public.ai_similarity_results;
create policy "Admins can manage AI similarity results"
on public.ai_similarity_results for all to authenticated
using (public.has_staff_permission('ai_training.manage'))
with check (public.has_staff_permission('ai_training.manage'));

comment on table public.ai_similarity_results is
  'Evidence-only comparisons against human-confirmed, approved and quality-gated training samples.';
comment on column public.ai_similarity_results.compared_features is
  'Sanitized comparison metadata only. Raw binary data and private storage paths are forbidden.';

commit;

-- Verification:
-- select source_type, count(*) from public.ai_similarity_results group by source_type;
-- select ecu_family, ecu_type, approved_samples, similarity_readiness
-- from public.ai_ecu_knowledge_profiles order by approved_samples desc;
