# Public Vehicle Catalog Protection

## Purpose

The public vehicle selector must remain fast for normal visitors while avoiding a bulk catalog download surface. Public data shown in a browser can never be made impossible to copy, so the goal is to make automated enumeration slower, bounded and observable without adding CAPTCHA or login friction to ordinary selection.

## Public flow

1. The homepage renders the canonical brand list in the first HTML response.
2. The browser refreshes that brand list through the existing public API in the background.
3. Models load only after a brand is selected.
4. Generations load only after a model is selected.
5. Engines load only after a generation is selected.
6. One customer-safe vehicle record loads only after an engine is selected.

The API does not provide a bulk catalog-index response.

## Transparent safeguards

- Only `brands`, `models`, `generations`, `engines` and `vehicle` request types are accepted.
- Each request type has an exact required parameter allowlist.
- Unknown, duplicate and cache-busting query parameters are rejected.
- IDs are length-limited and restricted to canonical safe characters.
- A high-tolerance ten-minute request budget allows ordinary browsing but slows rapid enumeration.
- Distinct-route budgets detect traversal across many brands and catalog branches while repeated use of the same selection remains allowed.
- Error responses are private and non-cacheable; successful customer-safe responses retain the existing CDN and browser caching behavior.
- API responses are marked `noindex`, `nofollow`, `noarchive` and `nosniff`.

There is no CAPTCHA, login requirement or artificial delay in the normal selector flow.

## Data boundary

Public responses may contain only published customer-safe selector options and the existing customer-safe vehicle projection. They must never contain:

- admin notes or review events
- source URLs or source references
- confidence scores
- import, validation or alias internals
- private storage paths or signed URLs
- unpublished or draft vehicle records

## Operational limitation

The application-level limiter uses warm-instance memory and is intentionally best-effort in a serverless deployment. Before treating it as a strong distributed control, configure a Vercel Firewall rate-limit rule for `/api/vehicles` using matching high-tolerance thresholds and monitor 400/429 rates. A firewall rule should be tested in Preview first so shared workshop networks and the desktop uploader are not blocked.

Robots directives, minified JavaScript and obfuscation are not security controls. They do not replace progressive data access, strict response allowlists, server-side monitoring or edge rate limiting.
