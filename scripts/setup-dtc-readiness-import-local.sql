-- Local-only setup for DTC readiness metadata imports.
-- Intended for disposable local Supabase databases only.
-- This is additive and metadata-only. It stores no firmware bytes, raw hex, paths or customer identity.

create table if not exists public.dtc_readiness_import_records (
  id text primary key,
  import_batch_id text not null,
  record_id text not null,
  source_kind text not null,
  ecu_supplier text,
  ecu_family text,
  ecu_type text,
  hw_number text,
  sw_number text,
  calibration_id text,
  representation_type text,
  file_role text,
  file_size bigint,
  segment_manifest_digest text,
  read_method text,
  source_provenance text,
  source_authorization_quality text,
  original_hash text,
  mod_hash text,
  exact_dtc_labels jsonb not null default '[]'::jsonb,
  service_labels jsonb not null default '[]'::jsonb,
  human_verified boolean not null default false,
  learning_approved boolean not null default false,
  pair_confidence numeric,
  pair_review_status text,
  pair_identity_consistent boolean,
  changed_region_signature text,
  changed_region_consistency text,
  unrelated_change boolean not null default false,
  checksum_only_control boolean not null default false,
  already_modified_negative boolean not null default false,
  wrong_pair_negative boolean not null default false,
  pre_integrity_available boolean not null default false,
  final_mod_available boolean not null default false,
  map_definition_available boolean not null default false,
  integrity_evidence_available boolean not null default false,
  bench_verified boolean not null default false,
  successful_write_readback boolean not null default false,
  rollback_verified boolean not null default false,
  conflict_notes jsonb not null default '[]'::jsonb,
  export_source_table text,
  exported_at timestamptz,
  raw_record jsonb not null default '{}'::jsonb,
  validation_status text not null default 'accepted',
  imported_at timestamptz not null default now(),
  unique (import_batch_id, record_id)
);

alter table public.dtc_readiness_import_records enable row level security;

revoke all on table public.dtc_readiness_import_records from anon;
revoke all on table public.dtc_readiness_import_records from authenticated;
grant select, insert on table public.dtc_readiness_import_records to service_role;
