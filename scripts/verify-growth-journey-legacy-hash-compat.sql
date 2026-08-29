-- Structural receipt: the rollback bridge must be attached only to INSERTs on
-- growth_journey_events and must use the reviewed compatibility function.
select
  exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'normalize_growth_journey_hash_version_compat'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
      and pg_catalog.pg_get_function_result(p.oid) = 'trigger'
      and not p.prosecdef
      and exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) as setting
        where pg_catalog.split_part(setting, '=', 1) = 'search_path'
          and pg_catalog.split_part(setting, '=', 2) in ('', '""')
      )
      and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) as compatibility_function_exists,
  exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where t.tgname = 'growth_journey_hash_version_compat'
      and t.tgrelid = 'public.growth_journey_events'::pg_catalog.regclass
      and not t.tgisinternal
      and t.tgtype = 7
      and t.tgqual is not null
      and pg_catalog.pg_get_triggerdef(t.oid) ilike '%visitor_hash IS NOT NULL%'
      and pg_catalog.pg_get_triggerdef(t.oid) ilike '%visitor_hash_version IS NULL%'
      and n.nspname = 'public'
      and p.proname = 'normalize_growth_journey_hash_version_compat'
  ) as compatibility_trigger_is_before_insert_only,
  exists (
    select 1
    from pg_catalog.pg_attrdef d
    join pg_catalog.pg_attribute a
      on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'public.growth_attribution_sessions'::pg_catalog.regclass
      and a.attname = 'visitor_hash_version'
      and pg_catalog.pg_get_expr(d.adbin, d.adrelid) ilike '%pre-v2-key-unknown%'
  ) as legacy_session_default_is_unknown,
  exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(
      'public.record_growth_attribution_touch(text,uuid,text,text,text,text,text,text,text,text,text)'
    )
      and pg_catalog.strpos(pg_catalog.lower(p.prosrc), 'p_term') = 0
      and not p.prosecdef
      and exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) as setting
        where pg_catalog.split_part(setting, '=', 1) = 'search_path'
          and pg_catalog.split_part(setting, '=', 2) in ('', '""')
      )
      and not pg_catalog.has_function_privilege(
        'anon', p.oid, 'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated', p.oid, 'EXECUTE'
      )
      and pg_catalog.has_function_privilege(
        'service_role', p.oid, 'EXECUTE'
      )
  ) as legacy_rpc_is_privacy_minimized_and_service_only,
  not exists (
    select 1
    from public.growth_attribution_sessions
    where first_term is not null or last_term is not null
  ) as no_stored_search_terms;

-- Functional receipt. All probe rows are rolled back and never become customer
-- or operational data.
begin;

do $$
declare
  legacy_key text := 'compat-legacy-' || gen_random_uuid()::text;
  anonymous_key text := 'compat-anonymous-' || gen_random_uuid()::text;
  current_key text := 'compat-current-' || gen_random_uuid()::text;
  invalid_key text := 'compat-invalid-' || gen_random_uuid()::text;
  invalid_version_key text := 'compat-invalid-version-' || gen_random_uuid()::text;
  omitted_session_hash text := encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
  legacy_rpc_hash text := encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
  legacy_rpc_session_id uuid;
  stored_version text;
  stored_first_term text;
  stored_last_term text;
begin
  insert into public.growth_attribution_sessions (
    visitor_hash,
    user_id,
    first_landing_path,
    last_landing_path,
    first_source,
    last_source,
    first_medium,
    last_medium,
    consent_version
  ) values (
    omitted_session_hash,
    null,
    '/compat-default',
    '/compat-default',
    'compat',
    'compat',
    'test',
    'test',
    'compat-v1'
  );

  select visitor_hash_version into stored_version
  from public.growth_attribution_sessions
  where visitor_hash = omitted_session_hash;

  if stored_version is distinct from 'pre-v2-key-unknown' then
    raise exception 'omitted legacy session version did not use the safe default';
  end if;

  legacy_rpc_session_id := public.record_growth_attribution_touch(
    legacy_rpc_hash,
    null,
    '/compat-rpc',
    'google',
    'cpc',
    'compat-campaign',
    'must-not-be-stored',
    'example.com',
    'DE',
    'en',
    'consent-mode-v2'
  );

  select visitor_hash_version, first_term, last_term
  into stored_version, stored_first_term, stored_last_term
  from public.growth_attribution_sessions
  where id = legacy_rpc_session_id;

  if stored_version is distinct from 'pre-v2-key-unknown' then
    raise exception 'legacy RPC did not classify the omitted key version safely';
  end if;

  if stored_first_term is not null or stored_last_term is not null then
    raise exception 'legacy RPC stored a search term despite the privacy contract';
  end if;

  insert into public.growth_journey_events (
    event_type,
    event_key,
    visitor_hash,
    user_id,
    channel,
    safe_metadata
  ) values (
    'request_started',
    legacy_key,
    repeat('a', 64),
    null,
    'web',
    '{}'::jsonb
  );

  select visitor_hash_version into stored_version
  from public.growth_journey_events
  where event_key = legacy_key;

  if stored_version is distinct from 'pre-v2-key-unknown' then
    raise exception 'legacy omitted-version insert was not classified safely';
  end if;

  insert into public.growth_journey_events (
    event_type,
    event_key,
    visitor_hash,
    user_id,
    channel,
    safe_metadata
  ) values (
    'request_started',
    anonymous_key,
    null,
    null,
    'web',
    '{}'::jsonb
  );

  select visitor_hash_version into stored_version
  from public.growth_journey_events
  where event_key = anonymous_key;

  if stored_version is not null then
    raise exception 'hashless insert unexpectedly received a hash version';
  end if;

  insert into public.growth_journey_events (
    event_type,
    event_key,
    visitor_hash,
    visitor_hash_version,
    user_id,
    channel,
    safe_metadata
  ) values (
    'request_started',
    current_key,
    repeat('b', 64),
    'dedicated-v2',
    null,
    'web',
    '{}'::jsonb
  );

  select visitor_hash_version into stored_version
  from public.growth_journey_events
  where event_key = current_key;

  if stored_version is distinct from 'dedicated-v2' then
    raise exception 'explicit current hash version was changed by compatibility bridge';
  end if;

  begin
    insert into public.growth_journey_events (
      event_type,
      event_key,
      visitor_hash,
      visitor_hash_version,
      user_id,
      channel,
      safe_metadata
    ) values (
      'request_started',
      invalid_key,
      null,
      'dedicated-v2',
      null,
      'web',
      '{}'::jsonb
    );

    raise exception 'invalid hash/version pair bypassed the relational check';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.growth_journey_events (
      event_type,
      event_key,
      visitor_hash,
      visitor_hash_version,
      user_id,
      channel,
      safe_metadata
    ) values (
      'request_started',
      invalid_version_key,
      repeat('d', 64),
      'invalid-version',
      null,
      'web',
      '{}'::jsonb
    );

    raise exception 'invalid hash version bypassed the relational check';
  exception
    when check_violation then
      null;
  end;
end
$$;

rollback;
