# Platform reliability hardening

## Scope

This layer protects the existing MG AutoTech request, admin and customer
workflows. It does not change payments, vehicle data, file processing or
customer authorization rules.

## Session and refresh behavior

- Verified sessions are cached only in the current browser process. They are
  never retained in shared Next.js server memory.
- API authorization remains server-side on every protected request.
- A temporary access/profile response cannot become an admin denial until the
  protected access endpoint independently repeats the denial.
- Customer dashboard queries run concurrently, background refreshes cannot
  overlap and polling pauses in hidden tabs.
- Previously verified dashboard/admin data stays visible during a temporary
  refresh failure. Initial-load failures keep an explicit retry state.

## Runtime diagnostics

The global reliability monitor records only an allowlisted event envelope:

- event kind and coarse failure category;
- normalized route (private UUID/opaque identifiers become `:id`);
- Core Web Vital name, bounded value and rating;
- coarse country and device class added by the server.

It never records an error message, stack trace, customer/account/order ID,
query string, filename, file content, storage path, vehicle data or payment
data. Events are rate-limited and written as structured Vercel runtime logs.
The endpoint stores no database rows.

## Email reliability

- The database idempotency key still prevents duplicate business events.
- Resend receives a SHA-256-derived provider idempotency key, so the provider
  can safely deduplicate a repeated network submission.
- Only transient provider/network failures receive bounded retries. Invalid
  recipients, authentication failures and other permanent errors do not loop.
- The Operations Intelligence page continues to show pending, failed, skipped
  and accepted-provider event totals. Provider acceptance is not proof of inbox
  delivery; production delivery webhooks remain the next observability step.

## SEO and conversion

The existing consent-aware GA4 request funnel and read-only Search Console
report remain unchanged. Operations Intelligence now exposes whether both
server reporting sources are configured, without exposing credentials.

## Verification

Run:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run check:performance
npm audit --omit=dev --audit-level=high
git diff --check
```

Manual responsive smoke widths: 390x844, 768x1024, 1366x768 and 1920x1080.
Confirm protected views retain verified content during a disconnected refresh,
real logout still shows login, and fatal-error retry does not reveal details.
