-- Reconcile the activation preflight with PostgreSQL's 63-byte identifier limit.
-- The widget_domain_change_requests policy names are deterministically truncated
-- by PostgreSQL; the installed policies themselves are otherwise complete.

create or replace function app_private.assert_customer_device_assurance_ready()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_missing text;
  v_signature text;
  v_relation text;
  v_operation text;
  v_function regprocedure;
  v_security_definer boolean;
  v_fixed_path boolean;
  v_definition text;
begin
  select pg_catalog.string_agg(expected.policy_name, ', ' order by expected.policy_name)
  into v_missing
  from (values
    ('public', 'profiles', 'MG assured customer profile select boundary', 'SELECT', true, false, false),
    ('public', 'profiles', 'MG assured customer profile update boundary', 'UPDATE', true, true, false),
    ('public', 'orders', 'MG assured customer order select boundary', 'SELECT', true, false, false),
    ('public', 'credit_transactions', 'MG assured customer credit select boundary', 'SELECT', true, false, false),
    ('public', 'notifications', 'MG assured customer notifications select boundary', 'SELECT', true, false, false),
    ('public', 'notifications', 'MG assured customer notifications update boundary', 'UPDATE', true, true, false),
    ('public', 'growth_customer_preferences', 'MG assured customer growth_customer_preferences select boundary', 'SELECT', true, false, false),
    ('public', 'widget_clients', 'MG assured customer widget_clients select boundary', 'SELECT', true, false, false),
    ('public', 'widget_domain_change_requests', 'MG assured customer widget_domain_change_requests select boundary', 'SELECT', true, false, false),
    ('public', 'widget_domain_change_requests', 'MG assured customer widget_domain_change_requests insert boundary', 'INSERT', false, true, false),
    ('storage', 'objects', 'MG protected buckets assured select boundary', 'SELECT', true, false, true),
    ('storage', 'objects', 'MG protected buckets assured insert boundary', 'INSERT', false, true, true),
    ('storage', 'objects', 'MG protected buckets assured update boundary', 'UPDATE', true, true, true),
    ('storage', 'objects', 'MG protected buckets assured delete boundary', 'DELETE', true, false, true)
  ) as expected(
    schema_name,
    table_name,
    policy_name,
    command_name,
    requires_using,
    requires_check,
    protects_buckets
  )
  where pg_catalog.to_regclass(expected.schema_name || '.' || expected.table_name) is not null
    and not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = expected.schema_name
        and policy.tablename = expected.table_name
        and policy.policyname = pg_catalog.substr(expected.policy_name, 1, 63)
        and policy.permissive = 'RESTRICTIVE'
        and policy.cmd = expected.command_name
        and policy.roles = array['authenticated']::name[]
        and (
          not expected.requires_using
          or pg_catalog.strpos(
            pg_catalog.lower(coalesce(policy.qual, '')),
            'current_customer_session_assured'
          ) > 0
        )
        and (expected.requires_using or policy.qual is null)
        and (
          not expected.requires_check
          or pg_catalog.strpos(
            pg_catalog.lower(coalesce(policy.with_check, '')),
            'current_customer_session_assured'
          ) > 0
        )
        and (expected.requires_check or policy.with_check is null)
        and (
          not expected.protects_buckets
          or (
            pg_catalog.strpos(
              pg_catalog.lower(
                coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
              ),
              'customer-files'
            ) > 0
            and pg_catalog.strpos(
              pg_catalog.lower(
                coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
              ),
              'file-expert'
            ) > 0
          )
        )
    );
  if v_missing is not null then
    raise exception 'Customer assurance policies are incomplete: %', v_missing;
  end if;

  select pg_catalog.string_agg(relation_name, ', ' order by relation_name)
  into v_missing
  from (values
    ('public.customer_auth_assurance_config'),
    ('public.customer_trusted_devices'),
    ('public.customer_session_assurance'),
    ('public.customer_device_email_challenges'),
    ('public.profiles'),
    ('public.orders'),
    ('public.credit_transactions'),
    ('public.notifications'),
    ('public.growth_customer_preferences'),
    ('public.widget_clients'),
    ('public.widget_domain_change_requests'),
    ('storage.objects')
  ) as expected(relation_name)
  join pg_catalog.pg_class as relation
    on relation.oid = pg_catalog.to_regclass(expected.relation_name)
  where not relation.relrowsecurity;
  if v_missing is not null then
    raise exception 'Customer assurance target RLS is disabled: %', v_missing;
  end if;

  foreach v_relation in array array[
    'public.customer_auth_assurance_config',
    'public.customer_trusted_devices',
    'public.customer_session_assurance',
    'public.customer_device_email_challenges'
  ]
  loop
    foreach v_operation in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if pg_catalog.has_table_privilege('authenticated', v_relation, v_operation) then
        raise exception 'Authenticated role has unsafe % access to %.', v_operation, v_relation;
      end if;
    end loop;
  end loop;

  foreach v_signature in array array[
    'public.get_customer_session_assurance_state(uuid,uuid)',
    'public.prepare_customer_password_change_verification(uuid,uuid)',
    'public.customer_password_change_verification_state(uuid,uuid)',
    'public.assure_customer_session_from_trusted_device(uuid,uuid,text,smallint)',
    'public.reserve_customer_device_challenge(uuid,uuid,uuid,text,smallint,text,boolean,uuid)',
    'public.mark_customer_device_challenge_sent(uuid,uuid,uuid)',
    'public.invalidate_customer_device_challenge(uuid,uuid,uuid)',
    'public.consume_customer_device_challenge(uuid,uuid,uuid,text,smallint,text,text)',
    'public.revoke_customer_trusted_device(uuid,uuid)',
    'public.revoke_other_customer_trusted_devices(uuid,uuid)',
    'public.revoke_all_customer_trusted_devices(uuid)',
    'public.activate_customer_device_assurance(integer)',
    'public.disable_customer_device_assurance()'
  ]
  loop
    v_function := pg_catalog.to_regprocedure(v_signature);
    if v_function is null then
      raise exception 'Required customer assurance function is missing: %', v_signature;
    end if;
    if pg_catalog.has_function_privilege('authenticated', v_function::oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('anon', v_function::oid, 'EXECUTE')
      or not pg_catalog.has_function_privilege('service_role', v_function::oid, 'EXECUTE') then
      raise exception 'Customer assurance function ACL is unsafe: %', v_signature;
    end if;
    select
      procedure.prosecdef,
      exists (
        select 1
        from pg_catalog.unnest(procedure.proconfig) as config(value)
        where config.value in ('search_path=', 'search_path=""')
      )
    into v_security_definer, v_fixed_path
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_function::oid;
    if not coalesce(v_security_definer, false)
      or not coalesce(v_fixed_path, false) then
      raise exception 'Customer assurance function metadata is unsafe: %', v_signature;
    end if;
  end loop;

  v_function := pg_catalog.to_regprocedure('app_private.current_customer_session_assured()');
  if v_function is null
    or not pg_catalog.has_function_privilege('authenticated', v_function::oid, 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', v_function::oid, 'EXECUTE')
    or pg_catalog.has_function_privilege('service_role', v_function::oid, 'EXECUTE') then
    raise exception 'Customer assurance RLS helper ACL is unsafe.';
  end if;

  foreach v_signature in array array[
    'public.create_order_with_credit_deduction_without_assurance(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
    'public.create_web_order_with_credit_deduction_without_assurance(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
    'public.create_desktop_order_with_credit_deduction_without_assurance(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'
  ]
  loop
    v_function := pg_catalog.to_regprocedure(v_signature);
    if v_function is null
      or pg_catalog.has_function_privilege('authenticated', v_function::oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('service_role', v_function::oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('anon', v_function::oid, 'EXECUTE') then
      raise exception 'Ungated order core is missing or executable: %', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
    'public.create_desktop_order_with_credit_deduction(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'
  ]
  loop
    v_function := pg_catalog.to_regprocedure(v_signature);
    select
      procedure.prosecdef,
      exists (
        select 1
        from pg_catalog.unnest(procedure.proconfig) as config(value)
        where config.value in ('search_path=', 'search_path=""')
      ),
      pg_catalog.pg_get_functiondef(procedure.oid)
    into v_security_definer, v_fixed_path, v_definition
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_function::oid;
    if v_function is null
      or not pg_catalog.has_function_privilege('authenticated', v_function::oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('anon', v_function::oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('service_role', v_function::oid, 'EXECUTE')
      or not coalesce(v_security_definer, false)
      or not coalesce(v_fixed_path, false)
      or pg_catalog.strpos(
        coalesce(v_definition, ''),
        'current_customer_session_assured'
      ) = 0 then
      raise exception 'Gated order wrapper is missing or unavailable: %', v_signature;
    end if;
  end loop;
end;
$$;

alter function app_private.assert_customer_device_assurance_ready() owner to postgres;
revoke all privileges on function app_private.assert_customer_device_assurance_ready()
  from public, anon, authenticated, service_role;

do $customer_device_catalog_reconciliation$
begin
  perform app_private.assert_customer_device_assurance_ready();
end;
$customer_device_catalog_reconciliation$;


