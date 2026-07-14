# DTC Active Adapter Qualification

Phase A does not run integrity adapters.

Future adapter qualification requires:

- exact adapter document and digest;
- exact scope;
- deterministic behavior or explicitly documented verification-only workflow;
- no network by default;
- resource limits;
- bounded logs;
- output hash verification;
- protected/expected changed regions;
- security review and revocation handling.

The only allowed Phase B adapter candidate is the synthetic CRC32 fixture adapter from the research package. It is not an ECU checksum and must remain labeled synthetic/internal-test only.

Real checksum, signature, secure-boot or external tool adapters are unsupported until approved evidence and isolation controls exist.
