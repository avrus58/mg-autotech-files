# ECU Intelligence Staging Checklist

Before staging:

- confirm latest migrations exist in staging
- confirm `ai_training.manage` admin can open `/admin/ecu-intelligence`
- confirm anonymous API requests return 401
- confirm customer tokens return 403
- confirm no API response includes storage paths, signed URLs, raw bytes, hex, customer PII or payment data
- confirm refresh endpoint remains disabled unless a private read model exists
- confirm no firmware output is generated
- confirm no MOD generation exists
- confirm no A3/A4/A5/customer delivery automation is enabled
- confirm existing File Expert, AI Training, Dataset Workbench and DTC readiness pages still load
