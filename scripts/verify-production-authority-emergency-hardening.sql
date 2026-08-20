-- SELECT-only, aggregate/catalog-only verifier for the current-production P0.
-- It reads no auth.users, profiles, orders, payment, ledger or customer rows.

with release_state as (
  select
    pg_catalog.to_regprocedure(
      'public.staff_adjust_customer_credits(uuid,numeric,text,uuid)'
    ) is not null as modern_staff,
    pg_catalog.to_regprocedure(
      'public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'
    ) is not null as modern_web_order,
    pg_catalog.to_regprocedure(
      'public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text,uuid)'
    ) is not null as modern_stripe,
    pg_catalog.to_regprocedure(
      'public.admin_apply_payment_refund(uuid,uuid,text,text,uuid)'
    ) is not null as modern_refund
),
expected_access(
  signature,
  anon_execute,
  authenticated_execute,
  service_execute
) as (
  select
    'public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text)',
    false,
    false,
    not state.modern_stripe
  from release_state as state

  union all
  values
    ('public.admin_adjust_customer_credits(uuid,integer,text)', false, false, false),
    ('public.admin_add_credits(uuid,integer,text)', false, false, false)

  union all
  select
    'public.admin_apply_payment_refund(uuid,uuid,text,text)',
    false,
    false,
    not state.modern_refund
  from release_state as state

  union all
  values
    ('public.admin_record_bank_payment(uuid,uuid,text,numeric,bigint,text,text)', false, false, true)

  union all
  select
    'public.create_order_with_credit_deduction(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
    false,
    not state.modern_web_order,
    false
  from release_state as state

  union all
  select
    'public.staff_adjust_customer_credits(uuid,numeric,text)',
    false,
    not state.modern_staff,
    false
  from release_state as state
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
authority_function_contract(signature, expected_definer) as (
  values
    ('public.create_order_with_credit_deduction(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)', true),
    ('public.emergency_resolve_request_service_credits(text)', true),
    ('public.emergency_staff_adjust_customer_credits(uuid,numeric,text,uuid)', true),
    ('public.handle_new_user()', true),
    ('public.has_staff_permission(text)', true),
    ('public.is_admin()', true),
    ('public.is_primary_owner()', true),
    ('public.log_order_credit_usage()', true),
    ('public.protect_profile_authority_fields()', false),
    ('public.protect_staff_security_fields()', false),
    ('public.staff_adjust_customer_credits(uuid,numeric,text)', true)
),
authority_function_state as (
  select
    expected.*,
    procedure.oid as function_oid,
    procedure.prosecdef,
    procedure.proconfig,
    owner_role.rolname as owner_name
  from authority_function_contract as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  left join pg_catalog.pg_roles as owner_role
    on owner_role.oid = procedure.proowner
),
helper_function_access(signature, authenticated_execute) as (
  values
    ('public.emergency_resolve_request_service_credits(text)', false),
    ('public.emergency_staff_adjust_customer_credits(uuid,numeric,text,uuid)', false),
    ('public.handle_new_user()', false),
    ('public.has_staff_permission(text)', true),
    ('public.is_admin()', true),
    ('public.is_primary_owner()', true),
    ('public.log_order_credit_usage()', false),
    ('public.protect_profile_authority_fields()', false),
    ('public.protect_staff_security_fields()', false)
),
helper_function_state as (
  select
    expected.*,
    procedure.oid as function_oid,
    procedure.proacl,
    procedure.proowner
  from helper_function_access as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
),
auth_trigger_state as (
  select
    trigger_info.tgname,
    trigger_info.tgenabled,
    trigger_info.tgtype,
    procedure_namespace.nspname as function_schema,
    procedure.proname as function_name
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
    and not trigger_info.tgisinternal
    and trigger_info.tgtype::integer & 1 = 1
    and trigger_info.tgtype::integer & 4 = 4
),
profile_trigger_state as (
  select
    trigger_info.tgname,
    trigger_info.tgenabled,
    trigger_info.tgtype,
    procedure.proname as function_name
  from pg_catalog.pg_trigger as trigger_info
  join pg_catalog.pg_class as relation
    on relation.oid = trigger_info.tgrelid
  join pg_catalog.pg_namespace as relation_namespace
    on relation_namespace.oid = relation.relnamespace
  join pg_catalog.pg_proc as procedure
    on procedure.oid = trigger_info.tgfoid
  where relation_namespace.nspname = 'public'
    and relation.relname = 'profiles'
    and procedure.proname in (
      'protect_profile_authority_fields',
      'protect_staff_security_fields'
    )
    and not trigger_info.tgisinternal
),
order_ledger_trigger_state as (
  select
    trigger_info.tgname,
    trigger_info.tgenabled,
    trigger_info.tgtype,
    procedure_namespace.nspname as function_schema,
    procedure.proname as function_name
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
    and relation.relname = 'orders'
    and procedure_namespace.nspname = 'public'
    and procedure.proname = 'log_order_credit_usage'
    and not trigger_info.tgisinternal
),
private_relations(relation_name) as (
  values
    ('emergency_request_service_catalog'),
    ('emergency_staff_credit_adjustment_idempotency')
),
expected_admin_policies(
  schema_name,
  table_name,
  policy_name,
  command_code,
  customer_files_boundary
) as (
  values
    ('public', 'credit_payments', 'Admins can view all credit payments', 'r', false),
    ('public', 'profiles', 'Admins can update all profiles', 'w', false),
    ('public', 'profiles', 'Admins can view all profiles', 'r', false),
    ('public', 'ai_ecu_knowledge_profiles', 'Admins can manage AI knowledge profiles', '*', false),
    ('public', 'ai_model_runs', 'Admins can read AI model runs', 'r', false),
    ('public', 'ai_pattern_signatures', 'Admins can manage AI pattern signatures', '*', false),
    ('public', 'ai_training_events', 'Admins can read AI training events', 'r', false),
    ('public', 'ai_training_samples', 'Admins can manage AI training samples', '*', false),
    ('public', 'file_expert_binary_fingerprints', 'Admins can manage file expert fingerprints', '*', false),
    ('public', 'file_expert_feedback', 'Admins can manage file expert feedback', '*', false),
    ('public', 'file_expert_jobs', 'Admins can manage file expert jobs', '*', false),
    ('public', 'known_file_patterns', 'Admins can manage known file patterns', '*', false),
    ('public', 'credit_transactions', 'Admins can insert credit transactions', 'a', false),
    ('public', 'credit_transactions', 'Admins can view all credit transactions', 'r', false),
    ('public', 'orders', 'Admins can update all orders', 'w', false),
    ('public', 'orders', 'Admins can view all orders', 'r', false),
    ('storage', 'objects', 'Admins can read all customer files', 'r', true),
    ('storage', 'objects', 'Admins can update modified customer files', 'w', true),
    ('storage', 'objects', 'Admins can upload modified customer files', 'a', true)
),
admin_policy_state as (
  select
    expected.*,
    policy.oid as policy_oid,
    policy.polcmd::text as polcmd,
    policy.polroles,
    authenticated_role.oid as authenticated_oid,
    pg_catalog.lower(
      coalesce(
        pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
        ''
      ) || ' ' || coalesce(
        pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid),
        ''
      )
    ) as expression
  from expected_admin_policies as expected
  join pg_catalog.pg_roles as authenticated_role
    on authenticated_role.rolname = 'authenticated'
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = expected.schema_name
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
    and relation.relname = expected.table_name
  left join pg_catalog.pg_policy as policy
    on policy.polrelid = relation.oid
    and policy.polname = expected.policy_name
),
checks(check_name, ok, details) as (
  select
    'schema phase is fully legacy or fully canonical',
    (
      state.modern_staff::integer
      + state.modern_web_order::integer
      + state.modern_stripe::integer
      + state.modern_refund::integer
    ) in (0, 4),
    (
      state.modern_staff::integer
      + state.modern_web_order::integer
      + state.modern_stripe::integer
      + state.modern_refund::integer
    )::text || ' of 4 modern contracts present'
  from release_state as state

  union all

  select
    'all catalog-confirmed legacy finance signatures exist',
    pg_catalog.count(*) = 7
      and pg_catalog.bool_and(function_oid is not null),
    pg_catalog.count(*) filter (where function_oid is null)::text || ' missing'
  from function_state

  union all

  select
    'is_admin is exact owner-only fixed-path authority',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        procedure.prosecdef
        and owner_role.rolname = 'postgres'
        and exists (
          select 1
          from pg_catalog.unnest(procedure.proconfig) as config(value)
          where config.value in ('search_path=', 'search_path=""')
        )
        and pg_catalog.strpos(definition.body, 'auth.uid()') > 0
        and pg_catalog.strpos(definition.body, 'role = ''admin''') > 0
        and pg_catalog.strpos(definition.body, 'staff_role = ''owner''') > 0
        and pg_catalog.has_function_privilege(
          'authenticated', procedure.oid, 'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'anon', procedure.oid, 'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'service_role', procedure.oid, 'EXECUTE'
        )
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              procedure.proacl,
              pg_catalog.acldefault('f', procedure.proowner)
            )
          ) as acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
      ),
    pg_catalog.count(*)::text
      || ' exact is_admin function checked; owner-only authenticated EXECUTE required'
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_roles as owner_role
    on owner_role.oid = procedure.proowner
  cross join lateral (
    select pg_catalog.lower(
      pg_catalog.pg_get_functiondef(procedure.oid)
    ) as body
  ) as definition
  where procedure.oid = pg_catalog.to_regprocedure('public.is_admin()')

  union all

  select
    'all 19 legacy admin policies are owner-only or absent after canonical cutover',
    pg_catalog.count(*) = 19
      and pg_catalog.bool_and(
        policy_oid is null
        or (
          polcmd = command_code
          and pg_catalog.cardinality(polroles) = 1
          and authenticated_oid = any(polroles)
          and pg_catalog.strpos(expression, 'is_admin()') > 0
          and not (
            pg_catalog.strpos(expression, 'profiles') > 0
            and pg_catalog.strpos(expression, 'role') > 0
            and pg_catalog.strpos(expression, 'admin') > 0
          )
          and (
            not customer_files_boundary
            or pg_catalog.strpos(expression, 'customer-files') > 0
          )
        )
      ),
    pg_catalog.count(*) filter (where policy_oid is not null)::text
      || ' present; '
      || pg_catalog.count(*) filter (
        where policy_oid is not null
          and pg_catalog.strpos(expression, 'is_admin()') > 0
      )::text || ' owner-only'
  from admin_policy_state

  union all

  select
    'authority functions have exact owner, path and definer mode',
    pg_catalog.count(*) = 11
      and pg_catalog.bool_and(
        function_oid is not null
        and owner_name = 'postgres'
        and prosecdef = expected_definer
        and exists (
          select 1
          from pg_catalog.unnest(proconfig) as config(value)
          where config.value in ('search_path=', 'search_path=""')
        )
      ),
    pg_catalog.count(*) filter (where function_oid is null)::text
      || ' missing; exact SECURITY DEFINER/INVOKER modes required'
  from authority_function_state

  union all

  select
    'authority helper and trigger functions have exact ACLs',
    pg_catalog.count(*) = 9
      and pg_catalog.bool_and(
        function_oid is not null
        and not coalesce(
          pg_catalog.has_function_privilege(
            'anon', function_oid, 'EXECUTE'
          ),
          false
        )
        and coalesce(
          pg_catalog.has_function_privilege(
            'authenticated', function_oid, 'EXECUTE'
          ),
          false
        ) = authenticated_execute
        and not coalesce(
          pg_catalog.has_function_privilege(
            'service_role', function_oid, 'EXECUTE'
          ),
          false
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
    'Only has_staff_permission/is_primary_owner/is_admin are authenticated-callable'
  from helper_function_state

  union all

  select
    'no public or storage policy retains a raw profiles role-admin check',
    pg_catalog.count(*) = 0,
    pg_catalog.count(*)::text || ' raw role-admin policies remain'
  from pg_catalog.pg_policy as policy
  join pg_catalog.pg_class as relation
    on relation.oid = policy.polrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  cross join lateral (
    select pg_catalog.lower(
      coalesce(
        pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
        ''
      ) || ' ' || coalesce(
        pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid),
        ''
      )
    ) as expression
  ) as policy_definition
  where namespace.nspname in ('public', 'storage')
    and policy_definition.expression ~ 'profiles.*role.*admin'

  union all

  select
    'legacy finance role matrix matches the active release phase',
    pg_catalog.bool_and(
      not coalesce(
        pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE'),
        false
      )
      and coalesce(
        pg_catalog.has_function_privilege(
          'authenticated',
          function_oid,
          'EXECUTE'
        ),
        false
      ) = authenticated_execute
      and coalesce(
        pg_catalog.has_function_privilege(
          'service_role',
          function_oid,
          'EXECUTE'
        ),
        false
      ) = service_execute
    ),
    'No anon execution; only the required legacy/current role retains EXECUTE'
  from function_state

  union all

  select
    'legacy finance functions have no PUBLIC EXECUTE',
    not exists (
      select 1
      from function_state as state
      join pg_catalog.pg_proc as procedure
        on procedure.oid = state.function_oid
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
    'legacy finance functions are postgres-owned',
    pg_catalog.bool_and(procedure_owner.rolname = 'postgres'),
    pg_catalog.string_agg(
      state.signature || '=' || coalesce(procedure_owner.rolname, 'missing'),
      ', '
      order by state.signature
    )
  from function_state as state
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = state.function_oid
  left join pg_catalog.pg_roles as procedure_owner
    on procedure_owner.oid = procedure.proowner

  union all

  select
    'legacy order RPC is caller-bound, locked and server-priced',
    position('v_user_id uuid := auth.uid()' in definition) > 0
      and position('for update of profile' in definition) > 0
      and position('emergency_resolve_request_service_credits' in definition) > 0
      and position('p_credits_required <> v_expected_credits' in definition) > 0
      and position('p_credits_required < 0' in definition) > 0
      and position('if v_expected_credits > 0 then' in definition) > 0
      and position('mg_autotech.profile_financial_write' in definition) > 0
      and position('mg_autotech.order_credit_debit' in definition) > 0
      and position('storage.objects' in definition) > 0,
    'Caller, storage prefix, server catalog, zero-credit branch, balance lock and audit markers required'
  from function_definitions
  where signature like 'public.create_order_with_credit_deduction(%'

  union all

  select
    'signup function ignores metadata authority and opening balance',
    position('raw_user_meta_data ->> ''role''' in definition) = 0
      and position('raw_user_meta_data ->> ''credit_balance''' in definition) = 0
      and position('''customer''' in definition) > 0,
    'handle_new_user must force role=customer and credit_balance=0'
  from (
    select pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        pg_catalog.to_regprocedure('public.handle_new_user()')
      )
    ) as definition
  ) as signup

  union all

  select
    'emergency authority functions are fixed-path postgres functions',
    pg_catalog.count(*) = 11
      and pg_catalog.bool_and(
        function_oid is not null
        and owner_name = 'postgres'
        and exists (
          select 1
          from pg_catalog.unnest(proconfig) as config(value)
          where config.value in ('search_path=', 'search_path=""')
        )
      ),
    pg_catalog.count(*)::text || ' exact fixed-path function contracts checked'
  from authority_function_state

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
      ),
    pg_catalog.count(*)::text || ' matching Auth triggers'
  from auth_trigger_state

  union all

  select
    'order credit ledger trigger is one exact enabled AFTER INSERT trigger',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        tgname = 'orders_credit_usage_ledger_trigger'
        and tgenabled = 'O'
        and tgtype::integer = 5
        and function_schema = 'public'
        and function_name = 'log_order_credit_usage'
      ),
    pg_catalog.count(*)::text || ' matching order-ledger triggers'
  from order_ledger_trigger_state

  union all

  select
    'profile authority triggers are exact and enabled',
    pg_catalog.count(*) = 2
      and pg_catalog.bool_and(
        tgenabled = 'O'
        and tgtype::integer = 19
        and (
          (
            tgname = 'protect_profile_authority_fields_trigger'
            and function_name = 'protect_profile_authority_fields'
          )
          or (
            tgname = 'protect_staff_security_fields_trigger'
            and function_name = 'protect_staff_security_fields'
          )
        )
      ),
    pg_catalog.count(*)::text || ' matching profile triggers'
  from profile_trigger_state

  union all

  select
    'profiles Data API retains only authenticated read/update compatibility',
    relation.relrowsecurity
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'SELECT'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'INSERT'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'UPDATE'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'DELETE'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'TRUNCATE'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'REFERENCES'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'TRIGGER'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', relation.oid, 'INSERT'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', relation.oid, 'DELETE'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', relation.oid, 'TRUNCATE'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', relation.oid, 'REFERENCES'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', relation.oid, 'TRIGGER'
      )
      and pg_catalog.has_any_column_privilege(
        'authenticated', relation.oid, 'SELECT'
      )
      and pg_catalog.has_any_column_privilege(
        'authenticated', relation.oid, 'UPDATE'
      )
      and pg_catalog.has_table_privilege(
        'service_role', relation.oid, 'INSERT'
      )
      and pg_catalog.has_table_privilege(
        'service_role', relation.oid, 'DELETE'
      )
      and not exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            relation.relacl,
            pg_catalog.acldefault('r', relation.relowner)
          )
        ) as acl
        where acl.grantee = 0
      )
      and not exists (
        select 1
        from pg_catalog.pg_attribute as attribute
        where attribute.attrelid = relation.oid
          and attribute.attnum > 0
          and not attribute.attisdropped
          and (
            pg_catalog.has_column_privilege(
              'anon', relation.oid, attribute.attnum, 'SELECT'
            )
            or pg_catalog.has_column_privilege(
              'anon', relation.oid, attribute.attnum, 'INSERT'
            )
            or pg_catalog.has_column_privilege(
              'anon', relation.oid, attribute.attnum, 'UPDATE'
            )
            or pg_catalog.has_column_privilege(
              'anon', relation.oid, attribute.attnum, 'REFERENCES'
            )
            or pg_catalog.has_column_privilege(
              'authenticated', relation.oid, attribute.attnum, 'INSERT'
            )
            or pg_catalog.has_column_privilege(
              'authenticated', relation.oid, attribute.attnum, 'REFERENCES'
            )
          )
      )
      and not exists (
        select 1
        from pg_catalog.pg_policy as policy
        where policy.polrelid = relation.oid
          and policy.polcmd::text in ('a', 'd', '*')
          and (
            0 = any(policy.polroles)
            or exists (
              select 1
              from pg_catalog.pg_roles as policy_role
              where policy_role.rolname in ('anon', 'authenticated')
                and policy_role.oid = any(policy.polroles)
            )
          )
      ),
    'PUBLIC/anon have no profile ACL; authenticated has no INSERT/DELETE/TRUNCATE/REFERENCES/TRIGGER path'
  from pg_catalog.pg_class as relation
  where relation.oid = 'public.profiles'::pg_catalog.regclass

  union all

  select
    'orders Data API cannot bypass the caller-bound creation RPC',
    relation.relrowsecurity
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'SELECT'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'INSERT'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'UPDATE'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'DELETE'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'TRUNCATE'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'REFERENCES'
      )
      and not pg_catalog.has_table_privilege(
        'anon', relation.oid, 'TRIGGER'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', relation.oid, 'INSERT'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', relation.oid, 'DELETE'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', relation.oid, 'TRUNCATE'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', relation.oid, 'REFERENCES'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', relation.oid, 'TRIGGER'
      )
      and pg_catalog.has_any_column_privilege(
        'authenticated', relation.oid, 'SELECT'
      )
      and pg_catalog.has_any_column_privilege(
        'authenticated', relation.oid, 'UPDATE'
      ) = not state.modern_web_order
      and not pg_catalog.has_any_column_privilege(
        'anon', relation.oid, 'SELECT'
      )
      and not pg_catalog.has_any_column_privilege(
        'anon', relation.oid, 'INSERT'
      )
      and not pg_catalog.has_any_column_privilege(
        'anon', relation.oid, 'UPDATE'
      )
      and not pg_catalog.has_any_column_privilege(
        'anon', relation.oid, 'REFERENCES'
      )
      and not pg_catalog.has_any_column_privilege(
        'authenticated', relation.oid, 'INSERT'
      )
      and not pg_catalog.has_any_column_privilege(
        'authenticated', relation.oid, 'REFERENCES'
      )
      and pg_catalog.has_table_privilege(
        'service_role', relation.oid, 'INSERT'
      )
      and pg_catalog.has_table_privilege(
        'service_role', relation.oid, 'DELETE'
      )
      and not exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            relation.relacl,
            pg_catalog.acldefault('r', relation.relowner)
          )
        ) as acl
        where acl.grantee = 0
      )
      and not exists (
        select 1
        from pg_catalog.pg_policy as policy
        where policy.polrelid = relation.oid
          and policy.polcmd::text in ('a', 'd', '*')
          and (
            0 = any(policy.polroles)
            or exists (
              select 1
              from pg_catalog.pg_roles as policy_role
              where policy_role.rolname in ('anon', 'authenticated')
                and policy_role.oid = any(policy.polroles)
            )
          )
      ),
    'Order INSERT/DELETE/TRUNCATE/REFERENCES/TRIGGER is server-only; customer SELECT and legacy admin UPDATE remain compatible'
  from pg_catalog.pg_class as relation
  cross join release_state as state
  where relation.oid = 'public.orders'::pg_catalog.regclass

  union all

  select
    'profile trigger guards finance, account and authority fields',
    position('credit_balance' in definition) > 0
      and position('staff_adjustment' in definition) > 0
      and position('account_status' in definition) > 0
      and position('internal_admin_note' in definition) > 0
      and position('staff_permissions' in definition) > 0
      and position('profile authority fields are not a coherent authority tuple' in definition) > 0
      and position('staff.manage' in definition) > 0,
    'Direct own-profile UPDATE cannot mutate protected fields'
  from (
    select pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        pg_catalog.to_regprocedure(
          'public.protect_profile_authority_fields()'
        )
      )
    ) as definition
  ) as profile_guard

  union all

  select
    'profile authority tuple constraint protects every future write',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        pg_catalog.strpos(
          pg_catalog.lower(
            pg_catalog.pg_get_constraintdef(constraint_info.oid, true)
          ),
          'staff_role = ''owner'''
        ) > 0
        and pg_catalog.strpos(
          pg_catalog.lower(
            pg_catalog.pg_get_constraintdef(constraint_info.oid, true)
          ),
          'manager'
        ) > 0
        and pg_catalog.strpos(
          pg_catalog.lower(
            pg_catalog.pg_get_constraintdef(constraint_info.oid, true)
          ),
          'cardinality'
        ) > 0
      ),
    pg_catalog.count(*)::text
      || ' authority tuple constraints; future writes must be coherent'
  from pg_catalog.pg_constraint as constraint_info
  where constraint_info.conrelid = 'public.profiles'::pg_catalog.regclass
    and constraint_info.conname = 'profiles_emergency_authority_tuple_check'

  union all

  select
    'emergency relations exist with RLS and no Data API grants',
    pg_catalog.count(*) = 2
      and pg_catalog.bool_and(
        relation.oid is not null
        and relation.relrowsecurity
        and relation_owner.rolname = 'postgres'
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              relation.relacl,
              pg_catalog.acldefault('r', relation.relowner)
            )
          ) as acl
          where acl.grantee = 0
            or acl.grantee in (
              select role_info.oid
              from pg_catalog.pg_roles as role_info
              where role_info.rolname in (
                'anon',
                'authenticated',
                'service_role'
              )
            )
        )
        and not pg_catalog.has_table_privilege(
          'anon',
          relation.oid,
          'SELECT'
        )
        and not pg_catalog.has_table_privilege('anon', relation.oid, 'INSERT')
        and not pg_catalog.has_table_privilege('anon', relation.oid, 'UPDATE')
        and not pg_catalog.has_table_privilege('anon', relation.oid, 'DELETE')
        and not pg_catalog.has_table_privilege(
          'authenticated',
          relation.oid,
          'SELECT'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated', relation.oid, 'INSERT'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated', relation.oid, 'UPDATE'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated', relation.oid, 'DELETE'
        )
        and not pg_catalog.has_table_privilege(
          'service_role',
          relation.oid,
          'SELECT'
        )
        and not pg_catalog.has_table_privilege(
          'service_role', relation.oid, 'INSERT'
        )
        and not pg_catalog.has_table_privilege(
          'service_role', relation.oid, 'UPDATE'
        )
        and not pg_catalog.has_table_privilege(
          'service_role', relation.oid, 'DELETE'
        )
      ),
    pg_catalog.count(*) filter (where relation.oid is null)::text || ' missing'
  from private_relations as expected
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
    and relation.relname = expected.relation_name
    and relation.relkind in ('r', 'p')
  left join pg_catalog.pg_roles as relation_owner
    on relation_owner.oid = relation.relowner
)
select
  check_name,
  case when ok then 'PASS' else 'FAIL' end as result,
  details
from checks
order by check_name;
