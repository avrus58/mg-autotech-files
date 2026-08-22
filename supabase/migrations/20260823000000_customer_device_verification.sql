-- Server-enforced customer device verification.
--
-- Rollout is intentionally safe: the schema and restrictive policies are
-- installed in shadow mode. The matching application and HMAC secret must be
-- deployed and verified before service_role calls
-- activate_customer_device_assurance().

begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.customer_auth_assurance_config (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'shadow' check (mode in ('shadow', 'enforced')),
  enforce_after timestamptz,
  legacy_grace_until timestamptz,
  updated_at timestamptz not null default pg_catalog.now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint customer_auth_assurance_enforcement_window_check check (
    mode = 'shadow'
    or (
      enforce_after is not null
      and legacy_grace_until is not null
      and legacy_grace_until >= enforce_after
    )
  )
);

insert into public.customer_auth_assurance_config (singleton, mode)
values (true, 'shadow')
on conflict (singleton) do nothing;

create table public.customer_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hmac text not null unique,
  hmac_key_version smallint not null default 1 check (hmac_key_version > 0),
  device_label text not null,
  created_at timestamptz not null default pg_catalog.now(),
  last_used_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_reason text,
  unique (id, user_id),
  constraint customer_trusted_devices_token_hmac_check
    check (token_hmac ~ '^[a-f0-9]{64}$'),
  constraint customer_trusted_devices_label_check
    check (pg_catalog.length(device_label) between 1 and 120),
  constraint customer_trusted_devices_expiry_check
    check (expires_at > created_at),
  constraint customer_trusted_devices_revocation_check
    check (
      (revoked_at is null and revocation_reason is null)
      or (revoked_at is not null and revocation_reason is not null)
    )
);

create index customer_trusted_devices_user_active_idx
  on public.customer_trusted_devices(user_id, last_used_at desc)
  where revoked_at is null;
create index customer_trusted_devices_active_expiry_idx
  on public.customer_trusted_devices(expires_at)
  where revoked_at is null;

create table public.customer_session_assurance (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  trusted_device_id uuid,
  state text not null default 'pending' check (state in ('pending', 'verified', 'revoked')),
  verified_via text check (verified_via in ('trusted_device', 'email_code')),
  force_email_verification boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  last_checked_at timestamptz not null default pg_catalog.now(),
  verified_at timestamptz,
  assurance_expires_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  unique (session_id, user_id),
  constraint customer_session_assurance_device_owner_fkey
    foreign key (trusted_device_id, user_id)
    references public.customer_trusted_devices(id, user_id),
  constraint customer_session_assurance_state_check check (
    (
      state = 'pending'
      and verified_via is null
      and verified_at is null
      and assurance_expires_at is null
      and revoked_at is null
      and revocation_reason is null
    )
    or (
      state = 'verified'
      and verified_via is not null
      and verified_at is not null
      and assurance_expires_at is not null
      and assurance_expires_at > verified_at
      and revoked_at is null
      and revocation_reason is null
    )
    or (
      state = 'revoked'
      and revoked_at is not null
      and revocation_reason is not null
    )
  )
);

create index customer_session_assurance_user_state_idx
  on public.customer_session_assurance(user_id, state, last_checked_at desc);
create index customer_session_assurance_device_idx
  on public.customer_session_assurance(trusted_device_id)
  where trusted_device_id is not null;

create table public.customer_device_email_challenges (
  id uuid primary key,
  session_id uuid not null,
  user_id uuid not null,
  purpose text not null default 'new_device_login'
    check (purpose = 'new_device_login'),
  code_hmac text not null,
  hmac_key_version smallint not null default 1 check (hmac_key_version > 0),
  device_label text not null,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 5),
  max_attempts smallint not null default 5 check (max_attempts = 5),
  delivery_state text not null default 'prepared'
    check (delivery_state in ('prepared', 'sent', 'failed')),
  created_at timestamptz not null default pg_catalog.now(),
  issued_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  invalidated_reason text,
  foreign key (session_id, user_id)
    references public.customer_session_assurance(session_id, user_id)
    on delete cascade,
  constraint customer_device_challenge_code_hmac_check
    check (code_hmac ~ '^[a-f0-9]{64}$'),
  constraint customer_device_challenge_label_check
    check (pg_catalog.length(device_label) between 1 and 120),
  constraint customer_device_challenge_expiry_check
    check (expires_at > issued_at),
  constraint customer_device_challenge_completion_check
    check (not (consumed_at is not null and invalidated_at is not null))
);

create unique index customer_device_challenge_one_sent_session_idx
  on public.customer_device_email_challenges(session_id, purpose)
  where delivery_state = 'sent'
    and consumed_at is null
    and invalidated_at is null;
create unique index customer_device_challenge_one_prepared_session_idx
  on public.customer_device_email_challenges(session_id, purpose)
  where delivery_state = 'prepared'
    and consumed_at is null
    and invalidated_at is null;
create index customer_device_challenge_user_created_idx
  on public.customer_device_email_challenges(user_id, created_at desc);
create index customer_device_challenge_active_expiry_idx
  on public.customer_device_email_challenges(expires_at)
  where consumed_at is null and invalidated_at is null;

alter table public.customer_auth_assurance_config enable row level security;
alter table public.customer_trusted_devices enable row level security;
alter table public.customer_session_assurance enable row level security;
alter table public.customer_device_email_challenges enable row level security;

revoke all privileges on table public.customer_auth_assurance_config
  from public, anon, authenticated, service_role;
revoke all privileges on table public.customer_trusted_devices
  from public, anon, authenticated, service_role;
revoke all privileges on table public.customer_session_assurance
  from public, anon, authenticated, service_role;
revoke all privileges on table public.customer_device_email_challenges
  from public, anon, authenticated, service_role;
grant select on table public.customer_trusted_devices to service_role;

create or replace function app_private.current_customer_session_assured()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_text text;
  v_session_id uuid;
  v_mode text;
  v_enforce_after timestamptz;
  v_legacy_grace_until timestamptz;
  v_session_created_at timestamptz;
  v_role text;
  v_state text;
  v_expires_at timestamptz;
  v_force_email_verification boolean;
begin
  if v_user_id is null then
    return false;
  end if;

  select config.mode, config.enforce_after, config.legacy_grace_until
  into v_mode, v_enforce_after, v_legacy_grace_until
  from public.customer_auth_assurance_config as config
  where config.singleton;

  if not found then
    return false;
  end if;
  v_session_text := auth.jwt() ->> 'session_id';
  if v_session_text is null
    or v_session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_session_id := v_session_text::uuid;

  select profile.role
  into v_role
  from public.profiles as profile
  where profile.id = v_user_id;

  select
    assurance.state,
    assurance.assurance_expires_at,
    assurance.force_email_verification
  into v_state, v_expires_at, v_force_email_verification
  from public.customer_session_assurance as assurance
  where assurance.session_id = v_session_id
    and assurance.user_id = v_user_id;

  if found then
    if v_state = 'revoked' then
      return v_role in ('admin', 'staff');
    end if;
  end if;

  if v_mode = 'shadow'
    and not (
      v_state = 'pending'
      and coalesce(v_force_email_verification, false)
    ) then
    return true;
  end if;

  select session.created_at
  into v_session_created_at
  from auth.sessions as session
  where session.id = v_session_id
    and session.user_id = v_user_id;
  if not found then
    return false;
  end if;
  if v_role in ('admin', 'staff') then
    return true;
  end if;
  if v_state = 'pending' and coalesce(v_force_email_verification, false) then
    return false;
  end if;
  if v_state = 'verified' and v_expires_at > pg_catalog.now() then
    return true;
  end if;

  return v_enforce_after is not null
    and v_legacy_grace_until is not null
    and v_session_created_at < v_enforce_after
    and pg_catalog.now() < v_legacy_grace_until;
end;
$$;

alter function app_private.current_customer_session_assured() owner to postgres;
revoke all privileges on function app_private.current_customer_session_assured()
  from public, anon, authenticated, service_role;
grant usage on schema app_private to authenticated;
grant execute on function app_private.current_customer_session_assured()
  to authenticated;

create or replace function public.get_customer_session_assurance_state(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
  v_enforce_after timestamptz;
  v_legacy_grace_until timestamptz;
  v_session_created_at timestamptz;
  v_role text;
  v_state text;
  v_expires_at timestamptz;
  v_force_email_verification boolean;
begin
  if p_user_id is null or p_session_id is null then
    return pg_catalog.jsonb_build_object('status', 'required');
  end if;

  select config.mode, config.enforce_after, config.legacy_grace_until
  into v_mode, v_enforce_after, v_legacy_grace_until
  from public.customer_auth_assurance_config as config
  where config.singleton;
  if not found then
    raise exception 'Customer assurance configuration is unavailable.';
  end if;
  select profile.role
  into v_role
  from public.profiles as profile
  where profile.id = p_user_id;
  select
    assurance.state,
    assurance.assurance_expires_at,
    assurance.force_email_verification
  into v_state, v_expires_at, v_force_email_verification
  from public.customer_session_assurance as assurance
  where assurance.session_id = p_session_id
    and assurance.user_id = p_user_id;

  if found and v_state = 'revoked' then
    return pg_catalog.jsonb_build_object(
      'status',
      case when v_role in ('admin', 'staff') then 'not_required' else 'revoked' end
    );
  end if;
  if v_mode = 'shadow'
    and not (
      v_state = 'pending'
      and coalesce(v_force_email_verification, false)
    ) then
    return pg_catalog.jsonb_build_object('status', 'not_required');
  end if;

  select session.created_at
  into v_session_created_at
  from auth.sessions as session
  where session.id = p_session_id
    and session.user_id = p_user_id;
  if not found then
    return pg_catalog.jsonb_build_object('status', 'required');
  end if;
  if v_role in ('admin', 'staff') then
    return pg_catalog.jsonb_build_object('status', 'not_required');
  end if;
  if v_state = 'pending' and coalesce(v_force_email_verification, false) then
    return pg_catalog.jsonb_build_object('status', 'required');
  end if;
  if v_state = 'verified' and v_expires_at > pg_catalog.now() then
    return pg_catalog.jsonb_build_object('status', 'verified');
  end if;

  if v_enforce_after is not null
    and v_legacy_grace_until is not null
    and v_session_created_at < v_enforce_after
    and pg_catalog.now() < v_legacy_grace_until then
    return pg_catalog.jsonb_build_object('status', 'verified');
  end if;

  return pg_catalog.jsonb_build_object('status', 'required');
end;
$$;

create or replace function public.prepare_customer_password_change_verification(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assurance public.customer_session_assurance%rowtype;
  v_now timestamptz := pg_catalog.now();
begin
  if p_user_id is null or p_session_id is null or not exists (
    select 1
    from auth.sessions as session
    where session.id = p_session_id and session.user_id = p_user_id
  ) then
    return pg_catalog.jsonb_build_object('status', 'required');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('customer-device:' || p_user_id::text, 0)
  );

  select assurance.*
  into v_assurance
  from public.customer_session_assurance as assurance
  where assurance.session_id = p_session_id
    and assurance.user_id = p_user_id
  for update;

  if found and v_assurance.state = 'revoked' then
    return pg_catalog.jsonb_build_object('status', 'revoked');
  end if;
  if found
    and v_assurance.state = 'verified'
    and v_assurance.verified_via = 'email_code'
    and v_assurance.verified_at > v_now - interval '15 minutes'
    and v_assurance.assurance_expires_at > v_now then
    return pg_catalog.jsonb_build_object('status', 'verified');
  end if;

  if found and v_assurance.state = 'pending' then
    update public.customer_session_assurance
    set force_email_verification = true, last_checked_at = v_now
    where session_id = p_session_id and user_id = p_user_id;
    return pg_catalog.jsonb_build_object('status', 'required');
  end if;

  insert into public.customer_session_assurance (
    session_id, user_id, state, force_email_verification, last_checked_at
  ) values (
    p_session_id, p_user_id, 'pending', true, v_now
  )
  on conflict (session_id) do update set
    user_id = excluded.user_id,
    trusted_device_id = null,
    state = 'pending',
    force_email_verification = true,
    verified_via = null,
    verified_at = null,
    assurance_expires_at = null,
    last_checked_at = excluded.last_checked_at,
    revoked_at = null,
    revocation_reason = null;

  update public.customer_device_email_challenges
  set
    invalidated_at = v_now,
    invalidated_reason = 'password_change_reverification'
  where session_id = p_session_id
    and user_id = p_user_id
    and consumed_at is null
    and invalidated_at is null;

  return pg_catalog.jsonb_build_object('status', 'required');
end;
$$;

create or replace function public.customer_password_change_verification_state(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'verified', exists (
      select 1
      from auth.sessions as session
      join public.customer_session_assurance as assurance
        on assurance.session_id = session.id
       and assurance.user_id = session.user_id
      where session.id = p_session_id
        and session.user_id = p_user_id
        and assurance.state = 'verified'
        and assurance.verified_via = 'email_code'
        and assurance.verified_at > pg_catalog.now() - interval '15 minutes'
        and assurance.assurance_expires_at > pg_catalog.now()
    )
  );
$$;

create or replace function public.assure_customer_session_from_trusted_device(
  p_user_id uuid,
  p_session_id uuid,
  p_token_hmac text,
  p_hmac_key_version smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.customer_trusted_devices%rowtype;
begin
  if p_token_hmac is null
    or p_token_hmac !~ '^[a-f0-9]{64}$'
    or p_hmac_key_version is null
    or p_hmac_key_version <= 0 then
    return pg_catalog.jsonb_build_object('verified', false);
  end if;
  if not exists (
    select 1 from auth.sessions as session
    where session.id = p_session_id and session.user_id = p_user_id
  ) then
    return pg_catalog.jsonb_build_object('verified', false);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('customer-device:' || p_user_id::text, 0)
  );

  if exists (
    select 1
    from public.customer_session_assurance as assurance
    where assurance.session_id = p_session_id
      and assurance.user_id = p_user_id
      and assurance.state = 'pending'
      and assurance.force_email_verification
  ) then
    return pg_catalog.jsonb_build_object('verified', false);
  end if;

  select device.*
  into v_device
  from public.customer_trusted_devices as device
  where device.user_id = p_user_id
    and device.token_hmac = p_token_hmac
    and device.hmac_key_version = p_hmac_key_version
    and device.revoked_at is null
    and device.expires_at > pg_catalog.now()
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('verified', false);
  end if;

  update public.customer_trusted_devices
  set last_used_at = pg_catalog.now()
  where id = v_device.id;

  insert into public.customer_session_assurance (
    session_id, user_id, trusted_device_id, state, verified_via,
    verified_at, assurance_expires_at, last_checked_at
  ) values (
    p_session_id, p_user_id, v_device.id, 'verified', 'trusted_device',
    pg_catalog.now(), v_device.expires_at, pg_catalog.now()
  )
  on conflict (session_id) do update set
    user_id = excluded.user_id,
    trusted_device_id = excluded.trusted_device_id,
    state = 'verified',
    verified_via = 'trusted_device',
    verified_at = excluded.verified_at,
    assurance_expires_at = excluded.assurance_expires_at,
    last_checked_at = excluded.last_checked_at,
    revoked_at = null,
    revocation_reason = null;

  update public.customer_device_email_challenges
  set invalidated_at = pg_catalog.now(), invalidated_reason = 'trusted_device'
  where session_id = p_session_id
    and user_id = p_user_id
    and consumed_at is null
    and invalidated_at is null;

  return pg_catalog.jsonb_build_object('verified', true);
end;
$$;

create or replace function public.reserve_customer_device_challenge(
  p_user_id uuid,
  p_session_id uuid,
  p_challenge_id uuid,
  p_code_hmac text,
  p_hmac_key_version smallint,
  p_device_label text,
  p_force_resend boolean,
  p_previous_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assurance public.customer_session_assurance%rowtype;
  v_active public.customer_device_email_challenges%rowtype;
  v_prepared public.customer_device_email_challenges%rowtype;
  v_recent_count integer;
  v_daily_count integer;
  v_oldest_recent timestamptz;
  v_oldest_daily timestamptz;
  v_retry integer;
  v_latest_issued_at timestamptz;
  v_now timestamptz := pg_catalog.now();
begin
  if p_user_id is null
    or p_session_id is null
    or p_challenge_id is null
    or p_code_hmac is null
    or p_code_hmac !~ '^[a-f0-9]{64}$'
    or p_hmac_key_version is null
    or p_hmac_key_version <= 0
    or p_device_label is null
    or pg_catalog.length(pg_catalog.btrim(p_device_label)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid device challenge input.';
  end if;
  if not exists (
    select 1 from auth.sessions as session
    where session.id = p_session_id and session.user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'The authenticated session is unavailable.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('customer-device:' || p_user_id::text, 0)
  );

  select assurance.*
  into v_assurance
  from public.customer_session_assurance as assurance
  where assurance.session_id = p_session_id
    and assurance.user_id = p_user_id
  for update;
  if found and v_assurance.state = 'revoked' then
    return pg_catalog.jsonb_build_object('status', 'revoked');
  end if;
  if found and v_assurance.state = 'verified'
    and v_assurance.assurance_expires_at > v_now then
    return pg_catalog.jsonb_build_object('status', 'verified');
  end if;
  if found then
    update public.customer_session_assurance
    set
      trusted_device_id = null,
      state = 'pending',
      verified_via = null,
      verified_at = null,
      assurance_expires_at = null,
      last_checked_at = v_now,
      revoked_at = null,
      revocation_reason = null
    where session_id = p_session_id and user_id = p_user_id;
  else
    insert into public.customer_session_assurance (
      session_id, user_id, state, last_checked_at
    ) values (
      p_session_id, p_user_id, 'pending', v_now
    );
  end if;

  update public.customer_device_email_challenges
  set
    invalidated_at = v_now,
    invalidated_reason = case
      when expires_at <= v_now then 'expired'
      else 'delivery_confirmation_timeout'
    end
  where session_id = p_session_id
    and user_id = p_user_id
    and consumed_at is null
    and invalidated_at is null
    and (
      expires_at <= v_now
      or (delivery_state = 'prepared' and issued_at <= v_now - interval '2 minutes')
    );

  select challenge.*
  into v_active
  from public.customer_device_email_challenges as challenge
  where challenge.session_id = p_session_id
    and challenge.user_id = p_user_id
    and challenge.delivery_state = 'sent'
    and challenge.consumed_at is null
    and challenge.invalidated_at is null
  for update;

  if found then
    v_retry := greatest(
      0,
      60 - pg_catalog.floor(pg_catalog.extract(epoch from (v_now - v_active.issued_at)))::integer
    );
    if not coalesce(p_force_resend, false) then
      return pg_catalog.jsonb_build_object(
        'status', 'existing_sent',
        'challenge_id', v_active.id,
        'expires_at', v_active.expires_at,
        'retry_after_seconds', v_retry,
        'can_verify', true
      );
    end if;
    if p_previous_challenge_id is distinct from v_active.id then
      return pg_catalog.jsonb_build_object(
        'status', 'stale_challenge',
        'challenge_id', v_active.id,
        'expires_at', v_active.expires_at,
        'retry_after_seconds', v_retry,
        'can_verify', true
      );
    end if;
    if v_retry > 0 then
      return pg_catalog.jsonb_build_object(
        'status', 'rate_limited',
        'challenge_id', v_active.id,
        'expires_at', v_active.expires_at,
        'retry_after_seconds', v_retry,
        'can_verify', true
      );
    end if;
  end if;

  select challenge.*
  into v_prepared
  from public.customer_device_email_challenges as challenge
  where challenge.session_id = p_session_id
    and challenge.user_id = p_user_id
    and challenge.delivery_state = 'prepared'
    and challenge.consumed_at is null
    and challenge.invalidated_at is null
  for update;
  if found then
    return pg_catalog.jsonb_build_object(
      'status', 'delivery_pending',
      'challenge_id', v_prepared.id,
      'expires_at', v_prepared.expires_at,
      'retry_after_seconds', 60,
      'can_verify', false
    );
  end if;

  select pg_catalog.max(challenge.issued_at)
  into v_latest_issued_at
  from public.customer_device_email_challenges as challenge
  where challenge.user_id = p_user_id;
  if v_latest_issued_at is not null then
    v_retry := greatest(
      0,
      60 - pg_catalog.floor(pg_catalog.extract(epoch from (v_now - v_latest_issued_at)))::integer
    );
    if v_retry > 0 then
      return pg_catalog.jsonb_build_object(
        'status', 'rate_limited',
        'retry_after_seconds', v_retry,
        'can_verify', false
      );
    end if;
  end if;

  select pg_catalog.count(*)::integer, pg_catalog.min(challenge.created_at)
  into v_recent_count, v_oldest_recent
  from public.customer_device_email_challenges as challenge
  where challenge.user_id = p_user_id
    and challenge.created_at > v_now - interval '15 minutes';
  if v_recent_count >= 3 then
    v_retry := greatest(
      1,
      pg_catalog.ceil(
        pg_catalog.extract(epoch from (v_oldest_recent + interval '15 minutes' - v_now))
      )::integer
    );
    return pg_catalog.jsonb_build_object(
      'status', 'rate_limited',
      'challenge_id', case when v_active.id is not null then v_active.id else null end,
      'expires_at', case when v_active.id is not null then v_active.expires_at else null end,
      'retry_after_seconds', v_retry,
      'can_verify', v_active.id is not null
    );
  end if;

  select pg_catalog.count(*)::integer, pg_catalog.min(challenge.created_at)
  into v_daily_count, v_oldest_daily
  from public.customer_device_email_challenges as challenge
  where challenge.user_id = p_user_id
    and challenge.created_at > v_now - interval '24 hours';
  if v_daily_count >= 12 then
    v_retry := greatest(
      1,
      pg_catalog.ceil(
        pg_catalog.extract(epoch from (v_oldest_daily + interval '24 hours' - v_now))
      )::integer
    );
    return pg_catalog.jsonb_build_object(
      'status', 'rate_limited',
      'challenge_id', case when v_active.id is not null then v_active.id else null end,
      'expires_at', case when v_active.id is not null then v_active.expires_at else null end,
      'retry_after_seconds', v_retry,
      'can_verify', v_active.id is not null
    );
  end if;

  begin
    insert into public.customer_device_email_challenges (
      id, session_id, user_id, code_hmac, hmac_key_version, device_label,
      delivery_state, created_at, issued_at, expires_at
    ) values (
      p_challenge_id,
      p_session_id,
      p_user_id,
      p_code_hmac,
      p_hmac_key_version,
      pg_catalog.btrim(p_device_label),
      'prepared',
      v_now,
      v_now,
      v_now + interval '10 minutes'
    );
  exception
    when unique_violation then
      select challenge.*
      into v_active
      from public.customer_device_email_challenges as challenge
      where challenge.session_id = p_session_id
        and challenge.user_id = p_user_id
        and challenge.delivery_state = 'prepared'
        and challenge.consumed_at is null
        and challenge.invalidated_at is null;
      return pg_catalog.jsonb_build_object(
        'status', 'delivery_pending',
        'challenge_id', v_active.id,
        'expires_at', v_active.expires_at,
        'retry_after_seconds', 60,
        'can_verify', false
      );
  end;

  return pg_catalog.jsonb_build_object(
    'status', 'reserved',
    'challenge_id', p_challenge_id,
    'issued_at', v_now,
    'expires_at', v_now + interval '10 minutes',
    'retry_after_seconds', 60
  );
end;
$$;

create or replace function public.mark_customer_device_challenge_sent(
  p_user_id uuid,
  p_session_id uuid,
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge public.customer_device_email_challenges%rowtype;
begin
  select challenge.*
  into v_challenge
  from public.customer_device_email_challenges as challenge
  where challenge.id = p_challenge_id
    and challenge.session_id = p_session_id
    and challenge.user_id = p_user_id
  for update;
  if not found
    or v_challenge.consumed_at is not null
    or v_challenge.invalidated_at is not null
    or v_challenge.expires_at <= pg_catalog.now() then
    return pg_catalog.jsonb_build_object('sent', false);
  end if;
  if v_challenge.delivery_state = 'sent' then
    return pg_catalog.jsonb_build_object('sent', true);
  end if;
  if v_challenge.delivery_state <> 'prepared' then
    return pg_catalog.jsonb_build_object('sent', false);
  end if;

  update public.customer_device_email_challenges
  set invalidated_at = pg_catalog.now(), invalidated_reason = 'resend_replaced'
  where session_id = p_session_id
    and user_id = p_user_id
    and purpose = v_challenge.purpose
    and id <> p_challenge_id
    and delivery_state = 'sent'
    and consumed_at is null
    and invalidated_at is null;

  update public.customer_device_email_challenges
  set delivery_state = 'sent'
  where id = p_challenge_id
    and session_id = p_session_id
    and user_id = p_user_id
    and delivery_state = 'prepared'
    and consumed_at is null
    and invalidated_at is null
    and expires_at > pg_catalog.now();
  if not found then
    raise exception 'The prepared device challenge could not be activated.';
  end if;
  return pg_catalog.jsonb_build_object('sent', true);
end;
$$;

create or replace function public.invalidate_customer_device_challenge(
  p_user_id uuid,
  p_session_id uuid,
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customer_device_email_challenges
  set
    delivery_state = 'failed',
    invalidated_at = pg_catalog.now(),
    invalidated_reason = 'delivery_failed'
  where id = p_challenge_id
    and session_id = p_session_id
    and user_id = p_user_id
    and consumed_at is null
    and invalidated_at is null;
  return pg_catalog.jsonb_build_object('invalidated', found);
end;
$$;

create or replace function public.consume_customer_device_challenge(
  p_user_id uuid,
  p_session_id uuid,
  p_challenge_id uuid,
  p_code_hmac text,
  p_hmac_key_version smallint,
  p_token_hmac text,
  p_device_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assurance public.customer_session_assurance%rowtype;
  v_challenge public.customer_device_email_challenges%rowtype;
  v_device_id uuid;
  v_now timestamptz := pg_catalog.now();
  v_attempts smallint;
begin
  if p_code_hmac is null
    or p_code_hmac !~ '^[a-f0-9]{64}$'
    or p_hmac_key_version is null
    or p_hmac_key_version <= 0
    or (p_token_hmac is not null and p_token_hmac !~ '^[a-f0-9]{64}$')
    or p_device_label is null
    or pg_catalog.length(pg_catalog.btrim(p_device_label)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid device verification input.';
  end if;
  if not exists (
    select 1 from auth.sessions as session
    where session.id = p_session_id and session.user_id = p_user_id
  ) then
    return pg_catalog.jsonb_build_object('status', 'missing', 'attempts_remaining', 0);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('customer-device:' || p_user_id::text, 0)
  );

  select assurance.*
  into v_assurance
  from public.customer_session_assurance as assurance
  where assurance.session_id = p_session_id
    and assurance.user_id = p_user_id
  for update;
  if not found or v_assurance.state = 'revoked' then
    return pg_catalog.jsonb_build_object('status', 'missing', 'attempts_remaining', 0);
  end if;

  select challenge.*
  into v_challenge
  from public.customer_device_email_challenges as challenge
  where challenge.id = p_challenge_id
    and challenge.session_id = p_session_id
    and challenge.user_id = p_user_id
    and challenge.hmac_key_version = p_hmac_key_version
  for update;
  if not found or v_challenge.consumed_at is not null or v_challenge.invalidated_at is not null then
    return pg_catalog.jsonb_build_object('status', 'missing', 'attempts_remaining', 0);
  end if;
  if v_challenge.delivery_state <> 'sent' then
    return pg_catalog.jsonb_build_object(
      'status', 'missing',
      'attempts_remaining', v_challenge.max_attempts - v_challenge.attempt_count
    );
  end if;
  if v_challenge.expires_at <= v_now then
    update public.customer_device_email_challenges
    set invalidated_at = v_now, invalidated_reason = 'expired'
    where id = v_challenge.id;
    return pg_catalog.jsonb_build_object('status', 'expired', 'attempts_remaining', 0);
  end if;
  if v_challenge.attempt_count >= v_challenge.max_attempts then
    return pg_catalog.jsonb_build_object('status', 'locked', 'attempts_remaining', 0);
  end if;

  if v_challenge.code_hmac is distinct from p_code_hmac then
    v_attempts := v_challenge.attempt_count + 1;
    update public.customer_device_email_challenges
    set
      attempt_count = v_attempts,
      invalidated_at = case when v_attempts >= max_attempts then v_now else null end,
      invalidated_reason = case when v_attempts >= max_attempts then 'attempts_exhausted' else null end
    where id = v_challenge.id;
    return pg_catalog.jsonb_build_object(
      'status', case when v_attempts >= v_challenge.max_attempts then 'locked' else 'invalid' end,
      'attempts_remaining', greatest(0, v_challenge.max_attempts - v_attempts)
    );
  end if;

  if p_token_hmac is not null then
    insert into public.customer_trusted_devices (
      user_id, token_hmac, hmac_key_version, device_label,
      created_at, last_used_at, expires_at
    ) values (
      p_user_id,
      p_token_hmac,
      p_hmac_key_version,
      pg_catalog.btrim(p_device_label),
      v_now,
      v_now,
      v_now + interval '30 days'
    )
    returning id into v_device_id;
  end if;

  update public.customer_device_email_challenges
  set consumed_at = v_now
  where id = v_challenge.id
    and consumed_at is null
    and invalidated_at is null;
  if not found then
    return pg_catalog.jsonb_build_object('status', 'missing', 'attempts_remaining', 0);
  end if;

  update public.customer_session_assurance
  set
    trusted_device_id = v_device_id,
    state = 'verified',
    verified_via = 'email_code',
    force_email_verification = false,
    verified_at = v_now,
    assurance_expires_at = v_now + interval '30 days',
    last_checked_at = v_now,
    revoked_at = null,
    revocation_reason = null
  where session_id = p_session_id
    and user_id = p_user_id;

  update public.customer_device_email_challenges
  set invalidated_at = v_now, invalidated_reason = 'verified_sibling'
  where session_id = p_session_id
    and user_id = p_user_id
    and id <> v_challenge.id
    and consumed_at is null
    and invalidated_at is null;

  return pg_catalog.jsonb_build_object(
    'status', 'verified',
    'device_id', v_device_id,
    'trusted_until', v_now + interval '30 days'
  );
end;
$$;

create or replace function public.revoke_customer_trusted_device(
  p_user_id uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessions uuid[];
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('customer-device:' || p_user_id::text, 0)
  );

  update public.customer_trusted_devices
  set revoked_at = pg_catalog.now(), revocation_reason = 'customer_revoked'
  where id = p_device_id
    and user_id = p_user_id
    and revoked_at is null;
  if not found then
    return pg_catalog.jsonb_build_object('revoked', false);
  end if;

  select pg_catalog.array_agg(assurance.session_id)
  into v_sessions
  from public.customer_session_assurance as assurance
  where assurance.user_id = p_user_id
    and assurance.trusted_device_id = p_device_id
    and assurance.state <> 'revoked';

  update public.customer_session_assurance
  set
    state = 'revoked',
    revoked_at = pg_catalog.now(),
    revocation_reason = 'trusted_device_revoked'
  where user_id = p_user_id
    and trusted_device_id = p_device_id
    and state <> 'revoked';

  if v_sessions is not null then
    update public.customer_device_email_challenges
    set invalidated_at = pg_catalog.now(), invalidated_reason = 'trusted_device_revoked'
    where user_id = p_user_id
      and session_id = any(v_sessions)
      and consumed_at is null
      and invalidated_at is null;
  end if;
  return pg_catalog.jsonb_build_object('revoked', true);
end;
$$;

create or replace function public.revoke_other_customer_trusted_devices(
  p_user_id uuid,
  p_current_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device record;
  v_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('customer-device:' || p_user_id::text, 0)
  );

  for v_device in
    select device.id
    from public.customer_trusted_devices as device
    where device.user_id = p_user_id
      and device.revoked_at is null
      and (p_current_device_id is null or device.id <> p_current_device_id)
    order by device.id
    for update
  loop
    perform public.revoke_customer_trusted_device(p_user_id, v_device.id);
    v_count := v_count + 1;
  end loop;
  return pg_catalog.jsonb_build_object('revoked', true, 'count', v_count);
end;
$$;

create or replace function public.revoke_all_customer_trusted_devices(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('customer-device:' || p_user_id::text, 0)
  );

  update public.customer_trusted_devices
  set revoked_at = pg_catalog.now(), revocation_reason = 'account_security_reset'
  where user_id = p_user_id and revoked_at is null;

  insert into public.customer_session_assurance (
    session_id, user_id, state, revoked_at, revocation_reason, last_checked_at
  )
  select
    session.id,
    p_user_id,
    'revoked',
    pg_catalog.now(),
    'account_security_reset',
    pg_catalog.now()
  from auth.sessions as session
  where session.user_id = p_user_id
  on conflict (session_id) do update set
    state = 'revoked',
    revoked_at = excluded.revoked_at,
    revocation_reason = excluded.revocation_reason,
    last_checked_at = excluded.last_checked_at;

  update public.customer_device_email_challenges
  set invalidated_at = pg_catalog.now(), invalidated_reason = 'account_security_reset'
  where user_id = p_user_id
    and consumed_at is null
    and invalidated_at is null;

  return pg_catalog.jsonb_build_object('revoked', true);
end;
$$;

create or replace function app_private.assert_customer_device_assurance_ready()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_missing text;
  v_signature text;
  v_relation text;
  v_operation text;
  v_function regprocedure;
  v_security_definer boolean;
  v_fixed_path boolean;
  v_definition text;
begin
  select pg_catalog.string_agg(expected.policy_name, ', ' order by expected.policy_name)
  into v_missing
  from (values
    ('public', 'profiles', 'MG assured customer profile select boundary', 'SELECT', true, false, false),
    ('public', 'profiles', 'MG assured customer profile update boundary', 'UPDATE', true, true, false),
    ('public', 'orders', 'MG assured customer order select boundary', 'SELECT', true, false, false),
    ('public', 'credit_transactions', 'MG assured customer credit select boundary', 'SELECT', true, false, false),
    ('public', 'notifications', 'MG assured customer notifications select boundary', 'SELECT', true, false, false),
    ('public', 'notifications', 'MG assured customer notifications update boundary', 'UPDATE', true, true, false),
    ('public', 'growth_customer_preferences', 'MG assured customer growth_customer_preferences select boundary', 'SELECT', true, false, false),
    ('public', 'widget_clients', 'MG assured customer widget_clients select boundary', 'SELECT', true, false, false),
    ('public', 'widget_domain_change_requests', 'MG assured customer widget_domain_change_requests select boundary', 'SELECT', true, false, false),
    ('public', 'widget_domain_change_requests', 'MG assured customer widget_domain_change_requests insert boundary', 'INSERT', false, true, false),
    ('storage', 'objects', 'MG protected buckets assured select boundary', 'SELECT', true, false, true),
    ('storage', 'objects', 'MG protected buckets assured insert boundary', 'INSERT', false, true, true),
    ('storage', 'objects', 'MG protected buckets assured update boundary', 'UPDATE', true, true, true),
    ('storage', 'objects', 'MG protected buckets assured delete boundary', 'DELETE', true, false, true)
  ) as expected(
    schema_name,
    table_name,
    policy_name,
    command_name,
    requires_using,
    requires_check,
    protects_buckets
  )
  where pg_catalog.to_regclass(expected.schema_name || '.' || expected.table_name) is not null
    and not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = expected.schema_name
        and policy.tablename = expected.table_name
        and policy.policyname = expected.policy_name
        and policy.permissive = 'RESTRICTIVE'
        and policy.cmd = expected.command_name
        and policy.roles = array['authenticated']::name[]
        and (
          not expected.requires_using
          or pg_catalog.strpos(
            pg_catalog.lower(coalesce(policy.qual, '')),
            'current_customer_session_assured'
          ) > 0
        )
        and (expected.requires_using or policy.qual is null)
        and (
          not expected.requires_check
          or pg_catalog.strpos(
            pg_catalog.lower(coalesce(policy.with_check, '')),
            'current_customer_session_assured'
          ) > 0
        )
        and (expected.requires_check or policy.with_check is null)
        and (
          not expected.protects_buckets
          or (
            pg_catalog.strpos(
              pg_catalog.lower(
                coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
              ),
              'customer-files'
            ) > 0
            and pg_catalog.strpos(
              pg_catalog.lower(
                coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
              ),
              'file-expert'
            ) > 0
          )
        )
    );
  if v_missing is not null then
    raise exception 'Customer assurance policies are incomplete: %', v_missing;
  end if;

  select pg_catalog.string_agg(relation_name, ', ' order by relation_name)
  into v_missing
  from (values
    ('public.customer_auth_assurance_config'),
    ('public.customer_trusted_devices'),
    ('public.customer_session_assurance'),
    ('public.customer_device_email_challenges'),
    ('public.profiles'),
    ('public.orders'),
    ('public.credit_transactions'),
    ('public.notifications'),
    ('public.growth_customer_preferences'),
    ('public.widget_clients'),
    ('public.widget_domain_change_requests'),
    ('storage.objects')
  ) as expected(relation_name)
  join pg_catalog.pg_class as relation
    on relation.oid = pg_catalog.to_regclass(expected.relation_name)
  where not relation.relrowsecurity;
  if v_missing is not null then
    raise exception 'Customer assurance target RLS is disabled: %', v_missing;
  end if;

  foreach v_relation in array array[
    'public.customer_auth_assurance_config',
    'public.customer_trusted_devices',
    'public.customer_session_assurance',
    'public.customer_device_email_challenges'
  ]
  loop
    foreach v_operation in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if pg_catalog.has_table_privilege('authenticated', v_relation, v_operation) then
        raise exception 'Authenticated role has unsafe % access to %.', v_operation, v_relation;
      end if;
    end loop;
  end loop;

  foreach v_signature in array array[
    'public.get_customer_session_assurance_state(uuid,uuid)',
    'public.prepare_customer_password_change_verification(uuid,uuid)',
    'public.customer_password_change_verification_state(uuid,uuid)',
    'public.assure_customer_session_from_trusted_device(uuid,uuid,text,smallint)',
    'public.reserve_customer_device_challenge(uuid,uuid,uuid,text,smallint,text,boolean,uuid)',
    'public.mark_customer_device_challenge_sent(uuid,uuid,uuid)',
    'public.invalidate_customer_device_challenge(uuid,uuid,uuid)',
    'public.consume_customer_device_challenge(uuid,uuid,uuid,text,smallint,text,text)',
    'public.revoke_customer_trusted_device(uuid,uuid)',
    'public.revoke_other_customer_trusted_devices(uuid,uuid)',
    'public.revoke_all_customer_trusted_devices(uuid)',
    'public.activate_customer_device_assurance(integer)',
    'public.disable_customer_device_assurance()'
  ]
  loop
    v_function := pg_catalog.to_regprocedure(v_signature);
    if v_function is null then
      raise exception 'Required customer assurance function is missing: %', v_signature;
    end if;
    if pg_catalog.has_function_privilege('authenticated', v_function::oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('anon', v_function::oid, 'EXECUTE')
      or not pg_catalog.has_function_privilege('service_role', v_function::oid, 'EXECUTE') then
      raise exception 'Customer assurance function ACL is unsafe: %', v_signature;
    end if;
    select
      procedure.prosecdef,
      exists (
        select 1
        from pg_catalog.unnest(procedure.proconfig) as config(value)
        where config.value in ('search_path=', 'search_path=""')
      )
    into v_security_definer, v_fixed_path
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_function::oid;
    if not coalesce(v_security_definer, false)
      or not coalesce(v_fixed_path, false) then
      raise exception 'Customer assurance function metadata is unsafe: %', v_signature;
    end if;
  end loop;

  v_function := pg_catalog.to_regprocedure('app_private.current_customer_session_assured()');
  if v_function is null
    or not pg_catalog.has_function_privilege('authenticated', v_function::oid, 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', v_function::oid, 'EXECUTE')
    or pg_catalog.has_function_privilege('service_role', v_function::oid, 'EXECUTE') then
    raise exception 'Customer assurance RLS helper ACL is unsafe.';
  end if;

  foreach v_signature in array array[
    'public.create_order_with_credit_deduction_without_assurance(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
    'public.create_web_order_with_credit_deduction_without_assurance(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
    'public.create_desktop_order_with_credit_deduction_without_assurance(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'
  ]
  loop
    v_function := pg_catalog.to_regprocedure(v_signature);
    if v_function is null
      or pg_catalog.has_function_privilege('authenticated', v_function::oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('service_role', v_function::oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('anon', v_function::oid, 'EXECUTE') then
      raise exception 'Ungated order core is missing or executable: %', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.create_web_order_with_credit_deduction(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)',
    'public.create_desktop_order_with_credit_deduction(text,uuid,text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text)'
  ]
  loop
    v_function := pg_catalog.to_regprocedure(v_signature);
    select
      procedure.prosecdef,
      exists (
        select 1
        from pg_catalog.unnest(procedure.proconfig) as config(value)
        where config.value in ('search_path=', 'search_path=""')
      ),
      pg_catalog.pg_get_functiondef(procedure.oid)
    into v_security_definer, v_fixed_path, v_definition
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_function::oid;
    if v_function is null
      or not pg_catalog.has_function_privilege('authenticated', v_function::oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('anon', v_function::oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('service_role', v_function::oid, 'EXECUTE')
      or not coalesce(v_security_definer, false)
      or not coalesce(v_fixed_path, false)
      or pg_catalog.strpos(
        coalesce(v_definition, ''),
        'current_customer_session_assured'
      ) = 0 then
      raise exception 'Gated order wrapper is missing or unavailable: %', v_signature;
    end if;
  end loop;
end;
$$;

alter function app_private.assert_customer_device_assurance_ready() owner to postgres;
revoke all privileges on function app_private.assert_customer_device_assurance_ready()
  from public, anon, authenticated, service_role;

create or replace function public.activate_customer_device_assurance(
  p_legacy_grace_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_hours integer;
  v_mode text;
  v_enforce_after timestamptz;
  v_legacy_grace_until timestamptz;
begin
  if p_legacy_grace_hours is null or p_legacy_grace_hours not between 0 and 48 then
    raise exception using errcode = '22023', message = 'Legacy grace must be between 0 and 48 hours.';
  end if;
  v_hours := p_legacy_grace_hours;

  select config.mode, config.enforce_after, config.legacy_grace_until
  into v_mode, v_enforce_after, v_legacy_grace_until
  from public.customer_auth_assurance_config as config
  where config.singleton
  for update;
  if not found then
    raise exception 'Customer assurance configuration is unavailable.';
  end if;

  perform app_private.assert_customer_device_assurance_ready();
  if v_mode = 'enforced' then
    return pg_catalog.jsonb_build_object(
      'mode', v_mode,
      'enforce_after', v_enforce_after,
      'legacy_grace_until', v_legacy_grace_until,
      'unchanged', true
    );
  end if;

  update public.customer_auth_assurance_config
  set
    mode = 'enforced',
    enforce_after = v_now,
    legacy_grace_until = v_now + pg_catalog.make_interval(hours => v_hours),
    updated_at = v_now
  where singleton and mode = 'shadow';
  return pg_catalog.jsonb_build_object(
    'mode', 'enforced',
    'enforce_after', v_now,
    'legacy_grace_until', v_now + pg_catalog.make_interval(hours => v_hours)
  );
end;
$$;

create or replace function public.disable_customer_device_assurance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customer_auth_assurance_config
  set
    mode = 'shadow',
    enforce_after = null,
    legacy_grace_until = null,
    updated_at = pg_catalog.now()
  where singleton;
  if not found then
    raise exception 'Customer assurance configuration is unavailable.';
  end if;
  return pg_catalog.jsonb_build_object('mode', 'shadow');
end;
$$;

-- Service-only RPCs. Identity always comes from a server-validated Supabase
-- bearer token; browsers cannot invoke these functions directly.
do $function_acl$
declare
  v_function regprocedure;
begin
  foreach v_function in array array[
    'public.get_customer_session_assurance_state(uuid,uuid)'::regprocedure,
    'public.prepare_customer_password_change_verification(uuid,uuid)'::regprocedure,
    'public.customer_password_change_verification_state(uuid,uuid)'::regprocedure,
    'public.assure_customer_session_from_trusted_device(uuid,uuid,text,smallint)'::regprocedure,
    'public.reserve_customer_device_challenge(uuid,uuid,uuid,text,smallint,text,boolean,uuid)'::regprocedure,
    'public.mark_customer_device_challenge_sent(uuid,uuid,uuid)'::regprocedure,
    'public.invalidate_customer_device_challenge(uuid,uuid,uuid)'::regprocedure,
    'public.consume_customer_device_challenge(uuid,uuid,uuid,text,smallint,text,text)'::regprocedure,
    'public.revoke_customer_trusted_device(uuid,uuid)'::regprocedure,
    'public.revoke_other_customer_trusted_devices(uuid,uuid)'::regprocedure,
    'public.revoke_all_customer_trusted_devices(uuid)'::regprocedure,
    'public.activate_customer_device_assurance(integer)'::regprocedure,
    'public.disable_customer_device_assurance()'::regprocedure
  ]
  loop
    execute pg_catalog.format('alter function %s owner to postgres', v_function);
    execute pg_catalog.format(
      'revoke all privileges on function %s from public, anon, authenticated, service_role',
      v_function
    );
    execute pg_catalog.format('grant execute on function %s to service_role', v_function);
  end loop;
end;
$function_acl$;

-- Restrictive policies compose with the existing owner/staff policies. In
-- shadow mode the helper returns true, so installing the migration does not
-- interrupt the current application.
drop policy if exists "MG assured customer profile select boundary" on public.profiles;
create policy "MG assured customer profile select boundary"
on public.profiles as restrictive for select to authenticated
using ((select app_private.current_customer_session_assured()));

drop policy if exists "MG assured customer profile update boundary" on public.profiles;
create policy "MG assured customer profile update boundary"
on public.profiles as restrictive for update to authenticated
using ((select app_private.current_customer_session_assured()))
with check ((select app_private.current_customer_session_assured()));

drop policy if exists "MG assured customer order select boundary" on public.orders;
create policy "MG assured customer order select boundary"
on public.orders as restrictive for select to authenticated
using ((select app_private.current_customer_session_assured()));

drop policy if exists "MG assured customer credit select boundary" on public.credit_transactions;
create policy "MG assured customer credit select boundary"
on public.credit_transactions as restrictive for select to authenticated
using ((select app_private.current_customer_session_assured()));

do $optional_customer_policy_boundaries$
declare
  v_table text;
  v_operation text;
  v_policy_name text;
  v_operations text[];
begin
  foreach v_table in array array[
    'notifications',
    'growth_customer_preferences',
    'widget_clients',
    'widget_domain_change_requests'
  ]
  loop
    if pg_catalog.to_regclass('public.' || v_table) is null then
      continue;
    end if;
    v_operations := case v_table
      when 'notifications' then array['select', 'update']
      when 'widget_domain_change_requests' then array['select', 'insert']
      else array['select']
    end;
    foreach v_operation in array v_operations
    loop
      v_policy_name := 'MG assured customer ' || v_table || ' ' || v_operation || ' boundary';
      execute pg_catalog.format('drop policy if exists %I on public.%I', v_policy_name, v_table);
      if v_operation = 'insert' then
        execute pg_catalog.format(
          'create policy %I on public.%I as restrictive for insert to authenticated with check ((select app_private.current_customer_session_assured()))',
          v_policy_name,
          v_table
        );
      elsif v_operation = 'update' then
        execute pg_catalog.format(
          'create policy %I on public.%I as restrictive for update to authenticated using ((select app_private.current_customer_session_assured())) with check ((select app_private.current_customer_session_assured()))',
          v_policy_name,
          v_table
        );
      else
        execute pg_catalog.format(
          'create policy %I on public.%I as restrictive for select to authenticated using ((select app_private.current_customer_session_assured()))',
          v_policy_name,
          v_table
        );
      end if;
    end loop;
  end loop;
end;
$optional_customer_policy_boundaries$;

drop policy if exists "MG protected buckets assured select boundary" on storage.objects;
create policy "MG protected buckets assured select boundary"
on storage.objects as restrictive for select to authenticated
using (
  bucket_id not in ('customer-files', 'file-expert')
  or (select app_private.current_customer_session_assured())
);

drop policy if exists "MG protected buckets assured insert boundary" on storage.objects;
create policy "MG protected buckets assured insert boundary"
on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id not in ('customer-files', 'file-expert')
  or (select app_private.current_customer_session_assured())
);

drop policy if exists "MG protected buckets assured update boundary" on storage.objects;
create policy "MG protected buckets assured update boundary"
on storage.objects as restrictive for update to authenticated
using (
  bucket_id not in ('customer-files', 'file-expert')
  or (select app_private.current_customer_session_assured())
)
with check (
  bucket_id not in ('customer-files', 'file-expert')
  or (select app_private.current_customer_session_assured())
);

drop policy if exists "MG protected buckets assured delete boundary" on storage.objects;
create policy "MG protected buckets assured delete boundary"
on storage.objects as restrictive for delete to authenticated
using (
  bucket_id not in ('customer-files', 'file-expert')
  or (select app_private.current_customer_session_assured())
);

-- Wrap every authenticated SECURITY DEFINER order entry point. The previous
-- implementations remain private and unchanged, preserving their audited
-- credit/idempotency behavior while adding an early assurance gate.
alter function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) rename to create_order_with_credit_deduction_without_assurance;

create function public.create_order_with_credit_deduction(
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
begin
  if not app_private.current_customer_session_assured() then
    raise exception using errcode = '42501', message = 'Device verification is required.';
  end if;
  return public.create_order_with_credit_deduction_without_assurance(
    p_customer_email, p_vehicle_brand, p_vehicle_model, p_vehicle_generation,
    p_vehicle_engine, p_service_type, p_credits_required, p_notes, p_ecu,
    p_gearbox, p_vehicle_year, p_read_method, p_license_plate, p_hw_sw,
    p_master_slave, p_uploaded_file_name, p_original_file_path
  );
end;
$$;

alter function public.create_web_order_with_credit_deduction(
  text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) rename to create_web_order_with_credit_deduction_without_assurance;

create function public.create_web_order_with_credit_deduction(
  p_idempotency_key text,
  p_customer_email text,
  p_vehicle_brand text,
  p_vehicle_model text,
  p_vehicle_generation text,
  p_vehicle_engine text,
  p_service_type text,
  p_credits_required integer,
  p_notes text,
  p_ecu text,
  p_gearbox text,
  p_vehicle_year text,
  p_read_method text,
  p_license_plate text,
  p_hw_sw text,
  p_master_slave text,
  p_uploaded_file_name text,
  p_original_file_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.current_customer_session_assured() then
    raise exception using errcode = '42501', message = 'Device verification is required.';
  end if;
  return public.create_web_order_with_credit_deduction_without_assurance(
    p_idempotency_key, p_customer_email, p_vehicle_brand, p_vehicle_model,
    p_vehicle_generation, p_vehicle_engine, p_service_type, p_credits_required,
    p_notes, p_ecu, p_gearbox, p_vehicle_year, p_read_method, p_license_plate,
    p_hw_sw, p_master_slave, p_uploaded_file_name, p_original_file_path
  );
end;
$$;

alter function public.create_desktop_order_with_credit_deduction(
  text, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) rename to create_desktop_order_with_credit_deduction_without_assurance;

create function public.create_desktop_order_with_credit_deduction(
  p_idempotency_key text,
  p_approval_token uuid,
  p_upload_session_id text,
  p_customer_email text,
  p_vehicle_brand text,
  p_vehicle_model text,
  p_vehicle_generation text,
  p_vehicle_engine text,
  p_service_type text,
  p_credits_required integer,
  p_notes text,
  p_ecu text,
  p_gearbox text,
  p_vehicle_year text,
  p_read_method text,
  p_license_plate text,
  p_hw_sw text,
  p_master_slave text,
  p_uploaded_file_name text,
  p_original_file_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.current_customer_session_assured() then
    raise exception using errcode = '42501', message = 'Device verification is required.';
  end if;
  return public.create_desktop_order_with_credit_deduction_without_assurance(
    p_idempotency_key, p_approval_token, p_upload_session_id, p_customer_email,
    p_vehicle_brand, p_vehicle_model, p_vehicle_generation, p_vehicle_engine,
    p_service_type, p_credits_required, p_notes, p_ecu, p_gearbox,
    p_vehicle_year, p_read_method, p_license_plate, p_hw_sw, p_master_slave,
    p_uploaded_file_name, p_original_file_path
  );
end;
$$;

alter function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) owner to postgres;
alter function public.create_web_order_with_credit_deduction(
  text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) owner to postgres;
alter function public.create_desktop_order_with_credit_deduction(
  text, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) owner to postgres;

revoke all privileges on function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.create_order_with_credit_deduction_without_assurance(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

revoke all privileges on function public.create_web_order_with_credit_deduction(
  text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.create_web_order_with_credit_deduction_without_assurance(
  text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_web_order_with_credit_deduction(
  text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) to authenticated;

revoke all privileges on function public.create_desktop_order_with_credit_deduction(
  text, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.create_desktop_order_with_credit_deduction_without_assurance(
  text, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_desktop_order_with_credit_deduction(
  text, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, text
) to authenticated;

comment on function app_private.current_customer_session_assured() is
  'Authoritative customer session assurance boundary for RLS and Storage. Shadow mode preserves rollout compatibility.';
comment on table public.customer_trusted_devices is
  'Service-only 30-day trusted device records. Stores HMACs and coarse labels only; never raw tokens, IPs or fingerprints.';
comment on table public.customer_device_email_challenges is
  'Service-only, session-bound, single-use email challenge HMACs with atomic expiry and attempt limits.';

commit;
