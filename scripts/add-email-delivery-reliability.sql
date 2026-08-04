-- MG AutoTech Email Delivery Reliability
-- Additive, private operational metadata only. No email body or provider payload storage.

begin;

alter table public.email_events
  add column if not exists delivery_status text,
  add column if not exists last_delivery_event_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delayed_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'email_events_delivery_status_check'
      and conrelid = 'public.email_events'::regclass
  ) then
    alter table public.email_events
      add constraint email_events_delivery_status_check
      check (delivery_status is null or delivery_status in (
        'pending', 'sent', 'delivered', 'delayed', 'bounced', 'complained',
        'failed', 'suppressed', 'skipped'
      ));
  end if;
end $$;

create index if not exists email_events_provider_message_id_idx
  on public.email_events(provider_message_id)
  where provider_message_id is not null;

create index if not exists email_events_delivery_status_idx
  on public.email_events(delivery_status, last_delivery_event_at desc);

create table if not exists public.email_delivery_events (
  provider_event_id text primary key,
  email_event_id uuid references public.email_events(id) on delete set null,
  provider_message_id text not null,
  provider_event_type text not null check (provider_event_type in (
    'email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced',
    'email.complained', 'email.failed', 'email.suppressed'
  )),
  delivery_status text not null check (delivery_status in (
    'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'suppressed'
  )),
  recipient_email text not null check (recipient_email = lower(recipient_email)),
  occurred_at timestamptz not null,
  reason_code text,
  reason_message text,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists email_delivery_events_message_idx
  on public.email_delivery_events(provider_message_id, occurred_at desc);
create index if not exists email_delivery_events_status_idx
  on public.email_delivery_events(delivery_status, occurred_at desc);
create index if not exists email_delivery_events_email_event_idx
  on public.email_delivery_events(email_event_id, occurred_at desc);

create table if not exists public.email_suppressions (
  recipient_email text primary key check (recipient_email = lower(recipient_email)),
  reason text not null check (reason in (
    'hard_bounce', 'complaint', 'provider_suppressed', 'manual'
  )),
  source_event_id text references public.email_delivery_events(provider_event_id) on delete set null,
  active boolean not null default true,
  last_event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists email_suppressions_active_idx
  on public.email_suppressions(active, last_event_at desc);

alter table public.email_delivery_events enable row level security;
alter table public.email_suppressions enable row level security;

revoke all on public.email_delivery_events from anon;
revoke all on public.email_suppressions from anon;
revoke insert, update, delete on public.email_delivery_events from authenticated;
revoke insert, update, delete on public.email_suppressions from authenticated;
grant select on public.email_delivery_events to authenticated;
grant select on public.email_suppressions to authenticated;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'has_staff_permission') then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'email_delivery_events'
        and policyname = 'Staff can read email delivery events'
    ) then
      create policy "Staff can read email delivery events"
      on public.email_delivery_events for select to authenticated
      using (public.has_staff_permission('orders.view'));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'email_suppressions'
        and policyname = 'Staff can read email suppressions'
    ) then
      create policy "Staff can read email suppressions"
      on public.email_suppressions for select to authenticated
      using (public.has_staff_permission('orders.view'));
    end if;
  end if;
end $$;

comment on table public.email_delivery_events is
  'Private, signed-provider delivery events. Stores only allowlisted delivery metadata and a payload digest, never the webhook payload or email body.';
comment on table public.email_suppressions is
  'Private recipient suppression registry. Hard bounces, complaints and provider suppressions block repeated application email delivery.';
comment on column public.email_delivery_events.reason_message is
  'Bounded provider delivery reason for staff troubleshooting. Never exposed to customer APIs.';

commit;
