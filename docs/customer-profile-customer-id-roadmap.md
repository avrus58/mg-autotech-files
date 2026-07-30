# Customer Profile & Customer ID Roadmap

## Current State

MG AutoTech already has stable customer references such as `MGA-10001` and the
core profile fields listed below. Customer and admin workspaces already display
these values where appropriate. The Operations Intelligence Suite adds a
read-only completeness score so staff can identify missing profile information;
it does not silently fill, infer, or overwrite customer data.

The remaining roadmap is controlled backfill quality, validation, and broader
workflow consistency rather than creating a second customer identity system.

## Goal

Create stable customer profile records and human-friendly customer references such as `MGA-10001`.

## Profile Fields

- full name
- company name
- phone
- billing address
- invoice email
- VAT/tax number
- preferred contact method
- account type: private/company
- stable customer ID
- language preference

## Customer ID Rules

- Stable and unique.
- Generated for new customers.
- Backfill-safe for existing customers.
- Never derived from private personal data.
- Usable as bank transfer reference.

## Bank Transfer Reference

Preferred format:

```text
MGA-10001 / Request 32007019
```

Fallback:

```text
Request 32007019
```

## Admin Integration

Admin should see customer profile details on:

- request/work-order detail
- payments
- credit adjustments
- customer management

## Remaining Data Quality Plan

1. Audit existing profiles for missing values through the readiness view.
2. Confirm customer ID uniqueness and generation in a disposable environment.
3. Backfill only through a separately reviewed, additive migration when needed.
4. Keep bank-transfer references compatible with existing records.
5. Add targeted validation without blocking established customer workflows.
6. Verify customer/admin ownership and field visibility after every change.

## Security

- Customers can read/update only their own profile.
- Admin/staff access requires explicit permissions.
- Customer ID is safe to show; billing details are not public.
- Readiness warnings are admin-only and never appear in public APIs.
