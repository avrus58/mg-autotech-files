# Upload integrity hardening

The desktop request and customer additional-file flows use a short-lived HMAC
contract plus server-side Storage metadata verification. Desktop finalization
also downloads the object and recomputes SHA-256. Configure this only on the
Next.js server:

```bash
UPLOAD_INTEGRITY_SECRET=<random-secret-at-least-32-characters>
```

Do not expose this value through `NEXT_PUBLIC_*` or `VITE_*` variables. Rotating
it invalidates prepared, not-yet-finalized uploads; existing orders are not
affected.

## Browser and desktop upload boundary

Customer JWTs no longer receive a general `storage.objects` INSERT policy for
`customer-files` or `file-expert`. Every active customer flow first passes a
rate-limited server prepare route. The service role then mints a Supabase signed
upload URL for one exact, random or idempotency-bound path with `upsert: false`:

- `/api/account/request-upload/prepare` for the main browser request;
- `/api/requests/:id/additional-file/prepare` for an approved additional file;
- `/api/file-expert/jobs/prepare` for File Expert ORI/MOD inputs;
- `/api/desktop/upload-session` for the desktop uploader.

The 32 MB bucket limits cap the signed upload itself. Production prepare routes
fail closed when the distributed account quota is unavailable. Because objects
are immutable and the signed token is bound to one path, replay cannot create a
second object at another name. The legacy 65 MB multipart File Expert endpoint
is disabled so it cannot buffer customer binaries inside the Next.js process.

The main request keeps its opaque submission key in session storage until the
server confirms the order. Only a SHA-256 digest of the request signature and
opaque IDs are stored; notes, e-mail and vehicle data are not. A reload/lost
response therefore reuses the same path and database idempotency claim rather
than creating a second debit.

Desktop finalization independently downloads and hashes the stored bytes. The
main browser request still has no independent full-file SHA-256 recomputation,
so its browser-declared content hash is not independently proven. Its exact path, object
existence, size ceiling, immutability, server-authoritative price and atomic
order/debit are enforced.

## Versioned migration (prepared, not deployed)

Supabase Storage bucket limits are defense in depth and must accompany the
server checks. Migration
`supabase/migrations/20260816002443_financial_authority_hardening.sql` contains
the following reviewed bucket configuration and immutable-object grant changes.
It must be applied and verified in isolated staging before Production:

```sql
begin;

update storage.buckets
set file_size_limit = 33554432,
    allowed_mime_types = array[
      'application/octet-stream',
      'application/x-binary',
      'application/zip',
      'application/x-zip-compressed',
      'text/plain'
    ]::text[]
where id = 'file-expert';

update storage.buckets
set file_size_limit = 33554432,
    allowed_mime_types = array[
      'application/octet-stream',
      'application/x-binary',
      'application/zip',
      'application/x-zip-compressed',
      'text/plain',
      'application/pdf',
      'image/jpeg',
      'image/png'
    ]::text[]
where id = 'customer-files';

commit;
```

Before applying a policy migration, inventory every existing Storage policy.
The prepared migration replaces known policies and adds restrictive boundaries
so an older permissive policy cannot widen either protected bucket:

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
```

Ordinary authenticated customer INSERT must remain absent. Only staff with the
reviewed `files.upload` permission may use the direct authenticated delivery
workflow; customer uploads use exact signed URLs:

```sql
create policy "MG customer files insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'customer-files'
  and public.has_staff_permission('files.upload')
);
```

Customer `UPDATE` must remain absent for immutable upload paths. Customer
`DELETE` should be denied after an upload is consumed, or mediated by an RPC
that checks no order/upload record references the object. Verify the migration
with `anon`, two authenticated users, and service-role test clients in isolated
staging before any production application.
