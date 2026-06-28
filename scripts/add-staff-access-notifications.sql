-- MG AutoTech staff permissions, customer notifications and controlled re-upload.
-- Run once in Supabase SQL Editor. Existing customer/order data is preserved.

begin;

alter table public.profiles
  add column if not exists staff_role text,
  add column if not exists staff_permissions text[] not null default '{}'::text[],
  add column if not exists staff_updated_at timestamptz;

-- Replace legacy role checks that only allowed customer/admin.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
      and pg_get_constraintdef(oid) not ilike '%staff%'
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_row.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check_v2'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check_v2
      check (role in ('customer', 'staff', 'admin'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_staff_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_staff_role_check
      check (staff_role is null or staff_role in ('owner', 'manager', 'calibrator', 'support'));
  end if;
end $$;

-- The oldest existing admin becomes the permanent Primary Owner.
update public.profiles
set staff_role = 'owner',
    staff_permissions = array['*']::text[],
    staff_updated_at = now()
where id = (
  select id
  from public.profiles
  where role = 'admin'
  order by created_at asc nulls last, id asc
  limit 1
)
and not exists (
  select 1 from public.profiles where staff_role = 'owner'
);

-- Any additional legacy admins are converted to permission-based staff.
update public.profiles
set role = 'staff',
    staff_role = coalesce(staff_role, 'manager'),
    staff_permissions = case
      when coalesce(array_length(staff_permissions, 1), 0) = 0 then
        array[
          'orders.view', 'orders.manage', 'files.download', 'files.upload',
          'messages.manage', 'customers.view', 'customers.manage',
          'credits.manage', 'file_expert.manage'
        ]::text[]
      else staff_permissions
    end,
    staff_updated_at = now()
where role = 'admin' and staff_role is distinct from 'owner';

create unique index if not exists profiles_one_primary_owner_idx
  on public.profiles ((staff_role))
  where staff_role = 'owner';

create or replace function public.is_primary_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and staff_role = 'owner'
  );
$$;

create or replace function public.has_staff_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (
        (role = 'admin' and staff_role = 'owner')
        or (
          role = 'staff'
          and required_permission <> 'staff.manage'
          and required_permission = any(staff_permissions)
        )
      )
  );
$$;

revoke all on function public.is_primary_owner() from public;
revoke all on function public.has_staff_permission(text) from public;
grant execute on function public.is_primary_owner() to authenticated;
grant execute on function public.has_staff_permission(text) to authenticated;

create or replace function public.staff_adjust_customer_credits(
  p_customer_id uuid,
  p_amount numeric,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance numeric;
  next_balance numeric;
  transaction_id text := gen_random_uuid()::text;
begin
  if not public.has_staff_permission('credits.manage') then
    raise exception 'Credit management permission is required.';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'Credit amount must not be zero.';
  end if;

  select coalesce(credit_balance, 0)
  into current_balance
  from public.profiles
  where id = p_customer_id
  for update;

  if not found then raise exception 'Customer was not found.'; end if;
  next_balance := current_balance + p_amount;

  update public.profiles set credit_balance = next_balance where id = p_customer_id;
  insert into public.credit_transactions (
    user_id, type, source_type, source_id, credits_delta, balance_after,
    description, amount_total, currency, metadata
  ) values (
    p_customer_id, 'adjustment', 'staff_adjustment', transaction_id,
    p_amount, next_balance, coalesce(nullif(trim(p_note), ''), 'Staff credit adjustment'),
    null, null, jsonb_build_object('actor_id', auth.uid())
  );

  return next_balance;
end;
$$;

revoke all on function public.staff_adjust_customer_credits(uuid, numeric, text) from public;
grant execute on function public.staff_adjust_customer_credits(uuid, numeric, text) to authenticated;

create or replace function public.protect_staff_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.staff_role = 'owner' and (
    new.role is distinct from old.role
    or new.staff_role is distinct from old.staff_role
    or new.staff_permissions is distinct from old.staff_permissions
  ) then
    raise exception 'The Primary Owner security role cannot be changed.';
  end if;

  if (
    new.role is distinct from old.role
    or new.staff_role is distinct from old.staff_role
    or new.staff_permissions is distinct from old.staff_permissions
  ) and auth.role() <> 'service_role' and not public.is_primary_owner() then
    raise exception 'Only the Primary Owner can change staff access.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_staff_security_fields_trigger on public.profiles;
create trigger protect_staff_security_fields_trigger
before update on public.profiles
for each row execute function public.protect_staff_security_fields();

create or replace function public.protect_primary_owner_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.staff_role = 'owner' then
    raise exception 'The Primary Owner account cannot be deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_primary_owner_delete_trigger on public.profiles;
create trigger protect_primary_owner_delete_trigger
before delete on public.profiles
for each row execute function public.protect_primary_owner_delete();

create table if not exists public.staff_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  previous_access jsonb,
  new_access jsonb,
  created_at timestamptz not null default now()
);

alter table public.staff_audit_log enable row level security;
drop policy if exists "Primary owner can read staff audit log" on public.staff_audit_log;
create policy "Primary owner can read staff audit log"
on public.staff_audit_log for select to authenticated
using (public.is_primary_owner());

alter table public.orders
  add column if not exists customer_upload_enabled boolean not null default false,
  add column if not exists customer_uploads jsonb not null default '[]'::jsonb;

create or replace function public.protect_order_upload_controls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.customer_upload_enabled is distinct from old.customer_upload_enabled
    or new.customer_uploads is distinct from old.customer_uploads
  ) and auth.role() <> 'service_role' and not public.has_staff_permission('orders.manage') then
    raise exception 'Controlled order upload fields can only be changed by authorized staff.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_order_upload_controls_trigger on public.orders;
create trigger protect_order_upload_controls_trigger
before update on public.orders
for each row execute function public.protect_order_upload_controls();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  type text not null check (type in (
    'admin_message', 'order_status', 'file_ready', 'additional_upload_enabled', 'system'
  )),
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "Customers can read own notifications" on public.notifications;
create policy "Customers can read own notifications"
on public.notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Customers can update own notifications" on public.notifications;
create policy "Customers can update own notifications"
on public.notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.protect_notification_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and (
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.order_id is distinct from old.order_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.metadata is distinct from old.metadata
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Only notification read state can be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_notification_content_trigger on public.notifications;
create trigger protect_notification_content_trigger
before update on public.notifications
for each row execute function public.protect_notification_content();

create or replace function public.create_customer_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  if new.sender_role <> 'admin' then return new; end if;
  select customer_id into recipient from public.orders where id = new.request_id;
  if recipient is null then return new; end if;

  insert into public.notifications (user_id, order_id, type, title, body)
  values (
    recipient,
    new.request_id,
    'admin_message',
    'New message from MG AutoTech',
    left(new.message, 240)
  );
  return new;
end;
$$;

drop trigger if exists request_message_customer_notification on public.request_messages;
create trigger request_message_customer_notification
after insert on public.request_messages
for each row execute function public.create_customer_message_notification();

create or replace function public.create_customer_order_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null then return new; end if;

  if new.status is distinct from old.status then
    insert into public.notifications (user_id, order_id, type, title, body, metadata)
    values (
      new.customer_id,
      new.id,
      case when new.status = 'completed' then 'file_ready' else 'order_status' end,
      case when new.status = 'completed' then 'Your file is ready' else 'Order status updated' end,
      case when new.status = 'completed'
        then 'Your completed file is ready to download.'
        else 'New status: ' || replace(initcap(replace(new.status, '_', ' ')), '_', ' ')
      end,
      jsonb_build_object('status', new.status)
    );
  end if;

  if new.customer_upload_enabled is true
     and new.customer_upload_enabled is distinct from old.customer_upload_enabled then
    insert into public.notifications (user_id, order_id, type, title, body)
    values (
      new.customer_id,
      new.id,
      'additional_upload_enabled',
      'Additional file upload enabled',
      'You can now upload another file inside this request.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists order_customer_notification on public.orders;
create trigger order_customer_notification
after update on public.orders
for each row execute function public.create_customer_order_notification();

-- Permission-based staff access. Legacy admin policies still cover only the owner,
-- because all additional staff use role = 'staff'.
drop policy if exists "Staff can read orders by permission" on public.orders;
create policy "Staff can read orders by permission"
on public.orders for select to authenticated
using (public.has_staff_permission('orders.view'));

drop policy if exists "Staff can update orders by permission" on public.orders;
create policy "Staff can update orders by permission"
on public.orders for update to authenticated
using (public.has_staff_permission('orders.manage'))
with check (public.has_staff_permission('orders.manage'));

drop policy if exists "Staff can read profiles by permission" on public.profiles;
create policy "Staff can read profiles by permission"
on public.profiles for select to authenticated
using (
  public.has_staff_permission('customers.view')
  or public.has_staff_permission('staff.manage')
);

drop policy if exists "Staff can update customers by permission" on public.profiles;
create policy "Staff can update customers by permission"
on public.profiles for update to authenticated
using (public.has_staff_permission('customers.manage'))
with check (public.has_staff_permission('customers.manage'));

drop policy if exists "Staff can read request messages" on public.request_messages;
create policy "Staff can read request messages"
on public.request_messages for select to authenticated
using (public.has_staff_permission('messages.manage'));

drop policy if exists "Staff can create request messages" on public.request_messages;
create policy "Staff can create request messages"
on public.request_messages for insert to authenticated
with check (public.has_staff_permission('messages.manage'));

drop policy if exists "Staff can read customer files" on storage.objects;
create policy "Staff can read customer files"
on storage.objects for select to authenticated
using (
  bucket_id = 'customer-files'
  and public.has_staff_permission('files.download')
);

drop policy if exists "Staff can upload customer files" on storage.objects;
create policy "Staff can upload customer files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-files'
  and public.has_staff_permission('files.upload')
);

do $$
begin
  if to_regclass('public.file_expert_jobs') is not null then
    execute 'drop policy if exists "Staff can manage file expert jobs by permission" on public.file_expert_jobs';
    execute 'create policy "Staff can manage file expert jobs by permission" on public.file_expert_jobs for all to authenticated using (public.has_staff_permission(''file_expert.manage'')) with check (public.has_staff_permission(''file_expert.manage''))';
  end if;
  if to_regclass('public.file_expert_feedback') is not null then
    execute 'drop policy if exists "Staff can manage file expert feedback by permission" on public.file_expert_feedback';
    execute 'create policy "Staff can manage file expert feedback by permission" on public.file_expert_feedback for all to authenticated using (public.has_staff_permission(''file_expert.manage'')) with check (public.has_staff_permission(''file_expert.manage''))';
  end if;
  if to_regclass('public.known_file_patterns') is not null then
    execute 'drop policy if exists "Staff can manage known patterns by permission" on public.known_file_patterns';
    execute 'create policy "Staff can manage known patterns by permission" on public.known_file_patterns for all to authenticated using (public.has_staff_permission(''file_expert.manage'')) with check (public.has_staff_permission(''file_expert.manage''))';
  end if;
  if to_regclass('public.file_fingerprints') is not null then
    execute 'drop policy if exists "Staff can manage fingerprints by permission" on public.file_fingerprints';
    execute 'create policy "Staff can manage fingerprints by permission" on public.file_fingerprints for all to authenticated using (public.has_staff_permission(''file_expert.manage'')) with check (public.has_staff_permission(''file_expert.manage''))';
  end if;
end $$;

drop policy if exists "Staff can read file expert objects" on storage.objects;
create policy "Staff can read file expert objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'file-expert'
  and public.has_staff_permission('file_expert.manage')
);

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

commit;

-- Verification:
-- select id, email, role, staff_role, staff_permissions from public.profiles order by created_at;
