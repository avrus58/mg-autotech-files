# Customer File Upload Assistant

## Purpose

The MG AutoTech File Upload Assistant is a separate Windows desktop app for authenticated customers. It is a guided upload client for `file.mgautotech.de`, not an offline standalone file-service program.

The desktop app lives only in:

`apps/customer-uploader`

The existing website remains in `src/`, `app/`, `tests/`, `docs/`, and `scripts/`.

## Strict Online Requirement

The app must verify itself online before meaningful actions.

Startup flow:

1. Create or load a local `installation_id`.
2. Call `GET /api/desktop/app-check`.
3. Block the app if the server is unreachable.
4. Block the app if the version is too old.
5. Block upload/request flow if maintenance mode or desktop upload disablement is active.
6. Only then allow customer login.

No offline request creation, offline credit use, offline upload queue, or stale-credit bypass is allowed.

## Version And App Control

`GET /api/desktop/app-check` returns:

- `server_ok`
- `minimum_supported_version`
- `latest_version`
- `update_required`
- `update_available`
- `update_url`
- `release_notes_url`
- `maintenance_mode`
- `desktop_upload_enabled`
- `message_en`
- `allowed_modules`

The desktop app sends:

- `x-mg-desktop-app-version`
- `x-mg-desktop-platform`
- `x-mg-desktop-build-channel`
- `x-mg-desktop-session-status`
- `x-mg-desktop-installation-id`

Server env controls:

```bash
DESKTOP_APP_MIN_VERSION=0.1.0
DESKTOP_APP_LATEST_VERSION=0.1.0
DESKTOP_APP_UPDATE_URL=https://file.mgautotech.de/downloads/MG-AutoTech-File-Upload-Assistant-Setup.exe
DESKTOP_APP_RELEASE_NOTES_URL=https://file.mgautotech.de/desktop/release-notes
DESKTOP_APP_MAINTENANCE_MODE=false
DESKTOP_APP_UPLOAD_ENABLED=true
DESKTOP_APP_MESSAGE_EN=
DESKTOP_APP_ALLOWED_MODULES=file_upload,request_history
```

## Installation ID

The Electron main process creates a random UUID on first launch and stores it under the app user-data directory as `installation-id.txt`.

The installation ID:

- is sent with app-check and desktop upload APIs
- is not authentication
- is used only for verification/audit correlation
- does not include personal device data

## Web APIs

- `GET /api/desktop/app-check`
  Public safe app policy endpoint. It returns no secrets and no customer data.

- `GET /api/desktop/bootstrap`
  Requires customer Bearer token and desktop app headers. Returns safe own profile summary, recent own requests, service catalog, upload limits, and app policy.

- `GET /api/desktop/requests`
  Requires customer Bearer token and desktop app headers. Returns only the authenticated customer's own requests.

- `POST /api/desktop/upload-session`
  Requires customer Bearer token and desktop app headers. Validates app status, file metadata, service selection, current credit access, idempotency, and returns a private upload target.

- `POST /api/desktop/requests/finalize`
  Requires customer Bearer token and desktop app headers. Verifies upload session ID, expected customer path, private storage object existence, current credits, duplicate request protection, and creates the request through the existing server-side credit-deduction flow.

## Auth

The desktop app uses Supabase email/password login with:

- `persistSession: false`
- `autoRefreshToken: false`
- in-memory token only

Logout clears the active session. The desktop app never receives a service-role key or admin token.

Required desktop environment variables:

```bash
VITE_API_BASE_URL=https://file.mgautotech.de
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_APP_VERSION=0.1.0
VITE_APP_BUILD_CHANNEL=stable
```

## Upload Flow

1. App verifies server/app status.
2. Customer logs in.
3. App verifies server/app status again.
4. App loads verified dashboard and credit summary.
5. Customer selects vehicle and service.
6. Customer selects a local file.
7. App validates extension and size.
8. App calculates SHA-256 locally.
9. App asks the server for an upload session.
10. Server validates service credits and account status.
11. App uploads to the returned private Storage object URL.
12. App verifies server/app status again.
13. App finalizes the request.
14. Server verifies storage object, expected path, customer ownership, credits, idempotency, and duplicate state.

Retry is allowed through the same idempotent upload session. True chunked/resumable upload is not implemented yet.

## What Is Uploaded

- The selected ECU/TCU/customer file, only to the intended private upload flow.
- Safe request metadata:
  - vehicle summary
  - selected service IDs
  - notes
  - filename
  - file size
  - SHA-256
  - idempotency key
  - upload session ID

## What Is Never Uploaded Or Exposed

- Admin API tokens
- Service-role keys
- Raw/hex previews
- MOD generation output
- Binary edits
- Checksum-corrected files
- Admin notes
- AI training sample IDs
- Provider/source private metadata
- Local absolute file paths in customer/server payloads

## Build Commands

From the desktop app folder:

```bash
cd apps/customer-uploader
npm install
npm run dev
npm run build
npm run package:win
```

Signed build example:

```powershell
$env:WINDOWS_CERTIFICATE_FILE="C:\certs\mg-autotech-code-signing.pfx"
$env:WINDOWS_CERTIFICATE_PASSWORD="secret"
npm run package:win
```

Expected Windows artifacts:

- `apps/customer-uploader/release/MG AutoTech File Upload Assistant 0.1.0-nsis.exe`
- `apps/customer-uploader/release/MG AutoTech File Upload Assistant 0.1.0-portable.exe`

## Troubleshooting

- If the app shows "Server unavailable", verify internet access and `VITE_API_BASE_URL`.
- If the app shows "Update required", install a newer build or lower `DESKTOP_APP_MIN_VERSION` intentionally on the server.
- If credits cannot be verified, the app disables request submission until the server returns a valid customer profile/credit state.
- If packaging fails, check Electron Builder output and local Windows signing/toolchain availability.

## Limitations

- The first version uses whole-file upload with retry, not chunked resumable upload.
- The app is English-only for now.
- Vehicle data is loaded online only.
- Native auto-update is foundation-ready, but public automatic updates require signed artifacts and a hosted update feed.
- Future modules are remotely gated; tuning, DTC OFF, binary patching and checksum modules are not implemented.
- Real upload testing must use a safe test customer account and a harmless small fixture file.
