# MG AutoTech AI Generation Safety Gates

AI generation is locked. Level 3 only prepares evidence, attribution and readiness reporting.

## Readiness statuses

- `blocked`: core identity, labels, evidence or privacy gates are missing.
- `not_ready`: evidence exists but is incomplete.
- `research_only`: useful for admin research only.
- `draft_plan_possible`: a future admin-only plan could be considered, but export remains locked.
- `human_review_required`: human review must happen before any next stage.
- `export_locked`: final output export is disabled.
- `ready_for_future_human_approved_draft`: future-only language; not active file export.

## Required safety gates

Before any future draft/change-plan work:

- ECU family/type identified.
- SW/HW or strong software identifier present.
- actual service labels confirmed.
- trusted approved samples exist.
- map definitions exist.
- pattern cluster is usable or stronger.
- unknown regions reviewed.
- human tuner workflow completed.
- checksum/export tooling boundary defined.

## Always locked in Level 3

- `export_allowed` is always false.
- `customer_visible` is always false for change plans and generation readiness internals.
- No write-ready file is created.
- No byte patch is created for customer use.
- No automatic delivery is possible.

## Block reasons

Common block reasons:

- no_map_definitions
- no_trusted_samples
- no_human_confirmed_samples
- insufficient_quality
- actual_service_labels_missing
- service_label_mismatch
- weak_cluster
- no_cluster
- no_pattern_signature
- unsupported_ecu
- unsupported_service
- customer_file_only
- checksum_not_supported
- output_export_disabled
- unsafe_private_data
- unknown_changed_regions
- insufficient_admin_review

## Future export rule

Human-approved MOD export must be a separate project with explicit owner approval, audit trail, checksum handling, versioning, rollback and bench/vehicle validation.
