-- Make the server-side commercial APIs the only pricing write authority.
-- One legacy compatibility cleanup canonicalizes a semantically inactive
-- adjustment value to zero. It cannot change an effective customer price and
-- is recorded with a bounded, PII-free policy event. No rows are deleted.

begin;

lock table public.commerce_settings in share row exclusive mode;
lock table public.customer_commercial_policies in share row exclusive mode;
lock table public.commerce_policy_events in share row exclusive mode;

alter table public.commerce_settings enable row level security;
alter table public.customer_commercial_policies enable row level security;
alter table public.commerce_policy_events enable row level security;

drop policy if exists "Staff can manage global commerce settings"
  on public.commerce_settings;
drop policy if exists "Staff can manage customer commerce policies"
  on public.customer_commercial_policies;

drop policy if exists "MG commerce settings staff read only"
  on public.commerce_settings;
create policy "MG commerce settings staff read only"
on public.commerce_settings
for select
to authenticated
using (public.has_staff_permission('credits.manage'));

drop policy if exists "MG customer commercial policies staff read only"
  on public.customer_commercial_policies;
create policy "MG customer commercial policies staff read only"
on public.customer_commercial_policies
for select
to authenticated
using (public.has_staff_permission('credits.manage'));

drop policy if exists "Staff can read commerce policy events"
  on public.commerce_policy_events;
drop policy if exists "MG commerce policy events staff read only"
  on public.commerce_policy_events;
create policy "MG commerce policy events staff read only"
on public.commerce_policy_events
for select
to authenticated
using (public.has_staff_permission('credits.manage'));

revoke all privileges on table public.commerce_settings from PUBLIC;
revoke all privileges on table public.customer_commercial_policies from PUBLIC;
revoke all privileges on table public.commerce_policy_events from PUBLIC;
revoke all privileges on table public.commerce_settings from anon;
revoke all privileges on table public.customer_commercial_policies from anon;
revoke all privileges on table public.commerce_policy_events from anon;
revoke all privileges on table public.commerce_settings from authenticated;
revoke all privileges on table public.customer_commercial_policies from authenticated;
revoke all privileges on table public.commerce_policy_events from authenticated;

grant select on table
  public.commerce_settings,
  public.customer_commercial_policies,
  public.commerce_policy_events
to authenticated;

grant select, insert, update, delete on table
  public.commerce_settings,
  public.customer_commercial_policies,
  public.commerce_policy_events
to service_role;

insert into public.commerce_policy_events (
  scope,
  customer_id,
  actor_user_id,
  event_type,
  before_json,
  after_json
)
select
  'customer',
  policy.user_id,
  null,
  'inactive_customer_adjustment_normalized',
  pg_catalog.jsonb_build_object(
    'adjustment_type', policy.adjustment_type,
    'adjustment_value', policy.adjustment_value
  ),
  pg_catalog.jsonb_build_object(
    'adjustment_type', 'none',
    'adjustment_value', 0
  )
from public.customer_commercial_policies as policy
where policy.adjustment_type = 'none'
  and policy.adjustment_value <> 0;

update public.customer_commercial_policies
set adjustment_value = 0
where adjustment_type = 'none'
  and adjustment_value <> 0;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.commerce_settings'::regclass
      and conname = 'commerce_settings_authoritative_values_chk'
  ) then
    alter table public.commerce_settings
      add constraint commerce_settings_authoritative_values_chk
      check (
        currency = 'EUR'
        and default_custom_credit_price_eur between 0.01 and 1000
        and (promotion_label is null or char_length(promotion_label) <= 180)
        and (
          (global_adjustment_type = 'none' and global_adjustment_value = 0)
          or (
            global_adjustment_type = 'percentage'
            and global_adjustment_value between -100 and 100
          )
          or (
            global_adjustment_type = 'fixed'
            and global_adjustment_value between -1000 and 1000
          )
        )
      ) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.customer_commercial_policies'::regclass
      and conname = 'customer_commercial_policy_authoritative_values_chk'
  ) then
    alter table public.customer_commercial_policies
      add constraint customer_commercial_policy_authoritative_values_chk
      check (
        (
          credit_price_override_eur is null
          or credit_price_override_eur between 0.01 and 1000
        )
        and (internal_note is null or char_length(internal_note) <= 2000)
        and (
          (adjustment_type = 'none' and adjustment_value = 0)
          or (
            credit_price_override_eur is null
            and adjustment_type = 'percentage'
            and adjustment_value between -100 and 100
          )
          or (
            credit_price_override_eur is null
            and adjustment_type = 'fixed'
            and adjustment_value between -1000 and 1000
          )
        )
      ) not valid;
  end if;
end
$$;

alter table public.commerce_settings
  validate constraint commerce_settings_authoritative_values_chk;
alter table public.customer_commercial_policies
  validate constraint customer_commercial_policy_authoritative_values_chk;

commit;
