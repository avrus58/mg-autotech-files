-- Make transactional e-mail delivery claims recoverable after an interrupted
-- serverless invocation while preserving compare-and-swap ownership.

begin;

alter table public.email_events
  add column if not exists updated_at timestamptz;

update public.email_events
set updated_at = coalesce(updated_at, created_at, pg_catalog.now())
where updated_at is null;

alter table public.email_events
  alter column updated_at set default pg_catalog.now(),
  alter column updated_at set not null;

create or replace function public.touch_email_events_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.clock_timestamp();
  return new;
end;
$$;

do $email_events_updated_at_trigger$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_info
    where trigger_info.tgname = 'email_events_touch_updated_at'
      and trigger_info.tgrelid =
        'public.email_events'::pg_catalog.regclass
      and not trigger_info.tgisinternal
  ) then
    create trigger email_events_touch_updated_at
      before update on public.email_events
      for each row
      execute function public.touch_email_events_updated_at();
  end if;
end;
$email_events_updated_at_trigger$;

revoke all on function public.touch_email_events_updated_at()
  from public, anon, authenticated;
grant execute on function public.touch_email_events_updated_at()
  to service_role;

create index if not exists email_events_pending_lease_idx
  on public.email_events(updated_at)
  where status = 'pending';

comment on column public.email_events.updated_at is
  'CAS lease version for transactional e-mail attempts; stale pending rows may be reclaimed only with the observed value.';

commit;
