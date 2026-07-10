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

Current in-memory rate limiting protects important public endpoints from simple abuse. At larger scale, move rate limits to a shared store so all Vercel instances share the same counters.

## Advanced RBAC

The platform has staff permissions, but future scale should separate owner, manager, tuner, support and finance roles more explicitly in the admin UI.

