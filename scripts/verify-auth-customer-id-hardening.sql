-- SELECT-only verification for 20260816002450_auth_customer_id_generator_hardening.sql.
-- Results contain only catalog-derived PASS/FAIL state; no customer rows or
-- generated customer references are read or returned.

with expected_functions(signature) as (
  values
    ('public.generate_customer_id()'),
    ('public.handle_new_user()'),
    ('public.set_customer_id()')
),
function_state as (
  select
    expected.signature,
    pg_catalog.to_regprocedure(expected.signature) as function_oid
  from expected_functions as expected
),
function_metadata as (
  select
    state.signature,
    state.function_oid,
    procedure.prosecdef as security_definer,
    procedure.proconfig,
    procedure.proacl,
    procedure.proowner,
    pg_catalog.lower(pg_catalog.pg_get_functiondef(procedure.oid)) as definition
  from function_state as state
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = state.function_oid
),
profile_trigger_state as (
  select
    trigger_info.tgname,
    trigger_info.tgenabled,
    trigger_info.tgtype,
    procedure_namespace.nspname as function_schema,
    procedure.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_arguments
  from pg_catalog.pg_trigger as trigger_info
  join pg_catalog.pg_class as relation
    on relation.oid = trigger_info.tgrelid
  join pg_catalog.pg_namespace as relation_namespace
    on relation_namespace.oid = relation.relnamespace
  join pg_catalog.pg_proc as procedure
    on procedure.oid = trigger_info.tgfoid
  join pg_catalog.pg_namespace as procedure_namespace
    on procedure_namespace.oid = procedure.pronamespace
  where relation_namespace.nspname = 'public'
    and relation.relname = 'profiles'
    and procedure_namespace.nspname = 'public'
    and procedure.proname = 'set_customer_id'
    and not trigger_info.tgisinternal
),
auth_trigger_state as (
  select
    trigger_info.tgname,
    trigger_info.tgenabled,
    trigger_info.tgtype,
    procedure_namespace.nspname as function_schema,
    procedure.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_arguments
  from pg_catalog.pg_trigger as trigger_info
  join pg_catalog.pg_class as relation
    on relation.oid = trigger_info.tgrelid
  join pg_catalog.pg_namespace as relation_namespace
    on relation_namespace.oid = relation.relnamespace
  join pg_catalog.pg_proc as procedure
    on procedure.oid = trigger_info.tgfoid
  join pg_catalog.pg_namespace as procedure_namespace
    on procedure_namespace.oid = procedure.pronamespace
  where relation_namespace.nspname = 'auth'
    and relation.relname = 'users'
    and procedure_namespace.nspname = 'public'
    and procedure.proname = 'handle_new_user'
    and not trigger_info.tgisinternal
),
sequence_state as (
  select
    relation.oid as sequence_oid,
    relation.relacl,
    relation.relowner as owner_oid,
    pg_catalog.pg_get_userbyid(relation.relowner) as owner_name
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'customer_id_seq'
    and relation.relkind = 'S'
),
checks(check_name, ok, details) as (
  select
    'customer ID trigger functions exist without overloads',
    pg_catalog.count(*) = 3
      and pg_catalog.count(*) filter (where function_oid is not null) = 3
      and (
        select pg_catalog.count(*) = 3
        from pg_catalog.pg_proc as procedure
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and procedure.proname in (
            'generate_customer_id',
            'handle_new_user',
            'set_customer_id'
          )
      ),
    pg_catalog.count(*) filter (where function_oid is not null)::text
      || ' of 3 exact functions found'
  from function_state

  union all

  select
    'customer ID trigger functions are fixed-path postgres definers',
    pg_catalog.count(*) = 3
      and pg_catalog.bool_and(
        security_definer
        and pg_catalog.pg_get_userbyid(proowner) = 'postgres'
        and exists (
          select 1
          from pg_catalog.unnest(proconfig) as config(value)
          where config.value in ('search_path=', 'search_path=""')
        )
      ),
    pg_catalog.count(*)::text || ' function security contracts checked'
  from function_metadata
  where function_oid is not null

  union all

  select
    'customer ID helpers use only schema-qualified dependencies',
    pg_catalog.bool_and(
      case signature
        when 'public.generate_customer_id()' then
          pg_catalog.strpos(definition, 'pg_catalog.nextval(') > 0
          and pg_catalog.strpos(
            definition,
            $$'public.customer_id_seq'::pg_catalog.regclass$$
          ) > 0
          and pg_catalog.strpos(definition, $$nextval('customer_id_seq$$) = 0
        when 'public.set_customer_id()' then
          pg_catalog.strpos(
            definition,
            'new.customer_id := public.generate_customer_id();'
          ) > 0
          and pg_catalog.strpos(
            definition,
            'new.customer_id := generate_customer_id();'
          ) = 0
        when 'public.handle_new_user()' then
          pg_catalog.strpos(definition, 'insert into public.profiles') > 0
          and pg_catalog.strpos(
            definition,
            $$raw_user_meta_data ->> 'role'$$
          ) = 0
        else false
      end
    ),
    'generator, profile trigger, and Auth handler definitions checked'
  from function_metadata
  where function_oid is not null

  union all

  select
    'customer ID trigger functions have no Data API or PUBLIC EXECUTE',
    pg_catalog.count(*) = 3
      and pg_catalog.bool_and(
        not pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege(
          'authenticated', function_oid, 'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'service_role', function_oid, 'EXECUTE'
        )
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              proacl,
              pg_catalog.acldefault('f', proowner)
            )
          ) as acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
      ),
    'PUBLIC, anon, authenticated, and service_role are fail-closed'
  from function_metadata
  where function_oid is not null

  union all

  select
    'customer ID sequence is postgres-owned and private',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        owner_name = 'postgres'
        and not pg_catalog.has_sequence_privilege(
          'anon', sequence_oid, 'USAGE'
        )
        and not pg_catalog.has_sequence_privilege(
          'anon', sequence_oid, 'SELECT'
        )
        and not pg_catalog.has_sequence_privilege(
          'anon', sequence_oid, 'UPDATE'
        )
        and not pg_catalog.has_sequence_privilege(
          'authenticated', sequence_oid, 'USAGE'
        )
        and not pg_catalog.has_sequence_privilege(
          'authenticated', sequence_oid, 'SELECT'
        )
        and not pg_catalog.has_sequence_privilege(
          'authenticated', sequence_oid, 'UPDATE'
        )
        and not pg_catalog.has_sequence_privilege(
          'service_role', sequence_oid, 'USAGE'
        )
        and not pg_catalog.has_sequence_privilege(
          'service_role', sequence_oid, 'SELECT'
        )
        and not pg_catalog.has_sequence_privilege(
          'service_role', sequence_oid, 'UPDATE'
        )
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              relacl,
              pg_catalog.acldefault('s', owner_oid)
            )
          ) as acl
          where acl.grantee = 0
        )
      ),
    pg_catalog.count(*)::text || ' exact private sequence found'
  from sequence_state

  union all

  select
    'profiles customer ID trigger is one exact enabled BEFORE INSERT trigger',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        tgname = 'profiles_customer_id_trigger'
        and tgenabled = 'O'
        and tgtype::integer = 7
        and function_schema = 'public'
        and function_name = 'set_customer_id'
        and identity_arguments = ''
      ),
    pg_catalog.count(*)::text || ' matching profile triggers found'
  from profile_trigger_state

  union all

  select
    'Auth signup trigger is one exact enabled AFTER INSERT trigger',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        tgname = 'on_auth_user_created'
        and tgenabled = 'O'
        and tgtype::integer = 5
        and function_schema = 'public'
        and function_name = 'handle_new_user'
        and identity_arguments = ''
      ),
    pg_catalog.count(*)::text || ' matching Auth triggers found'
  from auth_trigger_state
)
select check_name, ok, details
from checks
order by check_name;
