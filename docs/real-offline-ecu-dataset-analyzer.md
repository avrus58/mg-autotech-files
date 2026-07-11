# Real Offline ECU Dataset Analyzer

This system analyzes local ORI/MOD pair candidates and writes metadata-only JSONL reports.

It does not upload files, edit binaries, generate MOD files, produce checksum-corrected files or expose raw/hex data.

## Workflow

1. Scan a small fixture or limited dataset chunk:

```bash
DATASET_ROOT="D:/MG-Dataset" node scripts/scan-ai-dataset.mjs --out data/ai-dataset-scan.jsonl --limit 100
```

2. Analyze candidate pairs:

```bash
DATASET_ROOT="D:/MG-Dataset" node scripts/analyze-ecu-pairs.mjs \
  --scan data/ai-dataset-scan.jsonl \
  --out data/ai-pair-analysis.jsonl \
  --limit 100 \
  --merge-distance 32 \
  --max-regions 80
```

## Output Fields

- pair id
- ORI/MOD relative paths
- ORI/MOD SHA-256 hashes
- file size
- changed byte count
- changed percent
- changed region windows
- guessed service labels
- ECU/SW/HW guesses
- quality score
- confidence
- warnings
- pattern signature

## Safety

- Raw bytes are never written to the report.
- Hex dumps are never written to the report.
- Files are opened read-only.
- Archives are not extracted.
- Output is admin/offline only.
- The analyzer does not create training samples.

## Warnings

The analyzer flags:

- identical files
- suspicious tiny diff
- suspicious huge diff
- file size mismatch
- truncated region lists

These warnings are review signals, not automatic rejection or approval.
