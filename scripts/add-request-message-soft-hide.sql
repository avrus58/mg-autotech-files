-- MG AutoTech request message soft-hide/archive support
-- Safe additive migration. No destructive operations.

begin;

alter table public.request_messages
  add column if not exists visibility_status text not null default 'visible',
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id) on delete set null,
  add column if not exists hidden_reason text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid references auth.users(id) on delete set null;

alter table public.request_internal_notes
  add column if not exists visibility_status text not null default 'visible',
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id) on delete set null,
  add column if not exists hidden_reason text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid references auth.users(id) on delete set null,
  add column if not exists linked_request_message_id uuid references public.request_messages(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'request_messages_visibility_status_check'
  ) then
    alter table public.request_messages
      add constraint request_messages_visibility_status_check
      check (visibility_status in ('visible', 'hidden', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'request_internal_notes_visibility_status_check'
  ) then
    alter table public.request_internal_notes
      add constraint request_internal_notes_visibility_status_check
      check (visibility_status in ('visible', 'hidden', 'archived'));
  end if;
end $$;

create index if not exists request_messages_visible_request_idx
  on public.request_messages(request_id, created_at)
  where visibility_status = 'visible';

create index if not exists request_messages_hidden_request_idx
  on public.request_messages(request_id, hidden_at desc)
  where visibility_status in ('hidden', 'archived');

create index if not exists request_internal_notes_linked_message_idx
  on public.request_internal_notes(linked_request_message_id)
  where linked_request_message_id is not null;

create index if not exists request_internal_notes_visibility_idx
  on public.request_internal_notes(request_id, visibility_status, created_at desc);

alter table public.request_messages enable row level security;
alter table public.request_internal_notes enable row level security;

comment on column public.request_messages.visibility_status is
  'Customer-facing visibility state. Customer APIs must return only visible or legacy-null messages.';
comment on column public.request_messages.hidden_reason is
  'Admin-only reason for hiding a request message from the customer. Never expose to customer APIs.';
comment on column public.request_internal_notes.visibility_status is
  'Admin note visibility state for customer-visible note history. Hidden notes remain admin-visible.';
comment on column public.request_internal_notes.linked_request_message_id is
  'Optional link to the customer-facing request_messages row copied from a customer-visible admin note.';

commit;

-- Verification:
-- select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'request_messages' and column_name in ('visibility_status','hidden_at','hidden_by','hidden_reason','restored_at','restored_by');
-- select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'request_internal_notes' and column_name in ('visibility_status','hidden_at','hidden_by','hidden_reason','restored_at','restored_by','linked_request_message_id');
