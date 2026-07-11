# Customer Uploader Beta Test Plan

## Scope

This plan covers internal beta testing for MG AutoTech File Upload Assistant.

Do not publish the installer publicly. Do not use real customer ECU/TCU files. Use a safe test account and a harmless tiny fixture file.

## Preflight

1. Confirm `apps/customer-uploader/.env.local` exists and uses only public `VITE_*` values.
2. Confirm no service-role key is present in the desktop app.
3. Run `npm run build` from `apps/customer-uploader`.
4. Run `npm run package:win` from `apps/customer-uploader`.
5. Confirm installer and portable EXE are unsigned internal beta artifacts.
6. Confirm the packaged app opens to the English login screen.

## Startup And Update Gate

1. Launch with internet connected.
2. Confirm "Checking MG AutoTech server..." appears first.
3. Confirm "Connection successful." appears before login.
4. Disconnect internet and relaunch.
5. Confirm the app blocks workflow with the server unavailable screen.
6. Test forced update by raising `DESKTOP_APP_MIN_VERSION` in a safe non-production environment.
7. Confirm update-required workflow blocks dashboard and upload.

## Login And Dashboard

1. Login with a safe test customer.
2. Confirm dashboard cards show:
   - connected to MG AutoTech
   - credits verified
   - desktop uploads enabled
   - update status
3. Confirm customer ID placeholder is clean if no customer ID exists.
4. Confirm recent requests contain only customer-safe fields.

## New Request Wizard

1. Select a catalog vehicle.
2. Repeat with manual vehicle fallback.
3. Select service and optional extras.
4. Select a tiny harmless file with a supported extension.
5. Confirm file size, extension and SHA-256 display.
6. Confirm unsupported extension is blocked.
7. Confirm suspicious small file warning appears when relevant.
8. Confirm notes and contact preference are shown in review.
9. Submit.
10. Confirm upload phases:
    - preparing upload session
    - uploading file
    - verifying upload
    - finalizing request
    - request submitted

## Retry Safety

1. Trigger a safe network failure during a test upload if practical.
2. Retry from the same screen.
3. Confirm duplicate request is not created.
4. Confirm local history records safe metadata only.

## Request Status And Messages

1. Open Request Status.
2. Refresh server requests.
3. Open a request in the web dashboard.
4. Load customer-visible messages.
5. Confirm internal notes and hidden messages are not shown.

## Support And Settings

1. Copy support email.
2. Copy diagnostic info.
3. Confirm diagnostics contain no token, raw file content, local absolute path, private storage path or admin metadata.
4. Check for updates.
5. Clear local history.
6. Logout.

## Public Release Blockers

- Final branded Windows icon is still required.
- OV/EV code signing certificate is required.
- Clean Windows VM test is required.
- Defender and SmartScreen check is required.
- Hosted HTTPS update/download location is required.
- Real public release notes URL is required.
- True chunked/resumable upload is not implemented; current flow is retry-safe whole-file upload.
