-- Local-only, rollback-only verification for Learning Flywheel hardening.
-- Run only against a disposable local Supabase database reconstructed from migrations.

begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ai_learning_file_candidates',
    'ai_learning_pair_candidates',
    'ai_learning_review_events',
    'ai_learning_authorization_records',
    'ai_learning_ingestion_jobs'
  ] loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = table_name and c.relrowsecurity
    ) then
      raise exception 'learning table missing RLS: %', table_name;
    end if;
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT') then
      raise exception 'anonymous role can read private learning table: %', table_name;
    end if;
    if not has_table_privilege('service_role', format('public.%I', table_name), 'SELECT') then
      raise exception 'service role cannot read required learning table: %', table_name;
    end if;
  end loop;

  if (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'dtc_request_status_public'
  ) <> 1 then
    raise exception 'DTC projection must have exactly one equivalent permissive policy';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dtc_request_status_public'
      and policyname = 'Customers or staff can read DTC status projection'
      and qual ilike '%auth.uid()%'
      and qual ilike '%has_staff_permission%'
  ) then
    raise exception 'DTC equivalent customer-or-staff policy definition missing';
  end if;
  if has_table_privilege('anon', 'public.dtc_request_status_public', 'SELECT') then
    raise exception 'anonymous role can read DTC projection';
  end if;
  if has_table_privilege('authenticated', 'public.dtc_request_status_public', 'INSERT')
    or has_table_privilege('authenticated', 'public.dtc_request_status_public', 'UPDATE')
    or has_table_privilege('authenticated', 'public.dtc_request_status_public', 'DELETE') then
    raise exception 'authenticated role has DTC projection write grants';
  end if;
end $$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'learning-a@example.test', '', now(), now(), now(), '', '', '', ''),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'learning-b@example.test', '', now(), now(), now(), '', '', '', ''),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'learning-staff@example.test', '', now(), now(), now(), '', '', '', '')
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    create table public.profiles (
      id uuid primary key,
      email text,
      role text,
      staff_role text,
      staff_permissions text[] not null default '{}'
    );
    create or replace function public.has_staff_permission(permission_name text)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $fn$
      select exists (
        select 1 from public.profiles
        where id = auth.uid()
          and role = 'staff'
          and permission_name = any(staff_permissions)
      );
    $fn$;
    grant execute on function public.has_staff_permission(text) to authenticated;
  end if;
end $$;

insert into public.profiles (id, email, role, staff_role, staff_permissions)
values
  ('11111111-1111-4111-8111-111111111111', 'learning-a@example.test', 'customer', null, '{}'),
  ('22222222-2222-4222-8222-222222222222', 'learning-b@example.test', 'customer', null, '{}'),
  ('33333333-3333-4333-8333-333333333333', 'learning-staff@example.test', 'staff', 'calibrator', array['ai_training.manage'])
on conflict (id) do update
set role = excluded.role,
    staff_role = excluded.staff_role,
    staff_permissions = excluded.staff_permissions;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'customer_id'
  ) then
    insert into public.orders (id, customer_id)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222')
    on conflict (id) do nothing;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'user_id'
  ) then
    insert into public.orders (id, user_id)
    values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222')
    on conflict (id) do nothing;
  else
    raise exception 'orders ownership column missing';
  end if;
end $$;

insert into public.dtc_request_status_public (request_id, user_id, status, requested_codes, customer_message)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'expert_review', array['P0401'], 'Queued for expert review.'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'expert_review', array['P2002'], 'Queued for expert review.')
on conflict (request_id, user_id) do update set updated_at = now();

insert into public.ai_learning_file_candidates (
  request_id, customer_id, storage_path, file_name, sha256
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  '22222222/source-b.bin',
  'source-b.bin',
  repeat('b', 64)
)
on conflict (request_id, storage_bucket, storage_path) do nothing;

create temporary table learning_rls_probe (
  probe_name text primary key,
  observed_count integer not null
);
grant insert, select on learning_rls_probe to authenticated;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

insert into learning_rls_probe values
  ('customer_a_dtc_rows', (select count(*) from public.dtc_request_status_public)),
  ('customer_a_private_file_rows', (select count(*) from public.ai_learning_file_candidates)),
  ('customer_a_private_pair_rows', (select count(*) from public.ai_learning_pair_candidates)),
  ('customer_a_private_job_rows', (select count(*) from public.ai_learning_ingestion_jobs));

do $$
declare
  affected integer;
  insert_blocked boolean := false;
  dtc_update_blocked boolean := false;
begin
  begin
    update public.dtc_request_status_public
    set customer_message = 'forbidden'
    where request_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  exception when insufficient_privilege then
    dtc_update_blocked := true;
  end;
  if not dtc_update_blocked then
    raise exception 'ordinary customer retained a DTC projection update path';
  end if;

  update public.ai_learning_file_candidates
  set review_status = 'confirmed'
  where request_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'customer A updated customer B private learning row';
  end if;

  begin
    insert into public.ai_learning_file_candidates (
      request_id, customer_id, storage_path, file_name
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      '11111111/forbidden.bin',
      'forbidden.bin'
    );
  exception when insufficient_privilege then
    insert_blocked := true;
  end;
  if not insert_blocked then
    raise exception 'ordinary customer inserted a private learning row';
  end if;
end $$;

reset role;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
insert into learning_rls_probe values
  ('staff_dtc_rows', (select count(*) from public.dtc_request_status_public)),
  ('staff_private_file_rows', (select count(*) from public.ai_learning_file_candidates));
reset role;

do $$
begin
  if (select observed_count from learning_rls_probe where probe_name = 'customer_a_dtc_rows') <> 1 then
    raise exception 'customer A did not see exactly its own DTC projection';
  end if;
  if exists (
    select 1 from learning_rls_probe
    where probe_name like 'customer_a_private_%' and observed_count <> 0
  ) then
    raise exception 'ordinary customer saw private learning rows';
  end if;
  if (select observed_count from learning_rls_probe where probe_name = 'staff_dtc_rows') <> 2 then
    raise exception 'staff lost DTC projection access';
  end if;
  if (select observed_count from learning_rls_probe where probe_name = 'staff_private_file_rows') <> 1 then
    raise exception 'staff lost private learning corpus access';
  end if;
end $$;

rollback;
