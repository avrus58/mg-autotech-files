-- SELECT-only verification for the financial authority and recovery migrations.
-- This verifier accepts both deliberate release phases: compatibility after
-- 02443-02448, and the final legacy-RPC cutover after 02449.

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
expected_function_matrix(
  signature,
  anon_execute,
  authenticated_execute_before_cutover,
  service_execute_before_cutover,
  revoked_by_cutover
) as (
  values
    ('public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text)', false, false, true, true),
    ('public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text,uuid)', false, false, true, false),
    ('public.admin_add_credits(uuid,integer,text)', false, false, false, false),
    ('public.admin_adjust_customer_credits(uuid,integer,text)', false, false, false, false),
    ('public.admin_apply_payment_refund(uuid,uuid,text,text)', false, false, true, true),
    ('public.admin_apply_payment_refund(uuid,uuid,text,text,uuid)', false, false, true, false),
    ('public.admin_record_bank_payment(uuid,uuid,text,numeric,bigint,text,text)', false, false, true, false),
    ('public.create_customer_order_notification()', false, false, false, false),
    ('public.create_order_with_credit_deduction(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)', false, true, false, true),
    ('public.claim_payment_refund(uuid,uuid,uuid)', false, false, true, false),
    ('public.handle_new_user()', false, false, false, false),
    ('public.has_staff_permission(text)', false, true, false, false),
    ('public.is_admin()', false, true, false, false),
    ('public.is_primary_owner()', false, true, false, false),
    ('public.log_order_credit_usage()', false, false, false, false),
    ('public.protect_order_upload_controls()', false, false, false, false),
    ('public.protect_profile_authority_fields()', false, false, false, false),
    ('public.protect_primary_owner_delete()', false, false, false, false),
    ('public.protect_staff_security_fields()', false, false, false, false),
    ('public.resolve_request_service_credits(text)', false, false, false, false),
    ('public.staff_adjust_customer_credits(uuid,numeric,text)', false, true, false, true),
    ('public.staff_adjust_customer_credits(uuid,numeric,text,uuid)', false, true, false, false)
),
expected_functions(signature, anon_execute, authenticated_execute, service_execute) as (
  select
    matrix.signature,
    matrix.anon_execute,
    case
      when phase.post_cutover and matrix.revoked_by_cutover then false
      else matrix.authenticated_execute_before_cutover
    end,
    case
      when phase.post_cutover and matrix.revoked_by_cutover then false
      else matrix.service_execute_before_cutover
    end
  from expected_function_matrix as matrix
  cross join deployment_phase as phase
),
function_state as (
  select
    expected.*,
    pg_catalog.to_regprocedure(expected.signature) as function_oid
  from expected_functions as expected
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
legacy_function_state as (
  select
    phase.post_cutover,
    coalesce(pg_catalog.max(definition) filter (
      where signature = 'public.staff_adjust_customer_credits(uuid,numeric,text)'
    ), '') as staff_adjustment_definition,
    coalesce(pg_catalog.max(definition) filter (
      where signature = 'public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text)'
    ), '') as stripe_credit_definition,
    coalesce(pg_catalog.max(definition) filter (
      where signature = 'public.admin_apply_payment_refund(uuid,uuid,text,text)'
    ), '') as refund_definition
  from function_definitions
  cross join deployment_phase as phase
  group by phase.post_cutover
),
safe_profile_columns(column_name) as (
  values
    ('full_name'),
    ('account_type'),
    ('company_name'),
    ('phone'),
    ('street'),
    ('postal_code'),
    ('city'),
    ('country'),
    ('vat_id'),
    ('invoice_email'),
    ('preferred_contact')
),
customer_profile_select_columns(column_name) as (
  values
    ('id'),
    ('email'),
    ('customer_id'),
    ('credit_balance'),
    ('allow_negative_credits'),
    ('negative_credit_limit'),
    ('account_status'),
    ('full_name'),
    ('account_type'),
    ('company_name'),
    ('phone'),
    ('street'),
    ('postal_code'),
    ('city'),
    ('country'),
    ('vat_id'),
    ('invoice_email'),
    ('preferred_contact')
),
private_profile_select_columns(column_name) as (
  values
    ('role'),
    ('staff_role'),
    ('staff_permissions'),
    ('staff_updated_at'),
    ('internal_admin_note'),
    ('customer_tags'),
    ('custom_credit_price'),
    ('monthly_file_limit')
),
customer_order_select_columns(column_name) as (
  values
    ('id'),
    ('customer_id'),
    ('customer_email'),
    ('vehicle_brand'),
    ('vehicle_model'),
    ('vehicle_generation'),
    ('vehicle_engine'),
    ('service_type'),
    ('credits_required'),
    ('status'),
    ('notes'),
    ('created_at')
),
private_order_select_columns(column_name) as (
  values
    ('original_file_path'),
    ('modified_file_path'),
    ('modified_files'),
    ('customer_uploads'),
    ('customer_upload_grant_nonce')
),
sensitive_profile_columns(column_name) as (
  values
    ('id'),
    ('email'),
    ('role'),
    ('credit_balance'),
    ('allow_negative_balance'),
    ('negative_credit_limit'),
    ('custom_credit_price'),
    ('monthly_file_limit'),
    ('customer_id'),
    ('allow_negative_credits'),
    ('account_status'),
    ('internal_admin_note'),
    ('customer_tags'),
    ('staff_role'),
    ('staff_permissions'),
    ('staff_updated_at'),
    ('created_at')
),
checks(check_name, ok, details) as (
  select
    'critical functions exist',
    pg_catalog.bool_and(function_oid is not null),
    pg_catalog.count(*) filter (where function_oid is null)::text || ' missing'
  from function_state

  union all

  select
    'legacy RPC definitions match the release phase',
    case
      when post_cutover then
        position('legacy credit adjustment rpc is disabled' in staff_adjustment_definition) > 0
        and position('legacy stripe credit rpc is disabled' in stripe_credit_definition) > 0
        and position('legacy refund rpc is disabled' in refund_definition) > 0
      else
        position('auth.uid()' in staff_adjustment_definition) > 0
        and position('has_staff_permission(''credits.manage'')' in staff_adjustment_definition) > 0
        and position('pg_catalog.gen_random_uuid()' in staff_adjustment_definition) > 0
        and position('service_role' in stripe_credit_definition) > 0
        and position('from public.payment_records' in stripe_credit_definition) > 0
        and position('for update' in stripe_credit_definition) > 0
        and position('service_role' in refund_definition) > 0
        and position('credits.manage' in refund_definition) > 0
        and position('from public.payment_records' in refund_definition) > 0
        and position('for update' in refund_definition) > 0
    end,
    case
      when post_cutover then '02449 post-deploy cutover'
      else '02443-02448 migration-first compatibility'
    end
  from legacy_function_state

  union all

  select
    'signup metadata cannot assign a profile authority role',
    position(
      $$'customer'$$ in pg_catalog.lower(
        pg_catalog.pg_get_functiondef(function_oid)
      )
    ) > 0
    and position(
      $$raw_user_meta_data ->> 'role'$$ in pg_catalog.lower(
        pg_catalog.pg_get_functiondef(function_oid)
      )
    ) = 0,
    'handle_new_user must always insert role=customer'
  from function_state
  where signature = 'public.handle_new_user()'

  union all

  select
    'auth signup trigger invokes the hardened profile function once',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(trigger_info.tgenabled <> 'D')
      and pg_catalog.bool_and((trigger_info.tgtype::integer & 4) = 4),
    pg_catalog.count(*)::text || ' matching enabled INSERT triggers found'
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

  union all

  select
    'admin helper requires the canonical Primary Owner marker',
    position(
      $$profile.staff_role = 'owner'$$ in pg_catalog.lower(
        pg_catalog.pg_get_functiondef(function_oid)
      )
    ) > 0,
    'is_admin must reject legacy or metadata-created admin/null profiles'
  from function_state
  where signature = 'public.is_admin()'

  union all

  select
    'authority-helper policies do not apply to PUBLIC',
    not exists (
      select 1
      from pg_catalog.pg_policy as policy
      join pg_catalog.pg_class as relation
        on relation.oid = policy.polrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and 0 = any(policy.polroles)
        and (
          coalesce(
            pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
            ''
          ) ilike any(array[
            '%has_staff_permission%',
            '%is_admin()%',
            '%is_primary_owner()%'
          ]::text[])
          or coalesce(
            pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid),
            ''
          ) ilike any(array[
            '%has_staff_permission%',
            '%is_admin()%',
            '%is_primary_owner()%'
          ]::text[])
        )
    ),
    'Policies using authority helpers must be TO authenticated'

  union all

  select
    'critical functions have no PUBLIC EXECUTE',
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
    'critical function role matrix matches',
    pg_catalog.bool_and(
      coalesce(
        pg_catalog.has_function_privilege(
          'anon',
          function_oid,
          'EXECUTE'
        ),
        false
      ) = anon_execute
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
    'anon/authenticated/service_role must match the reviewed matrix'
  from function_state

  union all

  select
    'unexpected critical-function overloads have no Data API EXECUTE',
    not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      left join function_state as expected
        on expected.function_oid = procedure.oid
      where namespace.nspname = 'public'
        and expected.function_oid is null
        and procedure.proname::text = any(array[
          'add_credits_from_stripe',
          'admin_add_credits',
          'admin_adjust_customer_credits',
          'admin_apply_payment_refund',
          'claim_payment_refund',
          'admin_record_bank_payment',
          'create_customer_order_notification',
          'create_order_with_credit_deduction',
          'handle_new_user',
          'has_staff_permission',
          'is_admin',
          'is_primary_owner',
          'log_order_credit_usage',
          'protect_order_upload_controls',
          'protect_primary_owner_delete',
          'protect_profile_authority_fields',
          'protect_staff_security_fields',
          'resolve_request_service_credits',
          'staff_adjust_customer_credits'
        ]::text[])
        and (
          pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE')
        )
    ),
    'Every non-canonical overload must be private'

  union all

  select
    'critical functions use an empty fixed search_path',
    pg_catalog.bool_and(
      exists (
        select 1
        from pg_catalog.unnest(procedure.proconfig) as config(value)
        where config.value in ('search_path=', 'search_path=""')
      )
    ),
    'Every reviewed function must SET search_path to empty'
  from function_state as state
  join pg_catalog.pg_proc as procedure on procedure.oid = state.function_oid

  union all

  select
    'critical functions have the reviewed postgres owner',
    pg_catalog.bool_and(owner_role.rolname = 'postgres'),
    pg_catalog.count(*)::text || ' function owners checked'
  from function_state as state
  join pg_catalog.pg_proc as procedure on procedure.oid = state.function_oid
  join pg_catalog.pg_roles as owner_role on owner_role.oid = procedure.proowner

  union all

  select
    'financial RPC bodies enforce authorization, locks and audit markers',
    pg_catalog.bool_and(
      case
        when signature = 'public.staff_adjust_customer_credits(uuid,numeric,text,uuid)' then
          position('auth.uid()' in definition) > 0
          and position('credits.manage' in definition) > 0
          and position('for share' in definition) > 0
          and position('for update' in definition) > 0
          and position('insert into public.staff_credit_adjustment_idempotency' in definition) > 0
          and position('on conflict (idempotency_key) do nothing' in definition) > 0
          and position('v_claim.actor_id is distinct from v_actor_id' in definition) > 0
          and position('v_claim.customer_id is distinct from p_customer_id' in definition) > 0
          and position('v_claim.amount is distinct from p_amount' in definition) > 0
          and position('convert_to(v_claim.note' in definition) > 0
          and position('return v_claim.balance_after' in definition) > 0
          and position('staff_adjustment' in definition) > 0
          and position('insert into public.credit_transactions' in definition) > 0
        when signature = 'public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text,uuid)' then
          position('service_role' in definition) > 0
          and position('from public.payment_records' in definition) > 0
          and position('for update' in definition) > 0
          and position('stripe_credit_processing' in definition) > 0
          and position('processing_claim_token' in definition) > 0
          and position('payment_record_id' in definition) > 0
          and position('profile.role = ''customer''' in definition) > 0
        when signature = 'public.admin_record_bank_payment(uuid,uuid,text,numeric,bigint,text,text)' then
          position('service_role' in definition) > 0
          and position('credits.manage' in definition) > 0
          and position('for share' in definition) > 0
          and position('for update' in definition) > 0
          and position('profile.role = ''customer''' in definition) > 0
          and position('insert into public.credit_transactions' in definition) > 0
        when signature = 'public.claim_payment_refund(uuid,uuid,uuid)' then
          position('service_role' in definition) > 0
          and position('credits.manage' in definition) > 0
          and position('for share' in definition) > 0
          and position('for update' in definition) > 0
          and position('refund_claim_token' in definition) > 0
          and position('refund_processing' in definition) > 0
          and position('only stripe credit purchases support automatic refunds' in definition) > 0
          and position('stripe_checkout' in definition) > 0
        when signature = 'public.admin_apply_payment_refund(uuid,uuid,text,text,uuid)' then
          position('service_role' in definition) > 0
          and position('credits.manage' in definition) > 0
          and position('for share' in definition) > 0
          and position('for update' in definition) > 0
          and position('refund_provider_succeeded' in definition) > 0
          and position('refund_claim_token' in definition) > 0
          and position('only stripe credit purchases support automatic refunds' in definition) > 0
          and position('stripe_checkout' in definition) > 0
          and position('profile.role = ''customer''' in definition) > 0
          and position('insert into public.credit_transactions' in definition) > 0
        else false
      end
    ),
    pg_catalog.count(*)::text || ' financial entry points checked'
  from function_definitions
  where signature in (
    'public.staff_adjust_customer_credits(uuid,numeric,text,uuid)',
    'public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text,uuid)',
    'public.admin_record_bank_payment(uuid,uuid,text,numeric,bigint,text,text)',
    'public.claim_payment_refund(uuid,uuid,uuid)',
    'public.admin_apply_payment_refund(uuid,uuid,text,text,uuid)'
  )

  union all

  select
    'staff credit adjustment idempotency claims are private and complete',
    pg_catalog.to_regclass(
      'public.staff_credit_adjustment_idempotency'
    ) is not null
    and not pg_catalog.has_table_privilege(
      'anon',
      'public.staff_credit_adjustment_idempotency',
      'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'anon',
      'public.staff_credit_adjustment_idempotency',
      'INSERT'
    )
    and not pg_catalog.has_table_privilege(
      'anon',
      'public.staff_credit_adjustment_idempotency',
      'UPDATE'
    )
    and not pg_catalog.has_table_privilege(
      'anon',
      'public.staff_credit_adjustment_idempotency',
      'DELETE'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.staff_credit_adjustment_idempotency',
      'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.staff_credit_adjustment_idempotency',
      'INSERT'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.staff_credit_adjustment_idempotency',
      'UPDATE'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.staff_credit_adjustment_idempotency',
      'DELETE'
    )
    and not pg_catalog.has_table_privilege(
      'service_role',
      'public.staff_credit_adjustment_idempotency',
      'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'service_role',
      'public.staff_credit_adjustment_idempotency',
      'INSERT'
    )
    and not pg_catalog.has_table_privilege(
      'service_role',
      'public.staff_credit_adjustment_idempotency',
      'UPDATE'
    )
    and not pg_catalog.has_table_privilege(
      'service_role',
      'public.staff_credit_adjustment_idempotency',
      'DELETE'
    )
    and (
      select table_info.relrowsecurity
      from pg_catalog.pg_class as table_info
      where table_info.oid =
        'public.staff_credit_adjustment_idempotency'::pg_catalog.regclass
    )
    and (
      select pg_catalog.count(*) = 9
      from information_schema.columns as column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'staff_credit_adjustment_idempotency'
        and column_info.column_name in (
          'idempotency_key',
          'actor_id',
          'customer_id',
          'amount',
          'note',
          'transaction_id',
          'balance_after',
          'created_at',
          'completed_at'
        )
    ),
    'Private RLS table binds UUID, actor, customer, amount and note to one completed result'

  union all

  select
    'request service catalog is complete and private',
    (
      select pg_catalog.count(*) = 63
        and pg_catalog.count(*) filter (where active) = 63
      from public.request_service_catalog
    )
    and (
      select pg_catalog.md5(
        pg_catalog.string_agg(
          pg_catalog.format(
            '%s|%s|%s|%s',
            catalog.service_id,
            catalog.service_kind,
            catalog.service_title,
            catalog.credits
          ),
          E'\n' order by catalog.service_id collate "C"
        )
      ) = '2427f91d02b9e799d5055ab95486e47a'
      from public.request_service_catalog as catalog
    )
    and not pg_catalog.has_table_privilege(
      'anon',
      'public.request_service_catalog',
      'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.request_service_catalog',
      'SELECT'
    )
    and pg_catalog.has_table_privilege(
      'service_role',
      'public.request_service_catalog',
      'SELECT'
    )
    and (
      select table_info.relrowsecurity
      from pg_catalog.pg_class as table_info
      where table_info.oid = 'public.request_service_catalog'::pg_catalog.regclass
    ),
    '63 exact reviewed rows; only service_role may select directly'

  union all

  select
    'profiles authenticated table-wide UPDATE is absent',
    not pg_catalog.has_table_privilege(
      'authenticated',
      'public.profiles',
      'UPDATE'
    ),
    'Only explicit customer-settings columns may be updated'

  union all

  select
    'profiles safe customer-settings columns are writable',
    pg_catalog.bool_and(
      pg_catalog.has_column_privilege(
        'authenticated',
        'public.profiles',
        column_name,
        'UPDATE'
      )
    ),
    pg_catalog.count(*)::text || ' safe columns checked'
  from safe_profile_columns

  union all

  select
    'profiles authority columns are not directly writable',
    pg_catalog.bool_and(
      not pg_catalog.has_column_privilege(
        'authenticated',
        'public.profiles',
        column_name,
        'UPDATE'
      )
    ),
    pg_catalog.count(*)::text || ' sensitive columns checked'
  from sensitive_profile_columns

  union all

  select
    'profiles authenticated SELECT is column allowlisted',
    not pg_catalog.has_table_privilege(
      'authenticated',
      'public.profiles',
      'SELECT'
    )
      and pg_catalog.bool_and(
        pg_catalog.has_column_privilege(
          'authenticated',
          'public.profiles',
          column_name,
          'SELECT'
        )
      ),
    pg_catalog.count(*)::text || ' customer-visible columns checked'
  from customer_profile_select_columns

  union all

  select
    'profiles private columns are not directly readable',
    pg_catalog.bool_and(
      not pg_catalog.has_column_privilege(
        'authenticated',
        'public.profiles',
        column_name,
        'SELECT'
      )
    ),
    pg_catalog.count(*)::text || ' private columns checked'
  from private_profile_select_columns

  union all

  select
    'orders authenticated access is column-SELECT-only',
    not pg_catalog.has_table_privilege(
      'authenticated',
      'public.orders',
      'SELECT'
    )
    and pg_catalog.bool_and(
      pg_catalog.has_column_privilege(
        'authenticated',
        'public.orders',
        column_name,
        'SELECT'
      )
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.orders',
      'INSERT'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.orders',
      'UPDATE'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.orders',
      'DELETE'
    )
    and not exists (
      select 1
      from information_schema.columns as column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'orders'
        and (
          pg_catalog.has_column_privilege(
            'authenticated',
            'public.orders',
            column_info.column_name,
            'INSERT'
          )
          or pg_catalog.has_column_privilege(
            'authenticated',
            'public.orders',
            column_info.column_name,
            'UPDATE'
          )
        )
    ),
    'Reviewed SELECT columns only; no authenticated INSERT/UPDATE/DELETE grant'
  from customer_order_select_columns

  union all

  select
    'orders storage and delivery columns are not directly readable',
    pg_catalog.bool_and(
      not pg_catalog.has_column_privilege(
        'authenticated',
        'public.orders',
        column_name,
        'SELECT'
      )
    ),
    pg_catalog.count(*)::text || ' private columns checked'
  from private_order_select_columns

  union all

  select
    'orders keep SELECT policies and no direct mutation policy',
    exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = 'orders'
        and policy.cmd = 'SELECT'
    )
    and not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = 'orders'
        and policy.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    ),
    'Ownership/staff SELECT remains; all direct mutation policies are absent'

  union all

  select
    'profiles and orders RLS are enabled',
    pg_catalog.count(*) = 2
      and pg_catalog.bool_and(table_info.relrowsecurity),
    pg_catalog.count(*)::text || ' protected tables checked'
  from pg_catalog.pg_class as table_info
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = table_info.relnamespace
  where namespace.nspname = 'public'
    and table_info.relname in ('profiles', 'orders')

  union all

  select
    'authority triggers are installed and enabled',
    pg_catalog.count(*) = 5
      and pg_catalog.bool_and(trigger_info.tgenabled <> 'D'),
    pg_catalog.count(*)::text || ' of 5 triggers found'
  from pg_catalog.pg_trigger as trigger_info
  where trigger_info.tgrelid in (
      'public.profiles'::pg_catalog.regclass,
      'public.orders'::pg_catalog.regclass
    )
    and trigger_info.tgname in (
      'protect_profile_authority_fields_trigger',
      'protect_staff_security_fields_trigger',
      'protect_primary_owner_delete_trigger',
      'protect_order_upload_controls_trigger',
      'orders_credit_usage_ledger_trigger'
    )
    and not trigger_info.tgisinternal

  union all

  select
    'order RPC is caller-bound, locked and server-priced',
    position(
      'resolve_request_service_credits' in pg_catalog.lower(
        pg_catalog.pg_get_functiondef(function_oid)
      )
    ) > 0
    and position(
      'for update of profile' in pg_catalog.lower(
        pg_catalog.pg_get_functiondef(function_oid)
      )
    ) > 0
    and position(
      'left join auth.users' in pg_catalog.lower(
        pg_catalog.pg_get_functiondef(function_oid)
      )
    ) > 0
    and position(
      'p_credits_required <> v_expected_credits' in pg_catalog.lower(
        pg_catalog.pg_get_functiondef(function_oid)
      )
    ) > 0
    and position(
      'mg_autotech.profile_financial_write' in pg_catalog.lower(
        pg_catalog.pg_get_functiondef(function_oid)
      )
    ) > 0
    and position(
      'v_negative_limit not between 0 and 100000' in pg_catalog.lower(
        pg_catalog.pg_get_functiondef(function_oid)
      )
    ) > 0,
    'Catalog resolver, auth e-mail binding, profile row lock and guarded debit required'
  from function_state
  where signature like 'public.create_order_with_credit_deduction(%'
)
select check_name, ok, details
from checks
order by check_name;
