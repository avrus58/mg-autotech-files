# MG AutoTech File Upload Assistant

Windows desktop app for authenticated MG AutoTech customer uploads.

This app is not an offline standalone program. It requires an active connection to `file.mgautotech.de` before login, dashboard load, vehicle catalog load, upload-session creation, and request finalization.

## Location

Desktop app files live only under:

`apps/customer-uploader`

Do not place Electron UI or desktop packaging files inside the main web app folders.

## Environment

Create `apps/customer-uploader/.env.local` from `apps/customer-uploader/.env.example`:

```bash
VITE_API_BASE_URL=https://file.mgautotech.de
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_APP_VERSION=0.2.0
VITE_APP_BUILD_CHANNEL=stable
```

Never add service-role keys or admin secrets to this app.

`VITE_SUPABASE_ANON_KEY` is the public Supabase anon key used by customer clients. It is not the service-role key.

The build runs `npm run check-env` before Vite packaging. If required public desktop env values are missing, the build fails with:

```text
Missing desktop app environment variables. Create apps/customer-uploader/.env.local based on .env.example.
```

For local developer convenience, the Vite config can also resolve the public root website env names `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `VITE_API_BASE_URL` defaults to `https://file.mgautotech.de` so packaged builds do not accidentally point at a local web server. Release builds should still use the desktop app's own `.env.local` so the installer is reproducible.

## Commands

```bash
npm install
npm run dev
npm run build
npm run package:win
```

Run the explicit env check any time:

```bash
npm run check-env
```

Signed build example:

```powershell
$env:WINDOWS_CERTIFICATE_FILE="C:\certs\mg-autotech-code-signing.pfx"
$env:WINDOWS_CERTIFICATE_PASSWORD="secret"
npm run package:win
```

## Packaging Output

Electron Builder writes Windows artifacts to:

`apps/customer-uploader/release/`

Expected artifact names:

- `MG AutoTech File Upload Assistant 0.2.0-nsis.exe`
- `MG AutoTech File Upload Assistant 0.2.0-portable.exe`

`build/icon.ico` is currently generated from the temporary `public/mg-autotech-icon-placeholder.svg` style for internal beta work. It is already wired as the app, window, installer, taskbar and shortcut icon. Replace it with the final signed MG AutoTech Windows `.ico` before public release.

## Online Verification

On startup the app:

1. creates or loads a local installation ID
2. calls `/api/desktop/app-check`
3. blocks if the server is unavailable
4. blocks if the app version is unsupported
5. blocks upload/request flow during maintenance mode

No offline mode exists.

## Updates

The app uses `/api/desktop/app-check` as the authoritative update gate. Optional native update checking is prepared with Electron `electron-updater`.

Optional runtime env:

```bash
MG_DESKTOP_UPDATE_FEED_URL=https://file.mgautotech.de/desktop/updates
```

If no native feed is configured, update buttons open the HTTPS `update_url` returned by app-check.

## Modules

Customer-visible modules are remotely gated by app-check.

Enabled by default:

- `file_upload`
- `request_history`
- `support`
- `dtc_tools_beta_visible` as a non-functional beta preview

The DTC Tools beta card is visible as "Beta / Coming Soon" by default. The same module can also be returned by app-check as `dtc_tools_beta_visible`. Visibility does not enable real DTC processing.

Future diagnostics, DTC processing and tuning modules are disabled and hidden. They do not generate MOD files, binary patches, checksum changes or DTC OFF output.

## Customer Features

The current beta app includes:

- professional dashboard with account, credits, app status and sync status
- status cards for server connection, credit verification, desktop upload enablement and update state
- guided six-step request wizard: vehicle, service, file, notes, review, submit
- catalog vehicle selection with searchable dropdowns
- manual vehicle fallback for missing catalog entries
- multiple service selection where the server catalog supports it
- local SHA-256 calculation
- upload progress with percentage, transferred bytes, speed and ETA
- retry-safe idempotency key and upload-session reuse for the active submission
- local safe upload history
- recent request status view
- customer-visible request messages, loaded from the existing customer-safe messages API
- support panel with safe diagnostic copy
- settings panel with update status, theme, logout and local-history controls

Local history is only a convenience view. It cannot create requests, spend credits or bypass server validation.

## Upload Flow

1. Customer logs in.
2. App verifies app-check online.
3. App loads `/api/desktop/bootstrap`.
4. Customer selects vehicle, service, file, and notes.
5. App validates extension and size.
6. App calculates SHA-256 locally.
7. App calls `/api/desktop/upload-session` with service and file metadata.
8. Server validates app status, customer auth, current credits, service pricing, idempotency, and metadata.
9. App uploads to the returned private Storage object URL.
10. App calls `/api/desktop/requests/finalize`.
11. Server verifies the signed upload contract, real Storage size/content type, downloaded SHA-256, customer ownership, SHA-bound immutable path and credits.
12. A database idempotency claim creates the debit and order in one transaction,
    so concurrent finalization attempts return the same request instead of
    spending credits twice.

The web server requires a server-only `UPLOAD_INTEGRITY_SECRET` of at least 32
characters. Upload paths include the submitted SHA-256. A Storage `409` can be
treated as a retry only because finalization downloads that immutable path and
recomputes the hash; a stale or changed object cannot create a request.

## Stored Locally

Only safe read-only upload history metadata:

- request id
- filename
- file size
- SHA-256
- upload status
- timestamp
- selected vehicle summary
- selected service summary
- last known safe server status
- safe error message when an upload fails

The app does not copy raw ECU/TCU files into its local history.

## DTC Tools Beta Card

The dashboard shows a customer-facing `DTC Tools` card marked `Beta / Coming Soon`.

Current behavior:

- shows a disabled/future-state module card
- opens only an informational modal
- does not ask for a file
- does not upload files
- does not create a DTC request
- does not call DTC APIs
- does not modify files
- does not generate MOD files
- does not calculate checksums

Modal text:

```text
DTC Tools are currently in beta. This module will allow structured DTC request preparation in a future release. No file modification is performed in this version.
```

## Safety Boundaries

- No admin APIs.
- No service-role key.
- No MOD generation.
- No binary editing.
- No checksum correction.
- No raw/hex display.
- No offline credit usage.
- No cached-credit request creation.
- No customer access to another customer's requests.

## Blank Screen Prevention

Older builds could crash to a black Electron window if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` was missing at renderer startup. The app now prevents this in two ways:

1. `npm run check-env` blocks build/package if the required public desktop env values are missing.
2. If a bad build is somehow launched, the renderer shows a visible English configuration error instead of throwing before React can render:

```text
Application configuration is missing.
Please reinstall the app or contact MG AutoTech support.
```

## Beta Test Checklist

Use a safe test customer account and a harmless tiny fixture file only.

1. Launch app with internet connected.
2. Confirm "Connection successful" appears before login.
3. Login.
4. Confirm dashboard cards show connection, credits, desktop upload and update state.
5. Open New Request.
6. Select vehicle from catalog or use manual fallback.
7. Select service.
8. Select a tiny safe test file.
9. Confirm SHA-256 is calculated locally.
10. Submit and confirm progress phases appear.
11. Confirm success screen shows request ID.
12. Confirm local history stores metadata only.
13. Confirm Request Status can open the request in the web dashboard.
14. Confirm Support diagnostic copy contains no token, raw file content or storage path.
15. Disconnect internet and confirm the workflow blocks instead of continuing offline.

Do not use real customer files during beta packaging tests.
