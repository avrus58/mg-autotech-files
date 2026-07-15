-- MG AutoTech DTC corpus-readiness metadata export
-- Purpose: run manually in the Supabase Dashboard SQL editor and download the result as CSV.
-- Safety: SELECT-only. Exports metadata needed by the corpus-readiness engine.
-- Excludes firmware bytes, raw hex, customer identity, notes, payments, credentials, storage paths and signed URLs.

with map_sets as (
  select
    ecu_family,
    ecu_type,
    sw_number,
    hw_number
  from public.ai_map_definition_sets
  where active is true
    and (human_verified is true or verification_status = 'confirmed')
),
training_sample_rows as (
  select
    concat('training_sample:', s.id::text) as record_id,
    'training_sample'::text as source_kind,
    coalesce(nullif(s.source_metadata->>'ecu_supplier', ''), s.diff_json #>> '{ecu_identification,supplier}', case when concat_ws(' ', s.ecu_type, s.ecu_family) ilike '%bosch%' then 'Bosch' end) as ecu_supplier,
    coalesce(nullif(s.ecu_family, ''), s.diff_json #>> '{ecu_identification,family}') as ecu_family,
    coalesce(nullif(s.ecu_type, ''), s.diff_json #>> '{ecu_identification,display_name}') as ecu_type,
    coalesce(nullif(s.hw_number, ''), s.diff_json #>> '{ecu_identification,hardware_numbers,0}', nullif(s.source_metadata->>'hw_number', '')) as hw_number,
    coalesce(nullif(s.sw_number, ''), s.diff_json #>> '{ecu_identification,software_numbers,0}', nullif(s.source_metadata->>'sw_number', '')) as sw_number,
    coalesce(nullif(s.source_metadata->>'calibration_id', ''), s.diff_json #>> '{ecu_identification,calibration_ids,0}') as calibration_id,
    coalesce(nullif(s.source_metadata->>'representation_type', ''), s.diff_json #>> '{files,ori,read_scope}') as representation_type,
    'pair'::text as file_role,
    s.ori_file_size::bigint as file_size,
    nullif(s.source_metadata->>'segment_manifest_digest_sha256', '') as segment_manifest_digest,
    coalesce(nullif(s.read_method, ''), s.diff_json #>> '{metadata,read_method}') as read_method,
    coalesce(nullif(s.source_type, ''), 'training_sample') as source_provenance,
    case
      when s.source_metadata->>'authorized_lab' = 'true' then 'authorized_lab'
      when s.source_metadata->>'source_authorized' = 'true' or s.source_metadata->>'trusted_source' = 'true' then 'trusted'
      when s.source_type in ('completed_request', 'file_expert') then 'weak'
      else 'unknown'
    end as source_authorization_quality,
    lower(s.ori_sha256) as original_hash,
    lower(s.mod_sha256) as mod_hash,
    coalesce(s.source_metadata->'exact_dtc_labels', s.source_metadata->'dtc_codes', s.source_metadata->'actual_dtc_codes', '[]'::jsonb) as exact_dtc_labels,
    coalesce(to_jsonb(s.performed_service_labels), to_jsonb(s.requested_service_labels), '[]'::jsonb) as service_labels,
    (s.human_verification_status = 'confirmed') as human_verified,
    (s.learning_use_status = 'approved_for_learning') as learning_approved,
    coalesce(s.data_quality_score::numeric, 70) as pair_confidence,
    case when s.learning_use_status = 'approved_for_learning' then 'approved_for_learning' else s.human_verification_status end as pair_review_status,
    coalesce((s.source_metadata->>'pair_identity_consistent') is distinct from 'false', true)
      and coalesce((s.diff_json #>> '{integrity_assessment,ecu_identity_match}') is distinct from 'false', true) as pair_identity_consistent,
    (
      select string_agg(
        concat_ws(':',
          region->>'start_offset_hex',
          region->>'end_offset_hex',
          region->>'length',
          region->>'changed_byte_count'
        ),
        '|' order by concat_ws(':',
          region->>'start_offset_hex',
          region->>'end_offset_hex',
          region->>'length',
          region->>'changed_byte_count'
        )
      )
      from jsonb_array_elements(coalesce(
        s.diff_json #> '{pattern_signature,main_regions}',
        s.diff_json #> '{pattern_signature,changed_regions}',
        '[]'::jsonb
      )) as region
    ) as changed_region_signature,
    case
      when s.source_metadata->>'changed_region_inconsistent' = 'true' then 'inconsistent'
      when s.diff_json #> '{pattern_signature,main_regions}' is not null
        or s.diff_json #> '{pattern_signature,changed_regions}' is not null then 'consistent'
      else 'unknown'
    end as changed_region_consistency,
    (s.source_metadata->>'unrelated_change' = 'true' or s.change_type_classification in ('broad_rework', 'structural_mismatch')) as unrelated_change,
    (s.source_metadata->>'checksum_only_control' = 'true') as checksum_only_control,
    (s.source_metadata->>'already_modified_negative' = 'true' or s.outcome = 'already_modified') as already_modified_negative,
    (s.source_metadata->>'wrong_pair_negative' = 'true' or s.outcome = 'wrong_pair') as wrong_pair_negative,
    ((s.source_metadata->>'pre_integrity_sha256') ~* '^[0-9a-f]{64}$') as pre_integrity_available,
    (((s.source_metadata->>'final_sha256') ~* '^[0-9a-f]{64}$') or s.mod_sha256 is not null) as final_mod_available,
    exists (
      select 1
      from map_sets m
      where (m.ecu_family is null or upper(regexp_replace(m.ecu_family, '[^A-Z0-9+]', '', 'g')) = upper(regexp_replace(coalesce(s.ecu_family, s.diff_json #>> '{ecu_identification,family}', ''), '[^A-Z0-9+]', '', 'g')))
        and (m.ecu_type is null or upper(regexp_replace(m.ecu_type, '[^A-Z0-9+]', '', 'g')) = upper(regexp_replace(coalesce(s.ecu_type, s.diff_json #>> '{ecu_identification,display_name}', ''), '[^A-Z0-9+]', '', 'g')))
        and (m.sw_number is null or upper(regexp_replace(m.sw_number, '[^A-Z0-9+]', '', 'g')) = upper(regexp_replace(coalesce(s.sw_number, s.diff_json #>> '{ecu_identification,software_numbers,0}', ''), '[^A-Z0-9+]', '', 'g')))
        and (m.hw_number is null or upper(regexp_replace(m.hw_number, '[^A-Z0-9+]', '', 'g')) = upper(regexp_replace(coalesce(s.hw_number, s.diff_json #>> '{ecu_identification,hardware_numbers,0}', ''), '[^A-Z0-9+]', '', 'g')))
    ) or (s.source_metadata->>'map_definition_available' = 'true') as map_definition_available,
    (s.source_metadata->>'integrity_evidence_available' = 'true'
      or (s.source_metadata->>'pre_integrity_sha256') ~* '^[0-9a-f]{64}$'
      or (s.source_metadata->>'final_sha256') ~* '^[0-9a-f]{64}$') as integrity_evidence_available,
    (s.source_metadata->>'bench_verified' = 'true') as bench_verified,
    (s.source_metadata->>'successful_write_readback' = 'true') as successful_write_readback,
    (s.source_metadata->>'rollback_verified' = 'true') as rollback_verified,
    coalesce(s.source_metadata->'conflicts', '[]'::jsonb) as conflict_notes,
    'ai_training_samples'::text as export_source_table,
    now() as exported_at
  from public.ai_training_samples s
),
dataset_pair_rows as (
  select
    concat('dataset_pair:', p.id::text) as record_id,
    'dataset_pair'::text as source_kind,
    coalesce(nullif(ori.provider_metadata->>'ecu_supplier', ''), case when concat_ws(' ', ori.ecu_type_guess, ori.ecu_family_guess) ilike '%bosch%' then 'Bosch' end) as ecu_supplier,
    coalesce(nullif(ori.ecu_family_guess, ''), nullif(mod.ecu_family_guess, ''), nullif(ori.provider_metadata->>'ecu_family', '')) as ecu_family,
    coalesce(nullif(ori.ecu_type_guess, ''), nullif(mod.ecu_type_guess, ''), nullif(ori.provider_metadata->>'ecu_type', '')) as ecu_type,
    coalesce(nullif(ori.hw_number_guess, ''), nullif(mod.hw_number_guess, ''), nullif(ori.provider_metadata->>'hw_number', '')) as hw_number,
    coalesce(nullif(ori.sw_number_guess, ''), nullif(mod.sw_number_guess, ''), nullif(ori.provider_metadata->>'sw_number', '')) as sw_number,
    nullif(ori.provider_metadata->>'calibration_id', '') as calibration_id,
    nullif(ori.provider_metadata->>'representation_type', '') as representation_type,
    case when ori.file_role_guess = 'ori' and mod.file_role_guess = 'mod' then 'pair' else 'unknown' end as file_role,
    ori.file_size::bigint as file_size,
    nullif(ori.provider_metadata->>'segment_manifest_digest_sha256', '') as segment_manifest_digest,
    nullif(ori.provider_metadata->>'read_method', '') as read_method,
    coalesce(nullif(ori.provider_metadata->>'source_provenance', ''), 'dataset_import') as source_provenance,
    case
      when ori.provider_metadata->>'authorized_lab' = 'true' then 'authorized_lab'
      when ori.provider_metadata->>'source_authorized' = 'true' or ori.provider_metadata->>'trusted_source' = 'true' then 'trusted'
      else 'unknown'
    end as source_authorization_quality,
    lower(ori.fingerprint) as original_hash,
    lower(mod.fingerprint) as mod_hash,
    coalesce(ori.provider_metadata->'exact_dtc_labels', ori.provider_metadata->'dtc_codes', ori.provider_metadata->'actual_dtc_codes', '[]'::jsonb) as exact_dtc_labels,
    coalesce(to_jsonb(p.actual_service_labels), to_jsonb(p.service_label_guess), to_jsonb(mod.service_label_guess), '[]'::jsonb) as service_labels,
    (p.review_status in ('approved', 'ready_for_human_label')) as human_verified,
    false as learning_approved,
    p.pair_confidence::numeric as pair_confidence,
    p.review_status as pair_review_status,
    coalesce(p.sw_hw_match, true) and coalesce(ori.validation_status <> 'duplicate', true) and coalesce(mod.validation_status <> 'duplicate', true) as pair_identity_consistent,
    (
      select string_agg(
        concat_ws(':',
          region->>'start_offset_hex',
          region->>'end_offset_hex',
          region->>'length',
          region->>'changed_byte_count'
        ),
        '|' order by concat_ws(':',
          region->>'start_offset_hex',
          region->>'end_offset_hex',
          region->>'length',
          region->>'changed_byte_count'
        )
      )
      from jsonb_array_elements(coalesce(
        p.changed_region_summary->'main_regions',
        p.changed_region_summary->'changed_regions',
        p.changed_region_summary->'regions',
        '[]'::jsonb
      )) as region
    ) as changed_region_signature,
    case
      when p.changed_region_summary->>'inconsistent' = 'true' then 'inconsistent'
      when p.changed_region_summary is not null then 'consistent'
      else 'unknown'
    end as changed_region_consistency,
    (p.changed_region_summary->>'unrelated_change' = 'true') as unrelated_change,
    (p.changed_region_summary->>'checksum_only_control' = 'true') as checksum_only_control,
    (p.learning_recommendation = 'known_bad') as already_modified_negative,
    (p.learning_recommendation = 'reject_wrong_pair') as wrong_pair_negative,
    ((p.changed_region_summary->>'pre_integrity_sha256') ~* '^[0-9a-f]{64}$') as pre_integrity_available,
    (((p.changed_region_summary->>'final_sha256') ~* '^[0-9a-f]{64}$') or mod.fingerprint is not null) as final_mod_available,
    (p.map_attribution_summary->>'map_definition_available' = 'true') as map_definition_available,
    (p.changed_region_summary->>'integrity_evidence_available' = 'true' or (p.changed_region_summary->>'final_sha256') ~* '^[0-9a-f]{64}$') as integrity_evidence_available,
    (p.changed_region_summary->>'bench_verified' = 'true') as bench_verified,
    (p.changed_region_summary->>'successful_write_readback' = 'true') as successful_write_readback,
    (p.changed_region_summary->>'rollback_verified' = 'true') as rollback_verified,
    '[]'::jsonb as conflict_notes,
    'ai_dataset_pair_candidates'::text as export_source_table,
    now() as exported_at
  from public.ai_dataset_pair_candidates p
  left join public.ai_dataset_file_candidates ori on ori.id = p.ori_candidate_id
  left join public.ai_dataset_file_candidates mod on mod.id = p.mod_candidate_id
),
file_expert_rows as (
  select
    concat('file_expert_job:', j.id::text) as record_id,
    'file_expert_job'::text as source_kind,
    coalesce(j.result_json #>> '{ecu_identification,supplier}', case when concat_ws(' ', j.ecu_type, j.ecu_family) ilike '%bosch%' then 'Bosch' end) as ecu_supplier,
    coalesce(nullif(j.ecu_family, ''), j.result_json #>> '{ecu_identification,family}') as ecu_family,
    coalesce(nullif(j.ecu_type, ''), j.result_json #>> '{ecu_identification,display_name}', j.result_json #>> '{metadata,ecu_type}') as ecu_type,
    coalesce(nullif(j.hw_number, ''), j.result_json #>> '{ecu_identification,hardware_numbers,0}') as hw_number,
    coalesce(nullif(j.sw_number, ''), j.result_json #>> '{ecu_identification,software_numbers,0}') as sw_number,
    j.result_json #>> '{ecu_identification,calibration_ids,0}' as calibration_id,
    coalesce(j.result_json #>> '{files,ori,read_scope}', j.result_json #>> '{files,single,read_scope}') as representation_type,
    case when j.result_json #>> '{mode}' = 'single_file' then 'single' else 'ori' end as file_role,
    coalesce((j.ori_file_size)::bigint, (j.result_json #>> '{files,ori,file_size}')::bigint, (j.result_json #>> '{files,single,file_size}')::bigint) as file_size,
    null::text as segment_manifest_digest,
    coalesce(nullif(j.read_method, ''), j.result_json #>> '{metadata,read_method}') as read_method,
    'file_expert_job'::text as source_provenance,
    'weak'::text as source_authorization_quality,
    lower(coalesce(j.ori_sha256, j.result_json #>> '{files,ori,sha256}', j.result_json #>> '{files,single,sha256}')) as original_hash,
    lower(j.result_json #>> '{files,mod,sha256}') as mod_hash,
    '[]'::jsonb as exact_dtc_labels,
    case when j.result_json::text ilike '%dtc_off%' then '["dtc_off"]'::jsonb else '[]'::jsonb end as service_labels,
    false as human_verified,
    false as learning_approved,
    j.confidence_score::numeric as pair_confidence,
    case when j.status = 'completed' then 'needs_review' else j.status end as pair_review_status,
    coalesce((j.result_json #>> '{integrity_assessment,ecu_identity_match}') is distinct from 'false', true) as pair_identity_consistent,
    (
      select string_agg(
        concat_ws(':',
          region->>'start_offset_hex',
          region->>'end_offset_hex',
          region->>'length',
          region->>'changed_byte_count'
        ),
        '|' order by concat_ws(':',
          region->>'start_offset_hex',
          region->>'end_offset_hex',
          region->>'length',
          region->>'changed_byte_count'
        )
      )
      from jsonb_array_elements(coalesce(
        j.result_json #> '{pattern_signature,main_regions}',
        j.result_json #> '{pattern_signature,changed_regions}',
        '[]'::jsonb
      )) as region
    ) as changed_region_signature,
    'unknown'::text as changed_region_consistency,
    ((j.result_json #>> '{change_profile,classification}') in ('broad_rework', 'structural_mismatch')) as unrelated_change,
    false as checksum_only_control,
    ((j.result_json #>> '{summary,stock_or_modified}') = 'likely_modified') as already_modified_negative,
    false as wrong_pair_negative,
    false as pre_integrity_available,
    ((j.result_json #>> '{files,mod,sha256}') ~* '^[0-9a-f]{64}$') as final_mod_available,
    false as map_definition_available,
    false as integrity_evidence_available,
    false as bench_verified,
    false as successful_write_readback,
    false as rollback_verified,
    '[]'::jsonb as conflict_notes,
    'file_expert_jobs'::text as export_source_table,
    now() as exported_at
  from public.file_expert_jobs j
  where j.status = 'completed'
)
select *
from training_sample_rows
union all
select * from dataset_pair_rows
union all
select * from file_expert_rows
order by source_kind, record_id;
