-- MG AutoTech Growth Customer Classification Bulk Review
-- Additive and non-destructive. Existing classifications are never rewritten automatically.

begin;

alter table public.growth_customer_classification_events
  add column if not exists batch_id uuid;

create index if not exists growth_customer_classification_events_batch_idx
  on public.growth_customer_classification_events(batch_id, created_at)
  where batch_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.growth_customer_classifications'::regclass
      and conname = 'growth_customer_classification_evidence_note_chk'
  ) then
    alter table public.growth_customer_classifications
      add constraint growth_customer_classification_evidence_note_chk
      check (
        classification = 'unreviewed'
        or length(trim(coalesce(reason, ''))) between 3 and 240
      ) not valid;
  end if;
end;
$$;

create or replace function public.set_growth_customer_classification(
  p_user_id uuid,
  p_classification text,
  p_reason text,
  p_actor_user_id uuid
)
returns public.growth_customer_classifications
language plpgsql
security invoker
set search_path = public
as $$
declare
  previous_row public.growth_customer_classifications%rowtype;
  saved_row public.growth_customer_classifications%rowtype;
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
  next_excluded boolean;
  target_role text;
begin
  if p_actor_user_id is null then
    raise exception 'growth_customer_actor_required';
  end if;
  if p_classification not in ('unreviewed', 'real_customer', 'internal_test', 'staff_operated') then
    raise exception 'invalid_growth_customer_classification';
  end if;

  next_excluded := p_classification in ('internal_test', 'staff_operated');
  if p_classification <> 'unreviewed' and length(coalesce(clean_reason, '')) < 3 then
    raise exception 'growth_customer_classification_reason_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(role, 'customer') into target_role
  from public.profiles
  where id = p_user_id;

  if target_role is null then
    raise exception 'growth_customer_not_found';
  end if;
  if target_role in ('admin', 'staff') then
    raise exception 'staff_accounts_are_already_excluded';
  end if;

  select * into previous_row
  from public.growth_customer_classifications
  where user_id = p_user_id
  for update;

  if previous_row.user_id is not null
    and previous_row.classification = p_classification
    and coalesce(previous_row.reason, '') = coalesce(clean_reason, '') then
    return previous_row;
  end if;

  insert into public.growth_customer_classifications (
    user_id, classification, analytics_excluded, reason,
    verified_by, verified_at, updated_at
  ) values (
    p_user_id, p_classification, next_excluded, clean_reason,
    p_actor_user_id,
    case when p_classification = 'unreviewed' then null else now() end,
    now()
  )
  on conflict (user_id) do update set
    classification = excluded.classification,
    analytics_excluded = excluded.analytics_excluded,
    reason = excluded.reason,
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    updated_at = now()
  returning * into saved_row;

  insert into public.growth_customer_classification_events (
    user_id, actor_user_id,
    previous_classification, new_classification,
    previous_analytics_excluded, new_analytics_excluded,
    reason
  ) values (
    p_user_id, p_actor_user_id,
    previous_row.classification, saved_row.classification,
    previous_row.analytics_excluded, saved_row.analytics_excluded,
    clean_reason
  );

  return saved_row;
end;
$$;

revoke all on function public.set_growth_customer_classification(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_growth_customer_classification(uuid, text, text, uuid)
  to service_role;

create or replace function public.set_growth_customer_classifications_batch(
  p_changes jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  batch_id uuid := gen_random_uuid();
  change_item jsonb;
  target_user_id uuid;
  target_classification text;
  clean_reason text;
  expected_updated_at timestamptz;
  previous_row public.growth_customer_classifications%rowtype;
  saved_row public.growth_customer_classifications%rowtype;
  previous_exists boolean;
  next_excluded boolean;
  target_role text;
  item_count integer;
  distinct_user_count integer;
  saved_count integer := 0;
begin
  if p_actor_user_id is null then
    raise exception 'growth_customer_actor_required';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'growth_customer_batch_invalid';
  end if;

  item_count := jsonb_array_length(p_changes);
  if item_count < 1 or item_count > 100 then
    raise exception 'growth_customer_batch_too_large';
  end if;

  select count(*), count(distinct value->>'user_id')
    into item_count, distinct_user_count
  from jsonb_array_elements(p_changes);
  if item_count <> distinct_user_count then
    raise exception 'growth_customer_batch_duplicate';
  end if;

  for change_item in
    select value
    from jsonb_array_elements(p_changes)
    order by value->>'user_id'
  loop
    begin
      target_user_id := (change_item->>'user_id')::uuid;
      expected_updated_at := nullif(change_item->>'expected_updated_at', '')::timestamptz;
    exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'growth_customer_batch_invalid';
    end;
    target_classification := change_item->>'classification';
    clean_reason := nullif(trim(coalesce(change_item->>'reason', '')), '');

    if target_classification not in ('unreviewed', 'real_customer', 'internal_test', 'staff_operated') then
      raise exception 'invalid_growth_customer_classification';
    end if;
    if target_classification <> 'unreviewed' and length(coalesce(clean_reason, '')) < 3 then
      raise exception 'growth_customer_classification_reason_required';
    end if;

    next_excluded := target_classification in ('internal_test', 'staff_operated');
    perform pg_advisory_xact_lock(hashtextextended(target_user_id::text, 0));

    select coalesce(role, 'customer') into target_role
    from public.profiles
    where id = target_user_id;
    if target_role is null then
      raise exception 'growth_customer_not_found';
    end if;
    if target_role in ('admin', 'staff') then
      raise exception 'staff_accounts_are_already_excluded';
    end if;

    select * into previous_row
    from public.growth_customer_classifications
    where user_id = target_user_id
    for update;
    previous_exists := found;

    if previous_exists then
      if expected_updated_at is null or previous_row.updated_at <> expected_updated_at then
        raise exception 'growth_customer_classification_stale';
      end if;
    elsif expected_updated_at is not null then
      raise exception 'growth_customer_classification_stale';
    end if;

    if previous_exists
      and previous_row.classification = target_classification
      and coalesce(previous_row.reason, '') = coalesce(clean_reason, '') then
      continue;
    end if;

    insert into public.growth_customer_classifications (
      user_id, classification, analytics_excluded, reason,
      verified_by, verified_at, updated_at
    ) values (
      target_user_id, target_classification, next_excluded, clean_reason,
      p_actor_user_id,
      case when target_classification = 'unreviewed' then null else now() end,
      now()
    )
    on conflict (user_id) do update set
      classification = excluded.classification,
      analytics_excluded = excluded.analytics_excluded,
      reason = excluded.reason,
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at,
      updated_at = now()
    returning * into saved_row;

    insert into public.growth_customer_classification_events (
      user_id, actor_user_id, batch_id,
      previous_classification, new_classification,
      previous_analytics_excluded, new_analytics_excluded,
      reason
    ) values (
      target_user_id, p_actor_user_id, batch_id,
      previous_row.classification, saved_row.classification,
      previous_row.analytics_excluded, saved_row.analytics_excluded,
      clean_reason
    );
    saved_count := saved_count + 1;
  end loop;

  return jsonb_build_object(
    'batch_id', batch_id,
    'saved_count', saved_count
  );
end;
$$;

revoke all on function public.set_growth_customer_classifications_batch(jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.set_growth_customer_classifications_batch(jsonb, uuid)
  to service_role;

commit;
