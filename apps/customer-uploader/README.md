# MG AutoTech File Upload Assistant

Windows desktop app for authenticated MG AutoTech customer uploads.

This app is not an offline standalone program. It requires an active connection to `file.mgautotech.de` before login, dashboard load, vehicle catalog load, upload-session creation, and request finalization.

## Location

Desktop app files live only under:

`apps/customer-uploader`

Do not place Electron UI or desktop packaging files inside the main web app folders.

## Environment

Create `apps/customer-uploader/.env.local`:

```bash
VITE_API_BASE_URL=https://file.mgautotech.de
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_APP_VERSION=0.1.0
VITE_APP_BUILD_CHANNEL=stable
```

Never add service-role keys or admin secrets to this app.

## Commands

```bash
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

## Packaging Output

Electron Builder writes Windows artifacts to:

`apps/customer-uploader/release/`

Expected artifact names:

- `MG AutoTech File Upload Assistant 0.1.0-nsis.exe`
- `MG AutoTech File Upload Assistant 0.1.0-portable.exe`

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

Future diagnostics and DTC modules are disabled and hidden. They do not generate MOD files, binary patches, checksum changes or DTC OFF output.

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
11. Server verifies the private object, customer ownership, expected path, upload session ID, credits, and duplicate state.

## Stored Locally

Only safe read-only upload history metadata:

- request id
- filename
- file size
- SHA-256
- upload status
- timestamp

The app does not copy raw ECU/TCU files into its local history.

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
