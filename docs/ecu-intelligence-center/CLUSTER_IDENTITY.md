# Exact Cluster Identity

Cluster key version: `eci-cluster-v1`.

The canonical identity uses:

- supplier
- ECU family
- ECU type
- HW number
- SW number
- calibration ID or explicit unavailable reason
- representation type
- file role
- file size
- read method
- segment manifest digest if available

Only deterministic normalization is allowed: casing, whitespace, punctuation variants and explicit aliases. Different HW/SW values are never fuzzy-merged.
