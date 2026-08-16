begin;

-- The live schema had no authoritative request-service credit catalog. These
-- rows are copied verbatim from the shared web/desktop request catalog that was
-- current when this migration was prepared. Future credit changes must update
-- the application catalog and this table in the same reviewed migration.
create table public.request_service_catalog (
  service_id text primary key,
  service_kind text not null check (service_kind in ('primary', 'extra')),
  service_title text not null unique,
  credits integer not null check (credits between 0 and 100000),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint request_service_catalog_id_check
    check (service_id ~ '^[a-z0-9_]+$'),
  constraint request_service_catalog_title_check
    check (length(btrim(service_title)) between 1 and 160)
);

comment on table public.request_service_catalog is
  'Server-authoritative credit catalog for request creation. Changes require a reviewed migration kept in sync with the web and desktop catalogs.';

alter table public.request_service_catalog enable row level security;
revoke all privileges on table public.request_service_catalog from public, anon, authenticated;
grant select on table public.request_service_catalog to service_role;

insert into public.request_service_catalog (
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
  ('special_request', 'extra', 'Special Request / Other', 0, true);

create or replace function public.resolve_request_service_credits(
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
  v_match public.request_service_catalog%rowtype;
  v_seen_extra_ids text[] := '{}'::text[];
  v_total integer := 0;
begin
  if v_remaining is null
    or pg_catalog.length(v_remaining) = 0
    or pg_catalog.length(v_remaining) > 4096 then
    raise exception using
      errcode = '22023',
      message = 'A valid service selection is required.';
  end if;

  select catalog.*
  into v_match
  from public.request_service_catalog as catalog
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
    from public.request_service_catalog as catalog
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

  if v_total <= 0 then
    raise exception using
      errcode = '22023',
      message = 'The selected services must require a positive credit amount.';
  end if;

  return v_total;
end;
$$;

comment on function public.resolve_request_service_credits(text) is
  'Private resolver for the exact service summary emitted by the current web and desktop request flows.';

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

-- Auth metadata is customer-controlled input. It may populate presentation
-- fields, but it must never select a database authority role.
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

-- Ensure the hardened function is the single enabled INSERT trigger used by
-- Auth. Historical trigger names are removed by function identity so a stale
-- duplicate cannot create a second profile row or bypass this implementation.
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_primary_owner_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.staff_role = 'owner' then
    raise exception 'The Primary Owner account cannot be deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_primary_owner_delete_trigger
  on public.profiles;
create trigger protect_primary_owner_delete_trigger
before delete on public.profiles
for each row execute function public.protect_primary_owner_delete();

create or replace function public.create_customer_order_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_id is null then
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.notifications (
      user_id,
      order_id,
      type,
      title,
      body,
      metadata
    )
    values (
      new.customer_id,
      new.id,
      case when new.status = 'completed' then 'file_ready' else 'order_status' end,
      case when new.status = 'completed' then 'Your file is ready' else 'Order status updated' end,
      case
        when new.status = 'completed'
          then 'Your completed file is ready to download.'
        else 'New status: ' || pg_catalog.replace(
          pg_catalog.initcap(pg_catalog.replace(new.status, '_', ' ')),
          '_',
          ' '
        )
      end,
      pg_catalog.jsonb_build_object('status', new.status)
    );
  end if;

  if new.customer_upload_enabled is true
    and new.customer_upload_enabled is distinct from old.customer_upload_enabled then
    insert into public.notifications (
      user_id,
      order_id,
      type,
      title,
      body
    )
    values (
      new.customer_id,
      new.id,
      'additional_upload_enabled',
      'Additional file upload enabled',
      'You can now upload another file inside this request.'
    );
  end if;

  return new;
end;
$$;

-- Older migrations omitted TO authenticated on several authority policies,
-- which made them apply to PUBLIC. Narrow only policies that call a reviewed
-- authority helper before removing anon/PUBLIC EXECUTE from those helpers.
do $$
declare
  target record;
begin
  for target in
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
      target.policy_name,
      target.schema_name,
      target.table_name
    );
  end loop;
end;
$$;

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
begin
  if (
    new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.customer_id is distinct from old.customer_id
    or new.created_at is distinct from old.created_at
  ) and not v_trusted_service then
    raise exception using
      errcode = '42501',
      message = 'Profile identity fields cannot be changed through this access path.';
  end if;

  if new.credit_balance is distinct from old.credit_balance
    and not v_trusted_service
    and v_financial_marker not in ('order_debit', 'staff_adjustment') then
    raise exception using
      errcode = '42501',
      message = 'Credit balance changes require an authorized financial operation.';
  end if;

  if (
    new.allow_negative_balance is distinct from old.allow_negative_balance
    or new.allow_negative_credits is distinct from old.allow_negative_credits
    or new.negative_credit_limit is distinct from old.negative_credit_limit
    or new.custom_credit_price is distinct from old.custom_credit_price
    or new.monthly_file_limit is distinct from old.monthly_file_limit
  ) and not v_trusted_service then
    if not public.has_staff_permission('credits.manage') then
      raise exception using
        errcode = '42501',
        message = 'Financial profile settings require credits.manage.';
    end if;
  end if;

  if (
    new.account_status is distinct from old.account_status
    or new.customer_tags is distinct from old.customer_tags
    or new.internal_admin_note is distinct from old.internal_admin_note
  ) and not v_trusted_service then
    if not public.has_staff_permission('customers.manage') then
      raise exception using
        errcode = '42501',
        message = 'Customer account controls require customers.manage.';
    end if;
  end if;

  if (
    new.role is distinct from old.role
    or new.staff_role is distinct from old.staff_role
    or new.staff_permissions is distinct from old.staff_permissions
    or new.staff_updated_at is distinct from old.staff_updated_at
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

-- Keep the original Primary Owner invariant while removing its mutable search
-- path and deprecated auth.role() dependency.
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

alter table public.orders
  add column if not exists customer_upload_grant_nonce uuid;

update public.orders
set customer_upload_grant_nonce = pg_catalog.gen_random_uuid()
where customer_upload_enabled is true
  and customer_upload_grant_nonce is null;

create or replace function public.protect_order_upload_controls()
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
  if (
    new.customer_upload_enabled is distinct from old.customer_upload_enabled
    or new.customer_uploads is distinct from old.customer_uploads
    or new.customer_upload_grant_nonce is distinct from old.customer_upload_grant_nonce
  ) and not v_trusted_service then
    if not public.has_staff_permission('orders.manage') then
      raise exception using
        errcode = '42501',
        message = 'Controlled order upload fields require orders.manage.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_order_upload_controls_trigger
  on public.orders;
create trigger protect_order_upload_controls_trigger
before update on public.orders
for each row execute function public.protect_order_upload_controls();

-- Profiles remain directly editable only for the real customer-settings fields.
-- Staff/account/financial updates must go through an authenticated server route
-- or a reviewed RPC and are also protected by the trigger above.
revoke all privileges on table public.profiles from public, anon, authenticated;
do $$
declare
  v_columns text;
begin
  select pg_catalog.string_agg(pg_catalog.format('%I', attribute.attname), ', ')
  into v_columns
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.profiles'::pg_catalog.regclass
    and attribute.attnum > 0
    and not attribute.attisdropped;

  execute pg_catalog.format(
    'revoke update (%s) on table public.profiles from public, anon, authenticated',
    v_columns
  );
end;
$$;

grant select (
  id,
  email,
  customer_id,
  credit_balance,
  allow_negative_credits,
  negative_credit_limit,
  account_status,
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
  preferred_contact
) on table public.profiles to authenticated;
grant update (
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
  preferred_contact
) on table public.profiles to authenticated;
grant all privileges on table public.profiles to service_role;

-- Replace every historical profile policy with one deterministic customer-only
-- policy pair. Staff access is mediated by permission-checked server APIs,
-- which return explicit column allowlists; RLS cannot mask columns.
alter table public.profiles enable row level security;
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policy.polname
    from pg_catalog.pg_policy as policy
    where policy.polrelid = 'public.profiles'::pg_catalog.regclass
  loop
    execute pg_catalog.format(
      'drop policy %I on public.profiles',
      v_policy.polname
    );
  end loop;
end;
$$;

create policy "Customers can read own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Customers can update own profile settings"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Replace historical order policies instead of relying on their names. Direct
-- Data API access is customer-owned SELECT only; all mutations and staff reads
-- use the caller-bound RPC or projected service-role APIs.
alter table public.orders enable row level security;
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policy.polname
    from pg_catalog.pg_policy as policy
    where policy.polrelid = 'public.orders'::pg_catalog.regclass
  loop
    execute pg_catalog.format(
      'drop policy %I on public.orders',
      v_policy.polname
    );
  end loop;
end;
$$;

revoke all privileges on table public.orders from public, anon, authenticated;
do $$
declare
  v_columns text;
begin
  select pg_catalog.string_agg(pg_catalog.format('%I', attribute.attname), ', ')
  into v_columns
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.orders'::pg_catalog.regclass
    and attribute.attnum > 0
    and not attribute.attisdropped;

  execute pg_catalog.format(
    'revoke insert (%s) on table public.orders from public, anon, authenticated',
    v_columns
  );
  execute pg_catalog.format(
    'revoke update (%s) on table public.orders from public, anon, authenticated',
    v_columns
  );
end;
$$;

grant select (
  id,
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
  created_at
) on table public.orders to authenticated;
grant all privileges on table public.orders to service_role;

create policy "Customers can read own orders"
on public.orders
for select
to authenticated
using (customer_id = (select auth.uid()));

-- These relations contain internal notes, delivery metadata, binary paths or
-- provider diagnostics. They are API-only so a staff JWT cannot bypass the
-- Next.js permission projection with a direct PostgREST select("*") request.
do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'request_messages',
    'request_work_orders',
    'request_work_order_events',
    'request_internal_notes',
    'email_delivery_events',
    'email_suppressions',
    'file_expert_jobs',
    'file_expert_feedback',
    'known_file_patterns',
    'file_expert_binary_fingerprints',
    'file_fingerprints'
  ]
  loop
    if pg_catalog.to_regclass('public.' || v_table) is null then
      continue;
    end if;

    for v_policy in
      select policy.polname
      from pg_catalog.pg_policy as policy
      where policy.polrelid = pg_catalog.to_regclass('public.' || v_table)
    loop
      execute pg_catalog.format(
        'drop policy %I on public.%I',
        v_policy.polname,
        v_table
      );
    end loop;

    execute pg_catalog.format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      v_table
    );
    execute pg_catalog.format(
      'grant all privileges on table public.%I to service_role',
      v_table
    );
  end loop;
end;
$$;

-- Uploaded customer binaries are immutable once written. Hosted Supabase owns
-- the table grants in the storage schema, so immutability is enforced with
-- restrictive RLS policies instead of revoking storage.objects privileges.
-- The two owner-prefix INSERT policies below are temporary compatibility for
-- the application version that predates signed uploads; migration 02449 drops
-- them after the matching application has been deployed.

-- Reassert the private upload buckets independently from historical Storage
-- policies. Canonical permissive policies preserve owner/staff workflows;
-- restrictive boundaries ensure an older broad OR-policy cannot widen access
-- to either bucket.
drop policy if exists "Customers can upload own file expert objects" on storage.objects;
drop policy if exists "Customers can read own file expert objects" on storage.objects;
drop policy if exists "Staff can read customer files" on storage.objects;
drop policy if exists "Staff can upload customer files" on storage.objects;
drop policy if exists "Staff can read file expert objects" on storage.objects;
drop policy if exists "MG customer files select" on storage.objects;
drop policy if exists "MG customer files insert" on storage.objects;
drop policy if exists "MG customer files legacy owner insert" on storage.objects;
drop policy if exists "MG file expert select" on storage.objects;
drop policy if exists "MG file expert insert" on storage.objects;
drop policy if exists "MG file expert legacy owner insert" on storage.objects;
drop policy if exists "MG protected buckets select boundary" on storage.objects;
drop policy if exists "MG protected buckets insert boundary" on storage.objects;
drop policy if exists "MG protected buckets update boundary" on storage.objects;
drop policy if exists "MG protected buckets delete boundary" on storage.objects;
drop policy if exists "MG protected buckets anon select boundary" on storage.objects;
drop policy if exists "MG protected buckets anon insert boundary" on storage.objects;
drop policy if exists "MG protected buckets anon update boundary" on storage.objects;
drop policy if exists "MG protected buckets anon delete boundary" on storage.objects;

create policy "MG customer files select"
on storage.objects for select to authenticated
using (
  bucket_id = 'customer-files'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.has_staff_permission('files.download')
  )
);

create policy "MG customer files insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-files'
  and public.has_staff_permission('files.upload')
);

create policy "MG customer files legacy owner insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "MG file expert select"
on storage.objects for select to authenticated
using (
  bucket_id = 'file-expert'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.has_staff_permission('file_expert.manage')
  )
);

create policy "MG file expert legacy owner insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'file-expert'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "MG protected buckets select boundary"
on storage.objects as restrictive for select to authenticated
using (
  bucket_id not in ('customer-files', 'file-expert')
  or (
    bucket_id = 'customer-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_staff_permission('files.download')
    )
  )
  or (
    bucket_id = 'file-expert'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_staff_permission('file_expert.manage')
    )
  )
);

create policy "MG protected buckets insert boundary"
on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id not in ('customer-files', 'file-expert')
  or (
    bucket_id = 'customer-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_staff_permission('files.upload')
    )
  )
  or (
    bucket_id = 'file-expert'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

create policy "MG protected buckets update boundary"
on storage.objects as restrictive for update to authenticated
using (bucket_id not in ('customer-files', 'file-expert'))
with check (bucket_id not in ('customer-files', 'file-expert'));

create policy "MG protected buckets delete boundary"
on storage.objects as restrictive for delete to authenticated
using (bucket_id not in ('customer-files', 'file-expert'));

create policy "MG protected buckets anon select boundary"
on storage.objects as restrictive for select to anon
using (bucket_id not in ('customer-files', 'file-expert'));

create policy "MG protected buckets anon insert boundary"
on storage.objects as restrictive for insert to anon
with check (bucket_id not in ('customer-files', 'file-expert'));

create policy "MG protected buckets anon update boundary"
on storage.objects as restrictive for update to anon
using (bucket_id not in ('customer-files', 'file-expert'))
with check (bucket_id not in ('customer-files', 'file-expert'));

create policy "MG protected buckets anon delete boundary"
on storage.objects as restrictive for delete to anon
using (bucket_id not in ('customer-files', 'file-expert'));

update storage.buckets
set
  file_size_limit = 33554432,
  allowed_mime_types = array[
    'application/octet-stream',
    'application/x-binary',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain'
  ]::text[]
where id = 'file-expert';

update storage.buckets
set
  file_size_limit = 33554432,
  allowed_mime_types = array[
    'application/octet-stream',
    'application/x-binary',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]::text[]
where id = 'customer-files';

create or replace function public.log_order_credit_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance_after integer;
begin
  -- Only the hardened order-creation RPC may produce an order-usage ledger row.
  -- Direct service-role maintenance inserts must not manufacture a debit event.
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
    or p_credits_required <= 0
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

  v_expected_credits := public.resolve_request_service_credits(p_service_type);
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
  perform pg_catalog.set_config(
    'mg_autotech.order_credit_debit',
    '',
    true
  );

  return v_order_id;
end;
$$;

comment on function public.create_order_with_credit_deduction(
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) is
  'Caller-bound order creation. Credits are resolved from request_service_catalog; the client amount is only an equality guard.';

-- A browser may lose the RPC response after the database commits. Claim the
-- caller-provided UUID in the same transaction as the balance and ledger
-- writes so an exact retry returns its first result instead of charging twice.
create table public.staff_credit_adjustment_idempotency (
  idempotency_key uuid primary key,
  actor_id uuid not null,
  customer_id uuid not null,
  amount numeric not null,
  note text,
  transaction_id text,
  balance_after numeric,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint staff_credit_adjustment_amount_check
    check (
      amount <> 0
      and amount = pg_catalog.trunc(amount)
      and pg_catalog.abs(amount) <= 100000
    ),
  constraint staff_credit_adjustment_note_check
    check (pg_catalog.length(coalesce(note, '')) <= 1000),
  constraint staff_credit_adjustment_completion_check
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

alter table public.staff_credit_adjustment_idempotency enable row level security;
revoke all privileges on table public.staff_credit_adjustment_idempotency
  from public, anon, authenticated, service_role;
comment on table public.staff_credit_adjustment_idempotency is
  'Private atomic replay ledger for authenticated staff credit adjustments.';

create or replace function public.staff_adjust_customer_credits(
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
  v_claim public.staff_credit_adjustment_idempotency%rowtype;
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

  insert into public.staff_credit_adjustment_idempotency (
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
    from public.staff_credit_adjustment_idempotency as claim
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

  update public.staff_credit_adjustment_idempotency
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

comment on function public.staff_adjust_customer_credits(
  uuid,
  numeric,
  text,
  uuid
) is
  'Authenticated credits.manage adjustment with an atomic caller UUID claim and exact-replay result.';

-- Transitional compatibility for the application version that is live while
-- this migration is applied. The wrapper remains caller-bound and delegates
-- every mutation to the exact hardened implementation above. Migration 02449
-- disables this overload after the idempotent application has been deployed.
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
  if auth.uid() is null
    or not public.has_staff_permission('credits.manage') then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  return public.staff_adjust_customer_credits(
    p_customer_id,
    p_amount,
    p_note,
    pg_catalog.gen_random_uuid()
  );
end;
$$;

comment on function public.staff_adjust_customer_credits(
  uuid,
  numeric,
  text
) is
  'Temporary authenticated compatibility wrapper. Remove Data API access with migration 02449 after the idempotent application is deployed.';

-- Legacy aliases are retained for dependency compatibility but intentionally
-- receive no Data API grant. Their permission checks are defense in depth.
create or replace function public.admin_add_credits(
  p_customer_id uuid,
  p_credits integer,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance numeric;
begin
  if auth.uid() is null
    or not public.has_staff_permission('credits.manage') then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  if p_credits is null or p_credits <= 0 or p_credits > 100000 then
    raise exception using
      errcode = '22023',
      message = 'Credit amount must be positive and within the supported range.';
  end if;

  v_balance := public.staff_adjust_customer_credits(
    p_customer_id,
    p_credits,
    p_note
  );
  return v_balance::integer;
end;
$$;

create or replace function public.admin_adjust_customer_credits(
  p_customer_id uuid,
  p_amount integer,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance numeric;
begin
  if auth.uid() is null
    or not public.has_staff_permission('credits.manage') then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  v_balance := public.staff_adjust_customer_credits(
    p_customer_id,
    p_amount,
    p_note
  );
  return v_balance::integer;
end;
$$;

comment on function public.admin_add_credits(uuid, integer, text) is
  'Legacy private alias. Data API execution is revoked; use staff_adjust_customer_credits.';
comment on function public.admin_adjust_customer_credits(uuid, integer, text) is
  'Legacy private alias. Data API execution is revoked; use staff_adjust_customer_credits.';

create or replace function public.add_credits_from_stripe(
  p_user_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent text,
  p_customer_email text,
  p_package_id text,
  p_credits numeric,
  p_amount_total numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payment_records%rowtype;
  v_applied_payment public.credit_payments%rowtype;
  v_current_balance numeric;
  v_next_balance numeric;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'This operation requires the service role.';
  end if;

  if p_user_id is null
    or p_stripe_session_id is null
    or pg_catalog.length(pg_catalog.btrim(p_stripe_session_id)) not between 3 and 255
    or p_credits is null
    or p_credits <= 0
    or p_credits <> pg_catalog.trunc(p_credits)
    or p_credits > 100000
    or p_amount_total is null
    or p_amount_total < 0
    or p_amount_total <> pg_catalog.trunc(p_amount_total)
    or p_amount_total > 2147483647
    or p_currency is null
    or pg_catalog.lower(pg_catalog.btrim(p_currency)) !~ '^[a-z]{3}$' then
    raise exception using
      errcode = '22023',
      message = 'Stripe credit reconciliation input is invalid.';
  end if;

  select payment.*
  into v_payment
  from public.payment_records as payment
  where payment.provider = 'stripe'
    and payment.external_id = pg_catalog.btrim(p_stripe_session_id)
  for update;

  if not found then
    raise exception 'The Stripe payment record was not found.';
  end if;

  if not (
      (
        v_payment.status = 'requires_review'
        and v_payment.failure_code = 'stripe_credit_processing'
      )
      or (
        v_payment.status = 'pending'
        and v_payment.failure_code is null
      )
    )
    or v_payment.payment_type <> 'credit_purchase'
    or v_payment.user_id is distinct from p_user_id
    or v_payment.credits is distinct from p_credits
    or v_payment.amount_total::numeric is distinct from p_amount_total
    or pg_catalog.lower(v_payment.currency)
      is distinct from pg_catalog.lower(pg_catalog.btrim(p_currency))
    or v_payment.provider_payment_id
      is distinct from nullif(pg_catalog.btrim(p_stripe_payment_intent), '')
    or v_payment.package_id is distinct from p_package_id then
    raise exception using
      errcode = '22023',
      message = 'Stripe reconciliation does not match the authoritative payment record.';
  end if;

  -- Compatibility for an in-flight application deployment: the previous
  -- server version called this RPC while the authoritative row was still
  -- pending. Claim it under the same lock before any balance mutation.
  if v_payment.status = 'pending' then
    update public.payment_records
    set
      status = 'requires_review',
      failure_code = 'stripe_credit_processing',
      failure_message = null
    where id = v_payment.id
      and status = 'pending'
      and failure_code is null;
    if not found then
      raise exception 'The Stripe payment claim changed during reconciliation.';
    end if;
    v_payment.status := 'requires_review';
    v_payment.failure_code := 'stripe_credit_processing';
  end if;

  select applied.*
  into v_applied_payment
  from public.credit_payments as applied
  where applied.stripe_session_id = v_payment.external_id
  for update;

  if found then
    if v_applied_payment.user_id is distinct from v_payment.user_id
      or v_applied_payment.stripe_payment_intent
        is distinct from v_payment.provider_payment_id
      or v_applied_payment.package_id is distinct from v_payment.package_id
      or v_applied_payment.credits is distinct from v_payment.credits
      or v_applied_payment.amount_total::numeric
        is distinct from v_payment.amount_total::numeric
      or pg_catalog.lower(v_applied_payment.currency)
        is distinct from pg_catalog.lower(v_payment.currency)
      or v_applied_payment.status is distinct from 'paid' then
      raise exception using
        errcode = '22023',
        message = 'The existing Stripe credit application requires financial reconciliation.';
    end if;
    return;
  end if;

  if exists (
    select 1
    from public.credit_transactions as ledger
    where ledger.source_type = 'stripe_checkout'
      and ledger.source_id = v_payment.external_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'A Stripe ledger row exists without its credit payment record.';
  end if;

  select coalesce(profile.credit_balance, 0)
  into v_current_balance
  from public.profiles as profile
  where profile.id = v_payment.user_id
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

  v_next_balance := v_current_balance + v_payment.credits;
  if v_next_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The resulting balance is outside the supported range.';
  end if;

  insert into public.credit_payments (
    user_id,
    stripe_session_id,
    stripe_payment_intent,
    customer_email,
    package_id,
    credits,
    amount_total,
    currency,
    status
  )
  values (
    v_payment.user_id,
    v_payment.external_id,
    v_payment.provider_payment_id,
    v_payment.customer_email,
    v_payment.package_id,
    v_payment.credits,
    v_payment.amount_total,
    v_payment.currency,
    'paid'
  );

  update public.profiles
  set credit_balance = v_next_balance
  where id = v_payment.user_id;

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
    metadata
  )
  values (
    v_payment.user_id,
    'purchase',
    'stripe_checkout',
    v_payment.external_id,
    v_payment.credits::integer,
    v_next_balance::integer,
    v_payment.credits::text || ' credits purchased via Stripe.',
    v_payment.amount_total::integer,
    v_payment.currency,
    pg_catalog.jsonb_build_object(
      'payment_record_id', v_payment.id,
      'stripe_session_id', v_payment.external_id,
      'stripe_payment_intent', v_payment.provider_payment_id,
      'package_id', v_payment.package_id,
      'purchase_type', v_payment.purchase_type
    )
  );
end;
$$;

create or replace function public.admin_record_bank_payment(
  p_actor_user_id uuid,
  p_customer_user_id uuid,
  p_reference text,
  p_credits numeric,
  p_amount_total bigint,
  p_currency text default 'eur',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_balance numeric;
  v_next_balance numeric;
  v_new_payment_id uuid;
  v_new_ledger_id uuid;
  v_clean_reference text := pg_catalog.btrim(p_reference);
  v_currency text := pg_catalog.lower(pg_catalog.btrim(p_currency));
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'This operation requires the service role.';
  end if;

  if p_actor_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  perform 1
  from public.profiles as actor
  where actor.id = p_actor_user_id
    and (
      (actor.role = 'admin' and actor.staff_role = 'owner')
      or (
        actor.role = 'staff'
        and 'credits.manage' = any(actor.staff_permissions)
      )
    )
  for share;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  if p_customer_user_id is null
    or v_clean_reference is null
    or pg_catalog.length(v_clean_reference) not between 3 and 160
    or p_credits is null
    or p_credits <= 0
    or p_credits <> pg_catalog.trunc(p_credits)
    or p_credits > 100000
    or p_amount_total is null
    or p_amount_total <= 0
    or p_amount_total > 100000000
    or v_currency is null
    or v_currency !~ '^[a-z]{3}$'
    or pg_catalog.length(coalesce(p_note, '')) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'Bank payment input is invalid.';
  end if;

  select coalesce(profile.credit_balance, 0)
  into v_current_balance
  from public.profiles as profile
  where profile.id = p_customer_user_id
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

  v_next_balance := v_current_balance + p_credits;
  if v_next_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The resulting balance is outside the supported range.';
  end if;

  insert into public.payment_records (
    provider,
    external_id,
    provider_payment_id,
    user_id,
    status,
    payment_type,
    credits,
    amount_total,
    currency,
    credits_applied_at,
    reviewed_at,
    reviewed_by,
    review_note,
    metadata
  )
  values (
    'bank',
    v_clean_reference,
    v_clean_reference,
    p_customer_user_id,
    'succeeded',
    'manual_bank',
    p_credits,
    p_amount_total,
    v_currency,
    pg_catalog.now(),
    pg_catalog.now(),
    p_actor_user_id,
    nullif(pg_catalog.btrim(p_note), ''),
    pg_catalog.jsonb_build_object('recorded_by', p_actor_user_id)
  )
  returning id into v_new_payment_id;

  update public.profiles
  set credit_balance = v_next_balance
  where id = p_customer_user_id;

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
    p_customer_user_id,
    'purchase',
    'bank_transfer',
    v_clean_reference,
    p_credits::integer,
    v_next_balance::integer,
    coalesce(
      nullif(pg_catalog.btrim(p_note), ''),
      'Credits purchased via bank transfer.'
    ),
    p_amount_total::integer,
    v_currency,
    pg_catalog.jsonb_build_object('payment_record_id', v_new_payment_id),
    p_actor_user_id
  )
  returning id into v_new_ledger_id;

  insert into public.payment_event_log (
    payment_record_id,
    provider,
    event_type,
    status,
    message,
    payload
  )
  values (
    v_new_payment_id,
    'bank',
    'bank_payment_recorded',
    'processed',
    'Bank payment matched and credits applied.',
    pg_catalog.jsonb_build_object(
      'ledger_id', v_new_ledger_id,
      'actor_id', p_actor_user_id
    )
  );

  return pg_catalog.jsonb_build_object(
    'payment_id', v_new_payment_id,
    'ledger_id', v_new_ledger_id,
    'balance_after', v_next_balance
  );
exception
  when unique_violation then
    raise exception 'This bank reference has already been recorded.';
end;
$$;

create or replace function public.admin_apply_payment_refund(
  p_actor_user_id uuid,
  p_payment_record_id uuid,
  p_provider_refund_id text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payment_records%rowtype;
  v_current_balance numeric;
  v_next_balance numeric;
  v_new_ledger_id uuid;
  v_existing_ledger_id uuid;
  v_existing_balance integer;
  v_provider_refund_id text := pg_catalog.btrim(p_provider_refund_id);
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'This operation requires the service role.';
  end if;

  if p_actor_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  perform 1
  from public.profiles as actor
  where actor.id = p_actor_user_id
    and (
      (actor.role = 'admin' and actor.staff_role = 'owner')
      or (
        actor.role = 'staff'
        and 'credits.manage' = any(actor.staff_permissions)
      )
    )
  for share;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'Credit management permission is required.';
  end if;

  if p_payment_record_id is null
    or v_provider_refund_id is null
    or pg_catalog.length(v_provider_refund_id) not between 3 and 255
    or pg_catalog.length(coalesce(p_note, '')) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'Refund input is invalid.';
  end if;

  select payment.*
  into v_payment
  from public.payment_records as payment
  where payment.id = p_payment_record_id
  for update;

  if not found then
    raise exception 'Payment record was not found.';
  end if;
  if v_payment.status = 'refunded' then
    select ledger.id, ledger.balance_after
    into v_existing_ledger_id, v_existing_balance
    from public.credit_transactions as ledger
    where ledger.user_id = v_payment.user_id
      and ledger.source_type = v_payment.provider || '_refund'
      and ledger.source_id = v_provider_refund_id
      and ledger.metadata ->> 'payment_record_id' = v_payment.id::text
    limit 1;

    if not found then
      raise exception 'The refunded payment requires ledger reconciliation.';
    end if;

    return pg_catalog.jsonb_build_object(
      'ledger_id', v_existing_ledger_id,
      'balance_after', v_existing_balance,
      'duplicate', true
    );
  end if;
  if v_payment.status <> 'succeeded' then
    raise exception 'Only successful payments can be refunded.';
  end if;
  if v_payment.user_id is null
    or v_payment.credits <= 0
    or v_payment.credits <> pg_catalog.trunc(v_payment.credits)
    or v_payment.credits > 100000
    or v_payment.credits_applied_at is null
    or v_payment.amount_total is null
    or v_payment.amount_total < 0
    or v_payment.amount_total > 2147483647 then
    raise exception 'Payment has no valid reversible credit allocation.';
  end if;

  select coalesce(profile.credit_balance, 0)
  into v_current_balance
  from public.profiles as profile
  where profile.id = v_payment.user_id
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

  v_next_balance := v_current_balance - v_payment.credits;
  if v_next_balance not between -2147483648 and 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'The resulting balance is outside the supported range.';
  end if;

  update public.profiles
  set credit_balance = v_next_balance
  where id = v_payment.user_id;

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
    v_payment.user_id,
    'refund',
    v_payment.provider || '_refund',
    v_provider_refund_id,
    -v_payment.credits::integer,
    v_next_balance::integer,
    coalesce(
      nullif(pg_catalog.btrim(p_note), ''),
      'Payment refunded and purchased credits reversed.'
    ),
    -v_payment.amount_total::integer,
    v_payment.currency,
    pg_catalog.jsonb_build_object(
      'payment_record_id', v_payment.id,
      'provider_refund_id', v_provider_refund_id
    ),
    p_actor_user_id
  )
  returning id into v_new_ledger_id;

  update public.payment_records
  set
    status = 'refunded',
    refunded_at = pg_catalog.now(),
    reviewed_at = pg_catalog.now(),
    reviewed_by = p_actor_user_id,
    review_note = nullif(pg_catalog.btrim(p_note), '')
  where id = v_payment.id;

  insert into public.payment_event_log (
    payment_record_id,
    provider,
    event_type,
    status,
    message,
    payload
  )
  values (
    v_payment.id,
    v_payment.provider,
    'payment_refunded',
    'processed',
    'Provider refund completed and credits reversed.',
    pg_catalog.jsonb_build_object(
      'ledger_id', v_new_ledger_id,
      'provider_refund_id', v_provider_refund_id
    )
  );

  return pg_catalog.jsonb_build_object(
    'ledger_id', v_new_ledger_id,
    'balance_after', v_next_balance
  );
end;
$$;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Revoke every
-- overload of each financial/authority function first, then grant only the
-- reviewed browser or server entry points below.
do $$
declare
  target record;
begin
  for target in
    select procedure.oid::pg_catalog.regprocedure as signature
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname::text = any(array[
        'add_credits_from_stripe',
        'admin_add_credits',
        'admin_adjust_customer_credits',
        'admin_apply_payment_refund',
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
      ])
  loop
    execute pg_catalog.format(
      'alter function %s owner to postgres',
      target.signature
    );
    execute pg_catalog.format(
      'revoke all privileges on function %s from public, anon, authenticated, service_role',
      target.signature
    );
  end loop;
end;
$$;

grant execute on function public.has_staff_permission(text)
  to authenticated;
grant execute on function public.is_primary_owner()
  to authenticated;
grant execute on function public.is_admin()
  to authenticated;
grant execute on function public.staff_adjust_customer_credits(
  uuid,
  numeric,
  text
) to authenticated;
grant execute on function public.staff_adjust_customer_credits(
  uuid,
  numeric,
  text,
  uuid
) to authenticated;
grant execute on function public.create_order_with_credit_deduction(
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

grant execute on function public.add_credits_from_stripe(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text
) to service_role;
grant execute on function public.admin_record_bank_payment(
  uuid,
  uuid,
  text,
  numeric,
  bigint,
  text,
  text
) to service_role;
grant execute on function public.admin_apply_payment_refund(
  uuid,
  uuid,
  text,
  text
) to service_role;

comment on function public.add_credits_from_stripe(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text
) is
  'Service-role-only Stripe reconciliation. Values must match a locked payment_records row.';
comment on function public.admin_record_bank_payment(
  uuid,
  uuid,
  text,
  numeric,
  bigint,
  text,
  text
) is
  'Service-role-only bank reconciliation with explicit staff actor verification and locked balance update.';
comment on function public.admin_apply_payment_refund(
  uuid,
  uuid,
  text,
  text
) is
  'Service-role-only refund ledger reversal with explicit staff actor verification and locked rows.';

commit;
