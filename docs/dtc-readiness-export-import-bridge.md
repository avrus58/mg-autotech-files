# DTC Readiness Export / Import Bridge

This bridge moves metadata from production into a disposable local readiness lab without copying firmware bytes or customer data.

It exists only to support the admin-only DTC corpus readiness dashboard and first real lab target qualification.

## Safety Boundary

The bridge is metadata-only.

It does not export or import:

- firmware bytes
- raw binary
- raw hex
- customer names
- customer emails
- customer phone numbers
- customer addresses
- customer notes
- internal notes
- payment data
- credentials
- Supabase service role keys
- storage paths
- local absolute paths
- signed URLs
- source URLs
- provider private sample metadata

It does export only the allowlisted readiness fields listed below.

## Export SQL

Script:

```text
scripts/export-dtc-corpus-readiness-metadata.sql
```

This script is `SELECT`-only. It reads metadata from:

- `ai_training_samples`
- `ai_dataset_pair_candidates`
- `ai_dataset_file_candidates`
- `file_expert_jobs`
- `ai_map_definition_sets`

It does not mutate production data.

## Exported Field Allowlist

- `record_id`
- `source_kind`
- `ecu_supplier`
- `ecu_family`
- `ecu_type`
- `hw_number`
- `sw_number`
- `calibration_id`
- `representation_type`
- `file_role`
- `file_size`
- `segment_manifest_digest`
- `read_method`
- `source_provenance`
- `source_authorization_quality`
- `original_hash`
- `mod_hash`
- `exact_dtc_labels`
- `service_labels`
- `human_verified`
- `learning_approved`
- `pair_confidence`
- `pair_review_status`
- `pair_identity_consistent`
- `changed_region_signature`
- `changed_region_consistency`
- `unrelated_change`
- `checksum_only_control`
- `already_modified_negative`
- `wrong_pair_negative`
- `pre_integrity_available`
- `final_mod_available`
- `map_definition_available`
- `integrity_evidence_available`
- `bench_verified`
- `successful_write_readback`
- `rollback_verified`
- `conflict_notes`
- `export_source_table`
- `exported_at`

## Manual Production Export

1. Open the Supabase Dashboard for the production project.
2. Open SQL Editor.
3. Paste the full contents of:

   ```text
   scripts/export-dtc-corpus-readiness-metadata.sql
   ```

4. Run the query.
5. Download the result as CSV.
6. Store the downloaded file under:

   ```text
   .local/dtc-readiness-import/
   ```

Do not store the export in `data/`, `docs/`, `scripts/`, or any committed folder.

## Local Import Validation

Run:

```bash
node scripts/import-dtc-readiness-metadata.mjs --input .local/dtc-readiness-import/dtc-readiness-export.csv --format csv
```

The importer writes only under `.local/dtc-readiness-import/`:

- `accepted/*.accepted.json`
- `quarantine/*.quarantine.json`
- `audit/*.audit.json`
- `sql/*.load-local.sql`

The importer rejects input paths outside `.local/dtc-readiness-import/`.

## Deterministic Normalization

The importer performs deterministic compatibility normalization before applying safety gates. This is not evidence promotion.

### Authorization Quality

Accepted `source_authorization_quality` values are:

- `trusted`
- `authorized_lab`

Explicit aliases accepted as equivalent:

- `trusted_source` -> `trusted`
- `source_authorized` -> `trusted`
- `source_authorised` -> `trusted`
- `authorized_lab` / `authorised_lab` / `lab_authorized` / `lab_authorised` -> `authorized_lab`

The observed exported values in the first local diagnostic export were:

- `weak`
- `unknown`

Those are not mapped to an approved state. Null, unknown, weak, customer-unapproved, and ambiguous authorization values remain quarantined.

### Array Fields

`service_labels`, `exact_dtc_labels`, and `conflict_notes` are exported as deterministic JSON arrays.

The importer accepts JSON arrays and supports legacy service-label object maps only to read older exports where service labels were emitted as `{ "dtc_off": true }`. For object maps, only keys with explicit `true` values are converted to label arrays. The importer does not invent `dtc_off` or DTC labels.

Malformed arrays, unsupported service labels, and invalid DTC labels are quarantined.

### Pair Review Status

Accepted `pair_review_status` values are:

- `approved`
- `ready_for_human_label`
- `confirmed`
- `approved_for_learning`
- `needs_review`
- `pending_review`

Explicit aliases:

- `pending` -> `pending_review`
- `review_required` -> `needs_review`
- `unverified` -> `needs_review`

Unknown review statuses are quarantined.

### ECU Family / Type Aliases

First-lab target family aliases are exact spelling, spacing, and punctuation variants only:

- `ME7.5`, `ME75`, `Bosch ME7.5`, `Bosch ME75` -> `ME7.5`
- `EDC15P`, `Bosch EDC15P` -> `EDC15P`
- `EDC15VM`, `EDC15VM+`, `Bosch EDC15VM`, `Bosch EDC15VM+` -> `EDC15VM+`
- `EDC16U34`, `Bosch EDC16U34` -> `EDC16U34`

No fuzzy matching is used. For example, `EDC16`, `EDC16CP31`, `EDC17`, `MED17`, `SID`, and `Delco E-Series` remain out of scope unless a future approved lab target explicitly includes them.

### Read Method

The importer normalizes exact read-method spelling variants:

- `Bench` -> `bench`
- `OBD` -> `obd`
- `VR` / `Virtual Read` -> `virtual_read`
- `Boot` / `Boot mode` -> `boot`
- `BDM` -> `bdm`
- `JTAG` -> `jtag`

It does not infer `read_method` from file size, ECU family, tool name, storage location, or filename. Missing or `Unknown` read methods remain quarantined.

## Quarantine Rules

The importer quarantines records that are:

- malformed
- outside the strict field allowlist
- missing exact ECU identity
- outside Bosch ME7.5, Bosch EDC15P/EDC15VM+, or Bosch EDC16U34 targets
- missing source provenance
- unauthorized or weakly authorized
- mixed or ambiguous file role
- missing required hashes
- missing controlled DTC labels for pair records
- not human verified
- identity-inconsistent
- unrelated-change evidence
- changed-region inconsistent
- already-modified negative evidence
- wrong-pair negative evidence
- conflict-note bearing

Quarantined records are not loaded into the accepted local staging SQL.

## Disposable Local Supabase Import

Start local Supabase first:

```bash
npx supabase start
```

Apply the local-only staging table:

```bash
npx supabase db query --local --file scripts/setup-dtc-readiness-import-local.sql
```

Then apply the generated local load SQL:

```bash
npx supabase db query --local --file .local/dtc-readiness-import/sql/<generated-file>.load-local.sql
```

If the CLI rejects multi-statement SQL in your environment, open the generated SQL file and run it with your local Postgres client against the disposable local Supabase database.

The web app corpus readiness loader treats `dtc_readiness_import_records` as optional. If the table does not exist, production behavior is unchanged.

## Review Dashboard

After importing locally, run the app against the local/disposable database and open:

```text
/admin/dtc/corpus-readiness
```

The imported records appear as additional metadata evidence only. They do not create firmware output, MOD files, rules, checksum adapters, A3/A4/A5 automation, or customer delivery.

## Cleanup

All downloaded exports, accepted files, quarantine files, audit reports, and generated SQL live under:

```text
.local/dtc-readiness-import/
```

That directory is ignored by Git.
