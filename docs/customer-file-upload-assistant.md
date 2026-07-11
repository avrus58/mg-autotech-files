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

Create `apps/customer-uploader/.env.local` from `apps/customer-uploader/.env.example` before building or packaging. The Supabase anon key is public client configuration; never put the Supabase service-role key, admin tokens, payment secrets, email secrets, or signing passwords into the renderer env.

The desktop package scripts run `npm run check-env` before Vite builds. Missing required public Supabase env values stop the build with a clear message instead of creating an installer that opens to a black window. `VITE_API_BASE_URL` defaults to `https://file.mgautotech.de` if it is not explicitly set, so packaged builds do not inherit a local root website URL.

## Upload Flow

1. App verifies server/app status.
2. Customer logs in.
3. App verifies server/app status again.
4. App loads verified dashboard and credit summary.
5. Customer uses the guided request wizard.
6. Customer selects vehicle from the online catalog or uses the manual fallback.
7. Customer selects service and optional extra services.
8. Customer selects a local file.
9. App validates extension and size.
10. App calculates SHA-256 locally.
11. App asks the server for an upload session.
12. Server validates service credits and account status.
13. App uploads to the returned private Storage object URL.
14. App shows transferred bytes, percentage, upload speed and estimated time remaining.
15. App verifies server/app status again.
16. App finalizes the request.
17. Server verifies storage object, expected path, customer ownership, credits, idempotency, and duplicate state.

Retry is allowed through the same idempotent upload session. True chunked/resumable upload is not implemented yet.

## Customer UI

The beta desktop app now includes:

- professional dashboard with customer name/email, customer ID if available, credits, account status, app version and last sync time
- status cards for server connectivity, credit verification, desktop upload enablement and update status
- recent request tracking
- local safe upload history
- customer-visible request messages loaded through the existing customer-safe messages API
- support panel with website, support email, app version, installation ID and safe diagnostic copy
- settings panel with update check, theme selector, logout, local-history clearing and app-data-folder access
- DTC Tools beta/coming-soon module card

The desktop UI is English-only. The website and German transactional email templates are unchanged.

## DTC Tools Beta Module

The desktop dashboard includes a visible `DTC Tools` module card marked `Beta / Coming Soon`.

It is intentionally non-functional in this release:

- it opens only a product information modal
- it does not ask for a file
- it does not upload files
- it does not create DTC requests
- it does not call DTC APIs
- it does not modify files
- it does not generate MOD files
- it does not calculate checksums

The module is prepared for a future structured request workflow. If app-check returns `dtc_tools_beta_visible`, the card can be treated as remotely allowed. If the server does not yet return it, the desktop app still shows it as a safe coming-soon preview by default.

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

## Local History

Local history stores only safe metadata on the customer's Windows profile:

- request ID or local failed-attempt ID
- filename
- file size
- SHA-256
- selected vehicle summary
- selected service summary
- upload status
- safe error message if the upload failed

It does not store raw file content, binary previews, storage object paths, tokens, service-role keys or admin metadata.

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
npm run check-env
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

Icon status:

- `apps/customer-uploader/build/icon.ico` is configured as the app, window, installer, taskbar and shortcut icon.
- The current icon is an internal beta placeholder and should be replaced with the final MG AutoTech `.ico` before public release.

## Troubleshooting

- If the packaged app previously opened to a black screen with `Supabase configuration missing`, rebuild it after creating `apps/customer-uploader/.env.local`. The renderer now shows a visible configuration error if a bad build somehow ships.
- If `npm run build` fails with `Missing desktop app environment variables`, copy `apps/customer-uploader/.env.example` to `.env.local` and fill only the public `VITE_*` values.
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

## Beta Smoke Test

1. Build and package the desktop app.
2. Launch the unpacked EXE or portable EXE.
3. Confirm the login screen opens, not a black window.
4. Confirm app-check shows connected status.
5. Login with a safe test customer.
6. Confirm dashboard cards render.
7. Create a test request using a harmless tiny file.
8. Confirm upload progress phases and retry-safe wording.
9. Confirm local history contains only metadata.
10. Confirm customer-visible messages show only safe message content.
11. Confirm support diagnostic copy contains no token, raw content, private path or admin field.
12. Confirm offline/server-unavailable state blocks workflow.
