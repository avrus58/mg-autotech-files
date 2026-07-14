-- Read/assert local verification for scripts/add-dtc-active-processing-phase-a.sql.
--
-- Run only against a disposable local Supabase database after applying:
-- 1. supabase/migrations/20260714132000_dtc_phase_a_test_baseline.sql
-- 2. scripts/add-dtc-active-processing-phase-a.sql

begin;

do $$
declare
  table_name text;
  required_private_tables text[] := array[
    'dtc_active_policy_snapshots',
    'dtc_processing_rule_documents',
    'dtc_integrity_adapter_documents',
    'dtc_golden_corpus_versions',
    'dtc_processing_attempts',
    'dtc_processing_state_events',
    'dtc_processing_controls'
  ];
begin
  if not exists (select 1 from pg_namespace where nspname = 'dtc_private') then
    raise exception 'dtc_private schema missing';
  end if;

  foreach table_name in array required_private_tables loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dtc_private'
        and c.relname = table_name
        and c.relkind = 'r'
    ) then
      raise exception 'missing private DTC table: %', table_name;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dtc_private'
        and c.relname = table_name
        and c.relrowsecurity
    ) then
      raise exception 'RLS not enabled for private DTC table: %', table_name;
    end if;

    if has_table_privilege('authenticated', format('dtc_private.%I', table_name), 'SELECT') then
      raise exception 'authenticated role can select private DTC table: %', table_name;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'dtc_request_status_public'
      and c.relrowsecurity
  ) then
    raise exception 'public DTC status projection missing RLS';
  end if;

  if has_table_privilege('anon', 'public.dtc_request_status_public', 'SELECT') then
    raise exception 'anon role can select DTC customer projection';
  end if;

  if not has_table_privilege('authenticated', 'public.dtc_request_status_public', 'SELECT') then
    raise exception 'authenticated role cannot select DTC customer projection';
  end if;

  if not has_table_privilege('service_role', 'public.dtc_request_status_public', 'INSERT') then
    raise exception 'service_role cannot insert DTC customer projection';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dtc_request_status_public'
      and policyname = 'Customers can read own DTC status projection'
  ) then
    raise exception 'customer DTC status projection policy missing';
  end if;

  foreach table_name in array array[
    'dtc_processing_rule_documents_immutable',
    'dtc_integrity_adapter_documents_immutable',
    'dtc_golden_corpus_versions_immutable',
    'dtc_processing_state_events_immutable'
  ] loop
    if not exists (select 1 from pg_trigger where tgname = table_name) then
      raise exception 'immutable trigger missing: %', table_name;
    end if;
  end loop;
end $$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values
  (
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dtc-a@example.test',
    '',
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dtc-b@example.test',
    '',
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

insert into public.orders (id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222')
on conflict (id) do nothing;

insert into public.dtc_request_status_public (
  request_id,
  user_id,
  status,
  requested_codes,
  customer_message
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'expert_review',
    array['P0401'],
    'Your DTC request is queued for expert review.'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'expert_review',
    array['P2002'],
    'Your DTC request is queued for expert review.'
  )
on conflict (request_id, user_id) do update
set status = excluded.status,
    requested_codes = excluded.requested_codes,
    customer_message = excluded.customer_message,
    updated_at = now();

create temporary table dtc_phase_a_rls_probe (
  probe_name text primary key,
  visible_count integer not null
);
grant insert, select on dtc_phase_a_rls_probe to authenticated;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

insert into dtc_phase_a_rls_probe (probe_name, visible_count)
select 'customer_a_visible_rows', count(*)
from public.dtc_request_status_public;

reset role;

do $$
declare
  observed_count integer;
  update_blocked boolean := false;
begin
  select visible_count
  into observed_count
  from dtc_phase_a_rls_probe
  where probe_name = 'customer_a_visible_rows';

  if observed_count <> 1 then
    raise exception 'customer RLS expected 1 visible row, observed %', observed_count;
  end if;

  insert into dtc_private.dtc_processing_rule_documents (
    stable_rule_key,
    semantic_version,
    body_json,
    content_digest
  ) values (
    'phase-a-local-verification',
    '0.0.1',
    '{"scope":"verification_only"}'::jsonb,
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  )
  on conflict (content_digest) do nothing;

  begin
    update dtc_private.dtc_processing_rule_documents
    set risk_category = 'changed'
    where content_digest = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  exception when sqlstate '55000' then
    update_blocked := true;
  end;

  if not update_blocked then
    raise exception 'append-only trigger did not block rule document update';
  end if;
end $$;

rollback;
