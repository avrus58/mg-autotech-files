# Vehicle Data Enrichment Center

The Vehicle Data Enrichment Center is an admin-controlled workflow for adding missing modern vehicles and engine options to the MG AutoTech Vehicle Database.

It is not a scraper, not an Auto-Data clone, and not a blind importer. External information is converted into MG AutoTech's practical file-service structure:

- Brand
- Model
- Generation / platform group
- Engine option
- Stock HP / NM
- Engine code
- Displacement
- Fuel / hybrid metadata
- Body variant metadata

It intentionally ignores catalogue fields that are not useful for ECU/TCU file-service selection, such as acceleration, dimensions, tire sizes, fuel consumption tables, bore/stroke, compression ratio, and weight ratios.

## Source Policy

The first implementation is manual-assisted only.

Admins may paste structured JSON/CSV-style entries and add an admin-only source URL/reference. The app normalizes, groups, compares and proposes drafts.

The system does not:

- Broad crawl Auto-Data or any external site
- Bypass anti-bot protection
- Copy large external datasets blindly
- Auto-publish external data
- Overwrite existing verified records
- Expose source URLs or references to customers

Direct source connectors can be added later only if they respect source terms, robots rules and rate limits.

## Modern / Current Scope

Default enrichment is modern/current only.

Default rules:

- `year_from >= 2020`
- or open/current ranges such as `2023-present`
- or admin explicitly disables the modern-only scope

Old historical vehicles are skipped by default so the database does not become polluted with unnecessary catalogue history.

## MG AutoTech Normalization

External catalogues often split one practical tuning generation into many body variants. MG AutoTech keeps the customer selector clean:

`Brand -> Model -> Generation/platform group -> Engine`

Body styles are stored as metadata, not separate customer-facing generations.

### W214/S214/V214 Example

External entries may include:

- Mercedes-Benz E-class Long (V214), 2023-present
- Mercedes-Benz E-class All-Terrain (S214), 2023-present
- Mercedes-Benz E-class T-Modell (S214), 2023-present
- Mercedes-Benz E-class (W214), 2023-present
- Mercedes-Benz E-class Coupe (C238, facelift 2020)
- Mercedes-Benz E-class Cabrio (A238, facelift 2020)

MG AutoTech normalizes the current generation as:

`Mercedes-Benz -> E-Class -> W214/S214/V214 (2023-present)`

Included body metadata:

- W214 Sedan
- S214 Estate / T-Modell
- S214 All-Terrain
- V214 Long wheelbase

C238/A238 are excluded from the W214/S214/V214 group because they are previous/different platform family records.

## Engine Candidate Extraction

The normalizer extracts practical tuning data from source text:

- `Power: 612 HP` -> `stock_hp: 612`
- `Torque: 850 Nm` -> `stock_nm: 850`
- `Engine Model/Code: M177.980` -> `engine_code: M177.980`
- `Engine displacement: 3982 cm3` -> `displacement_cc: 3982`

Missing HP/NM/code/displacement is not invented. The candidate remains `needs_review`.

## Stage 1 Draft Estimate Rule

External stock data may be used to create an admin-only Stage 1 draft helper:

```text
stage1_hp_estimate = round(stock_hp * 1.15)
stage1_nm_estimate = round(stock_nm * 1.15)
```

Rules:

- Estimate source is `auto_estimate_15_percent`
- Estimate confidence is `low`
- Estimate is unverified
- Estimate requires MG AutoTech review
- Stage 2 is never estimated
- ECU type is never invented
- Unlock/protection status is never invented
- TCU values are never invented

The admin UI displays this warning clearly before draft creation.

## Existing DB Protection

Before creating any draft, the enrichment plan compares candidates with existing Vehicle DB records.

It detects:

- Existing generation
- Existing engine
- Possible duplicate
- Conflicting stock HP/NM/displacement
- Manual verified conflict
- Missing generation
- Missing engine

Manual verified records are protected. If a candidate conflicts with a verified manual record, the action becomes a diff review, not overwrite.

## Draft / Review / Publish Workflow

The enrichment workflow is draft-first:

1. Admin pastes source entries.
2. System normalizes generation groups and engine candidates.
3. System compares against existing DB.
4. Admin reviews suggested actions.
5. Admin may create an unpublished `needs_review` draft.
6. Admin manually verifies ECU/service/performance data.
7. Admin explicitly publishes through the normal Vehicle Control Center workflow.

No enrichment candidate is customer-visible until the final vehicle record is active and published.

## Batch Traceability

The SQL migration adds admin-only tables for future persistent traceability:

- `vehicle_external_sources`
- `vehicle_external_import_batches`
- `vehicle_external_entries`
- `vehicle_external_generation_groups`
- `vehicle_external_engine_candidates`
- `vehicle_external_diffs`
- `vehicle_external_review_events`

These tables are protected by RLS and `vehicles.manage`.

The current app stores draft source context in admin-only notes/source references and can store review events after the migration is applied.

## Public Selector Safety

The public/customer selector only reads active and published records from the existing vehicle tables.

Customers never receive:

- Source URLs
- Source references
- Enrichment batch IDs
- Confidence scores
- Admin notes
- Review events
- Draft records
- Unpublished generations or engines
- Internal validation/import metadata

JSON fallback remains in place if database loading fails or no published records are available.

## Rollback / Archive Strategy

No destructive rollback SQL is used.

If an enrichment batch or draft is wrong:

- Mark candidate ignored/rejected
- Archive the draft
- Unpublish the record if it was accidentally published
- Add review notes

Do not delete production data automatically.
