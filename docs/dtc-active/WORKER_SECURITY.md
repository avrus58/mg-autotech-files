# DTC Active Worker Security

Phase A has no worker and no binary execution.

Phase B must not use an Edge runtime for binary processing. The worker needs:

- private Node/service runtime;
- server-generated workspace;
- immutable input;
- distinct output;
- no network by default;
- timeout, memory, CPU, process and output limits;
- bounded logs;
- lease/fencing token checks;
- no secrets in transformer/adapters;
- artifact lineage and cleanup.

If seccomp, gVisor, container or equivalent isolation cannot be enforced, production adapter execution must fail closed.
