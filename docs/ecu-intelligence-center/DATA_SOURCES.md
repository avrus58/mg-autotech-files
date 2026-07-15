# ECU Intelligence Center Data Sources

Reused tables and systems:

- `orders` through the learning flywheel integration
- `file_expert_jobs`
- `file_expert_binary_fingerprints` indirectly through File Expert metadata
- `ai_learning_file_candidates`
- `ai_learning_pair_candidates`
- `ai_learning_review_events`
- `ai_training_samples`
- `ai_dataset_*`
- `ai_pattern_signatures`
- `ai_pattern_clusters`
- `ai_cluster_members`
- `ai_similarity_results`
- `ai_map_definition_sets`
- `ai_map_definitions`
- `ai_generation_readiness_reports`

The API queries only allowlisted metadata fields. It does not select private file paths, raw binary, hex previews, signed URLs, customer names, emails, phone numbers, addresses, notes or payment information.
