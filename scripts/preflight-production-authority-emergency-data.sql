-- SELECT-only, aggregate-only Production preflight.
-- Returns counts and one GO/NO-GO boolean; it emits no profile identifiers,
-- e-mail addresses, names, balances, limits, notes or other row values.

with modern_contract_aggregate as (
  select pg_catalog.count(*) as modern_contract_count
  from (values
    ('public.staff_adjust_customer_credits(uuid,numeric,text,uuid)'),
    ('public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'),
    ('public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text,uuid)'),
    ('public.admin_apply_payment_refund(uuid,uuid,text,text,uuid)')
  ) as expected(signature)
  where pg_catalog.to_regprocedure(expected.signature) is not null
),
profile_safety_aggregate as (
  select
    pg_catalog.count(*) filter (
      where profile.credit_balance is not null
        and profile.credit_balance <> pg_catalog.trunc(profile.credit_balance)
    ) as fractional_credit_balance_count,
    pg_catalog.count(*) filter (
      where profile.credit_balance is not null
        and profile.credit_balance not between -2147483648 and 2147483647
    ) as out_of_range_credit_balance_count,
    pg_catalog.count(*) filter (
      where profile.negative_credit_limit is not null
        and profile.negative_credit_limit
          <> pg_catalog.trunc(profile.negative_credit_limit)
    ) as fractional_negative_limit_count,
    pg_catalog.count(*) filter (
      where profile.negative_credit_limit is not null
        and profile.negative_credit_limit not between 0 and 100000
    ) as out_of_range_negative_limit_count,
    pg_catalog.count(*) filter (
      where profile.role = 'customer'
        and (
          profile.staff_role is not null
          or coalesce(
            pg_catalog.array_length(profile.staff_permissions, 1),
            0
          ) > 0
        )
    ) as customer_authority_anomaly_count,
    pg_catalog.count(*) filter (
      where (
        profile.role = 'admin'
        and profile.staff_role is distinct from 'owner'
      )
      or (
        profile.role = 'staff'
        and (
          profile.staff_role is null
          or profile.staff_role not in ('manager', 'calibrator', 'support')
        )
      )
      or profile.role is null
      or profile.role not in ('customer', 'staff', 'admin')
    ) as malformed_staff_authority_count,
    pg_catalog.count(*) filter (
      where profile.role = 'admin'
        and profile.staff_role = 'owner'
    ) as primary_owner_count
  from public.profiles as profile
)
select
  aggregate.fractional_credit_balance_count,
  aggregate.out_of_range_credit_balance_count,
  aggregate.fractional_negative_limit_count,
  aggregate.out_of_range_negative_limit_count,
  aggregate.customer_authority_anomaly_count,
  aggregate.malformed_staff_authority_count,
  aggregate.primary_owner_count,
  contract.modern_contract_count,
  contract.modern_contract_count = 0 as legacy_contract_phase_ready,
  contract.modern_contract_count in (0, 4)
    as schema_contract_phase_coherent,
  true as data_containment_apply_required,
  aggregate.fractional_credit_balance_count = 0
    and aggregate.out_of_range_credit_balance_count = 0
    and aggregate.fractional_negative_limit_count = 0
    and aggregate.out_of_range_negative_limit_count = 0
      as finance_functional_go_ready,
  aggregate.customer_authority_anomaly_count = 0
    and aggregate.malformed_staff_authority_count = 0
    and aggregate.primary_owner_count = 1 as authority_incident_close_ready,
  aggregate.fractional_credit_balance_count = 0
    and aggregate.out_of_range_credit_balance_count = 0
    and aggregate.fractional_negative_limit_count = 0
    and aggregate.out_of_range_negative_limit_count = 0
    and aggregate.customer_authority_anomaly_count = 0
    and aggregate.malformed_staff_authority_count = 0
    and aggregate.primary_owner_count = 1
    and contract.modern_contract_count in (0, 4) as normal_operation_ready
from profile_safety_aggregate as aggregate
cross join modern_contract_aggregate as contract;
