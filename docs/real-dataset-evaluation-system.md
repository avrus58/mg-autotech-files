# Real Dataset Evaluation System

The dataset evaluator turns scanner and pair-analysis JSONL into an admin-only quality report.

It helps decide which dataset chunks are worth human review before any AI learning approval.

## Command

```bash
node scripts/evaluate-ai-dataset.mjs \
  --scan data/ai-dataset-scan.jsonl \
  --analysis data/ai-pair-analysis.jsonl \
  --out data/ai-dataset-evaluation-report.json \
  --md data/ai-dataset-evaluation-report.md
```

## Report Includes

- total scanned files
- total scanned size
- service category distribution
- ECU family/type distribution
- ORI/MOD/unknown role distribution
- duplicate statistics
- archive statistics
- pair candidate count
- analyzed pair count
- high/medium/low quality counts
- suspicious pair count
- Stage 1 usable candidate count
- aftertreatment candidate count
- top ECU families by usable data
- top SW numbers by usable data
- biggest quality problems
- recommended next action

## Quality Bands

- `high_quality_learning_candidate`
- `medium_needs_review`
- `low_quality_reject_or_exclude`
- `duplicate`
- `suspicious`
- `unknown`

## Safety

The report is metadata-only. It contains no raw binary, no hex previews and no generated MOD output.
