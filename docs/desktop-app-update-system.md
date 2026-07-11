# Desktop App Update System

## Current Status

The MG AutoTech File Upload Assistant has an update-ready foundation.

Implemented:

- online startup app-check
- minimum supported version
- latest version
- forced update gate
- optional update banner
- HTTPS update URL
- HTTPS release notes URL
- maintenance mode gate
- desktop upload enable/disable gate
- Electron `electron-updater` foundation

Not yet fully automated:

- hosted update feed
- signed update package publishing
- automatic download/install flow for customers

## Server App-Check

Endpoint:

`GET /api/desktop/app-check`

Desktop sends:

- `x-mg-desktop-app-version`
- `x-mg-desktop-platform`
- `x-mg-desktop-build-channel`
- `x-mg-desktop-session-status`
- `x-mg-desktop-installation-id`

Server returns:

- `server_ok`
- `desktop_upload_enabled`
- `maintenance_mode`
- `minimum_supported_version`
- `latest_version`
- `update_required`
- `update_available`
- `update_url`
- `release_notes_url`
- `message_en`
- `allowed_modules`

## Environment Variables

```bash
DESKTOP_APP_MIN_VERSION=0.1.0
DESKTOP_APP_LATEST_VERSION=0.1.0
DESKTOP_APP_UPDATE_URL=https://file.mgautotech.de/downloads/MG-AutoTech-File-Upload-Assistant-Setup.exe
DESKTOP_APP_RELEASE_NOTES_URL=https://file.mgautotech.de/desktop/release-notes
DESKTOP_APP_UPLOAD_ENABLED=true
DESKTOP_APP_MAINTENANCE_MODE=false
DESKTOP_APP_ALLOWED_MODULES=file_upload,request_history
```

Only HTTPS update and release note URLs are accepted.

## Forced Update

If `app_version < DESKTOP_APP_MIN_VERSION`, the app blocks the workflow and shows:

`A new version of MG AutoTech File Upload Assistant is required. Please update the application to continue.`

## Optional Update

If `app_version < DESKTOP_APP_LATEST_VERSION`, the app shows an update banner but allows the customer to continue unless the minimum version also blocks it.

## Native Updater Foundation

Electron main process includes an `electron-updater` IPC foundation.

Optional env:

```bash
MG_DESKTOP_UPDATE_FEED_URL=https://file.mgautotech.de/desktop/updates
```

If configured, the app can check a generic Electron update feed. The app does not auto-download or auto-install updates in the current MVP.

## Update Security Rules

- Update URL must be HTTPS.
- Update source must be MG AutoTech controlled.
- Public update packages should be signed.
- `app-check` must block unsupported versions.
- No update code should execute arbitrary scripts.
- Broad public release requires code signing.

## Future Completion

1. Choose final update hosting path.
2. Enable signed Electron Builder publish artifacts.
3. Configure generic feed metadata.
4. Add customer-safe auto-download UX after signed release testing.
5. Keep app-check as the authoritative forced-update gate.
