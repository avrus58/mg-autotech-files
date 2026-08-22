-- Read-only, aggregate verifier for customer trusted-device assurance.
-- Returns schema/config/ACL PASS/FAIL only; it reads no customer rows or PII.

with required_relations(relation_name) as (
  values
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
), result as (
  select
    'required_relations_exist'::text as check_name,
    pg_catalog.bool_and(pg_catalog.to_regclass(relation_name) is not null) as ok,
    pg_catalog.count(*)::text || ' required relations' as detail
  from required_relations
)
select * from result;

select
  'rollout_config_valid'::text as check_name,
  pg_catalog.count(*) = 1
    and pg_catalog.bool_and(mode in ('shadow', 'enforced'))
    and pg_catalog.bool_and(
      mode = 'shadow'
      or (
        enforce_after is not null
        and legacy_grace_until is not null
        and legacy_grace_until >= enforce_after
      )
    ) as ok,
  coalesce(pg_catalog.min(mode), 'missing') as detail
from public.customer_auth_assurance_config
where singleton;

with required_relations(relation_name) as (
  values
    ('public.customer_auth_assurance_config'),
    ('public.customer_trusted_devices'),
    ('public.customer_session_assurance'),
    ('public.customer_device_email_challenges')
)
select
  'assurance_target_rls_enabled'::text as check_name,
  pg_catalog.bool_and(relation.relrowsecurity) as ok,
  pg_catalog.count(*)::text || ' assurance relations checked' as detail
from required_relations
join pg_catalog.pg_class as relation
  on relation.oid = pg_catalog.to_regclass(required_relations.relation_name);

with expected(
  schema_name,
  table_name,
  policy_name,
  command_name,
  requires_using,
  requires_check,
  protects_buckets
) as (
  values
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
), applicable as (
  select *
  from expected
  where pg_catalog.to_regclass(schema_name || '.' || table_name) is not null
)
select
  'restrictive_policy_matrix_complete'::text as check_name,
  not exists (
    select 1
    from applicable
    where not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = applicable.schema_name
        and policy.tablename = applicable.table_name
        and policy.policyname = applicable.policy_name
        and policy.permissive = 'RESTRICTIVE'
        and policy.cmd = applicable.command_name
        and policy.roles = array['authenticated']::name[]
        and (
          not applicable.requires_using
          or pg_catalog.strpos(
            pg_catalog.lower(coalesce(policy.qual, '')),
            'current_customer_session_assured'
          ) > 0
        )
        and (applicable.requires_using or policy.qual is null)
        and (
          not applicable.requires_check
          or pg_catalog.strpos(
            pg_catalog.lower(coalesce(policy.with_check, '')),
            'current_customer_session_assured'
          ) > 0
        )
        and (applicable.requires_check or policy.with_check is null)
        and (
          not applicable.protects_buckets
          or (
            pg_catalog.strpos(
              pg_catalog.lower(coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')),
              'customer-files'
            ) > 0
            and pg_catalog.strpos(
              pg_catalog.lower(coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')),
              'file-expert'
            ) > 0
          )
        )
    )
  ) as ok,
  pg_catalog.count(*)::text || ' applicable policies' as detail
from applicable;

with assurance_relations(relation_name) as (
  values
    ('public.customer_auth_assurance_config'),
    ('public.customer_trusted_devices'),
    ('public.customer_session_assurance'),
    ('public.customer_device_email_challenges')
), operations(operation_name) as (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
)
select
  'authenticated_has_no_assurance_table_acl'::text as check_name,
  not pg_catalog.bool_or(
    pg_catalog.has_table_privilege(
      'authenticated',
      assurance_relations.relation_name,
      operations.operation_name
    )
  ) as ok,
  'SELECT/INSERT/UPDATE/DELETE denied'::text as detail
from assurance_relations
cross join operations;

with service_functions(signature) as (
  values
    ('public.get_customer_session_assurance_state(uuid,uuid)'),
    ('public.prepare_customer_password_change_verification(uuid,uuid)'),
    ('public.customer_password_change_verification_state(uuid,uuid)'),
    ('public.assure_customer_session_from_trusted_device(uuid,uuid,text,smallint)'),
    ('public.reserve_customer_device_challenge(uuid,uuid,uuid,text,smallint,text,boolean,uuid)'),
    ('public.mark_customer_device_challenge_sent(uuid,uuid,uuid)'),
    ('public.invalidate_customer_device_challenge(uuid,uuid,uuid)'),
    ('public.consume_customer_device_challenge(uuid,uuid,uuid,text,smallint,text,text)'),
    ('public.revoke_customer_trusted_device(uuid,uuid)'),
    ('public.revoke_other_customer_trusted_devices(uuid,uuid)'),
    ('public.revoke_all_customer_trusted_devices(uuid)'),
    ('public.activate_customer_device_assurance(integer)'),
    ('public.disable_customer_device_assurance()')
), resolved as (
  select
    service_functions.signature,
    procedure.oid as function_oid,
    procedure.prosecdef,
    exists (
      select 1
      from pg_catalog.unnest(procedure.proconfig) as config(value)
      where config.value in ('search_path=', 'search_path=""')
    ) as fixed_path
  from service_functions
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(service_functions.signature)
)
select
  'service_rpc_acl_exact'::text as check_name,
  pg_catalog.bool_and(
    function_oid is not null
    and prosecdef
    and fixed_path
    and pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
  ) as ok,
  pg_catalog.count(*)::text || ' service functions' as detail
from resolved;

with order_functions(kind, signature) as (
  values
    ('core', 'public.create_order_with_credit_deduction_without_assurance(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'),
    ('core', 'public.create_web_order_with_credit_deduction_without_assurance(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'),
    ('core', 'public.create_desktop_order_with_credit_deduction_without_assurance(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'),
    ('wrapper', 'public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'),
    ('wrapper', 'public.create_desktop_order_with_credit_deduction(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)')
), resolved as (
  select
    order_functions.kind,
    order_functions.signature,
    procedure.oid as function_oid,
    procedure.prosecdef,
    exists (
      select 1
      from pg_catalog.unnest(procedure.proconfig) as config(value)
      where config.value in ('search_path=', 'search_path=""')
    ) as fixed_path,
    pg_catalog.pg_get_functiondef(procedure.oid) as definition
  from order_functions
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(order_functions.signature)
)
select
  'order_assurance_wrappers_exact'::text as check_name,
  pg_catalog.bool_and(
    function_oid is not null
    and prosecdef
    and fixed_path
    and case
      when kind = 'core' then
        not pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
      else
        pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
        and pg_catalog.strpos(definition, 'current_customer_session_assured') > 0
    end
  ) as ok,
  pg_catalog.count(*)::text || ' order functions' as detail
from resolved;
