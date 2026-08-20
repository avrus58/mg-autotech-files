-- Emergency authority hardening immediately before the canonical 02443 chain
-- for the application currently deployed from
-- origin/main. This is deliberately compatible with the legacy web/desktop
-- request contract while the larger 02443-02453 release remains staged.
--
-- The emergency-only relations use distinct names so the later canonical
-- migration can create request_service_catalog and the durable staff-adjustment
-- claim table without a CREATE TABLE collision. Every emergency relation and
-- helper is private to postgres; no customer data is read or rewritten here.

begin;

-- Fail closed instead of waiting indefinitely for Auth/profile/order locks.
-- A lock timeout rolls this transaction back; release operations must retry
-- only in a reviewed low-traffic window after identifying the blocker.
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Accept only the two rehearsed schema phases: all modern contracts absent on
-- current Production, or all present in the explicit post-02453 rehearsal.
-- A partially cut over schema would make conditional compatibility grants
-- ambiguous and must fail before this transaction changes anything.
do $$
declare
  v_modern_contract_count integer;
begin
  select pg_catalog.count(*)
  into v_modern_contract_count
  from (values
    ('public.staff_adjust_customer_credits(uuid,numeric,text,uuid)'),
    ('public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'),
    ('public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text,uuid)'),
    ('public.admin_apply_payment_refund(uuid,uuid,text,text,uuid)')
  ) as expected(signature)
  where pg_catalog.to_regprocedure(expected.signature) is not null;

  if v_modern_contract_count not in (0, 4) then
    raise exception using
      errcode = '55000',
      message = 'Partial modern financial contract state; emergency migration aborted.';
  end if;
end;
$$;

create table if not exists public.emergency_request_service_catalog (
  service_id text primary key,
  service_kind text not null check (service_kind in ('primary', 'extra')),
  service_title text not null unique,
  credits integer not null check (credits between 0 and 100000),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint emergency_request_service_catalog_id_check
    check (service_id ~ '^[a-z0-9_]+$'),
  constraint emergency_request_service_catalog_title_check
    check (length(btrim(service_title)) between 1 and 160)
);

alter table public.emergency_request_service_catalog owner to postgres;
alter table public.emergency_request_service_catalog enable row level security;
revoke all privileges on table public.emergency_request_service_catalog
  from public, anon, authenticated, service_role;

insert into public.emergency_request_service_catalog (
  service_id,
  service_kind,
  service_title,
  credits,
  active
)
values
  ('only_options', 'primary', 'Only Options', 0, true),
  ('stage_1', 'primary', 'Stage 1', 10, true),
  ('stage_2', 'primary', 'Stage 2', 15, true),
  ('stage_3', 'primary', 'Stage 3', 30, true),
  ('eco_tuning', 'primary', 'ECO Tuning', 8, true),
  ('tcu_stage_1', 'primary', 'TCU Stage 1', 15, true),
  ('tcu_stage_2', 'primary', 'TCU Stage 2', 20, true),
  ('tcu_stage_3', 'primary', 'TCU Stage 3', 30, true),
  ('original_file', 'primary', 'Original File', 4, true),
  ('dpf_off', 'extra', 'DPF Removal', 6, true),
  ('egr_off', 'extra', 'EGR / AGR Removal', 6, true),
  ('adblue_off', 'extra', 'AdBlue / SCR Removal', 11, true),
  ('dpf_egr_off', 'extra', 'DPF + EGR Removal', 9, true),
  ('dpf_adblue_off', 'extra', 'DPF + AdBlue Removal', 14, true),
  ('egr_adblue_off', 'extra', 'EGR + AdBlue Removal', 11, true),
  ('dpf_egr_adblue_off', 'extra', 'DPF + EGR + AdBlue Removal', 15, true),
  ('opf_gpf_off', 'extra', 'GPF / OPF Removal', 12, true),
  ('nox_off', 'extra', 'NOx Removal', 4, true),
  ('lambda_o2_off', 'extra', 'Lambda / O2 Removal', 5, true),
  ('lambda_o2_gpf_off', 'extra', 'Lambda / O2 + GPF / OPF Removal', 12, true),
  ('decat', 'extra', 'Decat / CAT Removal', 6, true),
  ('additive_off', 'extra', 'Additive Removal', 6, true),
  ('vmax_off', 'extra', 'Speed Limit Removal / VMAX OFF', 5, true),
  ('limited_vmax', 'extra', 'Limited VMAX to Specific Speed', 6, true),
  ('launch_control', 'extra', 'Launch Control', 10, true),
  ('hardcut_diesel', 'extra', 'Hard Cut Limiter (Diesel)', 8, true),
  ('pops_bangs', 'extra', 'Pop and Bangs', 8, true),
  ('pops_bangs_sport', 'extra', 'Pop and Bangs Sport Button', 9, true),
  ('pops_bangs_ac', 'extra', 'Pop and Bangs AC Button', 9, true),
  ('upshift_farts', 'extra', 'Upshift Farts', 8, true),
  ('performance_gauge', 'extra', 'Performance Gauge BMW / Mini / VAG', 4, true),
  ('map_switch', 'extra', 'Map Switch', 60, true),
  ('multi_map', 'extra', 'Multi Map Setup', 12, true),
  ('burble_map', 'extra', 'Burble Map', 8, true),
  ('flex_fuel', 'extra', 'Flex Fuel / Ethanol Setup', 10, true),
  ('start_stop', 'extra', 'Start / Stop Removal', 5, true),
  ('cold_start', 'extra', 'Cold Start Removal', 4, true),
  ('hot_start_fix', 'extra', 'Hot Start Fix', 8, true),
  ('swirl_flaps', 'extra', 'Swirl Flaps Removal', 5, true),
  ('exhaust_flaps', 'extra', 'Exhaust Flaps Removal', 4, true),
  ('tva_off', 'extra', 'TVA Removal', 5, true),
  ('cylinder_on_demand', 'extra', 'Cylinder On Demand Removal', 4, true),
  ('maf_off', 'extra', 'MAF Removal', 4, true),
  ('map_sensor_calibration', 'extra', 'Map Sensor Calibration', 5, true),
  ('coolant_thermostat', 'extra', 'Coolant Temperature Control / Thermostat', 6, true),
  ('water_pump', 'extra', 'Water Pump Removal', 5, true),
  ('dtc_off', 'extra', 'DTC Removal', 4, true),
  ('file_check', 'extra', 'File Check', 2, true),
  ('checksum', 'extra', 'Checksum Correction', 2, true),
  ('file_expertise', 'extra', 'File Expertise', 17, true),
  ('readout_verification', 'extra', 'Readout Verification', 2, true),
  ('software_version_check', 'extra', 'Software Version Check', 2, true),
  ('ecu_recovery', 'extra', 'ECU Recovery Support', 10, true),
  ('original_backup_check', 'extra', 'Original Backup Check', 4, true),
  ('priority_processing', 'extra', 'Priority Processing', 5, true),
  ('same_day_processing', 'extra', 'Same Day Processing', 10, true),
  ('log_file_review', 'extra', 'Log File Review', 5, true),
  ('dyno_report_review', 'extra', 'Dyno Report Review', 5, true),
  ('smoke_limiter', 'extra', 'Smoke Limiter Optimization', 6, true),
  ('torque_monitoring', 'extra', 'Torque Monitoring', 6, true),
  ('gearbox_torque_limit', 'extra', 'Gearbox Torque Limit Adjustment', 8, true),
  ('remote_support', 'extra', 'Remote Support Session', 8, true),
  ('special_request', 'extra', 'Special Request / Other', 0, true)
on conflict (service_id) do update
set
  service_kind = excluded.service_kind,
  service_title = excluded.service_title,
  credits = excluded.credits,
  active = excluded.active,
  updated_at = now();

create or replace function public.emergency_resolve_request_service_credits(
  p_service_summary text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_remaining text := pg_catalog.btrim(p_service_summary);
  v_match public.emergency_request_service_catalog%rowtype;
  v_seen_extra_ids text[] := '{}'::text[];
  v_total integer := 0;
begin
  -- A compatibility rehearsal may execute this exact SQL against a schema
  -- that already has the canonical resolver. Delegate instead of pinning the
  -- emergency catalog over that later contract.
  if pg_catalog.to_regprocedure(
    'public.resolve_request_service_credits(text)'
  ) is not null then
    execute 'select public.resolve_request_service_credits($1)'
      into v_total
      using p_service_summary;
    return v_total;
  end if;

  if v_remaining is null
    or pg_catalog.length(v_remaining) = 0
    or pg_catalog.length(v_remaining) > 4096 then
    raise exception using
      errcode = '22023',
      message = 'A valid service selection is required.';
  end if;

  select catalog.*
  into v_match
  from public.emergency_request_service_catalog as catalog
  where catalog.active
    and catalog.service_kind = 'primary'
    and (
      v_remaining = catalog.service_title
      or pg_catalog.left(
        v_remaining,
        pg_catalog.length(catalog.service_title) + 3
      ) = catalog.service_title || ' + '
    )
  order by pg_catalog.length(catalog.service_title) desc
  limit 1;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'The primary service is not in the server catalog.';
  end if;

  v_total := v_match.credits;
  if v_remaining = v_match.service_title then
    v_remaining := '';
  else
    v_remaining := pg_catalog.substr(
      v_remaining,
      pg_catalog.length(v_match.service_title) + 4
    );
  end if;

  while pg_catalog.length(v_remaining) > 0 loop
    select catalog.*
    into v_match
    from public.emergency_request_service_catalog as catalog
    where catalog.active
      and catalog.service_kind = 'extra'
      and (
        v_remaining = catalog.service_title
        or pg_catalog.left(
          v_remaining,
          pg_catalog.length(catalog.service_title) + 3
        ) = catalog.service_title || ' + '
      )
    order by pg_catalog.length(catalog.service_title) desc
    limit 1;

    if not found then
      raise exception using
        errcode = '22023',
        message = 'A selected extra service is not in the server catalog.';
    end if;

    if v_match.service_id = any(v_seen_extra_ids) then
      raise exception using
        errcode = '22023',
        message = 'Duplicate extra services are not allowed.';
    end if;

    if v_total > 100000 - v_match.credits then
      raise exception using
        errcode = '22003',
        message = 'The calculated credit amount is outside the supported range.';
    end if;

    v_seen_extra_ids := pg_catalog.array_append(
      v_seen_extra_ids,
      v_match.service_id
    );
    v_total := v_total + v_match.credits;

    if v_remaining = v_match.service_title then
      v_remaining := '';
    else
      v_remaining := pg_catalog.substr(
        v_remaining,
        pg_catalog.length(v_match.service_title) + 4
      );
    end if;
  end loop;

  if v_total < 0 then
    raise exception using
      errcode = '22023',
      message = 'The selected services produced an invalid credit amount.';
  end if;

  return v_total;
end;
$$;

alter function public.emergency_resolve_request_service_credits(text)
  owner to postgres;
revoke all privileges on function
  public.emergency_resolve_request_service_credits(text)
  from public, anon, authenticated, service_role;

-- Authorization helpers retain the existing staff contract but use a fixed,
-- fully-qualified path.
create or replace function public.has_staff_permission(
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and required_permission is not null
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = auth.uid()
        and (
          (profile.role = 'admin' and profile.staff_role = 'owner')
          or (
            profile.role = 'staff'
            and profile.staff_role in ('manager', 'calibrator', 'support')
            and required_permission <> 'staff.manage'
            and required_permission = any(profile.staff_permissions)
          )
        )
    );
$$;

create or replace function public.is_primary_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = auth.uid()
        and profile.role = 'admin'
        and profile.staff_role = 'owner'
    );
$$;

-- Historical policies call is_admin(), while older AI/File Expert policies
-- repeat a raw role='admin' subquery. The only administrative identity is the
-- exact Primary Owner tuple; a metadata-created admin/null row is never enough.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = auth.uid()
        and profile.role = 'admin'
        and profile.staff_role = 'owner'
    );
$$;

-- Rewrite only catalog-confirmed legacy policies that still exist and still
-- have their legacy raw-admin/is_admin expression class. The following
-- 02443-02453 chain removes most of these names; a direct canonical-schema
-- rehearsal also leaves every already-missing legacy policy missing.
do $$
declare
  v_target record;
  v_policy record;
  v_expression text;
begin
  for v_target in
    select *
    from (values
      ('public', 'credit_payments', 'Admins can view all credit payments', 'r', 'helper'),
      ('public', 'profiles', 'Admins can update all profiles', 'w', 'helper'),
      ('public', 'profiles', 'Admins can view all profiles', 'r', 'helper'),
      ('public', 'ai_ecu_knowledge_profiles', 'Admins can manage AI knowledge profiles', '*', 'plain'),
      ('public', 'ai_model_runs', 'Admins can read AI model runs', 'r', 'plain'),
      ('public', 'ai_pattern_signatures', 'Admins can manage AI pattern signatures', '*', 'plain'),
      ('public', 'ai_training_events', 'Admins can read AI training events', 'r', 'plain'),
      ('public', 'ai_training_samples', 'Admins can manage AI training samples', '*', 'plain'),
      ('public', 'file_expert_binary_fingerprints', 'Admins can manage file expert fingerprints', '*', 'plain'),
      ('public', 'file_expert_feedback', 'Admins can manage file expert feedback', '*', 'plain'),
      ('public', 'file_expert_jobs', 'Admins can manage file expert jobs', '*', 'plain'),
      ('public', 'known_file_patterns', 'Admins can manage known file patterns', '*', 'plain'),
      ('public', 'credit_transactions', 'Admins can insert credit transactions', 'a', 'plain'),
      ('public', 'credit_transactions', 'Admins can view all credit transactions', 'r', 'plain'),
      ('public', 'orders', 'Admins can update all orders', 'w', 'plain'),
      ('public', 'orders', 'Admins can view all orders', 'r', 'plain'),
      ('storage', 'objects', 'Admins can read all customer files', 'r', 'customer-files'),
      ('storage', 'objects', 'Admins can update modified customer files', 'w', 'customer-files'),
      ('storage', 'objects', 'Admins can upload modified customer files', 'a', 'customer-files')
    ) as expected(
      schema_name,
      table_name,
      policy_name,
      command_code,
      boundary_kind
    )
  loop
    select
      policy.polcmd::text as polcmd,
      pg_catalog.lower(
        coalesce(
          pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
          ''
        ) || ' ' || coalesce(
          pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid),
          ''
        )
      ) as expression
    into v_policy
    from pg_catalog.pg_policy as policy
    join pg_catalog.pg_class as relation
      on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = v_target.schema_name
      and relation.relname = v_target.table_name
      and policy.polname = v_target.policy_name;

    if not found then
      continue;
    end if;

    if v_policy.polcmd <> v_target.command_code then
      raise exception
        'Unexpected command for legacy authority policy %.%.%: %',
        v_target.schema_name,
        v_target.table_name,
        v_target.policy_name,
        v_policy.polcmd;
    end if;

    v_expression := v_policy.expression;
    if v_target.boundary_kind = 'helper' then
      if pg_catalog.strpos(v_expression, 'is_admin()') = 0 then
        raise exception
          'Unexpected expression for helper authority policy %.%.%',
          v_target.schema_name,
          v_target.table_name,
          v_target.policy_name;
      end if;
    elsif pg_catalog.strpos(v_expression, 'is_admin()') = 0
      and not (
        pg_catalog.strpos(v_expression, 'profiles') > 0
        and pg_catalog.strpos(v_expression, 'auth.uid') > 0
        and pg_catalog.strpos(v_expression, 'role') > 0
        and pg_catalog.strpos(v_expression, 'admin') > 0
      ) then
      raise exception
        'Unexpected expression for raw authority policy %.%.%',
        v_target.schema_name,
        v_target.table_name,
        v_target.policy_name;
    end if;

    if v_target.command_code = 'r' then
      execute pg_catalog.format(
        'alter policy %I on %I.%I to authenticated using (%s)',
        v_target.policy_name,
        v_target.schema_name,
        v_target.table_name,
        case
          when v_target.boundary_kind = 'customer-files'
            then 'bucket_id = ''customer-files'' and public.is_admin()'
          else 'public.is_admin()'
        end
      );
    elsif v_target.command_code = 'a' then
      execute pg_catalog.format(
        'alter policy %I on %I.%I to authenticated with check (%s)',
        v_target.policy_name,
        v_target.schema_name,
        v_target.table_name,
        case
          when v_target.boundary_kind = 'customer-files'
            then 'bucket_id = ''customer-files'' and public.is_admin()'
          else 'public.is_admin()'
        end
      );
    else
      execute pg_catalog.format(
        'alter policy %I on %I.%I to authenticated using (%s) with check (%s)',
        v_target.policy_name,
        v_target.schema_name,
        v_target.table_name,
        case
          when v_target.boundary_kind = 'customer-files'
            then 'bucket_id = ''customer-files'' and public.is_admin()'
          else 'public.is_admin()'
        end,
        case
          when v_target.boundary_kind = 'customer-files'
            then 'bucket_id = ''customer-files'' and public.is_admin()'
          else 'public.is_admin()'
        end
      );
    end if;
  end loop;
end;
$$;

-- Auth profile creation runs through the postgres-owned SECURITY DEFINER
-- trigger. PUBLIC/anon need no direct profile privilege. Authenticated users
-- retain the current SELECT/UPDATE compatibility only; INSERT, DELETE and the
-- RLS-bypassing or schema-authority privileges are removed.
revoke all privileges on table public.profiles from public, anon;
revoke insert, delete, truncate, references, trigger
  on table public.profiles from authenticated;
do $$
declare
  v_insert_columns text;
  v_policy record;
begin
  select pg_catalog.string_agg(
    pg_catalog.format('%I', attribute.attname),
    ', '
    order by attribute.attnum
  )
  into v_insert_columns
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.profiles'::pg_catalog.regclass
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if v_insert_columns is not null then
    execute pg_catalog.format(
      'revoke select (%s) on table public.profiles from public, anon',
      v_insert_columns
    );
    execute pg_catalog.format(
      'revoke update (%s) on table public.profiles from public, anon',
      v_insert_columns
    );
    execute pg_catalog.format(
      'revoke insert (%s) on table public.profiles from public, anon, authenticated',
      v_insert_columns
    );
    execute pg_catalog.format(
      'revoke references (%s) on table public.profiles from public, anon, authenticated',
      v_insert_columns
    );
  end if;

  for v_policy in
    select policy.polname
    from pg_catalog.pg_policy as policy
    where policy.polrelid = 'public.profiles'::pg_catalog.regclass
      and policy.polcmd::text in ('a', 'd', '*')
  loop
    execute pg_catalog.format(
      'drop policy %I on public.profiles',
      v_policy.polname
    );
  end loop;
end;
$$;

-- dad28dd web/desktop create orders only through the hardened SECURITY DEFINER
-- RPC. Remove the direct Data API INSERT bypass while retaining authenticated
-- SELECT and the legacy permission-checked admin UPDATE compatibility.
revoke all privileges on table public.orders from public, anon;
revoke insert, delete, truncate, references, trigger
  on table public.orders from authenticated;
do $$
declare
  v_order_columns text;
  v_policy record;
begin
  select pg_catalog.string_agg(
    pg_catalog.format('%I', attribute.attname),
    ', '
    order by attribute.attnum
  )
  into v_order_columns
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.orders'::pg_catalog.regclass
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if v_order_columns is not null then
    execute pg_catalog.format(
      'revoke select (%s) on table public.orders from public, anon',
      v_order_columns
    );
    execute pg_catalog.format(
      'revoke update (%s) on table public.orders from public, anon',
      v_order_columns
    );
    execute pg_catalog.format(
      'revoke insert (%s) on table public.orders from public, anon, authenticated',
      v_order_columns
    );
    execute pg_catalog.format(
      'revoke references (%s) on table public.orders from public, anon, authenticated',
      v_order_columns
    );
  end if;

  for v_policy in
    select policy.polname
    from pg_catalog.pg_policy as policy
    where policy.polrelid = 'public.orders'::pg_catalog.regclass
      and policy.polcmd::text in ('a', 'd', '*')
  loop
    execute pg_catalog.format(
      'drop policy %I on public.orders',
      v_policy.polname
    );
  end loop;
end;
$$;

-- Enforce the same authority tuple for every future INSERT/UPDATE, including
-- service_role/postgres writes. NOT VALID avoids a blocking historical scan;
-- the separate aggregate preflight and post-apply incident gate assess rows
-- that existed before this constraint was installed.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_info
    where constraint_info.conrelid =
      'public.profiles'::pg_catalog.regclass
      and constraint_info.conname =
        'profiles_emergency_authority_tuple_check'
  ) then
    alter table public.profiles
      add constraint profiles_emergency_authority_tuple_check
      check (
        coalesce(
          role = 'admin' and staff_role = 'owner'
          or role = 'staff'
            and staff_role in ('manager', 'calibrator', 'support')
          or role = 'customer'
            and staff_role is null
            and coalesce(
              pg_catalog.cardinality(staff_permissions),
              0
            ) = 0,
          false
        )
      ) not valid;
  end if;
end;
$$;

-- Auth metadata is customer-controlled. Presentation values may be copied,
-- but metadata can never select database authority or an opening balance.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    account_type,
    company_name,
    phone,
    street,
    postal_code,
    city,
    country,
    vat_id,
    invoice_email,
    preferred_contact,
    role,
    credit_balance
  )
  values (
    new.id,
    new.email,
    pg_catalog.left(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      200
    ),
    case
      when new.raw_user_meta_data ->> 'account_type' in ('private', 'company')
        then new.raw_user_meta_data ->> 'account_type'
      else 'private'
    end,
    case
      when new.raw_user_meta_data ->> 'account_type' = 'company'
        then pg_catalog.left(
          nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'company_name'), ''),
          200
        )
      else null
    end,
    pg_catalog.left(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'phone'), ''),
      80
    ),
    pg_catalog.left(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'street'), ''),
      240
    ),
    pg_catalog.left(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'postal_code'), ''),
      32
    ),
    pg_catalog.left(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'city'), ''),
      120
    ),
    coalesce(
      pg_catalog.left(
        nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'country'), ''),
        120
      ),
      'Germany'
    ),
    case
      when new.raw_user_meta_data ->> 'account_type' = 'company'
        then pg_catalog.left(
          nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'vat_id'), ''),
          80
        )
      else null
    end,
    pg_catalog.left(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'invoice_email'), ''),
      250
    ),
    case
      when new.raw_user_meta_data ->> 'preferred_contact' in ('email', 'whatsapp', 'phone')
        then new.raw_user_meta_data ->> 'preferred_contact'
      else 'email'
    end,
    'customer',
    0
  );

  return new;
end;
$$;

-- Replace every non-internal Auth INSERT trigger that points to the old body,
-- then install one exact normal-enabled trigger.
do $$
declare
  v_trigger record;
begin
  for v_trigger in
    select trigger_info.tgname
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
  loop
    execute pg_catalog.format(
      'drop trigger %I on auth.users',
      v_trigger.tgname
    );
  end loop;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Use JSONB field comparisons for optional historical profile columns. Missing
-- columns compare as unchanged, while every column present in current
-- production receives the same authority checks as migration 02443.
create or replace function public.protect_profile_authority_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request_role text := coalesce(auth.jwt() ->> 'role', '');
  v_financial_marker text := coalesce(
    pg_catalog.current_setting(
      'mg_autotech.profile_financial_write',
      true
    ),
    ''
  );
  v_trusted_service boolean :=
    v_request_role = 'service_role'
    or session_user in ('postgres', 'supabase_admin');
  v_new jsonb := pg_catalog.to_jsonb(new);
  v_old jsonb := pg_catalog.to_jsonb(old);
begin
  -- This final-row invariant is unconditional: even service_role/trusted
  -- server writes cannot create an admin without the exact owner marker, or
  -- move the owner marker onto a non-admin profile.
  if not coalesce(
    new.role = 'admin' and new.staff_role = 'owner'
    or new.role = 'staff'
      and new.staff_role in ('manager', 'calibrator', 'support')
    or new.role = 'customer'
      and new.staff_role is null
      and coalesce(pg_catalog.cardinality(new.staff_permissions), 0) = 0,
    false
  ) then
    raise exception using
      errcode = '23514',
      message = 'Profile authority fields are not a coherent authority tuple.';
  end if;

  if (
    v_new -> 'id' is distinct from v_old -> 'id'
    or v_new -> 'email' is distinct from v_old -> 'email'
    or v_new -> 'customer_id' is distinct from v_old -> 'customer_id'
    or v_new -> 'created_at' is distinct from v_old -> 'created_at'
  ) and not v_trusted_service then
    raise exception using
      errcode = '42501',
      message = 'Profile identity fields cannot be changed through this access path.';
  end if;

  if v_new -> 'credit_balance' is distinct from v_old -> 'credit_balance'
    and not v_trusted_service
    and v_financial_marker not in ('order_debit', 'staff_adjustment') then
    raise exception using
      errcode = '42501',
      message = 'Credit balance changes require an authorized financial operation.';
  end if;

  if (
    v_new -> 'allow_negative_balance' is distinct from v_old -> 'allow_negative_balance'
    or v_new -> 'allow_negative_credits' is distinct from v_old -> 'allow_negative_credits'
    or v_new -> 'negative_credit_limit' is distinct from v_old -> 'negative_credit_limit'
    or v_new -> 'custom_credit_price' is distinct from v_old -> 'custom_credit_price'
    or v_new -> 'monthly_file_limit' is distinct from v_old -> 'monthly_file_limit'
  ) and not v_trusted_service then
    if not public.has_staff_permission('credits.manage') then
      raise exception using
        errcode = '42501',
        message = 'Financial profile settings require credits.manage.';
    end if;
  end if;

  if (
    v_new -> 'account_status' is distinct from v_old -> 'account_status'
    or v_new -> 'customer_tags' is distinct from v_old -> 'customer_tags'
    or v_new -> 'internal_admin_note' is distinct from v_old -> 'internal_admin_note'
  ) and not v_trusted_service then
    if not public.has_staff_permission('customers.manage') then
      raise exception using
        errcode = '42501',
        message = 'Customer account controls require customers.manage.';
    end if;
  end if;

  if (
    v_new -> 'role' is distinct from v_old -> 'role'
    or v_new -> 'staff_role' is distinct from v_old -> 'staff_role'
    or v_new -> 'staff_permissions' is distinct from v_old -> 'staff_permissions'
    or v_new -> 'staff_updated_at' is distinct from v_old -> 'staff_updated_at'
  ) and not v_trusted_service then
    if not public.has_staff_permission('staff.manage') then
      raise exception using
        errcode = '42501',
        message = 'Staff authority fields require the Primary Owner.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_authority_fields_trigger
  on public.profiles;
create trigger protect_profile_authority_fields_trigger
before update on public.profiles
for each row execute function public.protect_profile_authority_fields();

create or replace function public.protect_staff_security_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trusted_service boolean :=
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin');
begin
  if old.staff_role = 'owner' and (
    new.role is distinct from old.role
    or new.staff_role is distinct from old.staff_role
    or new.staff_permissions is distinct from old.staff_permissions
  ) then
    raise exception 'The Primary Owner security role cannot be changed.';
  end if;

  if (
    new.role is distinct from old.role
    or new.staff_role is distinct from old.staff_role
    or new.staff_permissions is distinct from old.staff_permissions
  ) and not v_trusted_service then
    if not public.is_primary_owner() then
      raise exception using
        errcode = '42501',
        message = 'Only the Primary Owner can change staff access.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_staff_security_fields_trigger
  on public.profiles;
create trigger protect_staff_security_fields_trigger
before update on public.profiles
for each row execute function public.protect_staff_security_fields();

-- Preserve a one-to-one audited usage ledger for the hardened legacy order
-- RPC. The marker means unrelated service-role inserts cannot fabricate a
-- credit debit.
create or replace function public.log_order_credit_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance_after integer;
begin
  if coalesce(
    pg_catalog.current_setting(
      'mg_autotech.order_credit_debit',
      true
    ),
    ''
  ) <> 'authorized' then
    return new;
  end if;

  if new.customer_id is null
    or new.credits_required is null
    or new.credits_required <= 0
    or new.credits_required > 100000
    or new.credits_required <> pg_catalog.trunc(new.credits_required) then
    raise exception using
      errcode = '22023',
      message = 'Order credit usage is invalid.';
  end if;

  select profile.credit_balance::integer
  into v_balance_after
  from public.profiles as profile
  where profile.id = new.customer_id
    and profile.role = 'customer';

  if not found then
    raise exception 'Customer profile was not found for the order ledger.';
  end if;

  insert into public.credit_transactions (
    user_id,
    type,
    source_type,
    source_id,
    credits_delta,
    balance_after,
    description,
    metadata,
    created_by,
    created_at
  )
  values (
    new.customer_id,
    'usage',
    'order',
    new.id::text,
    -new.credits_required::integer,
    v_balance_after,
    'File request: '
      || coalesce(new.vehicle_brand, 'Vehicle')
      || ' '
      || coalesce(new.vehicle_model, '')
      || case
        when new.service_type is not null
          then ' - ' || new.service_type
        else ''
      end,
    pg_catalog.jsonb_build_object(
      'order_id', new.id,
      'vehicle_brand', new.vehicle_brand,
      'vehicle_model', new.vehicle_model,
      'service_type', new.service_type,
      'status', new.status
    ),
    new.customer_id,
    coalesce(new.created_at, pg_catalog.now())
  );

  return new;
end;
$$;

drop trigger if exists orders_credit_usage_ledger_trigger
  on public.orders;
create trigger orders_credit_usage_ledger_trigger
after insert on public.orders
for each row execute function public.log_order_credit_usage();

-- Same legacy signature used by origin/main and the desktop finalizer. The
-- caller identity, verified e-mail, account state, upload path and balance are
-- derived from server state; the client credit value is equality-only.
create or replace function public.create_order_with_credit_deduction(
  p_customer_email text,
  p_vehicle_brand text,
  p_vehicle_model text,
  p_vehicle_generation text,
  p_vehicle_engine text,
  p_service_type text,
  p_credits_required integer,
  p_notes text,
  p_ecu text default null,
  p_gearbox text default null,
  p_vehicle_year text default null,
  p_read_method text default null,
  p_license_plate text default null,
  p_hw_sw text default null,
  p_master_slave text default null,
  p_uploaded_file_name text default null,
  p_original_file_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_customer_email text;
  v_email_confirmed_at timestamptz;
  v_account_status text;
  v_balance numeric;
  v_allow_negative boolean;
  v_negative_limit numeric;
  v_expected_credits integer;
  v_new_balance numeric;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if p_credits_required is null
    or p_credits_required < 0
    or p_credits_required > 100000 then
    raise exception using
      errcode = '22023',
      message = 'The client credit amount is outside the supported range.';
  end if;

  if p_vehicle_brand is null
    or pg_catalog.length(pg_catalog.btrim(p_vehicle_brand)) not between 1 and 200
    or p_vehicle_model is null
    or pg_catalog.length(pg_catalog.btrim(p_vehicle_model)) not between 1 and 200
    or p_vehicle_engine is null
    or pg_catalog.length(pg_catalog.btrim(p_vehicle_engine)) not between 1 and 240 then
    raise exception using
      errcode = '22023',
      message = 'Valid vehicle brand, model and engine values are required.';
  end if;

  if pg_catalog.length(coalesce(p_vehicle_generation, '')) > 240
    or pg_catalog.length(coalesce(p_notes, '')) > 20000
    or pg_catalog.length(coalesce(p_ecu, '')) > 200
    or pg_catalog.length(coalesce(p_gearbox, '')) > 200
    or pg_catalog.length(coalesce(p_vehicle_year, '')) > 32
    or pg_catalog.length(coalesce(p_read_method, '')) > 120
    or pg_catalog.length(coalesce(p_license_plate, '')) > 80
    or pg_catalog.length(coalesce(p_hw_sw, '')) > 500
    or pg_catalog.length(coalesce(p_master_slave, '')) > 16
    or pg_catalog.length(coalesce(p_uploaded_file_name, '')) > 255
    or pg_catalog.length(coalesce(p_original_file_path, '')) > 1024 then
    raise exception using
      errcode = '22023',
      message = 'One or more request fields exceed their supported length.';
  end if;

  if nullif(pg_catalog.btrim(coalesce(p_master_slave, '')), '') is not null
    and pg_catalog.lower(pg_catalog.btrim(p_master_slave)) not in ('master', 'slave') then
    raise exception using
      errcode = '22023',
      message = 'Master/slave selection is invalid.';
  end if;

  if p_original_file_path is not null
    and pg_catalog.btrim(p_original_file_path) <> ''
    and pg_catalog.left(
      p_original_file_path,
      pg_catalog.length(v_user_id::text) + 1
    ) <> (v_user_id::text || '/') then
    raise exception using
      errcode = '42501',
      message = 'The uploaded file path is not bound to the authenticated user.';
  end if;

  if p_original_file_path is not null
    and pg_catalog.btrim(p_original_file_path) <> ''
    and not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'customer-files'
        and object.name = pg_catalog.btrim(p_original_file_path)
    ) then
    raise exception using
      errcode = '22023',
      message = 'The uploaded file does not exist in private storage.';
  end if;

  v_expected_credits :=
    public.emergency_resolve_request_service_credits(p_service_type);
  if p_credits_required <> v_expected_credits then
    raise exception using
      errcode = '22023',
      message = 'The request credits do not match the server catalog.';
  end if;

  select
    coalesce(profile.credit_balance, 0),
    coalesce(profile.allow_negative_credits, false),
    coalesce(profile.negative_credit_limit, 0),
    coalesce(profile.account_status, 'active'),
    coalesce(
      nullif(pg_catalog.btrim(auth_user.email), ''),
      nullif(pg_catalog.btrim(profile.email), '')
    ),
    coalesce(auth_user.email_confirmed_at, auth_user.confirmed_at)
  into
    v_balance,
    v_allow_negative,
    v_negative_limit,
    v_account_status,
    v_customer_email,
    v_email_confirmed_at
  from public.profiles as profile
  left join auth.users as auth_user on auth_user.id = profile.id
  where profile.id = v_user_id
    and profile.role = 'customer'
  for update of profile;

  if not found then
    raise exception 'Customer profile was not found.';
  end if;

  if v_customer_email is null or v_email_confirmed_at is null then
    raise exception using
      errcode = '42501',
      message = 'The authenticated account has no verified e-mail address.';
  end if;

  if p_customer_email is not null
    and pg_catalog.btrim(p_customer_email) <> ''
    and pg_catalog.lower(pg_catalog.btrim(p_customer_email))
      <> pg_catalog.lower(v_customer_email) then
    raise exception using
      errcode = '42501',
      message = 'The request e-mail is not bound to the authenticated user.';
  end if;

  if v_account_status <> 'active' then
    raise exception using
      errcode = '42501',
      message = 'The customer account is not active.';
  end if;

  if v_balance <> pg_catalog.trunc(v_balance)
    or v_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The customer balance requires financial reconciliation.';
  end if;

  if v_negative_limit <> pg_catalog.trunc(v_negative_limit)
    or v_negative_limit not between 0 and 100000 then
    raise exception using
      errcode = '22003',
      message = 'The negative credit limit requires financial reconciliation.';
  end if;

  if not v_allow_negative and v_balance < v_expected_credits then
    raise exception 'Insufficient credits.';
  end if;

  if v_allow_negative
    and v_balance - v_expected_credits < 0 - v_negative_limit then
    raise exception 'Negative credit limit exceeded.';
  end if;

  v_new_balance := v_balance - v_expected_credits;
  if v_new_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The resulting credit balance is outside the supported range.';
  end if;

  if v_expected_credits > 0 then
    perform pg_catalog.set_config(
      'mg_autotech.profile_financial_write',
      'order_debit',
      true
    );
    update public.profiles
    set credit_balance = v_new_balance
    where id = v_user_id;
    perform pg_catalog.set_config(
      'mg_autotech.profile_financial_write',
      '',
      true
    );

    perform pg_catalog.set_config(
      'mg_autotech.order_credit_debit',
      'authorized',
      true
    );
  end if;
  insert into public.orders (
    customer_id,
    customer_email,
    vehicle_brand,
    vehicle_model,
    vehicle_generation,
    vehicle_engine,
    service_type,
    credits_required,
    status,
    notes,
    ecu,
    gearbox,
    vehicle_year,
    read_method,
    license_plate,
    hw_sw,
    master_slave,
    uploaded_file_name,
    original_file_path
  )
  values (
    v_user_id,
    v_customer_email,
    pg_catalog.btrim(p_vehicle_brand),
    pg_catalog.btrim(p_vehicle_model),
    nullif(pg_catalog.btrim(p_vehicle_generation), ''),
    pg_catalog.btrim(p_vehicle_engine),
    pg_catalog.btrim(p_service_type),
    v_expected_credits,
    'new_request',
    coalesce(nullif(pg_catalog.btrim(p_notes), ''), '-'),
    nullif(pg_catalog.btrim(p_ecu), ''),
    nullif(pg_catalog.btrim(p_gearbox), ''),
    nullif(pg_catalog.btrim(p_vehicle_year), ''),
    nullif(pg_catalog.btrim(p_read_method), ''),
    nullif(pg_catalog.btrim(p_license_plate), ''),
    nullif(pg_catalog.btrim(p_hw_sw), ''),
    nullif(pg_catalog.btrim(p_master_slave), ''),
    nullif(pg_catalog.btrim(p_uploaded_file_name), ''),
    nullif(pg_catalog.btrim(p_original_file_path), '')
  )
  returning id into v_order_id;
  if v_expected_credits > 0 then
    perform pg_catalog.set_config(
      'mg_autotech.order_credit_debit',
      '',
      true
    );
  end if;

  return v_order_id;
end;
$$;

-- The current admin app calls the three-argument staff RPC. Its emergency
-- implementation keeps the permission check, row lock, ledger write and
-- profile marker. The distinct private table avoids colliding with 02443.
create table if not exists public.emergency_staff_credit_adjustment_idempotency (
  idempotency_key uuid primary key,
  actor_id uuid not null,
  customer_id uuid not null,
  amount numeric not null,
  note text,
  transaction_id text,
  balance_after numeric,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint emergency_staff_credit_adjustment_amount_check
    check (
      amount <> 0
      and amount = pg_catalog.trunc(amount)
      and pg_catalog.abs(amount) <= 100000
    ),
  constraint emergency_staff_credit_adjustment_note_check
    check (pg_catalog.length(coalesce(note, '')) <= 1000),
  constraint emergency_staff_credit_adjustment_completion_check
    check (
      (
        transaction_id is null
        and balance_after is null
        and completed_at is null
      )
      or (
        transaction_id is not null
        and balance_after is not null
        and completed_at is not null
      )
    )
);

alter table public.emergency_staff_credit_adjustment_idempotency
  owner to postgres;
alter table public.emergency_staff_credit_adjustment_idempotency
  enable row level security;
revoke all privileges on table
  public.emergency_staff_credit_adjustment_idempotency
  from public, anon, authenticated, service_role;

create or replace function public.emergency_staff_adjust_customer_credits(
  p_customer_id uuid,
  p_amount numeric,
  p_note text,
  p_idempotency_key uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_claim public.emergency_staff_credit_adjustment_idempotency%rowtype;
  v_current_balance numeric;
  v_next_balance numeric;
  v_transaction_id text := p_idempotency_key::text;
begin
  if v_actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  perform 1
  from public.profiles as actor
  where actor.id = v_actor_id
    and (
      (actor.role = 'admin' and actor.staff_role = 'owner')
      or (
        actor.role = 'staff'
        and actor.staff_role in ('manager', 'calibrator', 'support')
        and 'credits.manage' = any(actor.staff_permissions)
      )
    )
  for share;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  if p_amount is null
    or p_amount = 0
    or p_amount <> pg_catalog.trunc(p_amount)
    or pg_catalog.abs(p_amount) > 100000
    or p_customer_id is null
    or p_idempotency_key is null then
    raise exception using
      errcode = '22023',
      message = 'A valid credit amount and idempotency key are required.';
  end if;

  if pg_catalog.length(coalesce(p_note, '')) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'The adjustment note exceeds the supported length.';
  end if;

  insert into public.emergency_staff_credit_adjustment_idempotency (
    idempotency_key,
    actor_id,
    customer_id,
    amount,
    note
  )
  values (
    p_idempotency_key,
    v_actor_id,
    p_customer_id,
    p_amount,
    p_note
  )
  on conflict (idempotency_key) do nothing
  returning * into v_claim;

  if not found then
    select claim.*
    into v_claim
    from public.emergency_staff_credit_adjustment_idempotency as claim
    where claim.idempotency_key = p_idempotency_key
    for update;

    if not found
      or v_claim.actor_id is distinct from v_actor_id
      or v_claim.customer_id is distinct from p_customer_id
      or v_claim.amount is distinct from p_amount
      or pg_catalog.convert_to(v_claim.note, 'UTF8')
        is distinct from pg_catalog.convert_to(p_note, 'UTF8') then
      raise exception using
        errcode = '22023',
        message = 'The idempotency key is already bound to another credit adjustment.';
    end if;

    if v_claim.completed_at is null
      or v_claim.balance_after is null
      or v_claim.transaction_id is null then
      raise exception using
        errcode = '55000',
        message = 'The credit adjustment claim is incomplete and requires review.';
    end if;

    if not exists (
      select 1
      from public.credit_transactions as ledger
      where ledger.user_id = v_claim.customer_id
        and ledger.source_type = 'staff_adjustment'
        and ledger.source_id = v_claim.transaction_id
        and ledger.credits_delta::numeric = v_claim.amount
        and ledger.balance_after::numeric = v_claim.balance_after
        and ledger.created_by = v_claim.actor_id
    ) then
      raise exception using
        errcode = '55000',
        message = 'The credit adjustment ledger requires reconciliation.';
    end if;

    return v_claim.balance_after;
  end if;

  select coalesce(profile.credit_balance, 0)
  into v_current_balance
  from public.profiles as profile
  where profile.id = p_customer_id
    and profile.role = 'customer'
  for update;

  if not found then
    raise exception 'Customer was not found.';
  end if;

  if v_current_balance <> pg_catalog.trunc(v_current_balance)
    or v_current_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The customer balance requires financial reconciliation.';
  end if;

  v_next_balance := v_current_balance + p_amount;
  if v_next_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The resulting balance is outside the supported range.';
  end if;

  perform pg_catalog.set_config(
    'mg_autotech.profile_financial_write',
    'staff_adjustment',
    true
  );
  update public.profiles
  set credit_balance = v_next_balance
  where id = p_customer_id;
  perform pg_catalog.set_config(
    'mg_autotech.profile_financial_write',
    '',
    true
  );

  insert into public.credit_transactions (
    user_id,
    type,
    source_type,
    source_id,
    credits_delta,
    balance_after,
    description,
    amount_total,
    currency,
    metadata,
    created_by
  )
  values (
    p_customer_id,
    case when p_amount > 0 then 'admin_topup' else 'admin_adjustment' end,
    'staff_adjustment',
    v_transaction_id,
    p_amount::integer,
    v_next_balance::integer,
    coalesce(nullif(pg_catalog.btrim(p_note), ''), 'Staff credit adjustment'),
    null,
    null,
    pg_catalog.jsonb_build_object(
      'actor_id', v_actor_id,
      'idempotency_key', p_idempotency_key
    ),
    v_actor_id
  );

  update public.emergency_staff_credit_adjustment_idempotency
  set
    transaction_id = v_transaction_id,
    balance_after = v_next_balance,
    completed_at = pg_catalog.now()
  where idempotency_key = p_idempotency_key
    and completed_at is null;

  if not found then
    raise exception 'The credit adjustment idempotency claim could not be finalized.';
  end if;

  return v_next_balance;
end;
$$;

create or replace function public.staff_adjust_customer_credits(
  p_customer_id uuid,
  p_amount numeric,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- In the explicit canonical-schema rehearsal, 02452 already owns this
  -- legacy overload and it must remain fail-closed.
  if pg_catalog.to_regprocedure(
    'public.staff_adjust_customer_credits(uuid,numeric,text,uuid)'
  ) is not null then
    raise exception using
      errcode = '0A000',
      message = 'The legacy credit adjustment RPC is disabled; an idempotency key is required.';
  end if;

  if auth.uid() is null
    or not public.has_staff_permission('credits.manage') then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  return public.emergency_staff_adjust_customer_credits(
    p_customer_id,
    p_amount,
    p_note,
    pg_catalog.gen_random_uuid()
  );
end;
$$;

-- Normalize ownership and remove implicit PUBLIC/default-privilege execution
-- from the six catalog-confirmed production finance entry points.
alter function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) owner to postgres;
alter function public.admin_adjust_customer_credits(uuid, integer, text)
  owner to postgres;
alter function public.admin_add_credits(uuid, integer, text)
  owner to postgres;
alter function public.admin_apply_payment_refund(uuid, uuid, text, text)
  owner to postgres;
alter function public.admin_record_bank_payment(
  uuid, uuid, text, numeric, bigint, text, text
) owner to postgres;
alter function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) owner to postgres;

revoke all privileges on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) from public, anon, authenticated, service_role;
revoke all privileges on function
  public.admin_adjust_customer_credits(uuid, integer, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.admin_add_credits(uuid, integer, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function
  public.admin_apply_payment_refund(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.admin_record_bank_payment(
  uuid, uuid, text, numeric, bigint, text, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

alter function public.has_staff_permission(text) owner to postgres;
alter function public.is_primary_owner() owner to postgres;
alter function public.is_admin() owner to postgres;
alter function public.handle_new_user() owner to postgres;
alter function public.protect_profile_authority_fields() owner to postgres;
alter function public.protect_staff_security_fields() owner to postgres;
alter function public.log_order_credit_usage() owner to postgres;
alter function public.emergency_staff_adjust_customer_credits(
  uuid, numeric, text, uuid
) owner to postgres;
alter function public.staff_adjust_customer_credits(uuid, numeric, text)
  owner to postgres;

revoke all privileges on function public.has_staff_permission(text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.is_primary_owner()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.is_admin()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.handle_new_user()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.protect_profile_authority_fields()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.protect_staff_security_fields()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.log_order_credit_usage()
  from public, anon, authenticated, service_role;
revoke all privileges on function
  public.emergency_staff_adjust_customer_credits(uuid, numeric, text, uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function
  public.staff_adjust_customer_credits(uuid, numeric, text)
  from public, anon, authenticated, service_role;

-- A historical authority policy without TO applies to PUBLIC. Narrow only
-- policies that call the reviewed helpers before keeping those helpers private
-- from anon/PUBLIC callers.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select
      namespace.nspname as schema_name,
      relation.relname as table_name,
      policy.polname as policy_name
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
  loop
    execute pg_catalog.format(
      'alter policy %I on %I.%I to authenticated',
      v_policy.policy_name,
      v_policy.schema_name,
      v_policy.table_name
    );
  end loop;
end;
$$;

grant execute on function public.has_staff_permission(text) to authenticated;
grant execute on function public.is_primary_owner() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_record_bank_payment(
  uuid, uuid, text, numeric, bigint, text, text
) to service_role;

-- Preserve only the legacy entry points required by origin/main. If the newer
-- wrapper/claim overloads exist, keep the 02452 direct-RPC cutover closed.
do $$
begin
  if pg_catalog.to_regprocedure(
    'public.staff_adjust_customer_credits(uuid,numeric,text,uuid)'
  ) is null then
    execute
      'grant execute on function '
      || 'public.staff_adjust_customer_credits(uuid, numeric, text) '
      || 'to authenticated';
  end if;

  if pg_catalog.to_regprocedure(
    'public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'
  ) is null then
    execute
      'grant execute on function '
      || 'public.create_order_with_credit_deduction('
      || 'text, text, text, text, text, text, integer, text, text, '
      || 'text, text, text, text, text, text, text, text) '
      || 'to authenticated';
  end if;

  if pg_catalog.to_regprocedure(
    'public.add_credits_from_stripe(uuid,text,text,text,text,numeric,numeric,text,uuid)'
  ) is null then
    execute
      'grant execute on function '
      || 'public.add_credits_from_stripe('
      || 'uuid, text, text, text, text, numeric, numeric, text) '
      || 'to service_role';
  end if;

  if pg_catalog.to_regprocedure(
    'public.admin_apply_payment_refund(uuid,uuid,text,text,uuid)'
  ) is null then
    execute
      'grant execute on function '
      || 'public.admin_apply_payment_refund(uuid, uuid, text, text) '
      || 'to service_role';
  end if;
end;
$$;

comment on function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) is
  'Emergency caller-bound legacy order contract. Credits are resolved from a private server catalog; 02443 later replaces this body with the canonical resolver.';
comment on function public.emergency_staff_adjust_customer_credits(
  uuid, numeric, text, uuid
) is
  'Private emergency-only staff adjustment core retained for origin/main compatibility until the canonical 02443 RPC is released.';

commit;
