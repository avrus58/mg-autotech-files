# Customer Profile & Customer ID Roadmap

This is a planning document only. No implementation is included in the Bulk Dataset sprint.

## Goal

Create stable customer profile records and human-friendly customer references such as `MGA-10001`.

## Proposed Fields

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

## Migration Plan

1. Add nullable profile fields.
2. Add unique customer ID column.
3. Backfill with deterministic sequence.
4. Add creation logic for new customers.
5. Update bank transfer references.
6. Add tests and smoke checklist.

## Security

- Customers can read/update only their own profile.
- Admin/staff access requires explicit permissions.
- Customer ID is safe to show; billing details are not public.
