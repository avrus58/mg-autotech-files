-- MG AutoTech DTC Active Processing Phase A
-- Forward-only local/test migration draft.
--
-- Scope:
-- - metadata-only DTC active-processing foundation
-- - private schema and customer-safe positive projection
-- - no firmware bytes, no raw binary, no hex dumps, no output artifacts
--
-- Safety:
-- - do not run on production until docs/dtc-active/REPOSITORY_RECONCILIATION.md
--   is reviewed and the Supabase CLI/local database verification is completed.
-- - additive objects only; no destructive schema or data statements.

begin;

create extension if not exists pgcrypto;

create schema if not exists dtc_private;
comment on schema dtc_private is
  'Server-only DTC active-processing metadata. Not exposed to customer clients.';

revoke all on schema dtc_private from public, anon, authenticated;
grant usage on schema dtc_private to service_role;

create or replace function dtc_private.reject_dtc_immutable_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dtc_private
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%I.%I is append-only; create a new DTC evidence row instead', tg_table_schema, tg_table_name);
end;
$$;

revoke all on function dtc_private.reject_dtc_immutable_mutation() from public, anon, authenticated;
grant execute on function dtc_private.reject_dtc_immutable_mutation() to service_role;

create table if not exists dtc_private.dtc_active_policy_snapshots (
  id uuid primary key default gen_random_uuid(),
  policy_version text not null,
  feature_state_digest_sha256 text not null check (feature_state_digest_sha256 ~ '^[0-9a-f]{64}$'),
  effective_flags jsonb not null default '{}'::jsonb,
  global_kill_switch_engaged boolean not null default true,
  customer_delivery_enabled boolean not null default false,
  real_ecu_rules_enabled boolean not null default false,
  checksum_adapters_enabled boolean not null default false,
  production_automation_enabled boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists dtc_private.dtc_processing_rule_documents (
  id uuid primary key default gen_random_uuid(),
  stable_rule_key text not null,
  semantic_version text not null,
  schema_version text not null default '2.0.0',
  body_json jsonb not null,
  content_digest text not null check (content_digest ~ '^sha256:[0-9a-f]{64}$'),
  lifecycle_status text not null default 'draft'
    check (lifecycle_status in ('draft','candidate','internal_test_approved','human_verified','automation_approved','mature_approved','revoked')),
  mode_scope text not null default 'READ_ONLY'
    check (mode_scope in ('READ_ONLY','INTERNAL_TEST_PROCESSING','CONTROLLED_PRODUCTION_PROCESSING')),
  risk_category text not null default 'unknown',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (stable_rule_key, semantic_version),
  unique (content_digest)
);

create table if not exists dtc_private.dtc_integrity_adapter_documents (
  id uuid primary key default gen_random_uuid(),
  stable_adapter_key text not null,
  semantic_version text not null,
  schema_version text not null default '2.0.0',
  body_json jsonb not null,
  content_digest text not null check (content_digest ~ '^sha256:[0-9a-f]{64}$'),
  adapter_type text not null,
  lifecycle_status text not null default 'draft'
    check (lifecycle_status in ('draft','candidate','internal_test_approved','human_verified','automation_approved','mature_approved','revoked')),
  network_policy text not null default 'deny_all',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (stable_adapter_key, semantic_version),
  unique (content_digest)
);

create table if not exists dtc_private.dtc_golden_corpus_versions (
  id uuid primary key default gen_random_uuid(),
  stable_corpus_key text not null,
  semantic_version text not null,
  manifest_json jsonb not null,
  manifest_digest_sha256 text not null check (manifest_digest_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft' check (status in ('draft','candidate','released','revoked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (stable_corpus_key, semantic_version),
  unique (manifest_digest_sha256)
);

create table if not exists dtc_private.dtc_processing_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.orders(id) on delete restrict,
  work_order_id uuid references public.request_work_orders(id) on delete restrict,
  customer_user_id uuid,
  idempotency_key text not null,
  requested_codes text[] not null default '{}'::text[],
  requested_mode text not null default 'READ_ONLY'
    check (requested_mode in ('READ_ONLY','INTERNAL_TEST_PROCESSING','CONTROLLED_PRODUCTION_PROCESSING')),
  automation_class text not null default 'A0' check (automation_class in ('A0','A1','A2','A3','A4','A5')),
  state text not null default 'expert_review'
    check (state in ('expert_review','queued','leased','completed_unpublished','published','failed_safely','quarantined','cancelled')),
  source_artifact_sha256 text check (source_artifact_sha256 is null or source_artifact_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_digest_sha256 text check (snapshot_digest_sha256 is null or snapshot_digest_sha256 ~ '^[0-9a-f]{64}$'),
  terminal_error_code text,
  internal_test_only boolean not null default true,
  publication_eligible boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (request_id, idempotency_key)
);

create table if not exists dtc_private.dtc_processing_state_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references dtc_private.dtc_processing_attempts(id) on delete restrict,
  event_type text not null,
  old_state text,
  new_state text,
  actor_user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists dtc_private.dtc_processing_controls (
  id uuid primary key default gen_random_uuid(),
  control_scope text not null default 'global',
  control_key text not null,
  enabled boolean not null default false,
  reason text not null,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.dtc_request_status_public (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'expert_review'
    check (status in ('analyzing','expert_review','eligible','processing','completed','unsupported','action_required','failed_safely')),
  requested_codes text[] not null default '{}'::text[],
  customer_message text not null,
  result_version integer,
  downloadable boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (request_id, user_id)
);

create index if not exists dtc_status_public_user_idx
  on public.dtc_request_status_public(user_id, updated_at desc);
create index if not exists dtc_attempts_request_idx
  on dtc_private.dtc_processing_attempts(request_id, created_at desc);
create index if not exists dtc_events_attempt_idx
  on dtc_private.dtc_processing_state_events(attempt_id, created_at desc);
create index if not exists dtc_rule_documents_status_idx
  on dtc_private.dtc_processing_rule_documents(lifecycle_status, created_at desc);
create index if not exists dtc_adapter_documents_status_idx
  on dtc_private.dtc_integrity_adapter_documents(lifecycle_status, created_at desc);

alter table dtc_private.dtc_active_policy_snapshots enable row level security;
alter table dtc_private.dtc_processing_rule_documents enable row level security;
alter table dtc_private.dtc_integrity_adapter_documents enable row level security;
alter table dtc_private.dtc_golden_corpus_versions enable row level security;
alter table dtc_private.dtc_processing_attempts enable row level security;
alter table dtc_private.dtc_processing_state_events enable row level security;
alter table dtc_private.dtc_processing_controls enable row level security;
alter table public.dtc_request_status_public enable row level security;

revoke all on public.dtc_request_status_public from public, anon;
grant select on public.dtc_request_status_public to authenticated;
grant select, insert, update on public.dtc_request_status_public to service_role;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'dtc_processing_rule_documents_immutable'
  ) then
    create trigger dtc_processing_rule_documents_immutable
    before update or delete on dtc_private.dtc_processing_rule_documents
    for each row execute function dtc_private.reject_dtc_immutable_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'dtc_integrity_adapter_documents_immutable'
  ) then
    create trigger dtc_integrity_adapter_documents_immutable
    before update or delete on dtc_private.dtc_integrity_adapter_documents
    for each row execute function dtc_private.reject_dtc_immutable_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'dtc_golden_corpus_versions_immutable'
  ) then
    create trigger dtc_golden_corpus_versions_immutable
    before update or delete on dtc_private.dtc_golden_corpus_versions
    for each row execute function dtc_private.reject_dtc_immutable_mutation();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'dtc_processing_state_events_immutable'
  ) then
    create trigger dtc_processing_state_events_immutable
    before update or delete on dtc_private.dtc_processing_state_events
    for each row execute function dtc_private.reject_dtc_immutable_mutation();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dtc_request_status_public'
      and policyname = 'Customers can read own DTC status projection'
  ) then
    create policy "Customers can read own DTC status projection"
    on public.dtc_request_status_public for select to authenticated
    using (auth.uid() = user_id);
  end if;

  if exists (select 1 from pg_proc where proname = 'has_staff_permission')
    and not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'dtc_request_status_public'
        and policyname = 'Staff can read DTC status projection'
    ) then
    create policy "Staff can read DTC status projection"
    on public.dtc_request_status_public for select to authenticated
    using (public.has_staff_permission('ai_training.manage'));
  end if;
end $$;

revoke all on all tables in schema dtc_private from public, anon, authenticated;
grant select, insert on all tables in schema dtc_private to service_role;
grant usage, select on all sequences in schema dtc_private to service_role;

comment on table public.dtc_request_status_public is
  'Positive customer-safe DTC status projection. No offsets, rules, adapters, checksums, paths or private evidence.';
comment on table dtc_private.dtc_processing_attempts is
  'Server-only DTC attempt metadata. Phase A does not create binary outputs or customer-publishable artifacts.';

commit;
