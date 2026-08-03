# Bot and Data Exfiltration Defense

## Goal

MG AutoTech must keep ordinary customer browsing, vehicle selection, desktop uploads and authenticated work fast while making automated enumeration, telemetry flooding and transactional-email abuse bounded and observable.

No public browser response can be made impossible to copy. The enforceable boundary is therefore:

- expose only the smallest customer-safe projection;
- require ownership or staff authorization for private data;
- remove bulk enumeration routes;
- throttle bursts and distributed traversal;
- emit privacy-safe security signals;
- add edge controls only after observing normal traffic.

## Application protection

`src/lib/abuseProtection.ts` adds a common two-level counter:

1. A fast warm-instance memory counter always runs.
2. An optional HTTPS Redis REST counter shares an atomic fixed-window count across instances.
3. If the shared provider is missing or temporarily unavailable, the existing local guard remains active and normal customers are not locked out.

The common guard is applied to:

- the progressive public vehicle catalog;
- public client reliability telemetry;
- authenticated registration, order and bank-transfer email triggers.

Vehicle selector limits remain deliberately tolerant. The progressive API still exposes only one hierarchy level at a time and keeps the existing CDN cache, database loader and JSON fallback order.

## Privacy boundary

The shared counter key contains an HMAC-SHA-256 fingerprint only. It never contains the raw IP address, customer/user ID, route query, order ID, e-mail, filename, storage path or vehicle source metadata.

Security logs use the `[security-signal]` prefix and a strict field allowlist:

- signal kind
- normalized internal scope
- counter source
- two-letter country or `unknown`
- truncated salted subject fingerprint when shared protection is configured
- timestamp

Provider URL, provider token, salt, raw IP, request body, query string and user agent are not logged.

## Optional shared counter configuration

Shared protection is disabled unless every requirement is present:

```text
SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED=true
SECURITY_RATE_LIMIT_SALT=<random server-only value of at least 16 characters>
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Vercel KV-compatible names are also supported:

```text
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
```

Rules:

- Configure these as server-only variables. Never prefix them with `NEXT_PUBLIC_`.
- Start in Preview, run normal selector and customer-flow smoke tests, then enable in Production in a separate authorized release.
- Do not reuse the HMAC salt for auth, widget signing, Supabase or payment secrets.
- Provider failure is reported as a coarse security signal and falls back to the memory counter.

## Vercel WAF rollout

No WAF rule is published by this code patch. WAF is an edge control and must be rolled out separately so shared workshop networks are not accidentally blocked.

Recommended first observation thresholds per IP:

| Path prefix | Initial edge threshold | Reason |
| --- | ---: | --- |
| `/api/vehicles` | 300 requests / minute | Stops bursts while remaining much looser than normal selector use. |
| `/api/widget` | 600 requests / minute | Widget embeds can create legitimate cross-page traffic. |
| `/api/observability` | 180 requests / minute | Above the application limit but blocks volumetric noise at the edge. |
| `/api/email` | 60 requests / minute | Auth and idempotency remain the primary controls. |
| `/api/desktop` | 300 requests / minute | Allows retries and progress polling without permitting bursts. |
| `/api/admin` | 600 requests / minute | High tolerance avoids interrupting the operations desk. |

Rollout procedure:

1. Create disabled draft rules or log-only observation rules.
2. Observe normal Production traffic for at least one full business cycle.
3. Review the top IP/JA4 rates, 429 ratio, countries and affected routes without exporting customer data.
4. Adjust thresholds for known workshop NAT traffic.
5. Enable rate-limit rules one path family at a time.
6. Keep a documented one-click disable/rollback path.

Vercel documents custom WAF rules and IP/JA4/header keyed rate limiting at:

- https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules
- https://vercel.com/kb/guide/add-rate-limiting-vercel

## Alerting

Create log alerts for these exact structured events:

- `rate_limit_blocked`: warning when a scope rises above its normal baseline; urgent when multiple countries or many fingerprints spike together.
- `distributed_rate_limit_unavailable`: urgent only when sustained across several minutes; a single event may be a provider blip.

Recommended operational signals:

- 400/401/403/413/429 rate by route family;
- unique salted fingerprints per scope;
- vehicle hierarchy-to-brand request ratio;
- e-mail event deduplication and failure counts;
- widget shared-counter denials;
- auth failures by coarse country, without storing credentials or request bodies.

An alert must link to an investigation runbook, not automatically block countries or customers.

## Challenge and MFA roadmap

### Turnstile or another challenge

Add a challenge only to server-enforced abuse-prone mutations after provider keys, accessibility fallback and failure behavior are ready. A visual-only challenge in front of a direct Supabase Auth call is not a security control. Normal vehicle browsing must remain challenge-free.

### Admin MFA

Supabase supports TOTP enrollment and authenticator assurance levels. The safe rollout is:

1. Add enrollment, challenge and recovery UX.
2. Require the owner to verify a second device/recovery path.
3. Observe AAL state without blocking operations.
4. Require AAL2 for admin mutations first.
5. Expand to all admin reads only after support/recovery is tested.

Do not switch the current admin panel to mandatory AAL2 until recovery has been validated. Official reference: https://supabase.com/docs/guides/auth/auth-mfa

## Verification checklist

- Normal brand/model/generation/engine selection does not return 429.
- Repeated selection of the same branch is allowed.
- Rapid traversal of many distinct branches is blocked.
- 429 responses include `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `RateLimit-Policy` and `Retry-After`.
- Shared provider receives only a salted fingerprint key.
- Provider failure retains local protection and does not block the first normal request.
- Public API responses contain no source URL, admin metadata, confidence, storage path or private identifiers.
- Anonymous admin/customer APIs remain denied.
- No WAF, MFA or challenge rule is considered active until its separate environment smoke test passes.

## Residual risk

A patient distributed scraper can still collect information that is intentionally public. The controls raise cost, reduce bulk surfaces and improve detection; they do not turn public catalog labels into secrets. Private files, request data, customer data, payment data and admin evidence remain protected by authentication, ownership checks, staff permissions, RLS/private storage and customer-safe response allowlists.
