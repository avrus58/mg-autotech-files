# MG AutoTech Architecture And Production Hardening Review

Date: 2026-07-09
Scope: full project review after ECU Intelligence Level 2. This is an architecture and production hardening audit, not a new AI feature plan.

## Executive Summary

The platform is commercially usable for a controlled launch, but it is not yet at "hundreds of paying customers without operational guardrails" maturity. The core security direction is good: Supabase auth is enforced, admin APIs use permission checks, AI learning is gated, and payment records now have reconciliation tables. The remaining risk is mostly around operational hardening: distributed rate limiting, migration discipline, server-side upload finalization for all customer files, stronger payment atomicity for manual flows, background processing, and observability.

Safe fixes applied in this pass:

- Protected `/api/email/new-order` from unauthenticated email relay abuse.
- Added rate limiting and strict schema validation to `/api/email/new-customer`.
- Added shared in-memory rate-limit utility.
- Added client-side request file size and extension validation for the main order flow.
- Added a regression test for the rate limiter.

No deploy was performed.

Verification run after the fixes:

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm test`: passed, 54/54 tests
- `npm run build`: passed

## Scores

- Architecture score: 78/100
- Security score: 82/100
- Scalability score: 69/100
- Maintainability score: 66/100
- AI readiness score: 84/100
- Estimated commercial launch readiness: 78%

## Issue Register

### Critical

1. Public order email endpoint could be abused as an email relay.
Status: fixed in this pass.
Why: `/api/email/new-order` trusted request body fields and could send MG AutoTech email to arbitrary addresses.
Impact: domain reputation risk, spam abuse, support noise.
Migration difficulty: low.
Estimated benefit: high.

### High

1. Rate limiting is not distributed across all public and authenticated mutation APIs.
Status: partially improved.
Why: the new in-memory helper protects email endpoints, but Vercel serverless instances do not share memory.
Impact: abusive traffic can still pressure email, widget, payment confirmation, vehicle lookup, and upload endpoints.
Migration difficulty: medium. Use Redis/Upstash/Supabase-backed buckets or Vercel Edge Config/KV.
Estimated benefit: high.

2. Main order upload still uses direct client-to-Supabase upload.
Status: partially improved with client-side validation.
Why: client-side file checks are user-friendly, but not a hard security boundary.
Impact: a malicious client could attempt oversized or unsupported storage uploads if bucket policies allow it.
Migration difficulty: medium. Move main request upload to prepare/finalize API like additional uploads and File Expert.
Estimated benefit: high.

3. SQL migration management is manual.
Status: remaining.
Why: production depends on manually run SQL scripts; no formal migration ledger or CI schema verification.
Impact: schema drift, missing columns/policies, deploy-time surprises.
Migration difficulty: medium.
Estimated benefit: high.

4. Heavy AI/File Expert work is synchronous.
Status: remaining.
Why: analysis, similarity rebuilds, and cluster rebuilds run inside request/route lifecycles.
Impact: timeouts or slow admin UX as samples grow.
Migration difficulty: medium to high. Introduce queued background jobs.
Estimated benefit: high.

5. External File Expert analyzer trust boundary needs a shared secret.
Status: completed in the 2026-08 upload-integrity hotfix.
Control: the caller requires a safe analyzer URL plus a server-only token before
creating signed URLs. The analyzer authenticates before parsing the body,
allowlists exact HTTPS source hosts, rejects private DNS results and redirects,
and streams sources under byte/time limits. Local paths are disabled unless a
dedicated safe root is configured.
Remaining operations requirement: configure the same token on both services and
the exact signed-URL host allowlist on the analyzer.

### Medium

1. Admin and dashboard route protection is mostly client-side at page level.
Why: API authorization is strong, but server-side page redirect would reduce flashes and accidental rendering.
Impact: mostly UX/security posture, not direct data exposure because APIs/RLS protect data.
Migration difficulty: medium.

2. Large client components are accumulating technical debt.
Examples: `src/app/admin/page.tsx`, `src/app/new-request/page.tsx`, `src/app/page.tsx`, `src/lib/i18n.ts`.
Impact: slower changes, higher regression risk.
Migration difficulty: medium.

3. Vehicle database is a large JSON asset.
Impact: okay now, but filtering/search and widget scaling should move toward indexed DB or generated compact indexes.
Migration difficulty: medium.

4. Admin list endpoints use fixed large limits.
Examples: payments loads up to 500 payment records, 1,000 ledger/customer rows.
Impact: acceptable now, but expensive at scale.
Migration difficulty: low to medium.

5. Observability is limited.
Impact: production issues will be found by user reports, not proactively.
Migration difficulty: low to medium. Add Sentry/Logtail and structured server logs.

6. Audit logging is partial.
Good coverage exists for payment, staff, widget, and AI events, but not every admin mutation has a consistent audit record.
Migration difficulty: medium.

7. Local env contains legacy SumUp keys while production no longer uses SumUp.
Impact: low operational confusion and secret sprawl.
Migration difficulty: low.

8. Storage path and object policy verification is documented but not automated.
Impact: policy drift could expose files if a manual SQL change is wrong.
Migration difficulty: medium.

### Low

1. Some comments/text still show encoding artifacts in source comments.
Impact: no runtime impact.

2. Several admin pages use custom auth fetch implementations instead of one shared helper.
Impact: maintenance friction.

3. Legal and SEO content should be reviewed by a professional before aggressive paid acquisition.
Impact: business/legal polish.

### Future Improvement

1. Replace in-memory rate limiting with global distributed limits.
2. Move AI rebuilds and File Expert analysis to a job queue.
3. Add schema drift tests against Supabase.
4. Add Playwright smoke tests for customer/admin happy paths.
5. Add customer-facing SLA/incident status page if traffic grows.
6. Split i18n into per-locale chunks or generated dictionaries.
7. Add OpenTelemetry/Sentry for API latency and error rates.
8. Build a proper admin audit timeline for every order and profile mutation.

## Area Review

### Authentication

Supabase auth is used consistently. Email verification is enforced in critical customer APIs. Browser auth has been hardened against transient token refresh races.

Remaining: add server-side route guards for admin/dashboard pages to improve posture and UX.

### Authorization / RBAC

Admin APIs use `requireStaffPermission` or `requirePrimaryOwner`. Staff permissions are structured and owner protection exists in SQL.

Remaining: centralize client `authFetch` usage and add automated tests for each admin endpoint permission.

### RLS Policies

RLS is enabled in the migration scripts for AI, File Expert, widget, payments, notifications, and commercial policy tables. Storage policies scope customer file paths by auth uid.

Remaining: no automated production schema/RLS drift check.

### API Security

Most sensitive APIs are protected. The public email relay issue was fixed. Widget public APIs validate widget key/session/domain. Webhooks verify Stripe signatures.

Remaining: distributed rate limiting and stronger manual-payment idempotency.

### File Upload And Binary Isolation

File Expert has 32 MB server-side limits and safe public result shaping. Customer additional upload uses prepare/finalize. Main new-request upload now has client validation but still lacks server finalize.

Remaining: hard server-side size/type enforcement for main request uploads.

### AI Training Integrity

Level 0/1/2 rules are conservative: only approved, confirmed, quality-gated samples are trusted. No raw binary/hex is exposed to customers. Level 2 remains evidence-only.

Remaining: background jobs and stronger large-sample performance profiling.

### Payments And Credits

Stripe webhook is signed and idempotent. Payment records/event logs exist. Admin refund flow is guarded. Customer-specific pricing exists.

Remaining: manual credit mutation should be DB-transactional with unique source constraints where possible. Legacy provider records remain readable, but new credit purchases are limited to Stripe and bank transfer.

### Performance And Scalability

Current scale is fine for early usage. The biggest future pressure points are large JSON vehicle data, synchronous AI rebuilds, admin list endpoints, and storage-heavy file flows.

### Monitoring And Operations

Build/lint/tests are in place. No dedicated production observability or alerting is configured in code.

## Roadmap

### Phase A - Must Fix Before Public Launch

- Add distributed rate limiting for public and mutation APIs.
- Move main new-request upload to server prepare/finalize with hard size/type checks.
- Add manual payment idempotency checks and reconciliation review workflow.
- Add schema migration ledger and production schema verification checklist.
- Add Sentry or equivalent error monitoring.
- Add server-side admin/dashboard route guards.

### Phase B - Recommended During First 100 Customers

- Split large admin/new-request/home components.
- Add Playwright smoke tests for login, order creation, credits, File Expert, admin status update.
- Add audit records for every admin mutation.
- Add paginated admin tables.
- Add storage lifecycle cleanup for failed/abandoned upload objects.

### Phase C - Scale To 1,000 Customers

- Move File Expert analysis and AI cluster rebuilds to background jobs.
- Move vehicle database to indexed DB/search tables or generated compact indexes.
- Add Redis/KV-backed rate limits and idempotency keys across payments/uploads.
- Add operational dashboards for payments, upload failures, analysis failures, and queue latency.

### Phase D - Scale To 10,000+ Customers

- Dedicated job workers and queue monitoring.
- Tenant-aware data partitioning strategy for widget/vehicle/query-heavy tables.
- Advanced caching for vehicle lookup and public SEO pages.
- Full SOC-style audit exports and admin permission review workflow.
- Data retention policy for binaries, AI samples, logs, and payment records.
