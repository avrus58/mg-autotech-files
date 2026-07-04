-- MG AutoTech ECU Intelligence Level 2: pattern clustering and accuracy metrics.
-- Additive, evidence-only and safe to run more than once. No binary data is stored here.

begin;

create extension if not exists pgcrypto;

create table if not exists public.ai_pattern_clusters (
  id uuid primary key default gen_random_uuid(),
  cluster_key text not null unique,
  ecu_family text,
  ecu_type text,
  sw_number text,
  hw_number text,
  feature_type text not null check (feature_type in (
    'stage1', 'stage2', 'stage3', 'dpf_off', 'egr_off', 'adblue_off',
    'dtc_off', 'vmax_off', 'pop_bangs', 'tcu_tune', 'tcu_shift', 'tcu_lockup'
  )),
  sample_count integer not null default 0 check (sample_count >= 0),
  approved_sample_count integer not null default 0 check (approved_sample_count >= 0),
  human_verified_sample_count integer not null default 0 check (human_verified_sample_count >= 0),
  average_quality_score numeric not null default 0 check (average_quality_score between 0 and 100),
  cluster_confidence numeric not null default 0 check (cluster_confidence between 0 and 100),
  cluster_status text not null default 'weak' check (cluster_status in ('weak', 'usable', 'strong', 'mature')),
  repeated_regions jsonb,
  common_pattern_signature jsonb,
  feature_consistency_json jsonb,
  outlier_sample_ids jsonb,
  source_sample_ids jsonb,
  last_rebuilt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_pattern_clusters_ecu_idx
  on public.ai_pattern_clusters(ecu_family, ecu_type);
create index if not exists ai_pattern_clusters_feature_idx
  on public.ai_pattern_clusters(feature_type);
create index if not exists ai_pattern_clusters_confidence_idx
  on public.ai_pattern_clusters(cluster_confidence desc);
create index if not exists ai_pattern_clusters_status_idx
  on public.ai_pattern_clusters(cluster_status);
create index if not exists ai_pattern_clusters_rebuilt_idx
  on public.ai_pattern_clusters(last_rebuilt_at desc);

create table if not exists public.ai_cluster_members (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.ai_pattern_clusters(id) on delete cascade,
  training_sample_id uuid not null references public.ai_training_samples(id) on delete cascade,
  membership_score numeric not null default 0 check (membership_score between 0 and 100),
  membership_reasons jsonb,
  is_outlier boolean not null default false,
  created_at timestamptz not null default now(),
  unique (cluster_id, training_sample_id)
);

create index if not exists ai_cluster_members_sample_idx
  on public.ai_cluster_members(training_sample_id);
create index if not exists ai_cluster_members_outlier_idx
  on public.ai_cluster_members(cluster_id, is_outlier);

create table if not exists public.ai_accuracy_metrics (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('global', 'ecu_family', 'ecu_type', 'feature_type', 'cluster')),
  scope_key text not null,
  total_reviewed integer not null default 0 check (total_reviewed >= 0),
  auto_label_correct integer not null default 0 check (auto_label_correct >= 0),
  auto_label_partial integer not null default 0 check (auto_label_partial >= 0),
  auto_label_wrong integer not null default 0 check (auto_label_wrong >= 0),
  precision_score numeric not null default 0 check (precision_score between 0 and 100),
  review_coverage numeric not null default 0 check (review_coverage between 0 and 100),
  average_quality_score numeric not null default 0 check (average_quality_score between 0 and 100),
  confusion_json jsonb,
  last_calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_type, scope_key)
);

create index if not exists ai_accuracy_metrics_scope_idx
  on public.ai_accuracy_metrics(scope_type, scope_key);
create index if not exists ai_accuracy_metrics_precision_idx
  on public.ai_accuracy_metrics(precision_score desc);
create index if not exists ai_accuracy_metrics_calculated_idx
  on public.ai_accuracy_metrics(last_calculated_at desc);

alter table if exists public.ai_ecu_knowledge_profiles
  add column if not exists cluster_count integer not null default 0,
  add column if not exists strong_cluster_count integer not null default 0,
  add column if not exists usable_cluster_count integer not null default 0,
  add column if not exists weak_cluster_count integer not null default 0,
  add column if not exists outlier_count integer not null default 0,
  add column if not exists pattern_clustering_readiness text not null default 'no_data',
  add column if not exists accuracy_summary jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_ecu_profiles_pattern_clustering_readiness_check'
      and conrelid = 'public.ai_ecu_knowledge_profiles'::regclass
  ) then
    alter table public.ai_ecu_knowledge_profiles
      add constraint ai_ecu_profiles_pattern_clustering_readiness_check
      check (pattern_clustering_readiness in ('no_data', 'weak', 'usable', 'strong', 'mature'));
  end if;
end;
$$;

create or replace function public.touch_ai_level2_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_pattern_clusters_touch_updated_at on public.ai_pattern_clusters;
create trigger ai_pattern_clusters_touch_updated_at
before update on public.ai_pattern_clusters
for each row execute function public.touch_ai_level2_updated_at();

drop trigger if exists ai_accuracy_metrics_touch_updated_at on public.ai_accuracy_metrics;
create trigger ai_accuracy_metrics_touch_updated_at
before update on public.ai_accuracy_metrics
for each row execute function public.touch_ai_level2_updated_at();

alter table public.ai_pattern_clusters enable row level security;
alter table public.ai_cluster_members enable row level security;
alter table public.ai_accuracy_metrics enable row level security;

drop policy if exists "Admins can manage AI pattern clusters" on public.ai_pattern_clusters;
create policy "Admins can manage AI pattern clusters"
on public.ai_pattern_clusters for all to authenticated
using (public.has_staff_permission('ai_training.manage'))
with check (public.has_staff_permission('ai_training.manage'));

drop policy if exists "Admins can manage AI cluster members" on public.ai_cluster_members;
create policy "Admins can manage AI cluster members"
on public.ai_cluster_members for all to authenticated
using (public.has_staff_permission('ai_training.manage'))
with check (public.has_staff_permission('ai_training.manage'));

drop policy if exists "Admins can manage AI accuracy metrics" on public.ai_accuracy_metrics;
create policy "Admins can manage AI accuracy metrics"
on public.ai_accuracy_metrics for all to authenticated
using (public.has_staff_permission('ai_training.manage'))
with check (public.has_staff_permission('ai_training.manage'));

comment on table public.ai_pattern_clusters is
  'Evidence-only aggregates built from approved, confirmed and quality-gated training samples. Never write-ready output.';
comment on table public.ai_cluster_members is
  'Admin-only sample membership evidence. Customer APIs must never expose training sample identifiers.';
comment on table public.ai_accuracy_metrics is
  'Aggregated automatic-label accuracy measurements. Empty reviewed sets must remain explicitly insufficient.';

commit;

-- Verification only:
-- select cluster_status, count(*) from public.ai_pattern_clusters group by cluster_status;
-- select scope_type, scope_key, precision_score from public.ai_accuracy_metrics order by scope_type, scope_key;
