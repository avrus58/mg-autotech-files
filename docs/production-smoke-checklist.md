# MG AutoTech Production Smoke Checklist

Use this checklist after every production deploy. It is intentionally non-destructive.

## Before Deploy

- Run `npm run lint`
- Run `npm run typecheck`
- Run `npm test`
- Run `npm run build`
- Run `npm run check:payments`
- Run `npm audit --omit=dev --audit-level=high`
- Confirm no SQL migration is required, or run only reviewed non-destructive SQL first.
- Confirm no real vehicle import is triggered during deploy.
- Confirm active payment methods are Stripe/Card and Bank Transfer only.

## Public Smoke

- Open `/`
- Open `/new-request`
- Open `/api/vehicles?type=brands`
- Confirm vehicle source is `database` when imported records are available.
- Confirm vehicle response does not contain `admin_notes`, `source_reference`, `confidence_score`, import metadata, audit data, storage paths, raw binary, hex previews or private offsets.
- Confirm language-prefixed home routes render the same full platform layout.

## Customer Smoke

- Open `/dashboard`
- Open `/dashboard/settings`
- Open `/dashboard/credits`
- Confirm credits page shows Stripe/Card and Bank Transfer only.
- Open `/dashboard/file-expert`
- Open a File Expert report as a customer account.
- Confirm customer report does not expose storage paths, SHA hashes, binary previews, raw hex, offsets, provider data, private sample IDs or admin notes.
- Confirm customer request detail shows customer-visible messages only and does not expose internal work-order notes.

## Admin Smoke

- Open `/admin/requests`
- Open an existing `/admin/requests/[id]`
- Confirm payment summary is read-only.
- Confirm internal notes are admin-only.
- Confirm customer-visible notes appear in customer messages.
- Confirm status, priority and quality/delivery updates create visible work-order events.
- Open `/admin/vehicles`
- Open `/admin/vehicles/import`
- Run dry-run only when needed. Do not run real import without owner approval.
- Open `/admin/ai-training`
- Open `/admin/ai-training/clusters`
- Rebuild clusters only when expected and never as part of ordinary payment/vehicle checks.

## Safe Scripts

These scripts do not mutate data and do not contain secrets:

```bash
BASE_URL=https://file.mgautotech.de node scripts/smoke-public-platform.mjs
BASE_URL=https://file.mgautotech.de node scripts/smoke-admin-unauthenticated.mjs
```

## Rollback

- Prefer Vercel redeploy to the previous known-good deployment.
- Do not run destructive SQL to roll back.
- If a non-destructive migration introduced a compatibility issue, deploy a backward-compatible code fix first.

## Known Limitations

See `docs/known-limitations.md` before changing upload, background processing or rate-limit architecture.
