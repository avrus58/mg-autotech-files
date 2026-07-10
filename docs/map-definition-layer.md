# MG AutoTech Map Definition Layer

The Map Definition Layer is the next safe step after File Expert, similarity search and pattern clustering.

It is **not** a MOD generator. It does not edit bytes, export tuning files, repair checksums or deliver files to customers.

## Purpose

The current AI intelligence stack can compare ORI/MOD files, extract changed regions, calculate pattern signatures, find similar approved samples and build pattern clusters. That is enough to say:

- this file looks related to trusted examples
- these changed regions repeat across approved samples
- this evidence is weak, usable, strong or mature

It is not enough to say:

- this exact map has been safely changed
- these values should be edited
- this file is write-ready

Map definitions close that gap by connecting changed regions to human-reviewed ECU map areas.

## Definition Shape

A map definition should describe a known region for a specific ECU context:

- ECU family
- ECU type
- SW number when possible
- HW number when possible
- map name
- map category
- start offset
- end offset
- confidence
- source
- admin notes

Example categories:

- torque_model
- boost
- fuel
- rail_pressure
- smoke_limiter
- egr
- dpf
- adblue
- dtc
- vmax
- start_stop
- tcu_shift
- tcu_lockup
- unknown

## Attribution Rules

Attribution must stay conservative:

- exact SW/HW definitions are stronger than general ECU-family definitions
- unknown SW/HW should be treated as limited confidence
- overlap with a known region is evidence, not proof
- unknown changed regions must remain visible to admin
- customer reports must never expose offsets or private map data

## Safety Gates

Before any future AI-assisted draft workflow, all of these must be true:

- trusted sample evidence exists
- pattern cluster is strong or mature
- actual performed services are human-confirmed
- map definitions exist for the ECU/SW context
- unknown changed regions are reviewed by a human tuner
- checksum/export tooling is explicitly handled outside the AI evidence layer
- final delivery remains manual/admin-approved

## Current Implementation

Code foundation:

- `src/lib/ecuIntelligence/mapDefinitions.ts`

The helper can:

- accept human-reviewed map definitions
- compare changed regions against definitions
- return category attribution
- report unknown changed regions
- flag when map definitions are required

It cannot:

- edit binary files
- generate byte patches
- export MOD files
- approve a file for customer delivery

## Future Database Design

If/when this becomes persistent, use additive tables only:

- `ai_map_definition_sets`
- `ai_map_definitions`
- `ai_map_attribution_reviews`

All map definitions must be admin-only. Public/customer APIs must return only safe summaries such as:

> Human-reviewed map definition coverage exists for this ECU/service family.

They must not expose offsets, private source references, provider notes, sample IDs or storage paths.
