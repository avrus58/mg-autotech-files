# ECU Intelligence Center Architecture

The ECU Intelligence Center is an admin-only read layer over the existing MG AutoTech intelligence systems.

It does not replace File Expert, AI Training, Dataset Workbench, DTC readiness or the learning flywheel. It joins their metadata into one operational view:

- customer upload learning candidates
- ORI/MOD pair candidates
- File Expert identity metadata
- training samples
- dataset candidates
- pattern signatures and clusters
- similarity results
- map definition sets
- DTC corpus readiness links

No firmware bytes, storage paths, signed URLs, customer PII or delivery artifacts are copied into this center.

The first implementation uses live server-side aggregation. No derived read-model table is required yet.
