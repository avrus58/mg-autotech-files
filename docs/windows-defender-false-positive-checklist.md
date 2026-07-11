# Windows Defender False Positive Checklist

Use this checklist before broad customer distribution of MG AutoTech File Upload Assistant.

## Pre-Release

1. Build a signed installer.
2. Build a signed portable EXE if distributing portable builds.
3. Keep version, hash, build date, and release notes.
4. Test on a clean Windows VM.
5. Verify the app only connects to MG AutoTech HTTPS endpoints.
6. Verify the app does not request admin rights.
7. Verify no hidden background service or startup autorun is installed.
8. Verify uninstall works cleanly.

## Defender / SmartScreen

1. Run Windows Defender scan on the installer and portable EXE.
2. Open the installer on a clean Windows machine.
3. Observe SmartScreen behavior.
4. Confirm publisher name appears correctly on signed builds.
5. Confirm app launches and app-check runs online.

## If A False Positive Appears

1. Do not bypass or disable antivirus.
2. Do not obfuscate or pack the binary.
3. Do not distribute broadly until reviewed.
4. Submit the sample to Microsoft Security Intelligence as a false positive:
   - include company name
   - product name
   - version
   - SHA-256 hash
   - signed certificate details
   - explanation of app behavior
5. Keep the submitted sample and response for release records.

## Customer Communication

- Explain that the app is an online upload client for MG AutoTech customers.
- Explain that unsigned beta builds may show SmartScreen warnings.
- Prefer signed public releases only.

## Do Not Do

- Do not add antivirus bypass behavior.
- Do not use packers/obfuscation.
- Do not execute hidden scripts.
- Do not scan unrelated folders.
- Do not request admin rights without a real need.
