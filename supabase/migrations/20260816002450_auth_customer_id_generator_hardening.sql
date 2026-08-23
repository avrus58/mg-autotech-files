-- Harden the customer-reference trigger chain used by Auth profile creation.
-- This migration is additive and must run before the post-deploy 02451 cutover.

begin;

do $$
begin
  if pg_catalog.to_regclass('public.customer_id_seq') is null then
    raise exception 'Required sequence public.customer_id_seq is missing.';
  end if;

  if pg_catalog.to_regprocedure('public.handle_new_user()') is null then
    raise exception 'Required Auth trigger function public.handle_new_user() is missing.';
  end if;

  if pg_catalog.to_regprocedure('public.set_customer_id()') is null then
    raise exception 'Required profile trigger function public.set_customer_id() is missing.';
  end if;
end;
$$;

create or replace function public.generate_customer_id()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return 'MGA-' || pg_catalog.nextval(
    'public.customer_id_seq'::pg_catalog.regclass
  );
end;
$$;

alter function public.generate_customer_id() owner to postgres;
revoke all privileges on function public.generate_customer_id()
  from public, anon, authenticated, service_role;

create or replace function public.set_customer_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_id is null then
    new.customer_id := public.generate_customer_id();
  end if;

  return new;
end;
$$;

alter function public.set_customer_id() owner to postgres;
revoke all privileges on function public.set_customer_id()
  from public, anon, authenticated, service_role;

-- The Auth handler is trigger-only. Reassert its owner and private execution
-- boundary without replacing the already-applied 02443 implementation.
alter function public.handle_new_user() security definer;
alter function public.handle_new_user() set search_path = '';
alter function public.handle_new_user() owner to postgres;
revoke all privileges on function public.handle_new_user()
  from public, anon, authenticated, service_role;

alter sequence public.customer_id_seq owner to postgres;
revoke all privileges on sequence public.customer_id_seq
  from public, anon, authenticated, service_role;

-- Replace every historical trigger pointing at set_customer_id() with one
-- exact enabled BEFORE INSERT trigger. The function preserves a caller-supplied
-- non-null customer reference and allocates only when the column is null.
do $$
declare
  v_trigger record;
begin
  for v_trigger in
    select trigger_info.tgname
    from pg_catalog.pg_trigger as trigger_info
    join pg_catalog.pg_class as relation
      on relation.oid = trigger_info.tgrelid
    join pg_catalog.pg_namespace as relation_namespace
      on relation_namespace.oid = relation.relnamespace
    join pg_catalog.pg_proc as procedure
      on procedure.oid = trigger_info.tgfoid
    join pg_catalog.pg_namespace as procedure_namespace
      on procedure_namespace.oid = procedure.pronamespace
    where relation_namespace.nspname = 'public'
      and relation.relname = 'profiles'
      and procedure_namespace.nspname = 'public'
      and procedure.proname = 'set_customer_id'
      and not trigger_info.tgisinternal
  loop
    execute pg_catalog.format(
      'drop trigger %I on public.profiles',
      v_trigger.tgname
    );
  end loop;
end;
$$;

drop trigger if exists profiles_customer_id_trigger on public.profiles;
create trigger profiles_customer_id_trigger
before insert on public.profiles
for each row execute function public.set_customer_id();

-- 02443 owns the managed Auth trigger. Fail the transaction if its exact
-- singleton INSERT boundary is missing or disabled instead of silently
-- creating a second Auth trigger.
do $$
declare
  v_trigger_count integer;
  v_enabled_count integer;
  v_insert_row_after_count integer;
begin
  select
    pg_catalog.count(*),
    pg_catalog.count(*) filter (where trigger_info.tgenabled = 'O'),
    pg_catalog.count(*) filter (
      where trigger_info.tgtype::integer = 5
    )
  into v_trigger_count, v_enabled_count, v_insert_row_after_count
  from pg_catalog.pg_trigger as trigger_info
  join pg_catalog.pg_class as relation
    on relation.oid = trigger_info.tgrelid
  join pg_catalog.pg_namespace as relation_namespace
    on relation_namespace.oid = relation.relnamespace
  join pg_catalog.pg_proc as procedure
    on procedure.oid = trigger_info.tgfoid
  join pg_catalog.pg_namespace as procedure_namespace
    on procedure_namespace.oid = procedure.pronamespace
  where relation_namespace.nspname = 'auth'
    and relation.relname = 'users'
    and procedure_namespace.nspname = 'public'
    and procedure.proname = 'handle_new_user'
    and not trigger_info.tgisinternal;

  if v_trigger_count <> 1
    or v_enabled_count <> 1
    or v_insert_row_after_count <> 1
  then
    raise exception 'Expected one enabled AFTER INSERT auth.users trigger for public.handle_new_user().';
  end if;
end;
$$;

comment on function public.generate_customer_id() is
  'Private trigger helper that allocates MGA customer references from the schema-qualified sequence.';
comment on function public.set_customer_id() is
  'Private BEFORE INSERT trigger that assigns a customer reference through public.generate_customer_id().';

commit;
