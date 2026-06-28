# Admin Security V2

Run `scripts/add-staff-access-notifications.sql` once in the Supabase SQL Editor.

The migration:

- promotes the oldest existing `admin` profile to the permanent Primary Owner;
- converts every additional admin to permission-based `staff`;
- adds manager, calibrator and support access profiles;
- protects owner and staff security fields with database triggers;
- adds a staff audit log;
- adds persistent customer notifications;
- adds one-time additional file uploads per order;
- adds permission-aware RLS policies for orders, customers, files, messages and File Expert.

After the SQL succeeds, open `/admin/team` with the current admin account. Existing
customer accounts can be promoted to staff from that screen. The Primary Owner cannot
be demoted, replaced or deleted.
