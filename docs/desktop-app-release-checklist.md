# Desktop App Release Checklist

The Windows uploader remains an internal beta until every mandatory release
gate below is explicitly satisfied. The admin release center is read-only and
cannot publish an installer.

## Build And Product Checks

1. Build the desktop application from `apps/customer-uploader`.
2. Confirm all customer-facing UI is English.
3. Confirm startup app-check, forced update, maintenance, and offline blocking.
4. Confirm login is required and logout clears the session.
5. Confirm upload and finalize remain server-authorized and idempotent.
6. Confirm no service-role key, admin route, local absolute path, or raw/hex
   preview exists in the renderer bundle.
7. Confirm the final branded Windows icon is present.

## Signing And Windows Trust

1. Build with an MG AutoTech-controlled OV or EV code-signing certificate.
2. Keep certificate files and passwords outside the repository.
3. Verify the installer signature with `signtool verify /pa`.
4. Test install, launch, upgrade, and uninstall on a clean Windows VM.
5. Scan both installer and installed application with Windows Defender.
6. Record SmartScreen behavior and submit any false positive through Microsoft's
   official false-positive process.
7. Preserve release version and SHA-256 records internally.

## Update And Distribution

1. Upload only a signed installer to MG AutoTech-controlled HTTPS storage.
2. Configure HTTPS update and release-notes URLs.
3. Set minimum and latest supported versions.
4. Validate required and optional update behavior.
5. Enable only selected beta customers first.
6. Run one harmless, authorized beta upload end to end.
7. Confirm no installer link is visible on `/download/windows` before approval.
8. Enable public download only after signing and clean Windows/Defender checks.

## Admin Verification

Open `/admin/desktop-app`. Every mandatory check must be green before a public
download can be projected. Environment values are shown only as present or
missing; secret values are never returned.

