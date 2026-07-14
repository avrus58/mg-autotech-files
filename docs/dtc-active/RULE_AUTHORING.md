# DTC Active Rule Authoring

Phase A does not allow rule authoring through the UI or API.

Future rule authoring must follow the active package:

- exact compound identity;
- immutable document body;
- RFC8785/JCS canonical digest;
- approved schema validation;
- no duplicate JSON keys;
- exact source-byte preconditions;
- linked-structure validation;
- typed operations only;
- output allowlists;
- separate approvals;
- append-only revocation.

No real ECU rule, offset, byte sequence, DTC table definition or checksum strategy is authorized in this repository today.

Phase B may add synthetic fixture rule validation only. Real ECU slots stay `QUALIFICATION_REQUIRED` until an explicitly authorized rule bundle exists.
