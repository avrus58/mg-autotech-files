-- SELECT-only verification for 20260816002452_post_deploy_legacy_rpc_cutover.sql.
-- Run only after the matching application is deployed and 02452 is applied.

with expected_access(signature, anon_execute, authenticated_execute, service_execute) as (
  values
    ('public.staff_adjust_customer_credits(uuid,numeric,text)', false, false, false),
    ('public.staff_adjust_customer_credits(uuid,numeric,text,uuid)', false, true, false),
    ('public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text)', false, false, false),
    ('public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text,uuid)', false, false, true),
    ('public.admin_apply_payment_refund(uuid,uuid,text,text)', false, false, false),
    ('public.admin_apply_payment_refund(uuid,uuid,text,text,uuid)', false, false, true),
    ('public.claim_payment_refund(uuid,uuid,uuid)', false, false, true),
    ('public.create_order_with_credit_deduction(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)', false, false, false),
    ('public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)', false, true, false),
    ('public.create_desktop_order_with_credit_deduction(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)', false, true, false)
),
order_contract as (
  select
    pg_catalog.to_regprocedure(
      'public.create_order_with_credit_deduction(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'
    ) as wrapper_oid,
    pg_catalog.to_regprocedure(
      'public.create_order_with_credit_deduction_without_assurance(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'
    ) as renamed_core_oid
),
resolved_order_contract as (
  select
    contract.*,
    coalesce(contract.renamed_core_oid, contract.wrapper_oid) as core_oid,
    contract.renamed_core_oid is not null as device_assurance_installed
  from order_contract as contract
),
order_definitions as (
  select
    contract.*,
    case
      when contract.core_oid is null then ''
      else pg_catalog.lower(pg_catalog.pg_get_functiondef(contract.core_oid))
    end as core_definition,
    case
      when contract.wrapper_oid is null then ''
      else pg_catalog.lower(pg_catalog.pg_get_functiondef(contract.wrapper_oid))
    end as wrapper_definition,
    core_procedure.prosecdef as core_security_definer,
    exists (
      select 1
      from pg_catalog.unnest(core_procedure.proconfig) as config(value)
      where config.value in ('search_path=', 'search_path=""')
    ) as core_fixed_path,
    core_owner.rolname as core_owner,
    wrapper_procedure.prosecdef as wrapper_security_definer,
    exists (
      select 1
      from pg_catalog.unnest(wrapper_procedure.proconfig) as config(value)
      where config.value in ('search_path=', 'search_path=""')
    ) as wrapper_fixed_path,
    wrapper_owner.rolname as wrapper_owner
  from resolved_order_contract as contract
  left join pg_catalog.pg_proc as core_procedure
    on core_procedure.oid = contract.core_oid
  left join pg_catalog.pg_roles as core_owner
    on core_owner.oid = core_procedure.proowner
  left join pg_catalog.pg_proc as wrapper_procedure
    on wrapper_procedure.oid = contract.wrapper_oid
  left join pg_catalog.pg_roles as wrapper_owner
    on wrapper_owner.oid = wrapper_procedure.proowner
),
function_state as (
  select
    expected.*,
    pg_catalog.to_regprocedure(expected.signature) as function_oid
  from expected_access as expected
),
function_definitions as (
  select
    state.*,
    case
      when state.function_oid is null then ''
      else pg_catalog.lower(pg_catalog.pg_get_functiondef(state.function_oid))
    end as definition
  from function_state as state
),
checks(check_name, ok, details) as (
  select
    'cutover functions exist',
    pg_catalog.bool_and(function_oid is not null),
    pg_catalog.count(*) filter (where function_oid is null)::text || ' missing'
  from function_state

  union all

  select
    'post-cutover role matrix matches',
    pg_catalog.bool_and(
      coalesce(pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE'), false)
        = anon_execute
      and coalesce(
        pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE'),
        false
      ) = authenticated_execute
      and coalesce(
        pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE'),
        false
      ) = service_execute
    ),
    'Legacy entries are private; replacements retain only reviewed access'
  from function_state

  union all

  select
    'cutover functions have no PUBLIC EXECUTE',
    not exists (
      select 1
      from function_state as state
      join pg_catalog.pg_proc as procedure on procedure.oid = state.function_oid
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          procedure.proacl,
          pg_catalog.acldefault('f', procedure.proowner)
        )
      ) as acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ),
    'PUBLIC grantee OID 0 must not hold EXECUTE'

  union all

  select
    'obsolete overloads fail closed',
    pg_catalog.count(*) = 3
      and pg_catalog.bool_and(
        case signature
          when 'public.staff_adjust_customer_credits(uuid,numeric,text)' then
            position('legacy credit adjustment rpc is disabled' in definition) > 0
              and position('errcode = ''0a000''' in definition) > 0
          when 'public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text)' then
            position('legacy stripe credit rpc is disabled' in definition) > 0
              and position('errcode = ''0a000''' in definition) > 0
          when 'public.admin_apply_payment_refund(uuid,uuid,text,text)' then
            position('legacy refund rpc is disabled' in definition) > 0
              and position('errcode = ''0a000''' in definition) > 0
          else false
        end
      ),
    pg_catalog.count(*)::text || ' disabled compatibility overloads checked'
  from function_definitions
  where signature in (
    'public.staff_adjust_customer_credits(uuid,numeric,text)',
    'public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text)',
    'public.admin_apply_payment_refund(uuid,uuid,text,text)'
  )

  union all

  select
    'hardened order core is private but remains wrapper-callable',
    core_oid is not null
      and not pg_catalog.has_function_privilege('anon', core_oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('authenticated', core_oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('service_role', core_oid, 'EXECUTE')
      and core_security_definer
      and core_fixed_path
      and core_owner = 'postgres'
      and position('auth.uid()' in core_definition) > 0
      and position('resolve_request_service_credits' in core_definition) > 0
      and position('for update of profile' in core_definition) > 0
      and position('mg_autotech.order_credit_debit' in core_definition) > 0,
    case
      when device_assurance_installed
        then 'Renamed ungated core is private; only postgres-owned assured wrappers may invoke it'
      else 'Legacy post-cutover core is private and remains wrapper-callable'
    end
  from order_definitions

  union all

  select
    'device assurance wrapper calls the exact renamed order core',
    not device_assurance_installed
      or (
        wrapper_oid is not null
        and wrapper_oid <> core_oid
        and wrapper_security_definer
        and wrapper_fixed_path
        and wrapper_owner = 'postgres'
        and not pg_catalog.has_function_privilege('anon', wrapper_oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('authenticated', wrapper_oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', wrapper_oid, 'EXECUTE')
        and position('current_customer_session_assured' in wrapper_definition) > 0
        and position('device verification is required.' in wrapper_definition) > 0
        and position(
          'public.create_order_with_credit_deduction_without_assurance('
          in wrapper_definition
        ) > 0
      ),
    case
      when device_assurance_installed
        then 'Authenticated web/desktop entry points reach the private core only through the assured legacy-signature wrapper'
      else 'Device migration is not installed; the legacy signature remains the resolved private core'
    end
  from order_definitions

  union all

  select
    'temporary direct-upload compatibility is removed',
    not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'storage'
        and policy.tablename = 'objects'
        and policy.policyname in (
          'MG customer files legacy owner insert',
          'MG file expert legacy owner insert'
        )
    )
      and exists (
        select 1
        from pg_catalog.pg_policies as policy
        where policy.schemaname = 'storage'
          and policy.tablename = 'objects'
          and policy.policyname = 'MG protected buckets insert boundary'
          and policy.cmd = 'INSERT'
          and policy.permissive = 'RESTRICTIVE'
          and policy.roles = array['authenticated']::name[]
          and position('customer-files' in pg_catalog.lower(coalesce(policy.with_check, ''))) > 0
          and position('file-expert' in pg_catalog.lower(coalesce(policy.with_check, ''))) > 0
          and position('files.upload' in pg_catalog.lower(coalesce(policy.with_check, ''))) > 0
          and position('auth.uid' in pg_catalog.lower(coalesce(policy.with_check, ''))) = 0
      )
      and not exists (
        select 1
        from pg_catalog.pg_policies as policy
        where policy.schemaname = 'storage'
          and policy.tablename = 'objects'
          and policy.cmd = 'INSERT'
          and policy.permissive = 'PERMISSIVE'
          and policy.roles && array['public', 'anon', 'authenticated']::name[]
          and position(
            'file-expert' in pg_catalog.lower(coalesce(policy.with_check, ''))
          ) > 0
      ),
    'Signed-upload routes replace owner-prefix INSERT; only staff customer-file delivery remains'

  union all

  select
    'cutover functions keep fixed path and reviewed owner',
    pg_catalog.bool_and(owner_role.rolname = 'postgres')
      and pg_catalog.bool_and(exists (
        select 1
        from pg_catalog.unnest(procedure.proconfig) as config(value)
        where config.value in ('search_path=', 'search_path=""')
      )),
    pg_catalog.count(*)::text || ' functions checked'
  from function_state as state
  join pg_catalog.pg_proc as procedure on procedure.oid = state.function_oid
  join pg_catalog.pg_roles as owner_role on owner_role.oid = procedure.proowner
)
select check_name, ok, details
from checks
order by check_name;
