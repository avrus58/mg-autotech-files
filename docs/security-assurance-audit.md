# Platform Security Assurance Audit

## Scope

This audit covers the MG AutoTech web application and customer uploader source boundaries without connecting to production data. It combines static source assertions, dependency auditing, production-build inspection, local anonymous API checks, responsive browser QA, and safe malformed-input tests.

The local dynamic smoke command is:

```powershell
$env:BASE_URL="http://127.0.0.1:3000"
node scripts/security-smoke-local.mjs
```

The script refuses non-local HTTP targets and carries no credentials. Run the local application with disposable/local service configuration only: the smoke does not brute-force credentials, create users, upload files, mutate orders, call Stripe or send email, but the application routes under test may use whatever backend configuration the local process was given.

## Automated Boundaries

- Every discovered `/api/admin/**` method must deny anonymous requests.
- Customer upload, request, delivery, message, email and billing-management APIs must deny anonymous requests.
- Client components must not import service-role, Stripe secret or server email modules.
- Desktop finalization must verify the authenticated customer path, upload session, private object existence, current credits and duplicate request state.
- Stripe webhook processing must verify the Stripe signature before handling an event.
- Login and auth callback redirects must remain same-origin relative paths.
- Private and authentication pages must be non-cacheable, non-indexable and protected against framing.
- Public observability must reject unknown fields and oversized payloads.
- URL enrichment must reject loopback, private, link-local, reserved and IPv4-mapped IPv6 targets.
- Widget/embed pages remain outside the private page frame-deny rule because embedding is their intended product behavior.

## Data Safety

The security tests do not read `.env` files or secrets. They do not use customer accounts, customer files, signed URLs, storage paths, payment data or firmware. No database migration or production mutation is part of this audit.

## Findings Fixed

- Vehicle URL enrichment now rejects IPv4-mapped IPv6 loopback/private targets, the complete IPv6 link/site-local range, multicast targets and non-public IPv4 documentation/benchmark ranges before DNS or fetch work begins.
- File Expert admin feedback now uses the central `file_expert.manage` bearer guard. Anonymous requests are rejected before Supabase initialization instead of becoming a connection-dependent server error.
- Customer revision requests now authenticate before parsing input or creating service clients. Invalid JSON returns a bounded `400`; anonymous requests return `401`; existing customer ownership checks remain unchanged.
- Private/authentication pages now add frame denial, no-store, noindex and restrictive page-level CSP headers while widget/embed framing remains available.
- Homepage vehicle selects and the icon-only registration link now expose accessible names without changing the visible layout.

## Verification Snapshot

- 69 discovered admin API methods denied anonymous local production requests.
- 16 high-risk customer API routes denied anonymous requests.
- 8 private/auth pages returned frame, cache and indexing protections.
- Public app-check, vehicle catalog and observability validation checks passed.
- Responsive checks at 390x844, 768x1024, 1366x768 and 1920x1080 found no body-level horizontal overflow or browser console errors.
- Local warm vehicle-catalog responses settled at approximately 10-12 ms after the first fallback/cache fill. The homepage production entry remained below the repository's 80 KB gzip JavaScript budget.
- Sitemap returned 146 public URLs with no admin, dashboard, login, request or payment route exposure.

## Residual Risks

- In-memory rate limits are instance-local. A distributed rate-limit store would provide stronger protection against coordinated abuse across serverless instances.
- URL enrichment validates DNS before the exact one-page fetch and blocks redirects, but a hardened DNS-pinned transport would further reduce theoretical DNS-rebinding risk.
- Provider acceptance is not final email delivery proof. Resend delivery/bounce webhook reconciliation remains a separate operational improvement.
- Authenticated role and cross-tenant behavior is strongly covered by source/unit tests, but a complete staging E2E run still requires disposable staging users and a non-production database.
- A full CSP with nonces/hashes requires a separate compatibility rollout because Next.js runtime scripts, analytics and the embeddable widget must be tested together.

## Safe Release Gate

Before release, run lint, full typecheck, all tests, production build, web performance budget, i18n/SEO validation, production dependency audit, local security smoke and responsive browser checks. Production penetration testing or high-volume scanning is not included and must only be performed through an explicitly approved test window.
