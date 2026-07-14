-- MG AutoTech DTC Active Processing Phase C
-- Synthetic active test-output metadata only.
--
-- Scope:
-- - approved MGDTCFX1 synthetic fixture attempts
-- - immutable source/pre-integrity/final artifact metadata
-- - semantic/integrity changed-region metadata
-- - validation and audit event records
--
-- Safety:
-- - additive objects only
-- - no firmware bytes, raw binary, hex dumps or customer delivery grants
-- - private schema only; no public/customer projection for artifacts

begin;

create extension if not exists pgcrypto;

create schema if not exists dtc_private;
revoke all on schema dtc_private from public, anon, authenticated;
grant usage on schema dtc_private to service_role;

create table if not exists dtc_private.dtc_phase_c_synthetic_attempts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash_sha256 text not null check (request_hash_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'queued'
    check (status in ('queued','claimed','processing','succeeded','failed','cancelled')),
  requested_codes text[] not null default '{}'::text[],
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  pre_integrity_sha256 text check (pre_integrity_sha256 is null or pre_integrity_sha256 ~ '^[0-9a-f]{64}$'),
  final_sha256 text check (final_sha256 is null or final_sha256 ~ '^[0-9a-f]{64}$'),
  hard_vetoes text[] not null default '{}'::text[],
  lease_token uuid,
  lease_owner text,
  lease_expires_at timestamptz,
  fencing_token bigint not null default 0,
  actor_user_id uuid,
  internal_test_only boolean not null default true check (internal_test_only is true),
  customer_publishable boolean not null default false check (customer_publishable is false),
  customer_delivery_enabled boolean not null default false check (customer_delivery_enabled is false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dtc_private.dtc_phase_c_synthetic_artifacts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references dtc_private.dtc_phase_c_synthetic_attempts(id) on delete restrict,
  artifact_role text not null check (artifact_role in ('source','pre_integrity','final')),
  artifact_reference text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size = 4096),
  parent_artifact_id uuid references dtc_private.dtc_phase_c_synthetic_artifacts(id) on delete restrict,
  storage_kind text not null default 'memory_synthetic_test'
    check (storage_kind in ('memory_synthetic_test','local_disposable_test')),
  internal_test_only boolean not null default true check (internal_test_only is true),
  customer_publishable boolean not null default false check (customer_publishable is false),
  created_at timestamptz not null default now(),
  unique (attempt_id, artifact_role),
  unique (artifact_reference)
);

create table if not exists dtc_private.dtc_phase_c_synthetic_operations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references dtc_private.dtc_phase_c_synthetic_attempts(id) on delete restrict,
  operation_id text not null,
  operation_type text not null check (operation_type in ('write_bitfield','write_enum')),
  offset_start integer not null check (offset_start >= 0 and offset_start < 4096),
  width_bytes integer not null check (width_bytes > 0 and offset_start + width_bytes <= 4096),
  allowed_region_ref text not null,
  semantic_reason text not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, operation_id)
);

create table if not exists dtc_private.dtc_phase_c_synthetic_changed_regions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references dtc_private.dtc_phase_c_synthetic_attempts(id) on delete restrict,
  region_kind text not null check (region_kind in ('semantic','integrity')),
  region_ref text not null,
  start_offset integer not null check (start_offset >= 0 and start_offset < 4096),
  length_bytes integer not null check (length_bytes > 0 and start_offset + length_bytes <= 4096),
  before_sha256 text not null check (before_sha256 ~ '^[0-9a-f]{64}$'),
  after_sha256 text not null check (after_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists dtc_private.dtc_phase_c_synthetic_validations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references dtc_private.dtc_phase_c_synthetic_attempts(id) on delete restrict,
  validation_stage text not null
    check (validation_stage in ('source','dry_run','semantic_patch','integrity_adapter','post_validation','audit')),
  validation_status text not null check (validation_status in ('pass','fail')),
  hard_vetoes text[] not null default '{}'::text[],
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists dtc_private.dtc_phase_c_synthetic_audit_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references dtc_private.dtc_phase_c_synthetic_attempts(id) on delete restrict,
  event_type text not null,
  actor_user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dtc_phase_c_attempt_status_idx
  on dtc_private.dtc_phase_c_synthetic_attempts(status, created_at desc);
create index if not exists dtc_phase_c_attempt_idempotency_idx
  on dtc_private.dtc_phase_c_synthetic_attempts(idempotency_key);
create index if not exists dtc_phase_c_artifacts_attempt_idx
  on dtc_private.dtc_phase_c_synthetic_artifacts(attempt_id, artifact_role);
create index if not exists dtc_phase_c_regions_attempt_idx
  on dtc_private.dtc_phase_c_synthetic_changed_regions(attempt_id, region_kind, start_offset);
create index if not exists dtc_phase_c_events_attempt_idx
  on dtc_private.dtc_phase_c_synthetic_audit_events(attempt_id, created_at desc);

alter table dtc_private.dtc_phase_c_synthetic_attempts enable row level security;
alter table dtc_private.dtc_phase_c_synthetic_artifacts enable row level security;
alter table dtc_private.dtc_phase_c_synthetic_operations enable row level security;
alter table dtc_private.dtc_phase_c_synthetic_changed_regions enable row level security;
alter table dtc_private.dtc_phase_c_synthetic_validations enable row level security;
alter table dtc_private.dtc_phase_c_synthetic_audit_events enable row level security;

revoke all on all tables in schema dtc_private from public, anon, authenticated;
grant select, insert, update on dtc_private.dtc_phase_c_synthetic_attempts to service_role;
grant select, insert on dtc_private.dtc_phase_c_synthetic_artifacts to service_role;
grant select, insert on dtc_private.dtc_phase_c_synthetic_operations to service_role;
grant select, insert on dtc_private.dtc_phase_c_synthetic_changed_regions to service_role;
grant select, insert on dtc_private.dtc_phase_c_synthetic_validations to service_role;
grant select, insert on dtc_private.dtc_phase_c_synthetic_audit_events to service_role;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'dtc_phase_c_synthetic_artifacts_immutable'
  ) then
    create trigger dtc_phase_c_synthetic_artifacts_immutable
    before update or delete on dtc_private.dtc_phase_c_synthetic_artifacts
    for each row execute function dtc_private.reject_dtc_immutable_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'dtc_phase_c_synthetic_operations_immutable'
  ) then
    create trigger dtc_phase_c_synthetic_operations_immutable
    before update or delete on dtc_private.dtc_phase_c_synthetic_operations
    for each row execute function dtc_private.reject_dtc_immutable_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'dtc_phase_c_synthetic_changed_regions_immutable'
  ) then
    create trigger dtc_phase_c_synthetic_changed_regions_immutable
    before update or delete on dtc_private.dtc_phase_c_synthetic_changed_regions
    for each row execute function dtc_private.reject_dtc_immutable_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'dtc_phase_c_synthetic_validations_immutable'
  ) then
    create trigger dtc_phase_c_synthetic_validations_immutable
    before update or delete on dtc_private.dtc_phase_c_synthetic_validations
    for each row execute function dtc_private.reject_dtc_immutable_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'dtc_phase_c_synthetic_audit_events_immutable'
  ) then
    create trigger dtc_phase_c_synthetic_audit_events_immutable
    before update or delete on dtc_private.dtc_phase_c_synthetic_audit_events
    for each row execute function dtc_private.reject_dtc_immutable_mutation();
  end if;
end $$;

comment on table dtc_private.dtc_phase_c_synthetic_attempts is
  'Phase C synthetic active test-output attempts. Internal test metadata only; no customer delivery.';
comment on table dtc_private.dtc_phase_c_synthetic_artifacts is
  'Immutable source/pre-integrity/final synthetic artifact metadata. Stores hashes and byte sizes, never firmware bytes.';
comment on table dtc_private.dtc_phase_c_synthetic_changed_regions is
  'Semantic and synthetic integrity changed-region metadata for internal validation only.';

commit;
