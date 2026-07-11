# Low-Data AI Calibration Assistant

The calibration assistant is an admin-only advisory checklist for situations where the AI does not yet have enough trusted examples.

It does not generate MOD files, byte patches, checksum corrections or customer-deliverable output.

## Admin Page

```text
/admin/ai-training/calibration-assistant
```

## Inputs

- ECU family
- ECU type
- SW number
- fuel type
- induction type
- TCU flag
- evidence count
- high-quality evidence count
- map definition availability

## Outputs

- readiness
- confidence
- checklist
- likely calibration areas to inspect
- risk warnings
- missing evidence
- required human checks
- next best action

## Playbooks

Diesel turbo:

- driver wish
- torque limiters
- smoke limiter
- boost request/limiter
- rail pressure
- duration
- air/lambda model
- torque monitoring
- gearbox torque risk

Gasoline turbo:

- driver wish
- torque/load limiters
- boost request/limiter
- lambda/fuel enrichment
- ignition safety
- torque monitoring
- gearbox torque risk

Naturally aspirated:

- low gain warning
- ignition/fueling review
- throttle/driver wish
- realistic gain expectation

Unknown ECU:

- identify ECU/SW first
- inspect file metadata
- run similarity
- do not calibrate blindly

## Safety Gates

Human tuner verification is required before any real file work. Export remains locked.
