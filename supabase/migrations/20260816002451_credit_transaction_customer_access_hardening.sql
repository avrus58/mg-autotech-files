-- Restore customer credit-ledger and protected Storage access after the
-- authority-column hardening. This migration is additive and must run after
-- 02450, before authenticated customer smoke tests and the 02452 cutover.

begin;

alter table public.credit_transactions enable row level security;

-- Rebuild both relation- and column-level ACLs. A table-level REVOKE does not
-- remove historical per-column grants, so clear every live column explicitly
-- before granting the customer projection.
revoke all privileges on table public.credit_transactions
  from public, anon, authenticated, service_role;

do $credit_transaction_column_acl$
declare
  ledger_column record;
begin
  for ledger_column in
    select attribute.attname as column_name
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.credit_transactions'::pg_catalog.regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
    order by attribute.attnum
  loop
    execute pg_catalog.format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) '
      || 'on table public.credit_transactions '
      || 'from public, anon, authenticated, service_role',
      ledger_column.column_name
    );
  end loop;
end;
$credit_transaction_column_acl$;

grant select (
  id,
  user_id,
  type,
  source_type,
  source_id,
  credits_delta,
  balance_after,
  description,
  amount_total,
  currency,
  created_at
) on table public.credit_transactions to authenticated;

grant all privileges on table public.credit_transactions to service_role;

-- Replace every historical ledger policy, including policies that joined the
-- protected profiles.role column. Customers may read only their own rows;
-- mutation remains server-only through reviewed financial RPCs.
do $credit_transaction_policy_reset$
declare
  ledger_policy record;
begin
  for ledger_policy in
    select policy.policyname
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'credit_transactions'
  loop
    execute pg_catalog.format(
      'drop policy %I on public.credit_transactions',
      ledger_policy.policyname
    );
  end loop;
end;
$credit_transaction_policy_reset$;

create policy "Customers can read own credit transactions"
on public.credit_transactions
as permissive
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Keep only the reviewed transitional policy matrix for the two protected
-- buckets. The filter intentionally ignores policies for every other bucket.
-- The two owner INSERT policies remain until 02452 removes browser uploads.
do $protected_storage_policy_cleanup$
declare
  storage_policy record;
begin
  for storage_policy in
    select policy.policyname
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.policyname not in (
        'MG customer files select',
        'MG customer files insert',
        'MG customer files legacy owner insert',
        'MG file expert select',
        'MG file expert legacy owner insert',
        'MG protected buckets select boundary',
        'MG protected buckets insert boundary',
        'MG protected buckets update boundary',
        'MG protected buckets delete boundary',
        'MG protected buckets anon select boundary',
        'MG protected buckets anon insert boundary',
        'MG protected buckets anon update boundary',
        'MG protected buckets anon delete boundary'
      )
      and pg_catalog.lower(
        coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
      ) ~ '(customer-files|file-expert)'
  loop
    execute pg_catalog.format(
      'drop policy %I on storage.objects',
      storage_policy.policyname
    );
  end loop;
end;
$protected_storage_policy_cleanup$;

commit;
