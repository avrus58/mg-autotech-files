begin;

-- Current writers always provide their version explicitly. Omitted values can
-- only come from the previous Production image, whose key source cannot be
-- inferred inside Postgres, so keep the conservative dual-read classification.
alter table public.growth_attribution_sessions
  alter column visitor_hash_version set default 'pre-v2-key-unknown';

-- Retain the previous RPC signature for application rollback, but align its
-- storage behavior with the current privacy contract: search terms are ignored
-- and the unknown legacy key source is recorded explicitly.
create or replace function public.record_growth_attribution_touch(
  p_visitor_hash text,
  p_user_id uuid,
  p_landing_path text,
  p_source text,
  p_medium text,
  p_campaign text,
  p_term text,
  p_referrer_host text,
  p_country_code text,
  p_locale text,
  p_consent_version text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_visitor_hash, 0)
  );

  insert into public.growth_attribution_sessions (
    visitor_hash, visitor_hash_version, user_id,
    first_landing_path, last_landing_path,
    first_source, last_source,
    first_medium, last_medium,
    first_campaign, last_campaign,
    first_term, last_term,
    first_referrer_host, last_referrer_host,
    first_country_code, last_country_code,
    locale, consent_version, identified_at
  ) values (
    p_visitor_hash, 'pre-v2-key-unknown', p_user_id,
    p_landing_path, p_landing_path,
    p_source, p_source,
    p_medium, p_medium,
    p_campaign, p_campaign,
    null, null,
    p_referrer_host, p_referrer_host,
    p_country_code, p_country_code,
    p_locale, p_consent_version,
    case when p_user_id is null then null else pg_catalog.now() end
  )
  on conflict (visitor_hash) do update set
    user_id = coalesce(growth_attribution_sessions.user_id, excluded.user_id),
    last_landing_path = excluded.last_landing_path,
    last_source = excluded.last_source,
    last_medium = excluded.last_medium,
    last_campaign = excluded.last_campaign,
    last_term = null,
    last_referrer_host = excluded.last_referrer_host,
    last_country_code = excluded.last_country_code,
    locale = coalesce(excluded.locale, growth_attribution_sessions.locale),
    consent_version = excluded.consent_version,
    touch_count = growth_attribution_sessions.touch_count + 1,
    last_seen_at = pg_catalog.now(),
    identified_at = case
      when growth_attribution_sessions.user_id is null and excluded.user_id is not null
        then pg_catalog.now()
      else growth_attribution_sessions.identified_at
    end
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.record_growth_attribution_touch(
  text, uuid, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_growth_attribution_touch(
  text, uuid, text, text, text, text, text, text, text, text, text
) to service_role;

-- The previous Production image writes growth_journey_events.visitor_hash but
-- predates visitor_hash_version. Keep overlap and application rollback safe by
-- classifying only those omitted-version INSERTs as unknown-key legacy rows.
-- Current writers that provide an explicit version remain unchanged.
create or replace function public.normalize_growth_journey_hash_version_compat()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.visitor_hash is not null and new.visitor_hash_version is null then
    new.visitor_hash_version := 'pre-v2-key-unknown';
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_growth_journey_hash_version_compat()
  from public, anon, authenticated;

drop trigger if exists growth_journey_hash_version_compat on public.growth_journey_events;
create trigger growth_journey_hash_version_compat
before insert on public.growth_journey_events
for each row
when (new.visitor_hash is not null and new.visitor_hash_version is null)
execute function public.normalize_growth_journey_hash_version_compat();

comment on function public.normalize_growth_journey_hash_version_compat() is
  'Rollback bridge: classifies omitted journey hash versions without changing explicit current-version writes.';

commit;
