# Service Taxonomy

Canonical service categories include:

- `stage_1`, `stage_2`, `stage_3`
- `dtc`, `dpf`, `egr`, `adblue`
- `swirl`, `tva`, `vmax`, `start_stop`
- `hot_start`, `cold_start`, `launch_control`
- `pops_bangs`, `torque`, `tcu`, `boost`, `rail_pressure`, `lambda`
- `other`, `unknown`

Existing `TrainingFeature` labels are mapped explicitly. Unknown labels remain visible as unknown and are never silently converted.

DTC service category and exact DTC codes are separate. Example: category `dtc`, exact codes `["P0401", "P2002"]`.
