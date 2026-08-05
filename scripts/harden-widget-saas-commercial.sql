-- MG AutoTech Widget SaaS commercial control center hardening.
-- Additive and non-destructive. Apply after:
--   1. scripts/add-vehicle-widget-saas.sql
--   2. scripts/add-widget-enquiries.sql

begin;

create index if not exists widget_access_logs_commercial_metrics_idx
  on public.widget_access_logs(client_id, status, path, created_at desc);

create index if not exists widget_enquiries_commercial_metrics_idx
  on public.widget_enquiries(client_id, status, created_at desc);

create index if not exists widget_audit_logs_client_idx
  on public.widget_audit_logs(client_id);

create index if not exists widget_audit_logs_actor_user_idx
  on public.widget_audit_logs(actor_user_id);

create index if not exists widget_api_keys_active_client_idx
  on public.widget_api_keys(client_id, created_at desc)
  where is_active = true and revoked_at is null;

create index if not exists widget_domain_requests_pending_client_idx
  on public.widget_domain_change_requests(client_id, created_at desc)
  where status = 'pending';

-- These constraints deliberately fail closed if legacy conflicts exist. Review
-- conflicts manually before applying this migration; no row is merged or removed.
create unique index if not exists widget_clients_one_live_domain_idx
  on public.widget_clients(lower(allowed_domain))
  where status <> 'cancelled';

create unique index if not exists widget_api_keys_one_active_per_client_idx
  on public.widget_api_keys(client_id)
  where is_active = true and revoked_at is null;

create unique index if not exists widget_domain_requests_one_pending_per_client_idx
  on public.widget_domain_change_requests(client_id)
  where status = 'pending';

create or replace function public.widget_admin_commercial_metrics(
  p_since timestamptz
) returns table (
  client_id uuid,
  usage_this_month bigint,
  blocked_this_month bigint,
  enquiries_this_month bigint,
  failed_enquiries_this_month bigint,
  pending_domain_request_count bigint,
  active_key_count bigint,
  last_allowed_at timestamptz,
  last_blocked_at timestamptz,
  last_enquiry_at timestamptz,
  latest_requested_domain text
)
language sql
stable
security invoker
set search_path = public
as $$
  with access_metrics as (
    select
      logs.client_id,
      count(*) filter (
        where logs.status = 'allowed'
          and logs.path in ('/api/widget/config', '/embed/vehicle-selector')
          and logs.created_at >= p_since
      ) as usage_this_month,
      count(*) filter (
        where logs.status = 'blocked' and logs.created_at >= p_since
      ) as blocked_this_month,
      max(logs.created_at) filter (where logs.status = 'allowed') as last_allowed_at,
      max(logs.created_at) filter (where logs.status = 'blocked') as last_blocked_at
    from public.widget_access_logs logs
    where logs.client_id is not null
    group by logs.client_id
  ), enquiry_metrics as (
    select
      enquiries.client_id,
      count(*) filter (where enquiries.created_at >= p_since) as enquiries_this_month,
      count(*) filter (
        where enquiries.status = 'delivery_failed' and enquiries.created_at >= p_since
      ) as failed_enquiries_this_month,
      max(enquiries.created_at) as last_enquiry_at
    from public.widget_enquiries enquiries
    group by enquiries.client_id
  ), key_metrics as (
    select keys.client_id, count(*) as active_key_count
    from public.widget_api_keys keys
    where keys.is_active = true and keys.revoked_at is null
    group by keys.client_id
  ), domain_metrics as (
    select
      requests.client_id,
      count(*) as pending_domain_request_count,
      (array_agg(requests.requested_domain order by requests.created_at desc))[1]
        as latest_requested_domain
    from public.widget_domain_change_requests requests
    where requests.status = 'pending'
    group by requests.client_id
  )
  select
    clients.id as client_id,
    coalesce(access_metrics.usage_this_month, 0)::bigint,
    coalesce(access_metrics.blocked_this_month, 0)::bigint,
    coalesce(enquiry_metrics.enquiries_this_month, 0)::bigint,
    coalesce(enquiry_metrics.failed_enquiries_this_month, 0)::bigint,
    coalesce(domain_metrics.pending_domain_request_count, 0)::bigint,
    coalesce(key_metrics.active_key_count, 0)::bigint,
    access_metrics.last_allowed_at,
    access_metrics.last_blocked_at,
    enquiry_metrics.last_enquiry_at,
    domain_metrics.latest_requested_domain
  from public.widget_clients clients
  left join access_metrics on access_metrics.client_id = clients.id
  left join enquiry_metrics on enquiry_metrics.client_id = clients.id
  left join key_metrics on key_metrics.client_id = clients.id
  left join domain_metrics on domain_metrics.client_id = clients.id;
$$;

create or replace function public.widget_rotate_installation_key(
  p_client_id uuid,
  p_public_key text
) returns table (
  id uuid,
  issued_public_key text
)
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  if p_public_key !~ '^pk_mga_widget_[A-Za-z0-9_-]{24}$' then
    raise exception 'invalid widget public key';
  end if;

  update public.widget_api_keys
  set is_active = false, revoked_at = now()
  where client_id = p_client_id
    and is_active = true;

  return query
  insert into public.widget_api_keys(client_id, public_key)
  values (p_client_id, p_public_key)
  returning widget_api_keys.id, widget_api_keys.public_key;
end;
$$;

create or replace function public.widget_resolve_domain_request(
  p_client_id uuid,
  p_request_id uuid,
  p_approved boolean,
  p_admin_note text default null,
  p_resolved_domain text default null
) returns table (
  request_id uuid,
  requested_domain text,
  resolution_status text
)
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  target public.widget_domain_change_requests%rowtype;
begin
  select * into target
  from public.widget_domain_change_requests
  where id = p_request_id
    and client_id = p_client_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'pending widget domain request not found';
  end if;

  if p_approved then
    if p_resolved_domain is null or p_resolved_domain = '' then
      raise exception 'approved widget domain is required';
    end if;
    update public.widget_clients
    set
      allowed_domain = p_resolved_domain,
      website_domain = p_resolved_domain,
      domain_verified = false
    where id = p_client_id;
  end if;

  update public.widget_domain_change_requests
  set
    status = case when p_approved then 'approved' else 'rejected' end,
    admin_note = p_admin_note,
    resolved_at = now()
  where id = p_request_id;

  return query
  select target.id, target.requested_domain,
    case when p_approved then 'approved'::text else 'rejected'::text end;
end;
$$;

create or replace function public.widget_audit_client_security_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if
    old.status is distinct from new.status or
    old.admin_suspended is distinct from new.admin_suspended or
    old.widget_enabled is distinct from new.widget_enabled or
    old.allowed_domain is distinct from new.allowed_domain or
    old.domain_verified is distinct from new.domain_verified
  then
    insert into public.widget_audit_logs(client_id, action, details)
    values (
      new.id,
      'system.client_security_state_changed',
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'old_widget_enabled', old.widget_enabled,
        'new_widget_enabled', new.widget_enabled,
        'old_admin_suspended', old.admin_suspended,
        'new_admin_suspended', new.admin_suspended,
        'old_domain', old.allowed_domain,
        'new_domain', new.allowed_domain,
        'old_domain_verified', old.domain_verified,
        'new_domain_verified', new.domain_verified
      )
    );
  elsif old is distinct from new then
    insert into public.widget_audit_logs(client_id, action, details)
    values (
      new.id,
      'system.client_configuration_changed',
      jsonb_build_object('recorded_at', now())
    );
  end if;
  return new;
end;
$$;

create or replace function public.widget_audit_key_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.is_active is distinct from new.is_active or old.revoked_at is distinct from new.revoked_at then
    insert into public.widget_audit_logs(client_id, action, details)
    values (
      new.client_id,
      case when tg_op = 'INSERT' then 'system.installation_key_issued' else 'system.installation_key_state_changed' end,
      jsonb_build_object('key_id', new.id, 'active', new.is_active, 'revoked', new.revoked_at is not null)
    );
  end if;
  return new;
end;
$$;

create or replace function public.widget_audit_domain_request_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.widget_audit_logs(client_id, action, details)
    values (
      new.client_id,
      case when tg_op = 'INSERT' then 'system.domain_request_created' else 'system.domain_request_resolved' end,
      jsonb_build_object('request_id', new.id, 'status', new.status, 'requested_domain', new.requested_domain)
    );
  end if;
  return new;
end;
$$;

create or replace function public.widget_audit_settings_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old is distinct from new then
    insert into public.widget_audit_logs(action, details)
    values ('system.global_widget_settings_changed', jsonb_build_object('recorded_at', now()));
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'widget_clients_security_audit') then
    create trigger widget_clients_security_audit
      after update on public.widget_clients
      for each row execute function public.widget_audit_client_security_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'widget_api_keys_lifecycle_audit') then
    create trigger widget_api_keys_lifecycle_audit
      after insert or update on public.widget_api_keys
      for each row execute function public.widget_audit_key_lifecycle();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'widget_domain_requests_lifecycle_audit') then
    create trigger widget_domain_requests_lifecycle_audit
      after insert or update on public.widget_domain_change_requests
      for each row execute function public.widget_audit_domain_request_lifecycle();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'widget_settings_lifecycle_audit') then
    create trigger widget_settings_lifecycle_audit
      after update on public.widget_settings
      for each row execute function public.widget_audit_settings_change();
  end if;
end;
$$;

alter table public.widget_settings enable row level security;
alter table public.widget_plans enable row level security;
alter table public.widget_clients enable row level security;
alter table public.widget_api_keys enable row level security;
alter table public.widget_access_logs enable row level security;
alter table public.widget_domain_change_requests enable row level security;
alter table public.widget_webhook_events enable row level security;
alter table public.widget_audit_logs enable row level security;
alter table public.widget_enquiries enable row level security;
alter table public.widget_rate_limit_buckets enable row level security;

-- The legacy timestamp trigger is retained, but its object resolution must be
-- deterministic and it must not remain directly callable by public roles.
alter function public.touch_widget_updated_at() set search_path = public;

-- Keep the legacy ownership policies efficient if direct customer access is
-- ever deliberately restored. The current release still revokes table grants.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'widget_clients'
      and policyname = 'widget_clients_own_select'
  ) then
    execute 'alter policy widget_clients_own_select on public.widget_clients using (user_id = (select auth.uid()))';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'widget_domain_change_requests'
      and policyname = 'widget_domain_requests_own_select'
  ) then
    execute 'alter policy widget_domain_requests_own_select on public.widget_domain_change_requests using (exists (select 1 from public.widget_clients c where c.id = widget_domain_change_requests.client_id and c.user_id = (select auth.uid())))';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'widget_domain_change_requests'
      and policyname = 'widget_domain_requests_own_insert'
  ) then
    execute 'alter policy widget_domain_requests_own_insert on public.widget_domain_change_requests with check (exists (select 1 from public.widget_clients c where c.id = widget_domain_change_requests.client_id and c.user_id = (select auth.uid())))';
  end if;
end;
$$;

revoke all on table public.widget_settings from public, anon, authenticated;
revoke all on table public.widget_plans from public, anon, authenticated;
revoke all on table public.widget_clients from public, anon, authenticated;
revoke all on table public.widget_api_keys from public, anon, authenticated;
revoke all on table public.widget_access_logs from public, anon, authenticated;
revoke all on table public.widget_domain_change_requests from public, anon, authenticated;
revoke all on table public.widget_webhook_events from public, anon, authenticated;
revoke all on table public.widget_audit_logs from public, anon, authenticated;
revoke all on table public.widget_enquiries from public, anon, authenticated;
revoke all on table public.widget_rate_limit_buckets from public, anon, authenticated;

grant all on table public.widget_settings to service_role;
grant all on table public.widget_plans to service_role;
grant all on table public.widget_clients to service_role;
grant all on table public.widget_api_keys to service_role;
grant all on table public.widget_access_logs to service_role;
grant all on table public.widget_domain_change_requests to service_role;
grant all on table public.widget_webhook_events to service_role;
grant all on table public.widget_audit_logs to service_role;
grant all on table public.widget_enquiries to service_role;
grant all on table public.widget_rate_limit_buckets to service_role;

revoke execute on function public.touch_widget_updated_at()
  from public, anon, authenticated;
grant execute on function public.touch_widget_updated_at()
  to service_role;

revoke execute on function public.widget_consume_rate_limit(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.widget_consume_rate_limit(uuid, integer)
  to service_role;

-- Older, otherwise compatible widget installations may not include the
-- optional retention helper. Harden it when present without making the
-- commercial migration depend on a maintenance-only routine.
do $$
begin
  if to_regprocedure('public.cleanup_widget_operational_data()') is not null then
    execute 'revoke execute on function public.cleanup_widget_operational_data() from public, anon, authenticated';
    execute 'grant execute on function public.cleanup_widget_operational_data() to service_role';
  end if;
end;
$$;

revoke execute on function public.widget_admin_commercial_metrics(timestamptz)
  from public, anon, authenticated;
grant execute on function public.widget_admin_commercial_metrics(timestamptz)
  to service_role;

revoke execute on function public.widget_rotate_installation_key(uuid, text)
  from public, anon, authenticated;
grant execute on function public.widget_rotate_installation_key(uuid, text)
  to service_role;

revoke execute on function public.widget_resolve_domain_request(uuid, uuid, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.widget_resolve_domain_request(uuid, uuid, boolean, text, text)
  to service_role;

revoke execute on function public.widget_audit_client_security_change()
  from public, anon, authenticated;
revoke execute on function public.widget_audit_key_lifecycle()
  from public, anon, authenticated;
revoke execute on function public.widget_audit_domain_request_lifecycle()
  from public, anon, authenticated;
revoke execute on function public.widget_audit_settings_change()
  from public, anon, authenticated;

commit;
