-- Materialize final package totals and custom-credit unit prices as separate
-- authorities. All values are final payable EUR amounts; this model contains
-- no VAT, tax, or country-based price calculation.
--
-- Legacy price columns remain available for cutover verification. After the
-- first v2 save, application rollback is restricted to the retained v2-aware
-- bridge artifact documented in docs/explicit-credit-pricing-release.md.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if pg_catalog.to_regclass('public.commerce_settings') is null
    or pg_catalog.to_regclass('public.customer_commercial_policies') is null
    or pg_catalog.to_regclass('public.commerce_policy_events') is null
  then
    raise exception 'Explicit pricing migration prerequisites are missing';
  end if;

  if not exists (
    select 1
    from public.commerce_settings
    where id = 'default'
  ) then
    raise exception 'The default commerce settings row is missing';
  end if;
end
$$;

lock table public.commerce_settings in share row exclusive mode;
lock table public.customer_commercial_policies in share row exclusive mode;
lock table public.commerce_policy_events in share row exclusive mode;

alter table public.commerce_settings
  add column if not exists pricing_model_version smallint default 1,
  add column if not exists explicit_pricing_writes_enabled boolean not null default false,
  add column if not exists explicit_pricing_bridge_release text,
  add column if not exists credit_package_10_total_eur numeric(12,2),
  add column if not exists credit_package_50_total_eur numeric(12,2),
  add column if not exists credit_package_100_total_eur numeric(12,2),
  add column if not exists credit_package_250_total_eur numeric(12,2),
  add column if not exists credit_package_500_total_eur numeric(12,2),
  add column if not exists custom_credit_unit_price_eur numeric(10,4);

alter table public.customer_commercial_policies
  add column if not exists pricing_model_version smallint default 1,
  add column if not exists credit_package_10_total_override_eur numeric(12,2),
  add column if not exists credit_package_50_total_override_eur numeric(12,2),
  add column if not exists credit_package_100_total_override_eur numeric(12,2),
  add column if not exists credit_package_250_total_override_eur numeric(12,2),
  add column if not exists credit_package_500_total_override_eur numeric(12,2),
  add column if not exists custom_credit_unit_price_override_eur numeric(10,4);

-- Transaction-local compatibility helpers. Legacy pricing used JavaScript
-- binary64 arithmetic, one positive-number `toFixed(4)` operation, then
-- integer ten-thousandths for the final cent calculation. Keep that exact
-- order here so the cutover cannot move a valid legacy checkout by one cent.
create function public.mg_seed_legacy_credit_adjustment(
  input_unit double precision,
  adjustment_type text,
  adjustment_value double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $function$
  select greatest(
    0.01::double precision,
    case adjustment_type
      when 'percentage' then input_unit * (1 - adjustment_value / 100)
      when 'fixed' then input_unit - adjustment_value
      when 'none' then input_unit
      else null
    end
  )
$function$;

create function public.mg_seed_js_unit_ticks(input_unit double precision)
returns bigint
language plpgsql
immutable
strict
set search_path = ''
as $function$
declare
  encoded bytea;
  raw_bits bigint := 0;
  exponent_bits integer;
  fraction_bits bigint;
  binary_exponent integer;
  exact_numerator numeric;
  exact_denominator numeric := 1;
  byte_index integer;
  exponent_step integer;
begin
  if input_unit < 0 or input_unit = 'Infinity'::double precision
    or input_unit = '-Infinity'::double precision or input_unit <> input_unit
  then
    raise exception 'invalid legacy credit unit';
  end if;

  -- Decode the positive IEEE-754 binary64 value. JavaScript `toFixed(4)`
  -- rounds this exact rational value, not the already-rounded result of a
  -- second binary multiplication by 10000.
  encoded := pg_catalog.float8send(greatest(0.01::double precision, input_unit));
  for byte_index in 0..7 loop
    raw_bits := (raw_bits << 8) | pg_catalog.get_byte(encoded, byte_index)::bigint;
  end loop;

  exponent_bits := ((raw_bits >> 52) & 2047)::integer;
  fraction_bits := raw_bits & 4503599627370495::bigint;
  if exponent_bits = 2047 then
    raise exception 'invalid legacy credit unit';
  elsif exponent_bits = 0 then
    exact_numerator := fraction_bits::numeric * 10000::numeric;
    binary_exponent := -1074;
  else
    exact_numerator := (4503599627370496::numeric + fraction_bits::numeric) * 10000::numeric;
    binary_exponent := exponent_bits - 1023 - 52;
  end if;

  if binary_exponent > 0 then
    for exponent_step in 1..binary_exponent loop
      exact_numerator := exact_numerator * 2;
    end loop;
  elsif binary_exponent < 0 then
    for exponent_step in 1..(-binary_exponent) loop
      exact_denominator := exact_denominator * 2;
    end loop;
  end if;

  return pg_catalog.div(
    2 * exact_numerator + exact_denominator,
    2 * exact_denominator
  )::bigint;
end
$function$;

create function public.mg_seed_js_unit_price(input_unit double precision)
returns numeric
language sql
immutable
set search_path = ''
as $function$
  select public.mg_seed_js_unit_ticks(input_unit)::numeric / 10000::numeric
$function$;

create function public.mg_seed_js_package_total(
  credits integer,
  input_unit double precision
)
returns numeric
language sql
immutable
set search_path = ''
as $function$
  select (
    (
      credits::bigint * public.mg_seed_js_unit_ticks(input_unit) + 50
    ) / 100
  )::numeric / 100::numeric
$function$;

revoke all on function public.mg_seed_legacy_credit_adjustment(double precision, text, double precision)
  from PUBLIC, anon, authenticated;
revoke all on function public.mg_seed_js_unit_ticks(double precision)
  from PUBLIC, anon, authenticated;
revoke all on function public.mg_seed_js_unit_price(double precision)
  from PUBLIC, anon, authenticated;
revoke all on function public.mg_seed_js_package_total(integer, double precision)
  from PUBLIC, anon, authenticated;

-- Preserve every active legacy customer agreement as six explicit v2 values.
-- Customers with no special price keep NULL overrides and inherit each global
-- value independently.
with package_catalog(package_id, credits, catalog_unit_price) as (
  values
    ('credits_10', 10::numeric, 4.5::numeric),
    ('credits_50', 50::numeric, 4.5::numeric),
    ('credits_100', 100::numeric, 4::numeric),
    ('credits_250', 250::numeric, 3.5::numeric),
    ('credits_500', 500::numeric, 3::numeric)
), evaluated as (
  select
    policy.user_id,
    catalog.package_id,
    catalog.credits,
    case
      when policy.credit_price_override_eur is not null
        then greatest(0.01::numeric, policy.credit_price_override_eur)
      when policy.adjustment_type <> 'none'
        then public.mg_seed_legacy_credit_adjustment(
          public.mg_seed_legacy_credit_adjustment(
            catalog.catalog_unit_price,
            settings.global_adjustment_type,
            settings.global_adjustment_value
          ),
          policy.adjustment_type,
          policy.adjustment_value
        )
      else null
    end as effective_unit_price
  from public.customer_commercial_policies as policy
  cross join public.commerce_settings as settings
  cross join package_catalog as catalog
  where settings.id = 'default'
), materialized as (
  select
    evaluated.user_id,
    max(case when evaluated.package_id = 'credits_10'
      then public.mg_seed_js_package_total(evaluated.credits::integer, evaluated.effective_unit_price)
    end) as package_10,
    max(
      case when evaluated.package_id = 'credits_50'
        then public.mg_seed_js_package_total(evaluated.credits::integer, evaluated.effective_unit_price)
      end
    ) as package_50,
    max(
      case when evaluated.package_id = 'credits_100'
        then public.mg_seed_js_package_total(evaluated.credits::integer, evaluated.effective_unit_price)
      end
    ) as package_100,
    max(
      case when evaluated.package_id = 'credits_250'
        then public.mg_seed_js_package_total(evaluated.credits::integer, evaluated.effective_unit_price)
      end
    ) as package_250,
    max(
      case when evaluated.package_id = 'credits_500'
        then public.mg_seed_js_package_total(evaluated.credits::integer, evaluated.effective_unit_price)
      end
    ) as package_500
  from evaluated
  group by evaluated.user_id
), customer_values as (
  select
    policy.user_id,
    materialized.package_10,
    materialized.package_50,
    materialized.package_100,
    materialized.package_250,
    materialized.package_500,
    case
      when policy.credit_price_override_eur is not null
        then public.mg_seed_js_unit_price(
          greatest(0.01::double precision, policy.credit_price_override_eur::double precision)
        )
      when policy.adjustment_type <> 'none'
        then public.mg_seed_js_unit_price(
          public.mg_seed_legacy_credit_adjustment(
            public.mg_seed_legacy_credit_adjustment(
              settings.default_custom_credit_price_eur,
              settings.global_adjustment_type,
              settings.global_adjustment_value
            ),
            policy.adjustment_type,
            policy.adjustment_value
          )
        )
      else null
    end as custom_unit
  from public.customer_commercial_policies as policy
  join materialized on materialized.user_id = policy.user_id
  cross join public.commerce_settings as settings
  where settings.id = 'default'
)
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
  'explicit_customer_credit_prices_materialized',
  pg_catalog.jsonb_build_object(
    'legacy_fixed_unit_eur', policy.credit_price_override_eur,
    'legacy_adjustment_type', policy.adjustment_type,
    'legacy_adjustment_value', policy.adjustment_value
  ),
  pg_catalog.jsonb_build_object(
    'credit_package_10_total_override_eur', materialized_values.package_10,
    'credit_package_50_total_override_eur', materialized_values.package_50,
    'credit_package_100_total_override_eur', materialized_values.package_100,
    'credit_package_250_total_override_eur', materialized_values.package_250,
    'credit_package_500_total_override_eur', materialized_values.package_500,
    'custom_credit_unit_price_override_eur', materialized_values.custom_unit
  )
from public.customer_commercial_policies as policy
join customer_values as materialized_values
  on materialized_values.user_id = policy.user_id
where policy.credit_price_override_eur is not null
  or policy.adjustment_type <> 'none';

with package_catalog(package_id, credits, catalog_unit_price) as (
  values
    ('credits_10', 10::numeric, 4.5::numeric),
    ('credits_50', 50::numeric, 4.5::numeric),
    ('credits_100', 100::numeric, 4::numeric),
    ('credits_250', 250::numeric, 3.5::numeric),
    ('credits_500', 500::numeric, 3::numeric)
), evaluated as (
  select
    policy.user_id,
    catalog.package_id,
    catalog.credits,
    case
      when policy.credit_price_override_eur is not null
        then greatest(0.01::numeric, policy.credit_price_override_eur)
      when policy.adjustment_type <> 'none'
        then public.mg_seed_legacy_credit_adjustment(
          public.mg_seed_legacy_credit_adjustment(
            catalog.catalog_unit_price,
            settings.global_adjustment_type,
            settings.global_adjustment_value
          ),
          policy.adjustment_type,
          policy.adjustment_value
        )
      else null
    end as effective_unit_price
  from public.customer_commercial_policies as policy
  cross join public.commerce_settings as settings
  cross join package_catalog as catalog
  where settings.id = 'default'
), materialized as (
  select
    evaluated.user_id,
    max(case when evaluated.package_id = 'credits_10'
      then public.mg_seed_js_package_total(evaluated.credits::integer, evaluated.effective_unit_price) end) as package_10,
    max(case when evaluated.package_id = 'credits_50'
      then public.mg_seed_js_package_total(evaluated.credits::integer, evaluated.effective_unit_price) end) as package_50,
    max(case when evaluated.package_id = 'credits_100'
      then public.mg_seed_js_package_total(evaluated.credits::integer, evaluated.effective_unit_price) end) as package_100,
    max(case when evaluated.package_id = 'credits_250'
      then public.mg_seed_js_package_total(evaluated.credits::integer, evaluated.effective_unit_price) end) as package_250,
    max(case when evaluated.package_id = 'credits_500'
      then public.mg_seed_js_package_total(evaluated.credits::integer, evaluated.effective_unit_price) end) as package_500
  from evaluated
  group by evaluated.user_id
)
update public.customer_commercial_policies as policy
set
  pricing_model_version = 2,
  credit_package_10_total_override_eur = materialized.package_10,
  credit_package_50_total_override_eur = materialized.package_50,
  credit_package_100_total_override_eur = materialized.package_100,
  credit_package_250_total_override_eur = materialized.package_250,
  credit_package_500_total_override_eur = materialized.package_500,
  custom_credit_unit_price_override_eur = case
    when policy.credit_price_override_eur is not null
      then public.mg_seed_js_unit_price(
        greatest(0.01::double precision, policy.credit_price_override_eur::double precision)
      )
    when policy.adjustment_type <> 'none'
      then public.mg_seed_js_unit_price(
        public.mg_seed_legacy_credit_adjustment(
          public.mg_seed_legacy_credit_adjustment(
            settings.default_custom_credit_price_eur,
            settings.global_adjustment_type,
            settings.global_adjustment_value
          ),
          policy.adjustment_type,
          policy.adjustment_value
        )
      )
    else null
  end
from materialized
cross join public.commerce_settings as settings
where policy.user_id = materialized.user_id
  and settings.id = 'default';

-- Materialize the singleton global v2 price list from the live legacy row.
with package_catalog(package_id, credits, catalog_unit_price) as (
  values
    ('credits_10', 10::numeric, 4.5::numeric),
    ('credits_50', 50::numeric, 4.5::numeric),
    ('credits_100', 100::numeric, 4::numeric),
    ('credits_250', 250::numeric, 3.5::numeric),
    ('credits_500', 500::numeric, 3::numeric)
), materialized as (
  select
    settings.id,
    max(case when catalog.package_id = 'credits_10'
      then public.mg_seed_js_package_total(
        catalog.credits::integer,
        public.mg_seed_legacy_credit_adjustment(catalog.catalog_unit_price, settings.global_adjustment_type, settings.global_adjustment_value)
      ) end) as package_10,
    max(case when catalog.package_id = 'credits_50'
      then public.mg_seed_js_package_total(
        catalog.credits::integer,
        public.mg_seed_legacy_credit_adjustment(catalog.catalog_unit_price, settings.global_adjustment_type, settings.global_adjustment_value)
      ) end) as package_50,
    max(case when catalog.package_id = 'credits_100'
      then public.mg_seed_js_package_total(
        catalog.credits::integer,
        public.mg_seed_legacy_credit_adjustment(catalog.catalog_unit_price, settings.global_adjustment_type, settings.global_adjustment_value)
      ) end) as package_100,
    max(case when catalog.package_id = 'credits_250'
      then public.mg_seed_js_package_total(
        catalog.credits::integer,
        public.mg_seed_legacy_credit_adjustment(catalog.catalog_unit_price, settings.global_adjustment_type, settings.global_adjustment_value)
      ) end) as package_250,
    max(case when catalog.package_id = 'credits_500'
      then public.mg_seed_js_package_total(
        catalog.credits::integer,
        public.mg_seed_legacy_credit_adjustment(catalog.catalog_unit_price, settings.global_adjustment_type, settings.global_adjustment_value)
      ) end) as package_500,
    public.mg_seed_js_unit_price(
      public.mg_seed_legacy_credit_adjustment(
        settings.default_custom_credit_price_eur,
        settings.global_adjustment_type,
        settings.global_adjustment_value
      )
    ) as custom_unit
  from public.commerce_settings as settings
  cross join package_catalog as catalog
  where settings.id = 'default'
  group by settings.id, settings.default_custom_credit_price_eur,
    settings.global_adjustment_type, settings.global_adjustment_value
)
insert into public.commerce_policy_events (
  scope,
  customer_id,
  actor_user_id,
  event_type,
  before_json,
  after_json
)
select
  'global',
  null,
  null,
  'explicit_global_credit_prices_materialized',
  pg_catalog.jsonb_build_object(
    'legacy_custom_base_eur', settings.default_custom_credit_price_eur,
    'legacy_adjustment_type', settings.global_adjustment_type,
    'legacy_adjustment_value', settings.global_adjustment_value
  ),
  pg_catalog.jsonb_build_object(
    'credit_package_10_total_eur', materialized.package_10,
    'credit_package_50_total_eur', materialized.package_50,
    'credit_package_100_total_eur', materialized.package_100,
    'credit_package_250_total_eur', materialized.package_250,
    'credit_package_500_total_eur', materialized.package_500,
    'custom_credit_unit_price_eur', materialized.custom_unit
  )
from public.commerce_settings as settings
join materialized on materialized.id = settings.id
where settings.id = 'default';

with package_catalog(package_id, credits, catalog_unit_price) as (
  values
    ('credits_10', 10::numeric, 4.5::numeric),
    ('credits_50', 50::numeric, 4.5::numeric),
    ('credits_100', 100::numeric, 4::numeric),
    ('credits_250', 250::numeric, 3.5::numeric),
    ('credits_500', 500::numeric, 3::numeric)
), materialized as (
  select
    settings.id,
    max(case when catalog.package_id = 'credits_10'
      then public.mg_seed_js_package_total(
        catalog.credits::integer,
        public.mg_seed_legacy_credit_adjustment(catalog.catalog_unit_price, settings.global_adjustment_type, settings.global_adjustment_value)
      ) end) as package_10,
    max(case when catalog.package_id = 'credits_50'
      then public.mg_seed_js_package_total(
        catalog.credits::integer,
        public.mg_seed_legacy_credit_adjustment(catalog.catalog_unit_price, settings.global_adjustment_type, settings.global_adjustment_value)
      ) end) as package_50,
    max(case when catalog.package_id = 'credits_100'
      then public.mg_seed_js_package_total(
        catalog.credits::integer,
        public.mg_seed_legacy_credit_adjustment(catalog.catalog_unit_price, settings.global_adjustment_type, settings.global_adjustment_value)
      ) end) as package_100,
    max(case when catalog.package_id = 'credits_250'
      then public.mg_seed_js_package_total(
        catalog.credits::integer,
        public.mg_seed_legacy_credit_adjustment(catalog.catalog_unit_price, settings.global_adjustment_type, settings.global_adjustment_value)
      ) end) as package_250,
    max(case when catalog.package_id = 'credits_500'
      then public.mg_seed_js_package_total(
        catalog.credits::integer,
        public.mg_seed_legacy_credit_adjustment(catalog.catalog_unit_price, settings.global_adjustment_type, settings.global_adjustment_value)
      ) end) as package_500,
    public.mg_seed_js_unit_price(
      public.mg_seed_legacy_credit_adjustment(
        settings.default_custom_credit_price_eur,
        settings.global_adjustment_type,
        settings.global_adjustment_value
      )
    ) as custom_unit
  from public.commerce_settings as settings
  cross join package_catalog as catalog
  where settings.id = 'default'
  group by settings.id, settings.default_custom_credit_price_eur,
    settings.global_adjustment_type, settings.global_adjustment_value
)
update public.commerce_settings as settings
set
  pricing_model_version = 2,
  credit_package_10_total_eur = materialized.package_10,
  credit_package_50_total_eur = materialized.package_50,
  credit_package_100_total_eur = materialized.package_100,
  credit_package_250_total_eur = materialized.package_250,
  credit_package_500_total_eur = materialized.package_500,
  custom_credit_unit_price_eur = materialized.custom_unit
from materialized
where settings.id = materialized.id;

drop function public.mg_seed_js_package_total(integer, double precision);
drop function public.mg_seed_js_unit_price(double precision);
drop function public.mg_seed_js_unit_ticks(double precision);
drop function public.mg_seed_legacy_credit_adjustment(double precision, text, double precision);

alter table public.commerce_settings
  alter column pricing_model_version set not null,
  alter column credit_package_10_total_eur set not null,
  alter column credit_package_50_total_eur set not null,
  alter column credit_package_100_total_eur set not null,
  alter column credit_package_250_total_eur set not null,
  alter column credit_package_500_total_eur set not null,
  alter column custom_credit_unit_price_eur set not null;

alter table public.customer_commercial_policies
  alter column pricing_model_version set not null;

alter table public.commerce_settings
  add constraint commerce_settings_explicit_credit_prices_chk
  check (
    pricing_model_version in (1, 2)
    and (
      explicit_pricing_bridge_release is null
      or explicit_pricing_bridge_release ~ '^[A-Za-z0-9._:-]{8,180}$'
    )
    and (not explicit_pricing_writes_enabled or explicit_pricing_bridge_release is not null)
    and (not explicit_pricing_writes_enabled or pricing_model_version = 2)
    and credit_package_10_total_eur between 0.10 and 2000000.00
    and credit_package_50_total_eur between 0.50 and 2000000.00
    and credit_package_100_total_eur between 1.00 and 2000000.00
    and credit_package_250_total_eur between 2.50 and 2000000.00
    and credit_package_500_total_eur between 5.00 and 2000000.00
    and custom_credit_unit_price_eur between 0.01 and 4000
  ) not valid;

alter table public.customer_commercial_policies
  add constraint customer_commercial_policy_explicit_credit_prices_chk
  check (
    pricing_model_version in (1, 2)
    and (
      credit_package_10_total_override_eur is null
      or credit_package_10_total_override_eur between 0.10 and 2000000.00
    )
    and (
      credit_package_50_total_override_eur is null
      or credit_package_50_total_override_eur between 0.50 and 2000000.00
    )
    and (
      credit_package_100_total_override_eur is null
      or credit_package_100_total_override_eur between 1.00 and 2000000.00
    )
    and (
      credit_package_250_total_override_eur is null
      or credit_package_250_total_override_eur between 2.50 and 2000000.00
    )
    and (
      credit_package_500_total_override_eur is null
      or credit_package_500_total_override_eur between 5.00 and 2000000.00
    )
    and (
      custom_credit_unit_price_override_eur is null
      or custom_credit_unit_price_override_eur between 0.01 and 4000
    )
  ) not valid;

alter table public.commerce_settings
  validate constraint commerce_settings_explicit_credit_prices_chk;
alter table public.customer_commercial_policies
  validate constraint customer_commercial_policy_explicit_credit_prices_chk;

-- If an old application instance changes a legacy price during the rollout
-- window without changing v2 values, make v2 reads fail closed instead of
-- silently using stale materialized prices.
create or replace function public.mark_legacy_commerce_price_write()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.explicit_pricing_writes_enabled and (
    not new.explicit_pricing_writes_enabled
    or new.explicit_pricing_bridge_release is distinct from old.explicit_pricing_bridge_release
  ) then
    raise exception 'explicit_pricing_activation_is_one_way';
  end if;

  if (
    (
      new.default_custom_credit_price_eur is distinct from old.default_custom_credit_price_eur
      or new.global_adjustment_type is distinct from old.global_adjustment_type
      or new.global_adjustment_value is distinct from old.global_adjustment_value
    )
    and new.credit_package_10_total_eur is not distinct from old.credit_package_10_total_eur
    and new.credit_package_50_total_eur is not distinct from old.credit_package_50_total_eur
    and new.credit_package_100_total_eur is not distinct from old.credit_package_100_total_eur
    and new.credit_package_250_total_eur is not distinct from old.credit_package_250_total_eur
    and new.credit_package_500_total_eur is not distinct from old.credit_package_500_total_eur
    and new.custom_credit_unit_price_eur is not distinct from old.custom_credit_unit_price_eur
  ) then
    if old.explicit_pricing_writes_enabled then
      raise exception 'legacy_commerce_price_write_blocked_after_v2_activation';
    end if;
    new.pricing_model_version := 1;
  end if;
  return new;
end
$function$;

create or replace function public.mark_legacy_customer_price_write()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  writes_enabled boolean;
begin
  select settings.explicit_pricing_writes_enabled
  into writes_enabled
  from public.commerce_settings as settings
  where settings.id = 'default';

  if tg_op = 'INSERT' then
    if coalesce(writes_enabled, false) and new.pricing_model_version <> 2 then
      raise exception 'legacy_customer_price_insert_blocked_after_v2_activation';
    end if;
    return new;
  end if;

  if (
    (
      new.credit_price_override_eur is distinct from old.credit_price_override_eur
      or new.adjustment_type is distinct from old.adjustment_type
      or new.adjustment_value is distinct from old.adjustment_value
    )
    and new.credit_package_10_total_override_eur is not distinct from old.credit_package_10_total_override_eur
    and new.credit_package_50_total_override_eur is not distinct from old.credit_package_50_total_override_eur
    and new.credit_package_100_total_override_eur is not distinct from old.credit_package_100_total_override_eur
    and new.credit_package_250_total_override_eur is not distinct from old.credit_package_250_total_override_eur
    and new.credit_package_500_total_override_eur is not distinct from old.credit_package_500_total_override_eur
    and new.custom_credit_unit_price_override_eur is not distinct from old.custom_credit_unit_price_override_eur
  ) then
    if coalesce(writes_enabled, false) then
      raise exception 'legacy_customer_price_write_blocked_after_v2_activation';
    end if;
    new.pricing_model_version := 1;
  end if;
  return new;
end
$function$;

revoke all on function public.mark_legacy_commerce_price_write() from PUBLIC, anon, authenticated;
revoke all on function public.mark_legacy_customer_price_write() from PUBLIC, anon, authenticated;

drop trigger if exists mark_legacy_commerce_price_write
  on public.commerce_settings;
create trigger mark_legacy_commerce_price_write
before update on public.commerce_settings
for each row execute function public.mark_legacy_commerce_price_write();

drop trigger if exists mark_legacy_customer_price_write
  on public.customer_commercial_policies;
create trigger mark_legacy_customer_price_write
before insert or update on public.customer_commercial_policies
for each row execute function public.mark_legacy_customer_price_write();

-- Global save and its audit record are one database transaction.
create or replace function public.save_commerce_settings_v2(
  p_expected_updated_at timestamptz,
  p_credit_package_10_total_eur numeric,
  p_credit_package_50_total_eur numeric,
  p_credit_package_100_total_eur numeric,
  p_credit_package_250_total_eur numeric,
  p_credit_package_500_total_eur numeric,
  p_custom_credit_unit_price_eur numeric,
  p_promotion_label text,
  p_payment_stripe_enabled boolean,
  p_payment_bank_enabled boolean,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  before_row public.commerce_settings%rowtype;
  after_row public.commerce_settings%rowtype;
begin
  select *
  into before_row
  from public.commerce_settings
  where id = 'default'
  for update;

  if not found then
    raise exception 'commercial_settings_missing';
  end if;

  if before_row.updated_at is distinct from p_expected_updated_at then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'commercial_settings_conflict'
    );
  end if;

  if not before_row.explicit_pricing_writes_enabled then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'explicit_pricing_writes_not_activated'
    );
  end if;

  update public.commerce_settings
  set
    pricing_model_version = 2,
    credit_package_10_total_eur = p_credit_package_10_total_eur,
    credit_package_50_total_eur = p_credit_package_50_total_eur,
    credit_package_100_total_eur = p_credit_package_100_total_eur,
    credit_package_250_total_eur = p_credit_package_250_total_eur,
    credit_package_500_total_eur = p_credit_package_500_total_eur,
    custom_credit_unit_price_eur = p_custom_credit_unit_price_eur,
    promotion_label = p_promotion_label,
    payment_stripe_enabled = p_payment_stripe_enabled,
    payment_paypal_enabled = false,
    payment_bank_enabled = p_payment_bank_enabled,
    updated_by = p_actor_user_id,
    updated_at = pg_catalog.clock_timestamp()
  where id = 'default'
  returning * into after_row;

  insert into public.commerce_policy_events (
    scope,
    customer_id,
    actor_user_id,
    event_type,
    before_json,
    after_json
  )
  values (
    'global',
    null,
    p_actor_user_id,
    'global_explicit_credit_prices_updated',
    pg_catalog.to_jsonb(before_row),
    pg_catalog.to_jsonb(after_row)
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'settings', pg_catalog.to_jsonb(after_row),
    'auditRecorded', true
  );
end
$function$;

-- Customer override save/upsert and audit are also one transaction. A bounded
-- advisory lock closes the missing-row insert race.
create or replace function public.save_customer_commercial_policy_v2(
  p_user_id uuid,
  p_expected_updated_at timestamptz,
  p_credit_package_10_total_override_eur numeric,
  p_credit_package_50_total_override_eur numeric,
  p_credit_package_100_total_override_eur numeric,
  p_credit_package_250_total_override_eur numeric,
  p_credit_package_500_total_override_eur numeric,
  p_custom_credit_unit_price_override_eur numeric,
  p_payment_stripe_enabled boolean,
  p_payment_bank_enabled boolean,
  p_internal_note text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  before_row public.customer_commercial_policies%rowtype;
  after_row public.customer_commercial_policies%rowtype;
  row_exists boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 20260826)
  );

  if not coalesce((
    select settings.explicit_pricing_writes_enabled
    from public.commerce_settings as settings
    where settings.id = 'default'
  ), false) then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'explicit_pricing_writes_not_activated'
    );
  end if;

  select *
  into before_row
  from public.customer_commercial_policies
  where user_id = p_user_id
  for update;
  row_exists := found;

  if (
    (row_exists and before_row.updated_at is distinct from p_expected_updated_at)
    or (not row_exists and p_expected_updated_at is not null)
  ) then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'customer_commercial_policy_conflict'
    );
  end if;

  if row_exists then
    update public.customer_commercial_policies
    set
      pricing_model_version = 2,
      credit_package_10_total_override_eur = p_credit_package_10_total_override_eur,
      credit_package_50_total_override_eur = p_credit_package_50_total_override_eur,
      credit_package_100_total_override_eur = p_credit_package_100_total_override_eur,
      credit_package_250_total_override_eur = p_credit_package_250_total_override_eur,
      credit_package_500_total_override_eur = p_credit_package_500_total_override_eur,
      custom_credit_unit_price_override_eur = p_custom_credit_unit_price_override_eur,
      payment_stripe_enabled = p_payment_stripe_enabled,
      payment_paypal_enabled = false,
      payment_bank_enabled = p_payment_bank_enabled,
      internal_note = p_internal_note,
      updated_by = p_actor_user_id,
      updated_at = pg_catalog.clock_timestamp()
    where user_id = p_user_id
    returning * into after_row;
  else
    insert into public.customer_commercial_policies (
      user_id,
      pricing_model_version,
      credit_package_10_total_override_eur,
      credit_package_50_total_override_eur,
      credit_package_100_total_override_eur,
      credit_package_250_total_override_eur,
      credit_package_500_total_override_eur,
      custom_credit_unit_price_override_eur,
      payment_stripe_enabled,
      payment_paypal_enabled,
      payment_bank_enabled,
      internal_note,
      updated_by,
      updated_at
    )
    values (
      p_user_id,
      2,
      p_credit_package_10_total_override_eur,
      p_credit_package_50_total_override_eur,
      p_credit_package_100_total_override_eur,
      p_credit_package_250_total_override_eur,
      p_credit_package_500_total_override_eur,
      p_custom_credit_unit_price_override_eur,
      p_payment_stripe_enabled,
      false,
      p_payment_bank_enabled,
      p_internal_note,
      p_actor_user_id,
      pg_catalog.clock_timestamp()
    )
    returning * into after_row;
  end if;

  insert into public.commerce_policy_events (
    scope,
    customer_id,
    actor_user_id,
    event_type,
    before_json,
    after_json
  )
  values (
    'customer',
    p_user_id,
    p_actor_user_id,
    'customer_explicit_credit_prices_updated',
    case when row_exists then pg_catalog.to_jsonb(before_row) else null end,
    pg_catalog.to_jsonb(after_row)
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'policy', pg_catalog.to_jsonb(after_row),
    'auditRecorded', true
  );
end
$function$;

-- One-way release gate. Activate only after a verified v2-aware Production
-- deployment has been retained as the rollback bridge. The release identifier
-- is durable audit evidence; old pre-v2 application builds are not valid
-- rollback targets after this succeeds.
create or replace function public.activate_explicit_pricing_v2(
  p_expected_updated_at timestamptz,
  p_bridge_release text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  before_row public.commerce_settings%rowtype;
  after_row public.commerce_settings%rowtype;
begin
  select *
  into before_row
  from public.commerce_settings
  where id = 'default'
  for update;

  if not found then
    raise exception 'commercial_settings_missing';
  end if;

  if before_row.updated_at is distinct from p_expected_updated_at then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'commercial_settings_conflict'
    );
  end if;

  -- Wait for every in-flight legacy customer INSERT/UPDATE, then prevent any
  -- new one until this activation transaction commits. READ COMMITTED will see
  -- the just-finished rows in the completeness query below.
  lock table public.customer_commercial_policies in share mode;

  if before_row.pricing_model_version <> 2
    or exists (
      select 1
      from public.customer_commercial_policies
      where pricing_model_version <> 2
    )
  then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'explicit_pricing_materialization_incomplete'
    );
  end if;

  if p_bridge_release is null
    or p_bridge_release !~ '^[A-Za-z0-9._:-]{8,180}$'
  then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_bridge_release'
    );
  end if;

  if before_row.explicit_pricing_writes_enabled then
    if before_row.explicit_pricing_bridge_release is distinct from p_bridge_release then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'code', 'explicit_pricing_already_activated'
      );
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'settings', pg_catalog.to_jsonb(before_row),
      'auditRecorded', true,
      'alreadyActive', true
    );
  end if;

  update public.commerce_settings
  set
    explicit_pricing_writes_enabled = true,
    explicit_pricing_bridge_release = p_bridge_release,
    updated_by = p_actor_user_id,
    updated_at = pg_catalog.clock_timestamp()
  where id = 'default'
  returning * into after_row;

  insert into public.commerce_policy_events (
    scope,
    customer_id,
    actor_user_id,
    event_type,
    before_json,
    after_json
  )
  values (
    'global',
    null,
    p_actor_user_id,
    'explicit_pricing_v2_activated',
    pg_catalog.to_jsonb(before_row),
    pg_catalog.to_jsonb(after_row)
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'settings', pg_catalog.to_jsonb(after_row),
    'auditRecorded', true,
    'alreadyActive', false
  );
end
$function$;

revoke all on function public.save_commerce_settings_v2(
  timestamptz, numeric, numeric, numeric, numeric, numeric, numeric,
  text, boolean, boolean, uuid
) from PUBLIC, anon, authenticated;
grant execute on function public.save_commerce_settings_v2(
  timestamptz, numeric, numeric, numeric, numeric, numeric, numeric,
  text, boolean, boolean, uuid
) to service_role;

revoke all on function public.save_customer_commercial_policy_v2(
  uuid, timestamptz, numeric, numeric, numeric, numeric, numeric, numeric,
  boolean, boolean, text, uuid
) from PUBLIC, anon, authenticated;
grant execute on function public.save_customer_commercial_policy_v2(
  uuid, timestamptz, numeric, numeric, numeric, numeric, numeric, numeric,
  boolean, boolean, text, uuid
) to service_role;

revoke all on function public.activate_explicit_pricing_v2(
  timestamptz, text, uuid
) from PUBLIC, anon, authenticated;
grant execute on function public.activate_explicit_pricing_v2(
  timestamptz, text, uuid
) to service_role;

commit;
