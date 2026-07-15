# Operations

Entry point:

- `/admin/ecu-intelligence`

Deep links:

- `/admin/ai-training/corpus`
- `/admin/ai-training/datasets`
- `/admin/ai-training/clusters`
- `/admin/ai-training/map-definitions`
- `/admin/dtc/corpus-readiness`

Refresh behavior is fail-closed. `ECU_INTELLIGENCE_REFRESH_ENABLED=true` is required before a future private read model can run. The v1 center uses live bounded aggregation.
