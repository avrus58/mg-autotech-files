# Production release: completed-order PDF reports

Owner authorization: "guzel yayinla bunu", followed by "devam et".
Released on 2026-09-07; app started at 14:08:38 UTC.

## Exact source and scope

- Source: `65a53b606b5fd64f84ebff15725a92f619c26024`.
- Branch: `codex/post-service-reports-20260907`, pushed and remote SHA verified.
- Previous live source/tag: `e1b3266f3bf8`; live-derived feature base `454ddac`.
- Archive SHA-256, identical locally and on VPS:
  `8beb2015f561ea1cd5c9de37cbbfa0449ca9e1753afe2559a1b31e9523438234`.
- Source directory: `/opt/mgautotech/file-service/releases/65a53b606b5f`.
- Optional customer logo, completed-order PDF download, compact admin report
  details, sourced before/after performance values, private immutable revisions,
  12-locale report/UI copy and required native/font packaging only. No unrelated
  dirty checkout or unpublished customer-guide work was included.
- No pricing, payment settings, firmware generation/delivery, legal copy,
  vehicle catalog, Caddy/DNS or main-site implementation change.

## Database and recovery

Applied only reviewed additive `20260907111225_service_report_snapshots.sql`
to Production project `jujaeyvyaeesmipihrrw`. Its reviewed SQL SHA-256 is
`e614af00e85e5e221a0a15f880c6d8a7c98c8cc1644da3d6de9d4e47843df7d9`.
Supabase's apply-migration tool recorded version **20260907130634**, name
`service_report_snapshots`; this maps to the source migration above. Do not
apply the same SQL again solely because the tool-assigned timestamp differs.

Preflight inspected schema metadata only: required order/profile fields and
service-role privileges exist; `customer-files` is private, permits PNG/JPEG,
and restrictive authenticated/anonymous UPDATE/DELETE boundaries are present.
Post-apply verified 3 RLS tables, 14 constraints, no anonymous/authenticated
table or RPC access, service-role-only SECURITY INVOKER RPCs with empty
search_path, and append-only details/snapshot grants. Branding alone permits
service-role UPDATE. Storage controls remain unchanged after deployment.

No existing customer rows were read or changed. The migration creates new
objects transactionally and leaves existing tables/grants unchanged. Recovery
is the previous app/analyzer pair, leaving additive tables and issued history
intact; no destructive down migration or reset is appropriate:

```bash
cd /opt/mgautotech/file-service/releases/65a53b606b5f
bash scripts/vps/rollback.sh e1b3266f3bf8
```

Parent order/profile deletion still follows the explicit foreign-key cascade;
append-only application permissions do not promise survival of intentional
parent deletion. No deletion was performed in Production.

## Validation and a caught packaging defect

- Final source: full tests **1591/1591**, zero failed/skipped; full lint and
  web/desktop typecheck PASS. Focused native packaging regressions **10/10**.
- VPS Linux/Turbopack build PASS: all 12 locales, zero clean English fallbacks,
  2448 reviewed strings per non-English locale, 37 bundle tests, 281 pages.
- First Linux postbuild correctly blocked cutover: Next tracing omitted Sharp's
  separate musl libvips shared library. Exact report/branding native tracing and
  an expanded permanent asset guard fixed it. The failing image was never live.
- Final postbuild: **69 assets** (5 report font/license, 30 PDFKit, 34 installed
  Sharp/native files), compiled private 401, native PNG/PDF, no external fetch.
- Final runner image tested non-root, read-only, network-none, no Production
  runtime credentials: **14/14** actual compiled-route scenarios PASS, including
  real Sharp resize, private logo storage adapter, DE/TR/ZH PDF, incomplete409,
  other-owner404, render-time reopen409, second auth check and logo removal
  retaining immutable history. Backend responses were synthetic in memory.
- Disposable PostgreSQL **17.11**: **7/7 groups** passed. Separate sessions
  observed actual lock waits; issuance reused one snapshot and concurrent CAS
  admitted one save, rejecting the other with SR412. Ownership/state denials,
  10 permission denials, revisions and provenance bounds passed. Unique
  network-none/tmpfs-only test containers were removed and absence verified.
- Previously validated unchanged report/UI: all 12 PDF languages, 14 fixtures /
  18 visually inspected pages; 11 customer and 6 admin Chrome scenarios. No UI,
  translations or PDF layout changed in the native packaging correction.
- An ignored temporary CJS provider probe was archived as text after lint
  flagged its require syntax; no lint rule was weakened. Final lint passed.

## Cutover and immediate checks

Reviewed `scripts/vps/deploy.sh 65a53b606b5f` succeeded. Both services healthy,
zero restarts. Final image identifiers:

- App: `sha256:72eb13b80b1b667ae2875d86de34ff248ed25edbfb684cbe9cefd54ebd0c1b29`.
- Analyzer: `sha256:199e495a9b64a077d6f10248a749b43a2cb829d4104eeb88489af8ad9f829a33`.
- Cached deploy preserved the tested app manifest/config; Docker regenerated
  attestation metadata. The 14/14 isolated runner test was repeated against the
  final deployed image tag after cutover.

**34/34 live HTTP checks** passed: all 12 initial HTML languages/canonicals,
English `/en` to `/` redirect, auth/public auxiliary pages, readiness, all six
unauthenticated report API method checks (private/no-store401), current and four
previous hashed assets, and the separate main site. The first smoke expected
200 at `/en`; the harness was corrected to the existing canonical308 contract,
not the application.

Read-only provider probe inside the running app: all 3 new table endpoints
accessible with `limit=0`, nonexistent report denied SR404, distributed limiter
configuration valid and Redis PING returned PONG. No customer rows were fetched.
Caddy/main-site app start times remain 2026-09-06 19:22:19 / 19:22:11 UTC;
neither was recreated. Previous app/analyzer images are retained in release state.

## Evidence and limits

Ignored receipts: `.autopilot/runtime/service-reports/` final lint/typecheck/test,
`vps-build-final.log`, `production-deploy.log`, `linux-final-runner.log`,
`release-public-smoke.json`, `release-preflight.json`, and the disposable
PostgreSQL receipt under `release/`. This release does not claim a real customer
authenticated Production upload/download transaction, payment, email delivery,
or a new visual audit of unrelated pages. No real customer fixture was created.
Isolated Supabase staging was inactive; Linux runner plus disposable PostgreSQL
and Production metadata/provider checks were used without modifying staging.
