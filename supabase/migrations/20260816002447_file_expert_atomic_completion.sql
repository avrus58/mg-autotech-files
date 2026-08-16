-- Atomically commit a File Expert result and every job-scoped derived row.
-- Prepared only: this migration is not applied to a live environment here.

begin;

create or replace function public.complete_file_expert_analysis_atomic(
  p_job_id uuid,
  p_claim_token uuid,
  p_completion jsonb,
  p_fingerprints jsonb,
  p_similarity_matches jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.file_expert_jobs%rowtype;
  v_confidence integer;
  v_risk_level text;
begin
  if p_job_id is null or p_claim_token is null then
    return false;
  end if;
  if jsonb_typeof(p_completion) is distinct from 'object'
     or jsonb_typeof(p_completion -> 'result_json') is distinct from 'object'
     or jsonb_typeof(p_completion -> 'detected_features') is distinct from 'array'
     or jsonb_typeof(p_fingerprints) is distinct from 'array'
     or jsonb_typeof(p_similarity_matches) is distinct from 'array'
     or jsonb_array_length(p_fingerprints) > 2
     or jsonb_array_length(p_similarity_matches) > 50
     or pg_column_size(p_completion) > 2097152
     or pg_column_size(p_fingerprints) > 2097152
     or pg_column_size(p_similarity_matches) > 1048576 then
    raise exception 'invalid_file_expert_completion_payload';
  end if;

  select *
  into v_job
  from public.file_expert_jobs
  where id = p_job_id
  for update;

  if not found
     or v_job.status <> 'processing'
     or v_job.analysis_claim_token is distinct from p_claim_token
     or v_job.analysis_started_at is null
     or v_job.analysis_started_at < clock_timestamp() - interval '10 minutes' then
    return false;
  end if;

  if v_job.user_id is null
     or (v_job.ori_file_path is null and v_job.mod_file_path is null)
     or (
       v_job.ori_file_path is not null
       and (
         array_length(string_to_array(v_job.ori_file_path, '/'), 1) <> 3
         or split_part(v_job.ori_file_path, '/', 1) <> v_job.user_id::text
         or split_part(v_job.ori_file_path, '/', 2) <> p_job_id::text
         or split_part(v_job.ori_file_path, '/', 3) in ('', '.', '..')
         or position(chr(92) in v_job.ori_file_path) > 0
       )
     )
     or (
       v_job.mod_file_path is not null
       and (
         array_length(string_to_array(v_job.mod_file_path, '/'), 1) <> 3
         or split_part(v_job.mod_file_path, '/', 1) <> v_job.user_id::text
         or split_part(v_job.mod_file_path, '/', 2) <> p_job_id::text
         or split_part(v_job.mod_file_path, '/', 3) in ('', '.', '..')
         or position(chr(92) in v_job.mod_file_path) > 0
       )
     ) then
    return false;
  end if;

  v_confidence := (p_completion ->> 'confidence_score')::integer;
  v_risk_level := p_completion ->> 'risk_level';
  if v_confidence is null
     or v_confidence not between 0 and 100
     or v_risk_level is null
     or v_risk_level not in ('low', 'medium', 'high', 'unknown')
     or coalesce(p_completion ->> 'analysis_version', '') !~ '^2\.[0-9]+\.[0-9]+$'
     or coalesce(p_completion -> 'result_json' ->> 'job_id', '') <> p_job_id::text
     or coalesce(p_completion -> 'result_json' ->> 'analysis_version', '')
        <> (p_completion ->> 'analysis_version') then
    raise exception 'invalid_file_expert_completion_result';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_fingerprints) as rows(item)
    where coalesce(item ->> 'file_role', '') not in ('ori', 'mod', 'single')
       or coalesce(item ->> 'sha256', '') !~ '^[a-f0-9]{64}$'
       or coalesce((item ->> 'file_size')::bigint, 0) <= 0
       or jsonb_typeof(item -> 'ecu_strings') is distinct from 'array'
       or jsonb_typeof(item -> 'ascii_strings') is distinct from 'array'
       or jsonb_typeof(item -> 'active_regions') is distinct from 'array'
       or jsonb_typeof(item -> 'fingerprint_json') is distinct from 'object'
  ) or exists (
    select 1
    from jsonb_array_elements(p_fingerprints) as rows(item)
    group by item ->> 'file_role'
    having count(*) > 1
  ) then
    raise exception 'invalid_file_expert_fingerprints';
  end if;

  if (
    v_job.ori_file_path is not null
    and (
      coalesce(p_completion ->> 'ori_sha256', '') !~ '^[a-f0-9]{64}$'
      or coalesce((p_completion ->> 'ori_file_size')::bigint, 0) <= 0
    )
  ) or (
    v_job.mod_file_path is not null
    and (
      coalesce(p_completion ->> 'mod_sha256', '') !~ '^[a-f0-9]{64}$'
      or coalesce((p_completion ->> 'mod_file_size')::bigint, 0) <= 0
    )
  ) or (
    v_job.ori_file_path is not null
    and v_job.mod_file_path is not null
    and (
      jsonb_array_length(p_fingerprints) <> 2
      or not exists (
        select 1 from jsonb_array_elements(p_fingerprints) as rows(item)
        where item ->> 'file_role' = 'ori'
          and item ->> 'sha256' = p_completion ->> 'ori_sha256'
      )
      or not exists (
        select 1 from jsonb_array_elements(p_fingerprints) as rows(item)
        where item ->> 'file_role' = 'mod'
          and item ->> 'sha256' = p_completion ->> 'mod_sha256'
      )
    )
  ) or (
    (v_job.ori_file_path is null) <> (v_job.mod_file_path is null)
    and (
      jsonb_array_length(p_fingerprints) <> 1
      or not exists (
        select 1 from jsonb_array_elements(p_fingerprints) as rows(item)
        where item ->> 'file_role' = 'single'
          and item ->> 'sha256' = case
            when v_job.ori_file_path is not null then p_completion ->> 'ori_sha256'
            else p_completion ->> 'mod_sha256'
          end
      )
    )
  ) then
    raise exception 'file_expert_fingerprint_result_mismatch';
  end if;

  delete from public.file_expert_binary_fingerprints
  where job_id = p_job_id;

  insert into public.file_expert_binary_fingerprints (
    job_id,
    file_role,
    sha256,
    file_size,
    ecu_strings,
    ascii_strings,
    ff_ratio,
    zero_ratio,
    entropy,
    active_regions,
    fingerprint_json
  )
  select
    p_job_id,
    item ->> 'file_role',
    item ->> 'sha256',
    (item ->> 'file_size')::bigint,
    item -> 'ecu_strings',
    item -> 'ascii_strings',
    (item ->> 'ff_ratio')::numeric,
    (item ->> 'zero_ratio')::numeric,
    (item ->> 'entropy')::numeric,
    item -> 'active_regions',
    item -> 'fingerprint_json'
  from jsonb_array_elements(p_fingerprints) as rows(item);

  -- Level 1 similarity is optional on older installations. When present, it
  -- participates in this same token-bound transaction and cannot outlive the
  -- analysis version that produced it.
  if to_regclass('public.ai_similarity_results') is not null then
    execute $sql$
      delete from public.ai_similarity_results
      where source_type = 'file_expert_job' and source_id = $1
    $sql$ using p_job_id;

    if jsonb_array_length(p_similarity_matches) > 0 then
      execute $sql$
        insert into public.ai_similarity_results (
          source_type,
          source_id,
          compared_sample_id,
          ecu_match_score,
          file_size_score,
          identifier_score,
          pattern_score,
          feature_label_score,
          overall_similarity_score,
          match_reasons,
          mismatch_reasons,
          compared_features
        )
        select
          'file_expert_job',
          $1,
          (item ->> 'training_sample_id')::uuid,
          (item ->> 'ecu_match_score')::numeric,
          (item ->> 'file_size_score')::numeric,
          (item ->> 'identifier_score')::numeric,
          (item ->> 'pattern_score')::numeric,
          (item ->> 'feature_label_score')::numeric,
          (item ->> 'score')::numeric,
          item -> 'reasons',
          item -> 'warnings',
          item -> 'compared_sample'
        from jsonb_array_elements($2) as rows(item)
      $sql$ using p_job_id, p_similarity_matches;
    end if;
  end if;

  update public.file_expert_jobs
  set
    status = 'completed',
    brand = p_completion ->> 'brand',
    model = p_completion ->> 'model',
    engine = p_completion ->> 'engine',
    ecu_type = p_completion ->> 'ecu_type',
    ecu_family = p_completion ->> 'ecu_family',
    sw_number = p_completion ->> 'sw_number',
    hw_number = p_completion ->> 'hw_number',
    ori_sha256 = p_completion ->> 'ori_sha256',
    mod_sha256 = p_completion ->> 'mod_sha256',
    ori_file_size = nullif(p_completion ->> 'ori_file_size', '')::bigint,
    mod_file_size = nullif(p_completion ->> 'mod_file_size', '')::bigint,
    result_json = p_completion -> 'result_json',
    ai_report = p_completion ->> 'ai_report',
    executive_summary = p_completion ->> 'executive_summary',
    detected_features = p_completion -> 'detected_features',
    confidence_score = v_confidence,
    risk_level = v_risk_level,
    error_message = null,
    analysis_claim_token = null,
    analysis_started_at = null
  where id = p_job_id;

  return true;
end;
$$;

alter function public.complete_file_expert_analysis_atomic(
  uuid, uuid, jsonb, jsonb, jsonb
) owner to postgres;
revoke all on function public.complete_file_expert_analysis_atomic(
  uuid, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.complete_file_expert_analysis_atomic(
  uuid, uuid, jsonb, jsonb, jsonb
) to service_role;

comment on function public.complete_file_expert_analysis_atomic(
  uuid, uuid, jsonb, jsonb, jsonb
) is 'Service-only atomic File Expert claim completion with fingerprint and similarity replacement.';

commit;
