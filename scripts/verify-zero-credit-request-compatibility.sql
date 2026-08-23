-- SELECT-only verification for
-- 20260816002454_zero_credit_request_compatibility.sql.
-- Reads only catalog and PostgreSQL metadata; it does not read customer rows.

with deployment_phase(post_cutover) as (
  select coalesce(
    position(
      'legacy credit adjustment rpc is disabled' in pg_catalog.lower(
        pg_catalog.pg_get_functiondef(
          pg_catalog.to_regprocedure(
            'public.staff_adjust_customer_credits(uuid,numeric,text)'
          )
        )
      )
    ) > 0,
    false
  )
),
order_contract as (
  select
    'public.create_order_with_credit_deduction(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'::text
      as wrapper_signature,
    'public.create_order_with_credit_deduction_without_assurance(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'::text
      as renamed_core_signature,
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
expected_functions(function_kind, signature, authenticated_must_be_private) as (
  values
    ('catalog_resolver', 'public.resolve_request_service_credits(text)', true),
    ('usage_ledger', 'public.log_order_credit_usage()', true)
),
function_state as (
  select
    expected.function_kind,
    expected.signature,
    expected.authenticated_must_be_private,
    pg_catalog.to_regprocedure(expected.signature) as function_oid
  from expected_functions as expected

  union all

  select
    'order_core',
    case
      when contract.device_assurance_installed then contract.renamed_core_signature
      else contract.wrapper_signature
    end,
    false,
    contract.core_oid
  from resolved_order_contract as contract
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
order_wrapper_definition as (
  select
    contract.*,
    case
      when contract.wrapper_oid is null then ''
      else pg_catalog.lower(pg_catalog.pg_get_functiondef(contract.wrapper_oid))
    end as definition,
    wrapper_procedure.prosecdef as security_definer,
    exists (
      select 1
      from pg_catalog.unnest(wrapper_procedure.proconfig) as config(value)
      where config.value in ('search_path=', 'search_path=""')
    ) as fixed_path,
    wrapper_owner.rolname as owner_role
  from resolved_order_contract as contract
  left join pg_catalog.pg_proc as wrapper_procedure
    on wrapper_procedure.oid = contract.wrapper_oid
  left join pg_catalog.pg_roles as wrapper_owner
    on wrapper_owner.oid = wrapper_procedure.proowner
),
checks(sort_order, check_name, ok, details) as (
  select
    10,
    'zero-credit catalog contract is exact',
    pg_catalog.count(*) = 2
      and pg_catalog.count(*) filter (
        where catalog.service_id = 'only_options'
          and catalog.service_kind = 'primary'
          and catalog.service_title = 'Only Options'
          and catalog.active
      ) = 1
      and pg_catalog.count(*) filter (
        where catalog.service_id = 'special_request'
          and catalog.service_kind = 'extra'
          and catalog.service_title = 'Special Request / Other'
          and catalog.active
      ) = 1,
    pg_catalog.count(*)::text || ' active zero-credit catalog rows found'
  from public.request_service_catalog as catalog
  where catalog.credits = 0

  union all

  select
    20,
    'compatibility functions exist',
    pg_catalog.bool_and(function_oid is not null),
    pg_catalog.count(*) filter (where function_oid is null)::text || ' missing'
  from function_state

  union all

  select
    30,
    'catalog resolver permits zero and rejects negative totals',
    position('if v_total < 0 then' in definition) > 0
      and position('if v_total <= 0 then' in definition) = 0
      and position('duplicate extra services are not allowed' in definition) > 0
      and position('return v_total' in definition) > 0,
    'Zero is a valid authoritative total; malformed/negative totals remain closed'
  from function_definitions
  where function_kind = 'catalog_resolver'

  union all

  select
    40,
    'order core skips financial writes only for exact zero',
    position('p_credits_required < 0' in definition) > 0
      and position('p_credits_required <= 0' in definition) = 0
      and position('p_credits_required <> v_expected_credits' in definition) > 0
      and position('if v_expected_credits > 0 then' in definition) > 0
      and position('set credit_balance = v_new_balance' in definition) > 0
      and position('mg_autotech.order_credit_debit' in definition) > 0
      and position('for update of profile' in definition) > 0,
    'Catalog equality and profile lock remain; debit marker/update are positive-only'
  from function_definitions
  where function_kind = 'order_core'

  union all

  select
    50,
    'usage ledger ignores zero and rejects negative marked orders',
    position('new.credits_required < 0' in definition) > 0
      and position('if new.credits_required = 0 then' in definition) > 0
      and position('insert into public.credit_transactions' in definition) > 0
      and exists (
        select 1
        from pg_catalog.pg_trigger as trigger_info
        where trigger_info.tgrelid = 'public.orders'::pg_catalog.regclass
          and trigger_info.tgname = 'orders_credit_usage_ledger_trigger'
          and trigger_info.tgfoid = function_oid
          and not trigger_info.tgisinternal
      ),
    'Zero creates no usage row; positive marked orders keep the canonical trigger'
  from function_definitions
  where function_kind = 'usage_ledger'

  union all

  select
    60,
    'compatibility role boundary is private outside the phase-owned core grant',
    pg_catalog.bool_and(
      not pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
      and (
        not authenticated_must_be_private
        or not pg_catalog.has_function_privilege(
          'authenticated',
          function_oid,
          'EXECUTE'
        )
      )
    )
      and not exists (
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
    'Resolver/trigger are private; core authenticated access is owned by the 02444/02452 phase'
  from function_state

  union all

  select
    70,
    'order core authenticated access matches the cutover phase',
    pg_catalog.has_function_privilege(
      'authenticated',
      function_oid,
      'EXECUTE'
    ) = (
      not phase.post_cutover
      and not contract.device_assurance_installed
    ),
    case
      when contract.device_assurance_installed
        then 'Device assurance is installed; the renamed core must remain private'
      when phase.post_cutover
        then '02452 is active; authenticated legacy-core EXECUTE must remain revoked'
      else 'Pre-02452 compatibility is active; authenticated core EXECUTE must remain available'
    end
  from function_state
  cross join deployment_phase as phase
  cross join resolved_order_contract as contract
  where function_kind = 'order_core'

  union all

  select
    80,
    'device assurance wrapper calls the exact renamed order core',
    not device_assurance_installed
      or (
        wrapper_oid is not null
        and wrapper_oid <> core_oid
        and security_definer
        and fixed_path
        and owner_role = 'postgres'
        and not pg_catalog.has_function_privilege('anon', wrapper_oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('authenticated', wrapper_oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('service_role', wrapper_oid, 'EXECUTE')
        and position('current_customer_session_assured' in definition) > 0
        and position('device verification is required.' in definition) > 0
        and position(
          'public.create_order_with_credit_deduction_without_assurance('
          in definition
        ) > 0
      ),
    case
      when device_assurance_installed
        then 'Legacy signature is the private assured wrapper; renamed core remains the inspected implementation'
      else 'Before device migration, the legacy signature remains the inspected implementation'
    end
  from order_wrapper_definition
)
select check_name, ok, details
from checks
order by sort_order;
