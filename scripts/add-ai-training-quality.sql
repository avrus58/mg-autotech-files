-- MG AutoTech Level 0 hardening: quality-controlled training samples.
-- Additive and safe to run more than once.

alter table if exists public.ai_training_samples
  add column if not exists data_quality_score numeric null
    check (data_quality_score is null or (data_quality_score >= 0 and data_quality_score <= 100));

alter table if exists public.ai_training_samples
  add column if not exists data_quality_reasons jsonb null;

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

create index if not exists ai_training_samples_data_quality_idx
  on public.ai_training_samples(data_quality_score desc, created_at desc);

comment on column public.ai_training_samples.data_quality_score is
  'Level 0 evidence quality score from 0 to 100. This is not a flash-safety score.';

comment on column public.ai_training_samples.data_quality_reasons is
  'Structured positive and negative factors used to calculate data_quality_score.';
