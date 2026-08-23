begin;

-- The conventional www host and the apex host are one allocation boundary.
-- The trigger keeps every write path (checkout, admin and approved domain
-- changes) aligned, while the partial unique index arbitrates races atomically.
alter table public.widget_clients
  add column if not exists canonical_domain text;

create or replace function public.widget_set_canonical_domain()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_domain text;
  v_label text;
  v_labels text[];
begin
  v_domain := pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.btrim(new.allowed_domain)),
    '\.+$',
    ''
  );
  if pg_catalog.left(v_domain, 4) = 'www.' then
    v_domain := pg_catalog.substr(v_domain, 5);
  end if;
  v_labels := pg_catalog.string_to_array(v_domain, '.');
  if v_domain is null
    or pg_catalog.length(v_domain) not between 3 and 253
    or v_domain !~ '^[a-z0-9.-]+$'
    or pg_catalog.cardinality(v_labels) < 2
    or pg_catalog.length(v_labels[pg_catalog.cardinality(v_labels)]) < 2
    or v_labels[pg_catalog.cardinality(v_labels)] ~ '^[0-9]+$' then
    raise exception using
      errcode = '22023',
      message = 'Widget canonical domain is invalid.';
  end if;
  foreach v_label in array v_labels loop
    if pg_catalog.length(v_label) not between 1 and 63
      or v_label !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' then
      raise exception using
        errcode = '22023',
        message = 'Widget canonical domain contains an invalid label.';
    end if;
  end loop;
  new.canonical_domain := v_domain;
  return new;
end;
$$;

alter function public.widget_set_canonical_domain() owner to postgres;
revoke all privileges on function public.widget_set_canonical_domain()
  from public, anon, authenticated;
grant execute on function public.widget_set_canonical_domain() to service_role;

drop trigger if exists widget_clients_set_canonical_domain on public.widget_clients;
create trigger widget_clients_set_canonical_domain
  before insert or update on public.widget_clients
  for each row execute function public.widget_set_canonical_domain();

-- Fire the trigger for legacy rows without changing their customer-visible
-- domain. Invalid or conflicting legacy state deliberately aborts the migration
-- for manual review; no subscription is merged or deleted automatically.
update public.widget_clients
set allowed_domain = allowed_domain;

alter table public.widget_clients
  alter column canonical_domain set not null;

drop index if exists public.widget_clients_one_live_domain_idx;
create unique index widget_clients_one_live_canonical_domain_idx
  on public.widget_clients(canonical_domain)
  where status is distinct from 'cancelled';

create index if not exists widget_clients_canonical_domain_lookup_idx
  on public.widget_clients(canonical_domain, created_at desc);

-- Webhook claims remain durable on failure. A token prevents a stale worker
-- from completing or failing a claim that a later delivery has recovered.
alter table public.widget_webhook_events
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text;

alter table public.widget_webhook_events
  drop constraint if exists widget_webhook_events_processing_state_check;
alter table public.widget_webhook_events
  add constraint widget_webhook_events_processing_state_check
  check (processing_state in ('processing', 'failed', 'processed'));

update public.widget_webhook_events
set
  claim_token = case
    when processing_state = 'processing' then coalesce(claim_token, gen_random_uuid())
    else null
  end,
  claimed_at = case
    when processing_state = 'processing' then coalesce(claimed_at, processed_at)
    else claimed_at
  end,
  attempt_count = case
    when processing_state = 'processing' then greatest(attempt_count, 1)
    else attempt_count
  end;

alter table public.widget_webhook_events
  drop constraint if exists widget_webhook_events_claim_state_check;
alter table public.widget_webhook_events
  add constraint widget_webhook_events_claim_state_check
  check (
    attempt_count >= 0
    and (
      (
        processing_state = 'processing'
        and claim_token is not null
        and claimed_at is not null
      )
      or (
        processing_state in ('failed', 'processed')
        and claim_token is null
      )
    )
  );

create index if not exists widget_webhook_events_recovery_idx
  on public.widget_webhook_events(processing_state, claimed_at);

-- Each external effect has a durable state. Provider idempotency covers the
-- narrow send/ack crash window; this ledger avoids calling the provider again
-- after a completed effect on any later webhook retry.
create table if not exists public.widget_webhook_effects (
  event_id text not null references public.widget_webhook_events(event_id) on delete cascade,
  effect_key text not null,
  effect_state text not null default 'pending'
    check (effect_state in ('pending', 'completed')),
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (event_id, effect_key),
  constraint widget_webhook_effect_key_check
    check (pg_catalog.length(effect_key) between 3 and 120)
);

alter table public.widget_webhook_effects enable row level security;
revoke all privileges on table public.widget_webhook_effects
  from public, anon, authenticated;
grant all privileges on table public.widget_webhook_effects to service_role;

-- Audits are insert-idempotent per Stripe event/effect. Existing administrative
-- and trigger-generated audit rows remain unaffected because both fields are
-- null for those sources.
alter table public.widget_audit_logs
  add column if not exists source_event_id text,
  add column if not exists effect_key text,
  add constraint widget_audit_logs_event_effect_pair_check
    check (
      (source_event_id is null and effect_key is null)
      or (source_event_id is not null and effect_key is not null)
    );

create unique index if not exists widget_audit_logs_event_effect_idx
  on public.widget_audit_logs(source_event_id, effect_key)
  where source_event_id is not null;

-- Widget data is server-API-only. Reassert the complete table boundary here so
-- this versioned hardening does not rely on historical one-off SQL scripts.
alter table public.widget_settings enable row level security;
alter table public.widget_plans enable row level security;
alter table public.widget_clients enable row level security;
alter table public.widget_api_keys enable row level security;
alter table public.widget_access_logs enable row level security;
alter table public.widget_domain_change_requests enable row level security;
alter table public.widget_webhook_events enable row level security;
alter table public.widget_webhook_effects enable row level security;
alter table public.widget_audit_logs enable row level security;
alter table public.widget_enquiries enable row level security;
alter table public.widget_rate_limit_buckets enable row level security;

revoke all privileges on table
  public.widget_settings,
  public.widget_plans,
  public.widget_clients,
  public.widget_api_keys,
  public.widget_access_logs,
  public.widget_domain_change_requests,
  public.widget_webhook_events,
  public.widget_webhook_effects,
  public.widget_audit_logs,
  public.widget_enquiries,
  public.widget_rate_limit_buckets
from public, anon, authenticated;

grant all privileges on table
  public.widget_settings,
  public.widget_plans,
  public.widget_clients,
  public.widget_api_keys,
  public.widget_access_logs,
  public.widget_domain_change_requests,
  public.widget_webhook_events,
  public.widget_webhook_effects,
  public.widget_audit_logs,
  public.widget_enquiries,
  public.widget_rate_limit_buckets
to service_role;

commit;
