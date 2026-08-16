-- SELECT-only verification for the integrated security hotfix migrations.
-- This returns aggregate authority counts only; it does not expose customer PII.

with api_only_relations(relation_name) as (
  values
    ('request_messages'),
    ('request_work_orders'),
    ('request_work_order_events'),
    ('request_internal_notes'),
    ('email_delivery_events'),
    ('email_suppressions'),
    ('file_expert_jobs'),
    ('file_expert_feedback'),
    ('known_file_patterns'),
    ('file_expert_binary_fingerprints'),
    ('file_fingerprints'),
    ('desktop_request_approvals'),
    ('widget_settings'),
    ('widget_plans'),
    ('widget_clients'),
    ('widget_api_keys'),
    ('widget_access_logs'),
    ('widget_domain_change_requests'),
    ('widget_webhook_events'),
    ('widget_webhook_effects'),
    ('widget_audit_logs'),
    ('widget_enquiries'),
    ('widget_rate_limit_buckets')
),
expected_storage_policies(policy_name, command_name, role_name, policy_mode) as (
  values
    ('MG customer files select', 'SELECT', 'authenticated', 'PERMISSIVE'),
    ('MG customer files insert', 'INSERT', 'authenticated', 'PERMISSIVE'),
    ('MG file expert select', 'SELECT', 'authenticated', 'PERMISSIVE'),
    ('MG protected buckets select boundary', 'SELECT', 'authenticated', 'RESTRICTIVE'),
    ('MG protected buckets insert boundary', 'INSERT', 'authenticated', 'RESTRICTIVE'),
    ('MG protected buckets update boundary', 'UPDATE', 'authenticated', 'RESTRICTIVE'),
    ('MG protected buckets delete boundary', 'DELETE', 'authenticated', 'RESTRICTIVE'),
    ('MG protected buckets anon select boundary', 'SELECT', 'anon', 'RESTRICTIVE'),
    ('MG protected buckets anon insert boundary', 'INSERT', 'anon', 'RESTRICTIVE'),
    ('MG protected buckets anon update boundary', 'UPDATE', 'anon', 'RESTRICTIVE'),
    ('MG protected buckets anon delete boundary', 'DELETE', 'anon', 'RESTRICTIVE')
),
expected_ledger_columns(column_name) as (
  values
    ('id'),
    ('user_id'),
    ('type'),
    ('source_type'),
    ('source_id'),
    ('credits_delta'),
    ('balance_after'),
    ('description'),
    ('amount_total'),
    ('currency'),
    ('created_at')
),
authority_counts as (
  select
    pg_catalog.count(*) filter (
      where role = 'admin' and staff_role = 'owner'
    ) as primary_owners,
    pg_catalog.count(*) filter (
      where role = 'admin' and staff_role is distinct from 'owner'
    ) as non_owner_admins,
    pg_catalog.count(*) filter (
      where role not in ('customer', 'staff', 'admin') or role is null
    ) as unknown_roles,
    pg_catalog.count(*) filter (
      where role = 'customer'
        and (
          staff_role is not null
          or pg_catalog.cardinality(coalesce(staff_permissions, '{}'::text[])) > 0
        )
    ) as customer_authority_markers,
    pg_catalog.count(*) filter (
      where role = 'staff'
        and (
          staff_role is null
          or staff_role not in ('manager', 'calibrator', 'support')
          or 'staff.manage' = any(coalesce(staff_permissions, '{}'::text[]))
          or not (
            coalesce(staff_permissions, '{}'::text[]) <@ array[
            'orders.view',
            'orders.manage',
            'customers.view',
            'customers.manage',
            'credits.manage',
            'files.download',
            'files.upload',
            'messages.manage',
            'staff.manage',
            'file_expert.manage',
            'ai_training.manage',
            'vehicles.manage',
            'widget.manage'
            ]::text[]
          )
        )
    ) as invalid_staff_authority
  from public.profiles
),
checks(check_name, ok, details) as (
  select
    'authority inventory has exactly one canonical owner',
    primary_owners = 1,
    primary_owners::text || ' canonical owners'
  from authority_counts

  union all

  select
    'File Expert processing claims have recoverable leases',
    pg_catalog.count(*) = 2,
    pg_catalog.count(*)::text || ' of 2 lease columns found'
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'file_expert_jobs'
    and column_name in ('analysis_claim_token', 'analysis_started_at')

  union all

  select
    'legacy and malformed authority markers are absent',
    non_owner_admins = 0
      and unknown_roles = 0
      and customer_authority_markers = 0
      and invalid_staff_authority = 0,
    pg_catalog.format(
      'admin_non_owner=%s unknown_roles=%s customer_markers=%s invalid_staff=%s',
      non_owner_admins,
      unknown_roles,
      customer_authority_markers,
      invalid_staff_authority
    )
  from authority_counts

  union all

  select
    'profile and order Data API policies are deterministic and customer-owned',
    (select pg_catalog.count(*) = 3
     from pg_catalog.pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename in ('profiles', 'orders'))
      and exists (
        select 1
        from pg_catalog.pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'profiles'
          and policy.policyname = 'Customers can read own profile'
          and policy.permissive = 'PERMISSIVE'
          and policy.cmd = 'SELECT'
          and policy.roles = array['authenticated']::name[]
          and pg_catalog.lower(coalesce(policy.qual, '')) like '%id%auth.uid()%'
          and pg_catalog.lower(coalesce(policy.qual, '')) not like '% or %'
          and policy.with_check is null
      )
      and exists (
        select 1
        from pg_catalog.pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'profiles'
          and policy.policyname = 'Customers can update own profile settings'
          and policy.permissive = 'PERMISSIVE'
          and policy.cmd = 'UPDATE'
          and policy.roles = array['authenticated']::name[]
          and pg_catalog.lower(coalesce(policy.qual, '')) like '%id%auth.uid()%'
          and pg_catalog.lower(coalesce(policy.qual, '')) not like '% or %'
          and pg_catalog.lower(coalesce(policy.with_check, '')) like '%id%auth.uid()%'
          and pg_catalog.lower(coalesce(policy.with_check, '')) not like '% or %'
      )
      and exists (
        select 1
        from pg_catalog.pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'orders'
          and policy.policyname = 'Customers can read own orders'
          and policy.permissive = 'PERMISSIVE'
          and policy.cmd = 'SELECT'
          and policy.roles = array['authenticated']::name[]
          and pg_catalog.lower(coalesce(policy.qual, '')) like '%customer_id%auth.uid()%'
          and pg_catalog.lower(coalesce(policy.qual, '')) not like '% or %'
          and policy.with_check is null
      ),
    'Staff reads use projected APIs; customers can access only their own rows'

  union all

  select
    'customer profile and order SELECT columns are allowlisted',
    not pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'SELECT')
      and not pg_catalog.has_table_privilege('authenticated', 'public.orders', 'SELECT')
      and (
        select pg_catalog.bool_and(pg_catalog.has_column_privilege(
          'authenticated', 'public.profiles', allowed.column_name, 'SELECT'
        ))
        from (values
          ('id'), ('email'), ('customer_id'), ('credit_balance'),
          ('allow_negative_credits'), ('negative_credit_limit'), ('account_status'),
          ('full_name'), ('account_type'), ('company_name'), ('phone'), ('street'),
          ('postal_code'), ('city'), ('country'), ('vat_id'), ('invoice_email'),
          ('preferred_contact')
        ) as allowed(column_name)
      )
      and (
        select pg_catalog.bool_and(not pg_catalog.has_column_privilege(
          'authenticated', 'public.profiles', private_column.column_name, 'SELECT'
        ))
        from (values
          ('role'), ('staff_role'), ('staff_permissions'), ('internal_admin_note'),
          ('customer_tags')
        ) as private_column(column_name)
      )
      and (
        select pg_catalog.bool_and(pg_catalog.has_column_privilege(
          'authenticated', 'public.orders', allowed.column_name, 'SELECT'
        ))
        from (values
          ('id'), ('customer_id'), ('customer_email'), ('vehicle_brand'),
          ('vehicle_model'), ('vehicle_generation'), ('vehicle_engine'),
          ('service_type'), ('credits_required'), ('status'), ('notes'), ('created_at')
        ) as allowed(column_name)
      )
      and (
        select pg_catalog.bool_and(not pg_catalog.has_column_privilege(
          'authenticated', 'public.orders', private_column.column_name, 'SELECT'
        ))
        from (values
          ('original_file_path'), ('modified_file_path'), ('modified_files'),
          ('customer_uploads'), ('customer_upload_grant_nonce')
        ) as private_column(column_name)
      ),
    'Raw authority and storage metadata are reachable only through projected APIs'

  union all

  select
    'customer credit ledger is own-row and projection-only',
    exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'credit_transactions'
        and relation.relrowsecurity
    )
      and not pg_catalog.has_table_privilege(
        'authenticated', 'public.credit_transactions', 'SELECT'
      )
      and (
        select pg_catalog.bool_and(
          pg_catalog.has_column_privilege(
            'authenticated',
            'public.credit_transactions',
            expected.column_name,
            'SELECT'
          )
        )
        from expected_ledger_columns as expected
      )
      and not exists (
        select 1
        from information_schema.columns as live
        where live.table_schema = 'public'
          and live.table_name = 'credit_transactions'
          and not exists (
            select 1
            from expected_ledger_columns as expected
            where expected.column_name = live.column_name
          )
          and pg_catalog.has_column_privilege(
            'authenticated',
            'public.credit_transactions',
            live.column_name,
            'SELECT'
          )
      )
      and not exists (
        select 1
        from (values
          ('INSERT'), ('UPDATE'), ('DELETE'),
          ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
        ) as privilege(privilege_name)
        where pg_catalog.has_table_privilege(
          'authenticated',
          'public.credit_transactions',
          privilege.privilege_name
        )
      )
      and not exists (
        select 1
        from (values
          ('authenticated'),
          ('anon')
        ) as api_role(role_name)
        cross join information_schema.columns as live
        cross join (values
          ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')
        ) as privilege(privilege_name)
        where live.table_schema = 'public'
          and live.table_name = 'credit_transactions'
          and (
            api_role.role_name = 'anon'
            and pg_catalog.has_column_privilege(
              api_role.role_name,
              'public.credit_transactions',
              live.column_name,
              privilege.privilege_name
            )
            or api_role.role_name = 'authenticated'
            and privilege.privilege_name <> 'SELECT'
            and pg_catalog.has_column_privilege(
              api_role.role_name,
              'public.credit_transactions',
              live.column_name,
              privilege.privilege_name
            )
          )
      )
      and (
        select pg_catalog.bool_and(
          pg_catalog.has_table_privilege(
            'service_role',
            'public.credit_transactions',
            privilege.privilege_name
          )
        )
        from (values
          ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
          ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
        ) as privilege(privilege_name)
      )
      and (
        select pg_catalog.count(*) = 1
          and pg_catalog.bool_and(
            policy.policyname = 'Customers can read own credit transactions'
            and policy.permissive = 'PERMISSIVE'
            and policy.cmd = 'SELECT'
            and policy.roles = array['authenticated']::name[]
            and pg_catalog.lower(coalesce(policy.qual, '')) like '%auth.uid()%'
            and pg_catalog.lower(coalesce(policy.qual, '')) like '%user_id%'
            and pg_catalog.lower(coalesce(policy.qual, '')) not like '%profiles%'
            and pg_catalog.lower(coalesce(policy.qual, '')) not like '% or %'
            and policy.with_check is null
          )
        from pg_catalog.pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'credit_transactions'
      ),
    'Authenticated customers receive 11 safe columns from their own ledger rows only'

  union all

  select
    'private operational relations are service API only',
    pg_catalog.bool_and(
      pg_catalog.to_regclass('public.' || relation_name) is not null
      and not pg_catalog.has_table_privilege(
        'anon',
        pg_catalog.to_regclass('public.' || relation_name),
        'SELECT'
      )
      and not pg_catalog.has_table_privilege(
        'anon',
        pg_catalog.to_regclass('public.' || relation_name),
        'INSERT'
      )
      and not pg_catalog.has_table_privilege(
        'anon',
        pg_catalog.to_regclass('public.' || relation_name),
        'UPDATE'
      )
      and not pg_catalog.has_table_privilege(
        'anon',
        pg_catalog.to_regclass('public.' || relation_name),
        'DELETE'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated',
        pg_catalog.to_regclass('public.' || relation_name),
        'SELECT'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated',
        pg_catalog.to_regclass('public.' || relation_name),
        'INSERT'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated',
        pg_catalog.to_regclass('public.' || relation_name),
        'UPDATE'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated',
        pg_catalog.to_regclass('public.' || relation_name),
        'DELETE'
      )
      and pg_catalog.has_table_privilege(
        'service_role',
        pg_catalog.to_regclass('public.' || relation_name),
        'SELECT'
      )
      and pg_catalog.has_table_privilege(
        'service_role',
        pg_catalog.to_regclass('public.' || relation_name),
        'INSERT'
      )
      and pg_catalog.has_table_privilege(
        'service_role',
        pg_catalog.to_regclass('public.' || relation_name),
        'UPDATE'
      )
      and pg_catalog.has_table_privilege(
        'service_role',
        pg_catalog.to_regclass('public.' || relation_name),
        'DELETE'
      )
      and exists (
        select 1
        from pg_catalog.pg_class as relation
        where relation.oid = pg_catalog.to_regclass('public.' || relation_name)
          and relation.relrowsecurity
      )
    ),
    pg_catalog.count(*)::text || ' API-only relations checked'
  from api_only_relations

  union all

  select
    'customer storage objects are immutable through hosted-compatible RLS',
    not exists (
      select 1
      from (values
        ('MG protected buckets update boundary', 'UPDATE', 'authenticated'),
        ('MG protected buckets delete boundary', 'DELETE', 'authenticated'),
        ('MG protected buckets anon update boundary', 'UPDATE', 'anon'),
        ('MG protected buckets anon delete boundary', 'DELETE', 'anon')
      ) as expected(policy_name, command_name, role_name)
      left join pg_catalog.pg_policies as policy
        on policy.schemaname = 'storage'
        and policy.tablename = 'objects'
        and policy.policyname = expected.policy_name
        and policy.cmd = expected.command_name
        and policy.permissive = 'RESTRICTIVE'
        and policy.roles = array[expected.role_name]::name[]
      where policy.policyname is null
        or position('customer-files' in pg_catalog.lower(coalesce(policy.qual, ''))) = 0
        or position('file-expert' in pg_catalog.lower(coalesce(policy.qual, ''))) = 0
        or expected.command_name = 'UPDATE'
          and (
            position('customer-files' in pg_catalog.lower(coalesce(policy.with_check, ''))) = 0
            or position('file-expert' in pg_catalog.lower(coalesce(policy.with_check, ''))) = 0
          )
        or expected.command_name = 'DELETE'
          and policy.with_check is not null
        or pg_catalog.lower(
          coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
        ) ~ '(auth\.uid|has_staff_permission)'
    ),
    'Hosted Storage grants stay managed; exact anon/authenticated UPDATE and DELETE boundaries deny both protected buckets'

  union all

  select
    'private Storage bucket policies are canonical and restrictive',
    exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'storage'
        and relation.relname = 'objects'
        and relation.relrowsecurity
    )
      and not exists (
        select 1
        from expected_storage_policies as expected
        left join pg_catalog.pg_policies as policy
          on policy.schemaname = 'storage'
          and policy.tablename = 'objects'
          and policy.policyname = expected.policy_name
          and policy.cmd = expected.command_name
          and policy.permissive = expected.policy_mode
          and policy.roles = array[expected.role_name]::name[]
        cross join lateral (
          select pg_catalog.lower(
            coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
          ) as expression
        ) as policy_expression
        where policy.policyname is null
          or position('customer-files' in policy_expression.expression) = 0
            and expected.policy_name like '%customer files%'
          or position('file-expert' in policy_expression.expression) = 0
            and expected.policy_name like '%file expert%'
          or expected.policy_name like '%protected buckets%'
            and (
              position('customer-files' in policy_expression.expression) = 0
              or position('file-expert' in policy_expression.expression) = 0
            )
          or expected.role_name = 'authenticated'
            and expected.policy_name not like '%protected buckets%'
            and expected.policy_name <> 'MG customer files insert'
            and position('auth.uid' in policy_expression.expression) = 0
          or expected.policy_name = 'MG customer files select'
            and position('files.download' in policy_expression.expression) = 0
          or expected.policy_name = 'MG customer files insert'
            and (
              position('files.upload' in policy_expression.expression) = 0
              or position('auth.uid' in policy_expression.expression) > 0
            )
          or expected.policy_name = 'MG file expert select'
            and position('file_expert.manage' in policy_expression.expression) = 0
          or expected.policy_name = 'MG protected buckets select boundary'
            and (
              position('auth.uid' in policy_expression.expression) = 0
              or position('files.download' in policy_expression.expression) = 0
              or position('file_expert.manage' in policy_expression.expression) = 0
            )
          or expected.policy_name = 'MG protected buckets insert boundary'
            and (
              position('files.upload' in policy_expression.expression) = 0
              or position('auth.uid' in policy_expression.expression) > 0
            )
          or expected.command_name in ('UPDATE', 'DELETE')
            and policy_expression.expression ~ '(auth\.uid|has_staff_permission)'
      )
      and not exists (
        select 1
        from pg_catalog.pg_policies as policy
        where policy.schemaname = 'storage'
          and policy.tablename = 'objects'
          and policy.permissive = 'PERMISSIVE'
          and policy.roles && array['public', 'anon', 'authenticated']::name[]
          and policy.policyname not in (
            'MG customer files select',
            'MG customer files insert',
            'MG file expert select'
          )
          and pg_catalog.lower(
            coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
          ) ~ '(customer-files|file-expert)'
      )
      and not exists (
        select 1
        from pg_catalog.pg_policies as policy
        where policy.schemaname = 'storage'
          and policy.tablename = 'objects'
          and pg_catalog.lower(
            coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
          ) ~ '(customer-files|file-expert)'
          and (
            not exists (
              select 1
              from expected_storage_policies as expected
              where expected.policy_name = policy.policyname
            )
            or pg_catalog.lower(
              coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
            ) ~ '(profiles|staff_role|staff_permissions)'
          )
      ),
    'The exact restrictive command matrix prevents permissive OR-policies from bypassing protected-bucket access'

  union all

  select
    'desktop idempotency and server approval tables are private',
    pg_catalog.to_regclass('public.desktop_request_idempotency') is not null
      and pg_catalog.to_regclass('public.desktop_request_approvals') is not null
      and not pg_catalog.has_table_privilege(
        'authenticated',
        'public.desktop_request_idempotency',
        'SELECT'
      )
      and pg_catalog.has_table_privilege(
        'service_role',
        'public.desktop_request_idempotency',
        'SELECT'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated',
        'public.desktop_request_approvals',
        'SELECT'
      )
      and pg_catalog.has_table_privilege(
        'service_role',
        'public.desktop_request_approvals',
        'INSERT'
      ),
    'Only the server may mint approvals; the RPC atomically consumes them'

  union all

  select
    'desktop order RPC has the reviewed execution boundary',
    pg_catalog.to_regprocedure(
      'public.create_desktop_order_with_credit_deduction(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'
    ) is not null
      and pg_catalog.has_function_privilege(
        'authenticated',
        'public.create_desktop_order_with_credit_deduction(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'anon',
        'public.create_desktop_order_with_credit_deduction(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
        'EXECUTE'
      )
      and position(
        'on conflict (user_id, idempotency_key) do nothing' in pg_catalog.lower(
          pg_catalog.pg_get_functiondef(
            'public.create_desktop_order_with_credit_deduction(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'::pg_catalog.regprocedure
          )
        )
      ) > 0
      and position(
        'from public.desktop_request_approvals' in pg_catalog.lower(
          pg_catalog.pg_get_functiondef(
            'public.create_desktop_order_with_credit_deduction(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'::pg_catalog.regprocedure
          )
        )
      ) > 0
      and position(
        'approval.consumed_at is not null' in pg_catalog.lower(
          pg_catalog.pg_get_functiondef(
            'public.create_desktop_order_with_credit_deduction(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'::pg_catalog.regprocedure
          )
        )
      ) > 0,
    'Authenticated caller requires a private single-use server approval and atomic claim'

  union all

  select
    'web order creation uses a private atomic idempotency claim',
    pg_catalog.to_regclass('public.web_request_idempotency') is not null
      and not pg_catalog.has_table_privilege(
        'authenticated', 'public.web_request_idempotency', 'SELECT'
      )
      and pg_catalog.has_table_privilege(
        'service_role', 'public.web_request_idempotency', 'SELECT'
      )
      and pg_catalog.to_regprocedure(
        'public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'
      ) is not null
      and pg_catalog.has_function_privilege(
        'authenticated',
        'public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'anon',
        'public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
        'EXECUTE'
      )
      and position(
        'on conflict (user_id, idempotency_key) do nothing' in pg_catalog.lower(
          pg_catalog.pg_get_functiondef(
            'public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'::pg_catalog.regprocedure
          )
        )
      ) > 0,
    'A lost browser response cannot create a second debit or order'

  union all

  select
    'widget checkout and webhook durable-state columns exist',
    pg_catalog.count(*) = 15,
    pg_catalog.count(*)::text || ' of 15 columns found'
  from information_schema.columns
  where table_schema = 'public'
    and (
      (table_name = 'widget_clients' and column_name in (
        'stripe_checkout_session_id',
        'checkout_pending_until',
        'stripe_last_event_created',
        'stripe_last_event_id',
        'canonical_domain',
        'checkout_claim_token',
        'checkout_claimed_at'
      ))
      or (table_name = 'widget_webhook_events' and column_name in (
        'processing_state',
        'processed_at',
        'claim_token',
        'claimed_at',
        'attempt_count',
        'last_error'
      ))
      or (table_name = 'widget_audit_logs' and column_name in (
        'source_event_id',
        'effect_key'
      ))
    )

  union all

  select
    'widget canonical ownership and webhook effects are database-enforced',
    exists (
      select 1
      from information_schema.columns as column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'widget_clients'
        and column_info.column_name = 'canonical_domain'
        and column_info.is_nullable = 'NO'
    )
      and exists (
        select 1
        from pg_catalog.pg_index as index_info
        join pg_catalog.pg_class as index_relation
          on index_relation.oid = index_info.indexrelid
        where index_relation.relname = 'widget_clients_one_live_canonical_domain_idx'
          and index_info.indisunique
          and pg_catalog.lower(pg_catalog.pg_get_indexdef(index_info.indexrelid))
            like '%canonical_domain%'
          and pg_catalog.lower(
            pg_catalog.pg_get_expr(index_info.indpred, index_info.indrelid)
          ) like '%status is distinct from%cancelled%'
      )
      and exists (
        select 1
        from pg_catalog.pg_trigger as trigger_info
        where trigger_info.tgrelid = 'public.widget_clients'::pg_catalog.regclass
          and trigger_info.tgname = 'widget_clients_set_canonical_domain'
          and trigger_info.tgenabled <> 'D'
          and not trigger_info.tgisinternal
          and trigger_info.tgfoid =
            'public.widget_set_canonical_domain()'::pg_catalog.regprocedure
      )
      and not pg_catalog.has_function_privilege(
        'anon', 'public.widget_set_canonical_domain()', 'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated', 'public.widget_set_canonical_domain()', 'EXECUTE'
      )
      and pg_catalog.has_function_privilege(
        'service_role', 'public.widget_set_canonical_domain()', 'EXECUTE'
      )
      and exists (
        select 1
        from pg_catalog.pg_proc as procedure
        where procedure.oid =
          'public.widget_set_canonical_domain()'::pg_catalog.regprocedure
          and not procedure.prosecdef
          and exists (
            select 1
            from pg_catalog.unnest(procedure.proconfig) as config(value)
            where config.value in ('search_path=', 'search_path=""')
          )
      )
      and exists (
        select 1
        from pg_catalog.pg_constraint as constraint_info
        where constraint_info.conrelid =
          'public.widget_webhook_events'::pg_catalog.regclass
          and constraint_info.conname = 'widget_webhook_events_claim_state_check'
          and constraint_info.convalidated
      )
      and exists (
        select 1
        from pg_catalog.pg_constraint as constraint_info
        where constraint_info.conrelid =
          'public.widget_webhook_effects'::pg_catalog.regclass
          and constraint_info.contype = 'p'
          and pg_catalog.lower(
            pg_catalog.pg_get_constraintdef(constraint_info.oid)
          ) like '%event_id%effect_key%'
      )
      and exists (
        select 1
        from pg_catalog.pg_class as index_relation
        where index_relation.oid =
          pg_catalog.to_regclass('public.widget_audit_logs_event_effect_idx')
      ),
    'Canonical host allocation, claim leases and external effects must be durable'

  union all

  select
    'widget checkout provider creation is atomically claimed and bound',
    exists (
      select 1
      from pg_catalog.pg_constraint as constraint_info
      where constraint_info.conrelid =
        'public.widget_clients'::pg_catalog.regclass
        and constraint_info.conname = 'widget_clients_checkout_claim_state_check'
        and constraint_info.convalidated
    )
      and exists (
        select 1
        from pg_catalog.pg_index as index_info
        join pg_catalog.pg_class as index_relation
          on index_relation.oid = index_info.indexrelid
        where index_relation.relname = 'widget_clients_checkout_claim_token_idx'
          and index_info.indisunique
          and pg_catalog.lower(pg_catalog.pg_get_indexdef(index_info.indexrelid))
            like '%checkout_claim_token%'
      )
      and pg_catalog.to_regprocedure(
        'public.claim_widget_checkout_attempt(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,integer,uuid,timestamptz)'
      ) is not null
      and pg_catalog.to_regprocedure(
        'public.bind_widget_checkout_session(uuid,uuid,uuid,text,timestamptz)'
      ) is not null
      and pg_catalog.to_regprocedure(
        'public.release_widget_checkout_attempt(uuid,uuid,uuid,text)'
      ) is not null
      and not pg_catalog.has_function_privilege(
        'anon',
        'public.claim_widget_checkout_attempt(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,integer,uuid,timestamptz)',
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated',
        'public.claim_widget_checkout_attempt(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,integer,uuid,timestamptz)',
        'EXECUTE'
      )
      and pg_catalog.has_function_privilege(
        'service_role',
        'public.claim_widget_checkout_attempt(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,integer,uuid,timestamptz)',
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'anon',
        'public.bind_widget_checkout_session(uuid,uuid,uuid,text,timestamptz)',
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated',
        'public.bind_widget_checkout_session(uuid,uuid,uuid,text,timestamptz)',
        'EXECUTE'
      )
      and pg_catalog.has_function_privilege(
        'service_role',
        'public.bind_widget_checkout_session(uuid,uuid,uuid,text,timestamptz)',
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'anon',
        'public.release_widget_checkout_attempt(uuid,uuid,uuid,text)',
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated',
        'public.release_widget_checkout_attempt(uuid,uuid,uuid,text)',
        'EXECUTE'
      )
      and pg_catalog.has_function_privilege(
        'service_role',
        'public.release_widget_checkout_attempt(uuid,uuid,uuid,text)',
        'EXECUTE'
      )
      and (
        select pg_catalog.count(*) = 3
          and pg_catalog.bool_and(not procedure.prosecdef)
          and pg_catalog.bool_and(exists (
            select 1
            from pg_catalog.unnest(procedure.proconfig) as config(value)
            where config.value in ('search_path=', 'search_path=""')
          ))
        from pg_catalog.pg_proc as procedure
        where procedure.oid in (
          'public.claim_widget_checkout_attempt(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,integer,uuid,timestamptz)'::pg_catalog.regprocedure,
          'public.bind_widget_checkout_session(uuid,uuid,uuid,text,timestamptz)'::pg_catalog.regprocedure,
          'public.release_widget_checkout_attempt(uuid,uuid,uuid,text)'::pg_catalog.regprocedure
        )
      )
      and position(
        'for update' in pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'public.claim_widget_checkout_attempt(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,integer,uuid,timestamptz)'::pg_catalog.regprocedure
        ))
      ) > 0
      and position(
        'unique_violation' in pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'public.claim_widget_checkout_attempt(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,integer,uuid,timestamptz)'::pg_catalog.regprocedure
        ))
      ) > 0
      and position(
        'checkout_claim_token = p_claim_token' in pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'public.bind_widget_checkout_session(uuid,uuid,uuid,text,timestamptz)'::pg_catalog.regprocedure
        ))
      ) > 0
      and position(
        'checkout_claim_token = p_claim_token' in pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'public.release_widget_checkout_attempt(uuid,uuid,uuid,text)'::pg_catalog.regprocedure
        ))
      ) > 0
      and position(
        'p_expired_stripe_checkout_session_id is null' in pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'public.release_widget_checkout_attempt(uuid,uuid,uuid,text)'::pg_catalog.regprocedure
        ))
      ) > 0
      and position(
        'checkout_pending_until <= pg_catalog.now()' in pg_catalog.lower(pg_catalog.pg_get_functiondef(
          'public.release_widget_checkout_attempt(uuid,uuid,uuid,text)'::pg_catalog.regprocedure
        ))
      ) > 0,
    'One database token owns claim, Stripe idempotency, bind and verified release'

  union all

  select
    'Stripe payment and refund recovery state is durable',
    pg_catalog.count(*) = 5
      and exists (
        select 1
        from pg_catalog.pg_constraint as constraint_info
        where constraint_info.conrelid = 'public.payment_records'::pg_catalog.regclass
          and constraint_info.conname = 'payment_records_processing_claim_pair_check'
          and constraint_info.convalidated
      )
      and exists (
        select 1
        from pg_catalog.pg_constraint as constraint_info
        where constraint_info.conrelid = 'public.payment_records'::pg_catalog.regclass
          and constraint_info.conname = 'payment_records_refund_claim_pair_check'
          and constraint_info.convalidated
      )
      and pg_catalog.to_regclass('public.payment_records_processing_lease_idx') is not null
      and pg_catalog.to_regclass('public.payment_records_refund_lease_idx') is not null
      and exists (
        select 1
        from pg_catalog.pg_index as index_info
        where index_info.indexrelid =
          pg_catalog.to_regclass('public.payment_records_provider_refund_unique')
          and index_info.indisunique
      ),
    pg_catalog.count(*)::text || ' of 5 recovery columns found'
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'payment_records'
    and column_name in (
      'processing_claim_token',
      'processing_started_at',
      'provider_refund_id',
      'refund_claim_token',
      'refund_started_at'
    )

  union all

  select
    'one-time additional upload grant nonce exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'customer_upload_grant_nonce'
        and data_type = 'uuid'
    ),
    'Finalize must consume the exact grant nonce atomically'

  union all

  select
    'signup trigger retains allowlisted profile metadata only',
    position(
      $$raw_user_meta_data ->> 'account_type'$$ in pg_catalog.lower(
        pg_catalog.pg_get_functiondef('public.handle_new_user()'::pg_catalog.regprocedure)
      )
    ) > 0
      and position(
        $$raw_user_meta_data ->> 'preferred_contact'$$ in pg_catalog.lower(
          pg_catalog.pg_get_functiondef('public.handle_new_user()'::pg_catalog.regprocedure)
        )
      ) > 0
      and position(
        $$raw_user_meta_data ->> 'role'$$ in pg_catalog.lower(
          pg_catalog.pg_get_functiondef('public.handle_new_user()'::pg_catalog.regprocedure)
        )
      ) = 0
      and exists (
        select 1
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
          and trigger_info.tgenabled <> 'D'
          and not trigger_info.tgisinternal
          and (trigger_info.tgtype::integer & 4) = 4
      ),
    'Presentation metadata is retained, role is server-controlled and signup trigger is enabled'
)
select check_name, ok, details
from checks
order by check_name;
