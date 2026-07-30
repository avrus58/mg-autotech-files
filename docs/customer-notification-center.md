# Customer Notification Center

## Purpose

`/dashboard/notifications` gives each customer a durable, filterable view of
their account notifications. It complements the existing header dropdown and
does not replace order conversation or transactional email.

## Behavior

- Filters: all, unread, messages, orders, and files.
- Customers can mark one notification or all notifications as read.
- Realtime updates use the existing Supabase notification channel.
- Loading, empty, retry, and error states are explicit.

## Security

The page uses the existing Row Level Security boundary on `notifications` and
always filters by the authenticated user ID. It does not use an admin client or
service-role credential. Customers cannot choose another user ID.

Notification projections contain only customer-safe title, message, category,
read state, safe link, and timestamp fields. They do not include internal
notes, risk flags, source metadata, confidence values, storage paths, signed
URLs, raw/hex data, payment internals, or audit events.

## Smoke Checklist

1. Open `/dashboard/notifications` as a customer.
2. Confirm the same unread count appears in the header dropdown.
3. Exercise each filter and the empty state.
4. Mark one item and then all items as read.
5. Open a safe linked order or dashboard destination.
6. Confirm a second customer cannot read the first customer's notifications.
7. Confirm anonymous access redirects to login.
