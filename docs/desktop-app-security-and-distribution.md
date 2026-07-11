# Desktop App Security And Distribution

## Product

MG AutoTech File Upload Assistant is a Windows customer upload client for `file.mgautotech.de`.

It is designed to be transparent, signed, online-verified, and easy to uninstall.

## Antivirus-Friendly Behavior

The app:

- connects only to MG AutoTech HTTPS endpoints
- requires customer authentication
- reads only the file selected by the customer
- uploads only through the private MG AutoTech upload flow
- stores only safe local metadata
- does not run hidden background services
- does not add startup auto-run entries
- does not execute arbitrary PowerShell or command scripts
- does not scan unrelated filesystem folders
- does not read browser passwords or credentials
- does not modify the registry except normal installer entries
- does not use packers, obfuscators, or stealth behavior

The app does not:

- generate MOD files
- edit binary files
- checksum-correct files
- expose raw/hex data
- access admin APIs
- work offline as standalone software

## Installer Metadata

Electron Builder config sets:

- product name: `MG AutoTech File Upload Assistant`
- app id: `de.mgautotech.fileuploadassistant`
- publisher: `MG AutoTech`
- requested execution level: `asInvoker`
- per-user NSIS install by default
- clean uninstall support

No admin rights are requested by default.

## Code Signing Readiness

The packaging wrapper supports:

```bash
WINDOWS_CERTIFICATE_FILE=C:\path\to\certificate.pfx
WINDOWS_CERTIFICATE_PASSWORD=secret
npm run package:win
```

The wrapper maps these to Electron Builder's signing environment:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

Do not commit certificate files or passwords.

Ignored secret file types:

- `*.pfx`
- `*.p12`
- `*.pem`

## Certificate Recommendation

- OV code signing certificate: acceptable for controlled customer rollout.
- EV code signing certificate: recommended for faster Microsoft SmartScreen reputation.

Unsigned builds may trigger SmartScreen warnings. Public distribution should wait until the signed installer has been tested.

## Signature Verification

Example:

```powershell
signtool verify /pa "apps/customer-uploader/release/MG AutoTech File Upload Assistant 0.1.0-nsis.exe"
```

## Customer Trust

Before public distribution:

1. Sign installer and portable EXE.
2. Publish only from MG AutoTech controlled HTTPS URL.
3. Keep release notes and hashes.
4. Test on a clean Windows VM.
5. Confirm app-check blocks unsupported versions.
6. Confirm uninstall removes application files cleanly.

## Remaining Distribution Work

- Add final MG AutoTech icon assets.
- Configure final HTTPS update/release location.
- Sign production artifacts with OV/EV certificate.
- Build SmartScreen reputation through signed releases.
