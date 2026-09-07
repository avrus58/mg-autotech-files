-- Additive, server-only report data. No existing order/profile grants are changed.
-- Rollback: deploy the prior app; leave these additive tables and issued history intact.
begin;

create table public.customer_report_branding (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  logo_path text,
  updated_at timestamptz not null default now(),
  constraint customer_report_logo_path check (
    logo_path is null or logo_path ~ ('^' || customer_id::text || '/profile/report-logo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$')
  )
);

create table public.service_report_details (
  order_id uuid not null references public.orders(id) on delete cascade,
  revision integer not null check (revision > 0),
  details jsonb not null check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 24000),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (order_id, revision)
);

create table public.service_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  revision integer not null check (revision > 0),
  source_input jsonb not null,
  snapshot jsonb not null,
  issued_by uuid not null,
  issued_at timestamptz not null default now(),
  unique (order_id, revision),
  constraint service_report_snapshot_object check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 64000)
);

alter table public.customer_report_branding enable row level security;
alter table public.service_report_details enable row level security;
alter table public.service_report_snapshots enable row level security;
revoke all on public.customer_report_branding, public.service_report_details, public.service_report_snapshots from public, anon, authenticated, service_role;
grant select, insert, update on public.customer_report_branding to service_role;
-- Details and issued snapshots are append-only for the application role.
grant select, insert on public.service_report_details, public.service_report_snapshots to service_role;

create function public.valid_service_report_details(p_details jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_key text;
  v_value jsonb;
  v_has_metric boolean := false;
begin
  if p_details is null or jsonb_typeof(p_details) <> 'object' or octet_length(p_details::text) > 24000 then return false; end if;
  if (select count(*) from jsonb_object_keys(p_details)) <> 8 or not (p_details ?& array['performedServices','beforeHp','afterHp','beforeNm','afterNm','metricSource','sourceNote','customerNote']) then return false; end if;
  if jsonb_typeof(p_details->'performedServices') <> 'array' then return false; end if;
  if jsonb_array_length(p_details->'performedServices') > 30 then return false; end if;
  for v_value in select value from jsonb_array_elements(p_details->'performedServices') loop
    if jsonb_typeof(v_value) <> 'string' or length(btrim(v_value#>>'{}')) not between 1 and 160 then return false; end if;
  end loop;
  foreach v_key in array array['beforeHp','afterHp','beforeNm','afterNm'] loop
    v_value := p_details->v_key;
    if jsonb_typeof(v_value) = 'null' then continue; end if;
    if jsonb_typeof(v_value) <> 'number' then return false; end if;
    if (v_value::text)::numeric < 0 or (v_value::text)::numeric > (case when v_key like '%Hp' then 5000 else 20000 end) then return false; end if;
    v_has_metric := true;
  end loop;
  if p_details->'metricSource' <> 'null'::jsonb and not (p_details->>'metricSource' = any(array['measured','datalog_estimate','catalog_reference','manually_declared'])) then return false; end if;
  foreach v_key in array array['sourceNote','customerNote'] loop
    if jsonb_typeof(p_details->v_key) <> 'string' or length(p_details->>v_key) > 2000 then return false; end if;
    if array_length(regexp_split_to_array(p_details->>v_key, E'\r\n|\r|\n'), 1) > 30 then return false; end if;
  end loop;
  if v_has_metric and (p_details->'metricSource' = 'null'::jsonb or length(btrim(p_details->>'sourceNote')) = 0) then return false; end if;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.valid_service_report_details(jsonb) from public, anon, authenticated;
grant execute on function public.valid_service_report_details(jsonb) to service_role;
alter table public.service_report_details add constraint service_report_details_valid check (public.valid_service_report_details(details));

create function public.save_service_report_details(p_order_id uuid, p_actor_id uuid, p_expected_revision integer, p_details jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_current public.service_report_details%rowtype;
  v_revision integer;
begin
  if p_actor_id is null then raise exception using errcode = 'SR404', message = 'Report not found'; end if;
  perform 1 from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'SR404', message = 'Report not found'; end if;
  if not public.valid_service_report_details(p_details) then raise exception using errcode = '22023', message = 'Invalid report details'; end if;
  select * into v_current from public.service_report_details where order_id = p_order_id order by revision desc limit 1;
  if p_expected_revision is null or coalesce(v_current.revision, 0) <> p_expected_revision then raise exception using errcode = 'SR412', message = 'Report revision changed'; end if;
  if v_current.details = p_details then return jsonb_build_object('revision', v_current.revision, 'details', v_current.details); end if;
  v_revision := coalesce(v_current.revision, 0) + 1;
  insert into public.service_report_details(order_id, revision, details, created_by) values (p_order_id, v_revision, p_details, p_actor_id);
  return jsonb_build_object('revision', v_revision, 'details', p_details);
end;
$$;

create function public.get_or_create_service_report(p_order_id uuid, p_actor_id uuid, p_allow_staff boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_profile public.profiles%rowtype;
  v_branding public.customer_report_branding%rowtype;
  v_detail public.service_report_details%rowtype;
  v_previous public.service_report_snapshots%rowtype;
  v_details jsonb;
  v_services jsonb;
  v_source jsonb;
  v_snapshot jsonb;
  v_id uuid;
  v_revision integer;
  v_issued_at timestamptz;
begin
  -- Same lock is held by detail saves; legacy status updates also lock this row.
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or p_actor_id is null or v_order.customer_id is null or (v_order.customer_id <> p_actor_id and p_allow_staff is distinct from true) then
    raise exception using errcode = 'SR404', message = 'Report not found';
  end if;
  if v_order.status is distinct from 'completed' then raise exception using errcode = 'SR409', message = 'Order is not completed'; end if;
  select * into v_profile from public.profiles where id = v_order.customer_id for share;
  if not found then raise exception using errcode = 'SR404', message = 'Report not found'; end if;
  select * into v_branding from public.customer_report_branding where customer_id = v_order.customer_id for share;
  select * into v_detail from public.service_report_details where order_id = p_order_id order by revision desc limit 1;
  v_details := coalesce(v_detail.details, '{"performedServices":[],"beforeHp":null,"afterHp":null,"beforeNm":null,"afterNm":null,"metricSource":null,"sourceNote":"","customerNote":""}'::jsonb);
  -- Reject oversized legacy labels before materializing/issuing a report; do not truncate scope.
  if length(coalesce(v_order.service_type, '')) > 51300 then raise exception using errcode = 'SR503', message = 'Report source exceeds bounds'; end if;
  select coalesce(jsonb_agg(btrim(label) order by ordinal), '[]'::jsonb) into v_services
    from regexp_split_to_table(coalesce(v_order.service_type, ''), '[,;+|]') with ordinality as labels(label, ordinal)
    where btrim(label) <> '';
  if jsonb_array_length(v_services) > 100 or exists (select 1 from jsonb_array_elements_text(v_services) as service(label) where length(label) > 512) then
    raise exception using errcode = 'SR503', message = 'Report source exceeds bounds';
  end if;
  -- Equality of this canonical JSONB is the input fingerprint. Never include issuance time.
  v_source := jsonb_build_object(
    'schemaVersion', 1, 'orderId', p_order_id, 'customerId', v_order.customer_id,
    'detailRevision', coalesce(v_detail.revision, 0),
    'workshop', jsonb_build_object('name', left(coalesce(nullif(btrim(v_profile.company_name), ''), nullif(btrim(v_profile.full_name), '')), 512), 'logoPath', v_branding.logo_path),
    'vehicle', jsonb_build_object('brand', left(v_order.vehicle_brand,512), 'model', left(v_order.vehicle_model,512), 'generation', left(v_order.vehicle_generation,512), 'engine', left(v_order.vehicle_engine,512), 'year', left(v_order.vehicle_year::text,512), 'ecu', left(v_order.ecu,512), 'gearbox', left(v_order.gearbox,512), 'licensePlate', left(v_order.license_plate,512)),
    'requestedServices', v_services, 'performedServices', v_details->'performedServices',
    'performance', jsonb_build_object('beforeHp',v_details->'beforeHp','afterHp',v_details->'afterHp','beforeNm',v_details->'beforeNm','afterNm',v_details->'afterNm','source',v_details->'metricSource','sourceNote',v_details->'sourceNote'),
    'customerNote', v_details->'customerNote'
  );
  select * into v_previous from public.service_report_snapshots where order_id = p_order_id order by revision desc limit 1;
  if v_previous.source_input = v_source then return v_previous.snapshot; end if;
  v_id := gen_random_uuid();
  v_revision := coalesce(v_previous.revision, 0) + 1;
  v_issued_at := clock_timestamp();
  v_snapshot := (v_source - 'detailRevision') || jsonb_build_object('id',v_id,'revision',v_revision,'issuedAt',to_char(v_issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  insert into public.service_report_snapshots(id,order_id,customer_id,revision,source_input,snapshot,issued_by,issued_at)
    values(v_id,p_order_id,v_order.customer_id,v_revision,v_source,v_snapshot,p_actor_id,v_issued_at);
  return v_snapshot;
end;
$$;

revoke all on function public.save_service_report_details(uuid,uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function public.get_or_create_service_report(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.save_service_report_details(uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.get_or_create_service_report(uuid,uuid,boolean) to service_role;
commit;
