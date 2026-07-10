# MG AutoTech Map Definition Layer

The Map Definition Layer connects File Expert changed regions to human-reviewed ECU/TCU map definitions. It is Level 3 of MG AutoTech AI File Intelligence.

It is not a MOD generator. It does not edit bytes, export files, repair checksums or deliver customer files.

## Tables

The non-destructive migration draft is:

`scripts/add-ai-level3-map-definitions.sql`

It creates:

- `ai_map_definition_sets`
- `ai_map_definitions`
- `ai_map_attribution_results`
- `ai_generation_readiness_reports`
- `ai_synthetic_fixture_runs`

All tables are RLS protected and admin/staff-only through `ai_training.manage`.

## Map definition set

A definition set scopes maps to an ECU context:

- name
- ECU family
- ECU type
- SW number
- HW number
- vehicle brand/model/engine
- source type
- source reference
- confidence score
- human verified flag
- active flag

Prefer exact SW/HW definition sets. Generic ECU-family sets are lower-confidence evidence.

## Map definition

A map definition describes one known region:

- map name
- category
- offset start
- offset end
- rows and columns
- data type
- endian
- factor
- unit
- axes
- description
- confidence score
- human verified flag

Supported categories include:

- driver_wish
- torque_limiter
- boost_request
- boost_limiter
- rail_pressure
- duration
- lambda
- smoke_limiter
- ignition
- vanos
- egr
- dpf
- dtc
- vmax
- pop_bangs
- tcu_shift
- tcu_pressure
- tcu_lockup
- checksum
- axis
- metadata
- unknown

## Attribution logic

Changed-region attribution:

1. Select active definition sets matching ECU family/type/SW/HW.
2. Prefer exact SW match.
3. Compare changed region ranges to active map definitions.
4. Calculate overlap ratio.
5. Score matches by overlap, definition confidence, human verification, set verification and exact SW match.
6. Return matched_verified, matched_unverified, partial_match, ambiguous, unknown or no_definition_set.

Attribution is evidence only. It is not a write instruction.

## Customer privacy

Customer output must never include:

- offsets
- map definition IDs
- definition set IDs
- source reference
- provider/source metadata
- private sample IDs
- storage paths
- raw binary or hex
- hashes
- admin notes
- confidence internals

Customer-safe wording can say:

> Analysis is complete and human review is required.

## Admin workflow

Admin can use the layer to:

- list definition sets
- see map categories
- identify unknown changed regions
- see whether exact SW definition coverage exists
- understand why generation is blocked
- decide whether a sample can improve learning

Admin must still verify:

- actual performed services
- map definition correctness
- checksum and flash workflow
- final customer delivery

## JSON input example

```json
{
  "name": "Bosch EDC17C50 SW1037550001",
  "ecuFamily": "EDC17",
  "ecuType": "Bosch EDC17C50",
  "swNumber": "SW1037550001",
  "hwNumber": "0281031234",
  "sourceType": "manual",
  "confidenceScore": 80,
  "humanVerified": true,
  "definitions": [
    {
      "mapName": "Torque limiter 1",
      "category": "torque_limiter",
      "offsetStart": 4096,
      "offsetEnd": 4351,
      "rows": 16,
      "cols": 16,
      "dataType": "uint16",
      "endian": "big",
      "factor": 0.1,
      "unit": "Nm",
      "confidenceScore": 85,
      "humanVerified": true
    }
  ]
}
```

## Limitations

- No DAMOS/A2L parser yet.
- No byte-level generation.
- No checksum support.
- No customer-visible map details.
- Low-confidence or generic definitions must not be treated as approval.
