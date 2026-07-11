# Bulk Dataset Intelligence

MG AutoTech may have a large mixed ECU/TCU file dataset. The exact size must not be guessed. The local scanner calculates the real scanned file count and byte size.

## Safety Model

- Raw files stay local/offline for now.
- Supabase stores only metadata, indexes, candidates, review status, quality scores and safe summaries.
- Supabase Storage is not used for the bulk dataset.
- Customers never see scanner output, local references, provider/source details, hashes, duplicate groups, review events, raw binary, hex or dataset metadata.
- The system does not generate MOD files, edit binaries or perform checksum correction.
- Learning is never auto-approved.

## Local Scanner

Run the scanner from the repository:

```bash
DATASET_ROOT="D:/MG-Dataset" node scripts/scan-ai-dataset.mjs --out data/ai-dataset-scan.jsonl
```

Useful test options:

```bash
DATASET_ROOT="D:/MG-Dataset" node scripts/scan-ai-dataset.mjs --out data/ai-dataset-scan.jsonl --limit 100
DATASET_ROOT="D:/MG-Dataset" node scripts/scan-ai-dataset.mjs --out data/ai-dataset-scan.jsonl --extensions .bin,.ori,.mod
DATASET_ROOT="D:/MG-Dataset" node scripts/scan-ai-dataset.mjs --out data/ai-dataset-scan.jsonl --dry-run
DATASET_ROOT="D:/MG-Dataset" node scripts/scan-ai-dataset.mjs --out data/ai-dataset-scan.jsonl --progress-every 500
```

The scanner records:

- `relative_path`
- `filename`
- `extension`
- `file_size`
- `sha256`
- `quick_hash`
- `modified_at`
- `guessed_file_role`
- `guessed_service_labels`
- `guessed_ecu_family`
- `guessed_ecu_type`
- `guessed_sw_number`
- `guessed_hw_number`
- `duplicate_hash_group`
- warnings and errors

It also writes `data/ai-dataset-scan.summary.json` with total files, total bytes, GB size, supported/unsupported counts, duplicate count, archive count, guessed ORI/MOD counts and distributions.

## Safe Synthetic Fixture

Before touching any real dataset, create a tiny fake fixture:

```bash
node scripts/create-ai-dataset-fixture.mjs --out data/ai-dataset-fixture --clean
node scripts/scan-ai-dataset.mjs --root data/ai-dataset-fixture --out data/ai-dataset-fixture-scan.jsonl
```

The fixture files are deterministic, synthetic and marked in the manifest as:

- `safe_fake_binary: true`
- `not_flashable: true`
- `raw_customer_data: false`

They are only for scanner/import validation. They are not ECU data and must never be used as customer output.

## JSONL Import

Open:

```text
/admin/ai-training/datasets
```

Paste or upload the JSONL metadata report in the Scanner metadata import section.

The import creates:

- `ai_dataset_import_batches`
- `ai_dataset_file_candidates`
- `ai_dataset_pair_candidates`
- `ai_dataset_review_events`

It does not create raw storage files, does not create trusted learning evidence and does not approve learning samples.

The admin batch list and detail page show:

- batch id and created date
- total files and total scanned size
- supported/unsupported counts
- duplicate and archive counts
- guessed ORI/MOD/unknown counts
- pair candidate count
- review status counts
- warning/error counts

## Pair Matching

Pair candidates are suggested from metadata only:

- same folder/package
- similar normalized filename
- ORI/original/stock/read naming hints
- MOD/stage/EGR/DPF/AdBlue/DTC/VMAX/TCU naming hints
- same or close file size
- same guessed ECU/SW/HW metadata
- different SHA-256 hashes
- service label hints

Suggested service labels are not actual labels. `actual_service_labels` require human/admin confirmation.

## Offline Pair Analysis

After scanning a limited dataset chunk, analyze candidate ORI/MOD pairs:

```bash
DATASET_ROOT="D:/MG-Dataset" node scripts/analyze-ecu-pairs.mjs \
  --scan data/ai-dataset-scan.jsonl \
  --out data/ai-pair-analysis.jsonl \
  --limit 100
```

The analyzer reads local files only when explicitly run. It outputs metadata only:

- changed byte count
- changed percentage
- changed region windows
- quality score
- warnings
- pattern signature

It does not write raw bytes, hex dumps, MOD files, checksum corrections or customer output.

## Dataset Evaluation

Create an admin/offline quality report:

```bash
node scripts/evaluate-ai-dataset.mjs \
  --scan data/ai-dataset-scan.jsonl \
  --analysis data/ai-pair-analysis.jsonl \
  --out data/ai-dataset-evaluation-report.json \
  --md data/ai-dataset-evaluation-report.md
```

The report summarizes service distribution, ECU distribution, quality bands, suspicious pairs and next actions.

## Stage 1 Readiness

The system includes an evidence-only Stage 1 readiness helper. It reports:

- Stage 1 evidence count
- high-quality Stage 1 pair count
- readiness: `no_evidence`, `weak`, `usable`, `strong`
- missing items such as human labels, map definitions or ECU identification
- next recommended action

This does not generate calibration changes or MOD files.

## Quality Scoring

Pair quality considers:

- ORI and MOD both present
- file size compatibility
- service label clarity
- ECU/SW/HW metadata
- supported extension
- duplicate status
- privacy status
- hash difference and filename confidence

Low-quality candidates remain `needs_review`, `exclude`, `duplicate` or `reject`.

## Review Workflow

Admin can review candidates and later:

- correct ORI/MOD role
- correct service labels
- mark duplicates
- reject/exclude suspicious files
- add admin notes
- create a training sample candidate only after review

Pair review statuses are intentionally separate from trusted learning:

- `pending_review`
- `needs_manual_pairing`
- `ready_for_human_label`
- `approved`
- `rejected`
- `excluded`

The API does not allow dataset review to directly set `approved_for_learning`. Trusted learning remains a separate AI Training decision after human verification.

## Calibration Assistant

Admin-only advisory page:

```text
/admin/ai-training/calibration-assistant
```

It provides a low-data Stage 1 checklist for diesel turbo, gasoline turbo, naturally aspirated, TCU and unknown ECU scenarios. It is advisory-only and export-locked.

Trusted learning evidence still requires:

- `learning_use_status = approved_for_learning`
- `human_verification_status = confirmed`
- `data_quality_score >= 60`
- `actual_service_labels` present
- no pending/rejected/excluded/needs_review status

## Level 3 Relationship

Bulk metadata candidates can later feed Level 3 Map Intelligence once an admin confirms pairs and labels. Changed-region summaries and map attribution remain admin-review only and must not become customer-visible file generation.

## Not Implemented

- No real dataset scan was run by Codex.
- No raw file upload.
- No archive extraction.
- No automatic learning approval.
- No MOD generation.
- No binary editing.
- No checksum correction.

## Smoke Checklist

1. Generate the synthetic fixture.
2. Scan the fixture to JSONL.
3. Analyze the fixture pairs.
4. Evaluate the fixture report.
5. Open `/admin/ai-training/datasets` as an admin with `ai_training.manage`.
6. Import the fixture JSONL metadata only in a dev Supabase branch unless production mutation is explicitly approved.
7. Confirm a batch is created with file and pair candidates.
8. Open the batch detail page.
9. Mark one pair `ready_for_human_label`.
10. Mark one pair `approved` only after entering actual service labels.
11. Confirm no `ai_training_samples` row is created by the dataset importer.
12. Confirm anonymous `/api/admin/ai/datasets` returns 401/403.
13. Confirm no public/customer route exposes local paths, hashes, duplicate groups or scanner metadata.
