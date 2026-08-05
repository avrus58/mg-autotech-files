begin;

alter table public.request_messages enable row level security;

-- Request chat is intentionally API-only. The server verifies order ownership or
-- messages.manage before using its service-role client and returns a customer-safe
-- projection. Removing direct Data API access also keeps hide/audit metadata private.
drop policy if exists "Allow authenticated insert request messages"
  on public.request_messages;
drop policy if exists "Allow authenticated select request messages"
  on public.request_messages;
drop policy if exists "Users can view request messages"
  on public.request_messages;
drop policy if exists "Staff can create request messages"
  on public.request_messages;
drop policy if exists "Staff can read request messages"
  on public.request_messages;

revoke all privileges on table public.request_messages from anon;
revoke all privileges on table public.request_messages from authenticated;

grant select, insert, update, delete on table public.request_messages to service_role;

comment on table public.request_messages is
  'Private request conversation ledger. Access is server API only; customer responses use an explicit safe projection.';

commit;
