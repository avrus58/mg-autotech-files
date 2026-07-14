-- MG AutoTech DTC Active Processing Phase C.1
-- Durable local synthetic artifact metadata labeling.
--
-- Scope:
-- - metadata-only marker for internal test artifacts
-- - no firmware bytes, raw binary, hex dumps or customer delivery grants
-- - additive only; designed for disposable local Supabase verification

begin;

alter table if exists dtc_private.dtc_phase_c_synthetic_artifacts
  add column if not exists artifact_classification text not null default 'INTERNAL_TEST_ONLY'
  check (artifact_classification = 'INTERNAL_TEST_ONLY');

comment on column dtc_private.dtc_phase_c_synthetic_artifacts.artifact_classification is
  'Internal safety label for Phase C/C.1 synthetic artifacts. Must remain INTERNAL_TEST_ONLY.';

commit;
