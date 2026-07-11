# Vehicle URL Enrichment Import

The Vehicle URL Enrichment Import lets an admin paste one source URL into the Vehicle Enrichment Center, fetch that exact page or endpoint, extract vehicle candidates, normalize them into MG AutoTech's structure, and compare them against the Vehicle Database.

This is a review-first assistant. It is not a crawler and it does not publish data.

## Admin Flow

1. Open `/admin/vehicles/enrichment`.
2. Enter `Source Name`.
3. Enter `Source URL / reference`.
4. Choose source type:
   - Auto-detect
   - Generic HTML table/list
   - JSON endpoint
   - CSV endpoint
   - Plain text
5. Click `Fetch URL + Extract Vehicles`.
6. Review the fetched title, detected rows/items, extracted candidates, warnings, errors and confidence.
7. Review the structured JSON generated from the URL extraction.
8. Run `Dry-run normalize + compare`.
9. Create unpublished drafts only after manual review and the existing `CREATE_DRAFT` confirmation.

## Legal Responsibility

Only import data MG AutoTech is allowed to use. The URL importer performs a one-page extraction for admin review and does not grant rights to copy or republish third-party data.

The UI shows this warning:

> Only import data you are allowed to use. URL import performs a one-page extraction for admin review and does not auto-publish.

## Supported Input Types

The importer attempts to extract safe metadata from:

- HTML tables
- repeated HTML list/card items
- JSON arrays or object arrays
- CSV with headers
- plain text lines

Useful fields include:

- brand
- model
- generation/chassis/body
- raw title
- year range
- engine display name
- power
- torque
- displacement
- fuel type
- body type
- source URL

Extraction is best-effort. Low-confidence rows stay `needs_review`.

## Normalization

Extracted candidates use the same normalization framework as manual enrichment:

- `VW` resolves to `Volkswagen`
- `Mercedes-Benz / E-Class` resolves to `Mercedes-Benz / E`
- `W 214` and `E-Class W214` normalize toward `W214`
- duplicate public model families are avoided

## Comparison

The dry-run compares candidates against the existing Vehicle Database and reports:

- missing brand
- missing model
- missing generation
- missing engine
- existing match
- alias suggestion
- duplicate risk
- conflict
- protected verified-record conflict
- needs review

Verified MG AutoTech records are not overwritten. Public selector data changes only after explicit draft review, publish and public cache rebuild.

## Security

`POST /api/admin/vehicles/enrichment/fetch-url` is admin-only and requires `vehicles.manage`.

The fetcher:

- fetches only the exact URL entered by the admin
- allows only `http` and `https`
- blocks localhost
- blocks private IP ranges
- blocks link-local/cloud metadata IPs
- resolves DNS before fetching and blocks private resolved addresses
- does not follow redirects; admins must enter the final public URL directly
- sets a timeout
- limits response size
- does not use Puppeteer, Playwright or browser automation
- does not bypass anti-bot protection
- does not store the full fetched page

## Customer Safety

Customers never see:

- source URL
- source reference
- extraction confidence
- validation/import metadata
- draft candidates
- review events
- admin notes

Public/customer vehicle APIs continue to use published, customer-safe projections only.

## Limitations

- Extraction is not perfect.
- Some pages may need structured paste instead.
- Pages that require login, anti-bot challenges or heavy JavaScript rendering are not supported.
- The importer does not crawl linked pages.
- The importer does not parse full external catalogs.
- The importer does not auto-publish.

## Smoke Test

1. Open `/admin/vehicles/enrichment`.
2. Paste a safe test URL or use a local/mock test through automated tests.
3. Confirm preview shows title, row/item counts and extracted candidate count.
4. Confirm `Dry-run normalize + compare` works.
5. Confirm no draft is created unless `CREATE_DRAFT` is entered.
6. Confirm anonymous `POST /api/admin/vehicles/enrichment/fetch-url` returns `401`.
7. Confirm public `/api/vehicles` output does not expose source URLs or enrichment metadata.
