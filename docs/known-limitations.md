# MG AutoTech Known Limitations

These are non-blocking items that should be handled deliberately instead of rushed into production.

## File Expert Upload Architecture

The current large-file File Expert upload flow prepares a private Supabase Storage object path and lets the authenticated browser upload directly to the private bucket. RLS scopes the path to the authenticated user's folder and the report APIs sanitize storage paths from customer-facing responses.

Recommended future hardening:

- move File Expert uploads behind a server-side upload proxy, or
- use an opaque signed-upload abstraction that does not expose meaningful storage paths, and
- keep the existing 32 MB type/size validation on both client and server.

This should be changed carefully because ECU files can be large and an unsafe rushed change could break customer uploads.

## Background Jobs

File Expert analysis and AI evidence rebuilds are still request-driven. This is acceptable for the current stage, but higher volume should move these tasks to a background queue with retry, status visibility and operational alerts.

## Rate Limiting

Important public and transactional-trigger endpoints always use a high-tolerance in-memory guard and can use the optional privacy-safe shared counter documented in `docs/bot-and-data-exfiltration-defense.md`. The shared counter remains disabled until its server-only provider configuration is explicitly enabled and tested.

Vercel WAF rules are still a separate operational control. They should be observed in disabled/log-only form before enforcement so workshop networks behind one public IP are not interrupted.

## Advanced RBAC

The platform has staff permissions, but future scale should separate owner, manager, tuner, support and finance roles more explicitly in the admin UI.
