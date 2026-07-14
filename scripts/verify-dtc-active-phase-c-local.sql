-- Local-only verification for MG AutoTech DTC Active Processing Phase C.
-- Run only against disposable local Supabase. Read/write test metadata only.

begin;

do $$
declare
  missing_tables text[];
  anon_can_read boolean;
  authenticated_can_read boolean;
  service_can_insert boolean;
  byte_columns integer;
  attempt_id uuid;
  source_artifact_id uuid;
  immutability_blocked boolean := false;
begin
  select array_agg(required.table_name)
  into missing_tables
  from (
    values
      ('dtc_phase_c_synthetic_attempts'),
      ('dtc_phase_c_synthetic_artifacts'),
      ('dtc_phase_c_synthetic_operations'),
      ('dtc_phase_c_synthetic_changed_regions'),
      ('dtc_phase_c_synthetic_validations'),
      ('dtc_phase_c_synthetic_audit_events')
  ) as required(table_name)
  where not exists (
    select 1 from information_schema.tables
    where table_schema = 'dtc_private'
      and table_name = required.table_name
  );

  if missing_tables is not null then
    raise exception 'Phase C missing tables: %', missing_tables;
  end if;

  select count(*)
  into byte_columns
  from information_schema.columns
  where table_schema = 'dtc_private'
    and table_name like 'dtc_phase_c_synthetic_%'
    and data_type = 'bytea';

  if byte_columns <> 0 then
    raise exception 'Phase C must not store firmware bytes in bytea columns';
  end if;

  select has_table_privilege('anon', 'dtc_private.dtc_phase_c_synthetic_artifacts', 'SELECT')
  into anon_can_read;
  select has_table_privilege('authenticated', 'dtc_private.dtc_phase_c_synthetic_artifacts', 'SELECT')
  into authenticated_can_read;
  select has_table_privilege('service_role', 'dtc_private.dtc_phase_c_synthetic_artifacts', 'INSERT')
  into service_can_insert;

  if anon_can_read or authenticated_can_read then
    raise exception 'Phase C synthetic artifacts must not be directly readable by anon/authenticated roles';
  end if;
  if not service_can_insert then
    raise exception 'service_role must be able to insert Phase C synthetic artifact metadata';
  end if;

  set local role service_role;

  insert into dtc_private.dtc_phase_c_synthetic_attempts (
    idempotency_key,
    request_hash_sha256,
    status,
    requested_codes,
    source_sha256,
    pre_integrity_sha256,
    final_sha256
  ) values (
    'local-phase-c-verification',
    repeat('a', 64),
    'succeeded',
    array['P0100','P0300'],
    '3635c2b76cba5164d0b189305a0264e167d8a9e7c3bd264e92574e41acb277c9',
    'aee08c106549d591b7c48ee550b8b3a5139ad14315d3f3c87ab75bf0b8c5205b',
    '0b1d77135352893df994b75da7c9948d6e954ba7f8fe4df78328d09ff20736e0'
  )
  returning id into attempt_id;

  insert into dtc_private.dtc_phase_c_synthetic_artifacts (
    attempt_id,
    artifact_role,
    artifact_reference,
    sha256,
    byte_size
  ) values (
    attempt_id,
    'source',
    'dtc-phase-c/local/source',
    '3635c2b76cba5164d0b189305a0264e167d8a9e7c3bd264e92574e41acb277c9',
    4096
  )
  returning id into source_artifact_id;

  insert into dtc_private.dtc_phase_c_synthetic_artifacts (
    attempt_id,
    artifact_role,
    artifact_reference,
    sha256,
    byte_size,
    parent_artifact_id
  ) values (
    attempt_id,
    'pre_integrity',
    'dtc-phase-c/local/pre',
    'aee08c106549d591b7c48ee550b8b3a5139ad14315d3f3c87ab75bf0b8c5205b',
    4096,
    source_artifact_id
  );

  insert into dtc_private.dtc_phase_c_synthetic_changed_regions (
    attempt_id,
    region_kind,
    region_ref,
    start_offset,
    length_bytes,
    before_sha256,
    after_sha256
  ) values
    (attempt_id, 'semantic', 'fixture.semantic', 516, 1, repeat('b', 64), repeat('c', 64)),
    (attempt_id, 'semantic', 'fixture.semantic', 548, 1, repeat('b', 64), repeat('c', 64)),
    (attempt_id, 'semantic', 'fixture.semantic', 770, 1, repeat('b', 64), repeat('c', 64)),
    (attempt_id, 'semantic', 'fixture.semantic', 786, 1, repeat('b', 64), repeat('c', 64)),
    (attempt_id, 'integrity', 'fixture.integrity.crc32', 4092, 4, repeat('d', 64), repeat('e', 64));

  insert into dtc_private.dtc_phase_c_synthetic_validations (
    attempt_id,
    validation_stage,
    validation_status,
    message
  ) values (
    attempt_id,
    'post_validation',
    'pass',
    'local verification metadata row'
  );

  insert into dtc_private.dtc_phase_c_synthetic_audit_events (
    attempt_id,
    event_type,
    payload
  ) values (
    attempt_id,
    'local_verification',
    '{"internal_test_only": true}'::jsonb
  );

  begin
    update dtc_private.dtc_phase_c_synthetic_artifacts
    set sha256 = repeat('f', 64)
    where id = source_artifact_id;
  exception when others then
    immutability_blocked := true;
  end;

  if not immutability_blocked then
    raise exception 'Phase C artifact immutability trigger did not block update';
  end if;

  reset role;
end $$;

rollback;
