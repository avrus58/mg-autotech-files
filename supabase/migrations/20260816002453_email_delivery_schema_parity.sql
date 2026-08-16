-- Restore the canonical email-delivery schema in environments whose baseline
-- predates the historical delivery-reliability migration. The two operational
-- tables remain service-API-only under the 02443 security boundary.

begin;

alter table public.email_events
  add column if not exists delivery_status text,
  add column if not exists last_delivery_event_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delayed_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz;

do $email_event_delivery_status_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_info
    where constraint_info.conname = 'email_events_delivery_status_check'
      and constraint_info.conrelid =
        'public.email_events'::pg_catalog.regclass
  ) then
    alter table public.email_events
      add constraint email_events_delivery_status_check
      check (
        delivery_status is null
        or delivery_status in (
          'pending',
          'sent',
          'delivered',
          'delayed',
          'bounced',
          'complained',
          'failed',
          'suppressed',
          'skipped'
        )
      );
  end if;
end;
$email_event_delivery_status_constraint$;

create index if not exists email_events_provider_message_id_idx
  on public.email_events(provider_message_id)
  where provider_message_id is not null;

create index if not exists email_events_delivery_status_idx
  on public.email_events(delivery_status, last_delivery_event_at desc);

create table if not exists public.email_delivery_events (
  provider_event_id text primary key,
  email_event_id uuid
    references public.email_events(id)
    on delete set null,
  provider_message_id text not null,
  provider_event_type text not null
    check (
      provider_event_type in (
        'email.sent',
        'email.delivered',
        'email.delivery_delayed',
        'email.bounced',
        'email.complained',
        'email.failed',
        'email.suppressed'
      )
    ),
  delivery_status text not null
    check (
      delivery_status in (
        'sent',
        'delivered',
        'delayed',
        'bounced',
        'complained',
        'failed',
        'suppressed'
      )
    ),
  recipient_email text not null
    check (recipient_email = pg_catalog.lower(recipient_email)),
  occurred_at timestamptz not null,
  reason_code text,
  reason_message text,
  payload_sha256 text not null
    check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists email_delivery_events_message_idx
  on public.email_delivery_events(provider_message_id, occurred_at desc);

create index if not exists email_delivery_events_status_idx
  on public.email_delivery_events(delivery_status, occurred_at desc);

create index if not exists email_delivery_events_email_event_idx
  on public.email_delivery_events(email_event_id, occurred_at desc);

create table if not exists public.email_suppressions (
  recipient_email text primary key
    check (recipient_email = pg_catalog.lower(recipient_email)),
  reason text not null
    check (
      reason in (
        'hard_bounce',
        'complaint',
        'provider_suppressed',
        'manual'
      )
    ),
  source_event_id text
    references public.email_delivery_events(provider_event_id)
    on delete set null,
  active boolean not null default true,
  last_event_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  resolved_at timestamptz,
  resolved_by uuid
    references auth.users(id)
    on delete set null
);

create index if not exists email_suppressions_active_idx
  on public.email_suppressions(active, last_event_at desc);

alter table public.email_delivery_events enable row level security;
alter table public.email_suppressions enable row level security;

-- A later parity migration must not recreate the historical direct staff
-- policies. The application reads and writes these tables through permission-
-- checked service-role routes.
do $email_delivery_policy_reset$
declare
  target_table text;
  target_policy record;
begin
  foreach target_table in array array[
    'email_delivery_events',
    'email_suppressions'
  ]
  loop
    for target_policy in
      select policy.policyname
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = target_table
    loop
      execute pg_catalog.format(
        'drop policy %I on public.%I',
        target_policy.policyname,
        target_table
      );
    end loop;
  end loop;
end;
$email_delivery_policy_reset$;

revoke all privileges on table public.email_delivery_events
  from public, anon, authenticated, service_role;
revoke all privileges on table public.email_suppressions
  from public, anon, authenticated, service_role;

-- Clear historical per-column grants as well as table ACLs so future columns
-- cannot inherit a stale direct Data API projection.
do $email_delivery_column_acl_reset$
declare
  target_table text;
  target_column record;
begin
  foreach target_table in array array[
    'email_delivery_events',
    'email_suppressions'
  ]
  loop
    for target_column in
      select attribute.attname as column_name
      from pg_catalog.pg_attribute as attribute
      where attribute.attrelid =
        pg_catalog.to_regclass('public.' || target_table)
        and attribute.attnum > 0
        and not attribute.attisdropped
      order by attribute.attnum
    loop
      execute pg_catalog.format(
        'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) '
        || 'on table public.%2$I '
        || 'from public, anon, authenticated, service_role',
        target_column.column_name,
        target_table
      );
    end loop;
  end loop;
end;
$email_delivery_column_acl_reset$;

grant all privileges on table public.email_delivery_events to service_role;
grant all privileges on table public.email_suppressions to service_role;

comment on table public.email_delivery_events is
  'Private signed-provider delivery metadata and payload digest; email content and raw webhook payloads are never stored.';
comment on table public.email_suppressions is
  'Private recipient suppression registry used by server-side transactional email delivery.';
comment on column public.email_delivery_events.reason_message is
  'Bounded provider delivery reason for staff troubleshooting; available only through permission-checked server APIs.';

commit;
