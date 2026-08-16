-- Read-only preflight for migrations 20260816002443 through 20260816002449.
-- The result contains aggregate readiness only; it never returns customer rows,
-- identifiers, e-mail addresses, object names, or file paths.

with
target_versions(version) as (
  values
    ('20260816002443'),
    ('20260816002444'),
    ('20260816002445'),
    ('20260816002446'),
    ('20260816002447'),
    ('20260816002448'),
    ('20260816002449')
),
required_relations(schema_name, relation_name) as (
  values
    ('auth', 'users'),
    ('public', 'profiles'),
    ('public', 'orders'),
    ('public', 'notifications'),
    ('public', 'credit_payments'),
    ('public', 'credit_transactions'),
    ('public', 'payment_records'),
    ('public', 'payment_event_log'),
    ('public', 'file_expert_jobs'),
    ('public', 'file_expert_binary_fingerprints'),
    ('public', 'widget_clients'),
    ('public', 'widget_webhook_events'),
    ('public', 'widget_access_logs'),
    ('public', 'widget_api_keys'),
    ('public', 'widget_audit_logs'),
    ('public', 'widget_domain_change_requests'),
    ('public', 'widget_enquiries'),
    ('public', 'widget_plans'),
    ('public', 'widget_rate_limit_buckets'),
    ('public', 'widget_settings'),
    ('storage', 'buckets'),
    ('storage', 'objects')
),
required_columns(schema_name, table_name, column_name) as (
  values
    ('public', 'profiles', 'id'),
    ('public', 'profiles', 'role'),
    ('public', 'profiles', 'staff_role'),
    ('public', 'profiles', 'staff_permissions'),
    ('public', 'profiles', 'credit_balance'),
    ('public', 'profiles', 'allow_negative_credits'),
    ('public', 'profiles', 'negative_credit_limit'),
    ('public', 'profiles', 'account_status'),
    ('public', 'orders', 'id'),
    ('public', 'orders', 'customer_id'),
    ('public', 'orders', 'customer_email'),
    ('public', 'orders', 'service_type'),
    ('public', 'orders', 'credits_required'),
    ('public', 'orders', 'original_file_path'),
    ('public', 'orders', 'customer_upload_enabled'),
    ('public', 'payment_records', 'id'),
    ('public', 'payment_records', 'provider'),
    ('public', 'payment_records', 'external_id'),
    ('public', 'payment_records', 'provider_payment_id'),
    ('public', 'payment_records', 'user_id'),
    ('public', 'payment_records', 'status'),
    ('public', 'payment_records', 'payment_type'),
    ('public', 'payment_records', 'credits'),
    ('public', 'payment_records', 'amount_total'),
    ('public', 'payment_records', 'currency'),
    ('public', 'payment_records', 'failure_code'),
    ('public', 'payment_records', 'credits_applied_at'),
    ('public', 'widget_clients', 'id'),
    ('public', 'widget_clients', 'user_id'),
    ('public', 'widget_clients', 'allowed_domain'),
    ('public', 'widget_clients', 'status'),
    ('public', 'widget_clients', 'stripe_customer_id'),
    ('public', 'widget_clients', 'stripe_subscription_id'),
    ('public', 'widget_clients', 'created_at'),
    ('public', 'widget_webhook_events', 'event_id'),
    ('public', 'file_expert_jobs', 'id'),
    ('public', 'file_expert_jobs', 'user_id'),
    ('public', 'file_expert_jobs', 'status'),
    ('public', 'file_expert_jobs', 'ori_file_path'),
    ('public', 'file_expert_jobs', 'mod_file_path')
),
target_relations(schema_name, relation_name) as (
  values
    ('public', 'request_service_catalog'),
    ('public', 'staff_credit_adjustment_idempotency'),
    ('public', 'desktop_request_idempotency'),
    ('public', 'desktop_request_approvals'),
    ('public', 'web_request_idempotency'),
    ('public', 'widget_webhook_effects')
),
target_columns(schema_name, table_name, column_name) as (
  values
    ('public', 'orders', 'customer_upload_grant_nonce'),
    ('public', 'file_expert_jobs', 'analysis_claim_token'),
    ('public', 'file_expert_jobs', 'analysis_started_at'),
    ('public', 'payment_records', 'processing_claim_token'),
    ('public', 'payment_records', 'processing_started_at'),
    ('public', 'payment_records', 'provider_refund_id'),
    ('public', 'payment_records', 'refund_claim_token'),
    ('public', 'payment_records', 'refund_started_at'),
    ('public', 'widget_clients', 'stripe_checkout_session_id'),
    ('public', 'widget_clients', 'checkout_pending_until'),
    ('public', 'widget_clients', 'stripe_last_event_created'),
    ('public', 'widget_clients', 'stripe_last_event_id'),
    ('public', 'widget_clients', 'canonical_domain'),
    ('public', 'widget_clients', 'checkout_claim_token'),
    ('public', 'widget_clients', 'checkout_claimed_at'),
    ('public', 'widget_webhook_events', 'processing_state'),
    ('public', 'widget_webhook_events', 'claim_token'),
    ('public', 'widget_webhook_events', 'claimed_at'),
    ('public', 'widget_webhook_events', 'attempt_count'),
    ('public', 'widget_webhook_events', 'last_error'),
    ('public', 'widget_audit_logs', 'source_event_id'),
    ('public', 'widget_audit_logs', 'effect_key')
),
widget_domains as (
  select
    client.status,
    pg_catalog.regexp_replace(
      pg_catalog.lower(pg_catalog.btrim(client.allowed_domain)),
      '\.+$',
      ''
    ) as canonical_domain
  from public.widget_clients as client
),
canonical_widget_domains as (
  select
    domain.status,
    case
      when pg_catalog.left(domain.canonical_domain, 4) = 'www.'
        then pg_catalog.substr(domain.canonical_domain, 5)
      else domain.canonical_domain
    end as canonical_domain
  from widget_domains as domain
),
checks(sort_order, check_name, ok, details) as (
  select
    10,
    'target migration history is clean',
    not exists (
      select 1
      from supabase_migrations.schema_migrations as migration
      join target_versions as target
        on target.version = migration.version::text
    ),
    'No 02443-02449 version may already be recorded before this release starts'

  union all

  select
    20,
    'all prerequisite relations exist',
    pg_catalog.count(*) filter (
      where pg_catalog.to_regclass(
        pg_catalog.format('%I.%I', required.schema_name, required.relation_name)
      ) is null
    ) = 0,
    pg_catalog.format(
      '%s missing prerequisite relations',
      pg_catalog.count(*) filter (
        where pg_catalog.to_regclass(
          pg_catalog.format('%I.%I', required.schema_name, required.relation_name)
        ) is null
      )
    )
  from required_relations as required

  union all

  select
    30,
    'all prerequisite columns exist',
    pg_catalog.count(*) filter (where live.column_name is null) = 0,
    pg_catalog.format(
      '%s missing prerequisite columns',
      pg_catalog.count(*) filter (where live.column_name is null)
    )
  from required_columns as required
  left join information_schema.columns as live
    on live.table_schema = required.schema_name
    and live.table_name = required.table_name
    and live.column_name = required.column_name

  union all

  select
    40,
    'target DDL has no partial application',
    not exists (
      select 1
      from target_relations as target
      where pg_catalog.to_regclass(
        pg_catalog.format('%I.%I', target.schema_name, target.relation_name)
      ) is not null
    )
      and not exists (
        select 1
        from target_columns as target
        join information_schema.columns as live
          on live.table_schema = target.schema_name
          and live.table_name = target.table_name
          and live.column_name = target.column_name
      ),
    'Target tables and columns must be wholly absent before 02443'

  union all

  select
    50,
    'Auth profile trigger baseline is singular',
    pg_catalog.count(*) = 1,
    pg_catalog.format('%s handle_new_user triggers found', pg_catalog.count(*))
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
    60,
    'profile authority and financial values are migration-safe',
    pg_catalog.count(*) filter (
      where profile.role = 'admin' and profile.staff_role = 'owner'
    ) = 1
      and pg_catalog.count(*) filter (
        where profile.role is null
          or profile.role not in ('customer', 'staff', 'admin')
          or profile.role = 'admin' and profile.staff_role is distinct from 'owner'
          or profile.role = 'customer' and (
            profile.staff_role is not null
            or pg_catalog.cardinality(
              coalesce(profile.staff_permissions, '{}'::text[])
            ) > 0
          )
          or coalesce(profile.credit_balance, 0) <> pg_catalog.trunc(
            coalesce(profile.credit_balance, 0)
          )
          or coalesce(profile.credit_balance, 0) not between -2147483648 and 2147483647
          or coalesce(profile.negative_credit_limit, 0) <> pg_catalog.trunc(
            coalesce(profile.negative_credit_limit, 0)
          )
          or coalesce(profile.negative_credit_limit, 0) not between 0 and 100000
      ) = 0,
    'Exactly one owner; no malformed role, balance, or negative-limit state'
  from public.profiles as profile

  union all

  select
    70,
    'legacy widget domains are canonicalizable',
    not exists (
      select 1
      from canonical_widget_domains as domain
      where domain.canonical_domain is null
        or pg_catalog.length(domain.canonical_domain) not between 3 and 253
        or domain.canonical_domain !~ '^[a-z0-9.-]+$'
        or pg_catalog.cardinality(
          pg_catalog.string_to_array(domain.canonical_domain, '.')
        ) < 2
        or pg_catalog.length(
          (pg_catalog.string_to_array(domain.canonical_domain, '.'))[
            pg_catalog.cardinality(
              pg_catalog.string_to_array(domain.canonical_domain, '.')
            )
          ]
        ) < 2
        or (pg_catalog.string_to_array(domain.canonical_domain, '.'))[
          pg_catalog.cardinality(
            pg_catalog.string_to_array(domain.canonical_domain, '.')
          )
        ] ~ '^[0-9]+$'
        or exists (
          select 1
          from pg_catalog.unnest(
            pg_catalog.string_to_array(domain.canonical_domain, '.')
          ) as label(value)
          where pg_catalog.length(label.value) not between 1 and 63
            or label.value !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
        )
    ),
    'No invalid canonical domain labels found'

  union all

  select
    80,
    'live widget domains remain unique after canonicalization',
    not exists (
      select 1
      from canonical_widget_domains as domain
      where domain.status is distinct from 'cancelled'
      group by domain.canonical_domain
      having pg_catalog.count(*) > 1
    ),
    'No apex/www collision among non-cancelled clients'

  union all

  select
    90,
    'legacy unbound widget checkout window is clear',
    not exists (
      select 1
      from public.widget_clients as client
      where client.status = 'pending'
        and client.stripe_customer_id is null
        and client.stripe_subscription_id is null
        and client.created_at + interval '31 minutes' > pg_catalog.now()
    ),
    'No unbound pending checkout is inside its original provider window'

  union all

  select
    100,
    'protected Storage baseline is private with RLS enabled',
    exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'storage'
        and relation.relname = 'objects'
        and relation.relrowsecurity
    )
      and (
        select pg_catalog.count(*) = 2
        from storage.buckets as bucket
        where bucket.id in ('customer-files', 'file-expert')
          and bucket.public is false
      ),
    'customer-files and file-expert are private; storage.objects RLS is enabled'
)
select check_name, ok, details
from checks
order by sort_order;
