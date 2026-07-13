# Feature Proposals

## Proposed

### PROPOSAL-20260713-DESKTOP-RESUMABLE-UPLOAD - Desktop uploader true resumable chunked upload

- Problem: Large ECU/TCU uploads can fail on unstable customer connections. The desktop app currently supports retry-safe idempotency, but not true chunked resume.
- Target user: Customers using the Windows upload assistant and admins who need fewer duplicate or failed upload support cases.
- Current limitation: `apps/customer-uploader/src/App.tsx:1110-1119` uploads the selected file in one storage request through `uploadToPrivateStorage`, and `apps/customer-uploader/src/App.tsx:1301` explicitly tells the customer that true chunked resume is not enabled yet. `src/app/api/desktop/upload-session/route.ts:73-88` returns one object upload target and instructs the app to upload the exact file once before finalize.
- Proposed solution: Design a resumable upload protocol for the desktop assistant with chunk manifest creation, per-chunk retry/resume, server-side finalize/compose verification, checksum validation, local resume metadata and safe cleanup for abandoned sessions.
- Business value: Fewer failed uploads and duplicate customer requests for larger files, stronger professional desktop uploader experience and lower support load.
- User/Admin value: Customers can resume interrupted uploads without starting over; admins receive cleaner request history and fewer local-only failed attempts.
- Data model impact: Likely requires upload session/chunk metadata, expiry state and cleanup policy. This should be designed before any migration file is prepared.
- API impact: New or extended desktop upload-session, chunk upload, status and finalize endpoints may be needed. Existing single-object upload behavior should remain during rollout.
- Security impact: Must keep customer ownership scoping, file type/size limits, SHA-256 validation, private bucket paths, app-check headers and idempotency. No raw binary, storage path, signed URL or token should be exposed beyond the existing upload boundary.
- Rollout: Owner-approved technical design, local prototype with fixture files, beta-only desktop app build, local tests, then production migration/deploy handled outside Codex autonomous runs.
- Acceptance criteria:
  - Upload can resume after network interruption without duplicating the request.
  - Server verifies full-file checksum before request finalization.
  - Expired or abandoned chunks are auditable and cleanable.
  - Existing non-chunked upload remains available until the new path is proven.
  - No production migration, package install, deploy or customer-data test happens inside autonomous Codex runs.
- Owner decision required:
  - Approve data model and storage strategy.
  - Approve whether to use Supabase native resumable upload, a custom chunk protocol or another managed storage path.
  - Approve rollout timing for desktop beta distribution.

## Needs owner decision

## Approved

## Rejected

## Implemented
