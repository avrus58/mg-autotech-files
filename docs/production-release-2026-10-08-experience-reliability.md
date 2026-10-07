# Production release — Experience & Reliability v0.2.0

## Published runtime

- Owner authorization: `yayinla bakalim komple`, 8 October 2026 (Europe/Berlin).
- Application: https://file.mgautotech.de, existing Hostinger VPS deployment.
- Runtime source: `c9bf48c5f61358e4aa0a535e17c945d8024b35c8`.
- Paired release: `c9bf48c5f613`; version `0.2.0`.
- Linux BUILD_ID: `gT-gKmfVbgumVH1yhFPVa`.
- Branch: `codex/experience-reliability-release-20261008`; exact runtime source
  pushed and verified before deployment. Later documentation-only commits do
  not replace this runtime identity. No GitHub Actions/CI success is claimed.
- App image: `sha256:bb4f2fab6459715f33e431f5f6fc564ab364dfe78ca4ddf6ba7e161f1b966180`.
- Analyzer image: `sha256:f1ecc8192416199e1c40eb22ef499dbe2b292bd9fcb2dac64ab5a7654c15995b`.
- Both services healthy, zero restarts. Caddy, workshop and PostgreSQL image
  identities, start times and restart counts match the original preflight.

## Scope and preserved boundaries

All 16 accepted ready File Service packages are included: compact localized
homepage and illustrative interactive request demo; service discovery; five
shared service experiences; four multilingual service-guide families; shared
public utilities; ECU read-advisor containment; offline campaign-link locale
parity; scoped chat draft/send/heading/history reconciliation; admin customer
draft preservation and visible save/retry feedback; account-bound notifications
and reachable private overlays. Details and the exact unfinished pilot cut are
in [the scope record](experience-reliability-v0.2.0-release-scope.md).

The unfinished Tools hub/request-brief copy, progress and document-rewrite pilots
remain In Progress/PARTIAL/NO-GO and are excluded. Their original history/evidence
is retained. Existing features remain present. Root package/lock version only
changed; dependencies and desktop uploader version are unchanged. Primary dirty
owner checkout is untouched; no Ads, price/payment, schema, customer-data,
authentication/RLS policy, email configuration or separate workshop mutation.

## Fresh verification on the final runtime source

| Gate | Result |
|---|---|
| Full tests, first and alone | 2,072/2,072; zero failed/cancelled/skipped/todo |
| All-locale i18n | 38/38; 12 locales, 43 sources, 2,485 rows; zero clean English fallback |
| Standard lint | PASS; 34 ignored fixture files restored hash-identically |
| Web and desktop renderer/electron/node types | PASS before and after fresh build |
| Local Webpack Production build | PASS, 326 pages; mandatory prebuild and strict artifacts |
| Native Linux Turbopack Production build | PASS, 326 pages; prebuild 38/38 |
| Linux standalone artifacts | 69 assets, five fonts, 30 PDFKit, 34 Linux Sharp; compiled synthetic anonymous 401, valid PNG/PDF, external fetches zero |
| Performance / emitted contracts | PASS; homepage 16.4/80 KB gzip, worker 6.5/12 KB raw; 2/2 emitted checks |
| Immediate unchanged GET-only Production smoke | 167/167; 140 raw locale observations; readiness and anonymous privacy checks |
| Immediate predecessor asset continuity | 20/20 status/byte/hash-identical assets |
| Original b4 production asset continuity | Separate 20/20 status/byte/hash-identical assets; not 40 distinct files |
| Final native browser | 16 home/TCU guide EN/DE/TR/ZH laptop/mobile views; no document/main horizontal overflow or crash; console warnings/errors zero |
| Actual final language selections | Eight real menu selections: four DE guides mobile, TCU DE laptop/TR laptop/ZH mobile, repeated TCU DE mobile; English URL/body/lang, including settled TCU, verified |

## Native acceptance correction, not a waiver

The first healthy cutover `129a5dbc8c88` passed Linux and anonymous smoke, but
real DE-to-EN guide selection exposed a capture-order defect. The existing
measurement-boundary capture listener stopped React before the selected language
intent was persisted. The bounded final fix reuses the existing validated intent
writer before the existing forced document navigation. Four actual-handler
regressions were added. Measurement allowlists/configuration, consent, isolation,
assertions, timeouts and skips were not weakened. Initial failures remain in the
packet; no successfully executed baseline unit RED is claimed for the refused
launcher. The final eight real hosted interactions verify the correction.
Seven immediate destinations include the test query/hash; the settled English
TCU address is bare because the unchanged existing Google privacy sanitizer
removes arbitrary query/hash before provider insertion. The original observer
assertion and intermediate over-specific wording are retained and corrected in
the accepted successor; permanent arbitrary-query retention is not claimed.
The sanitizer file is byte-identical in original b4 and final c9 source.

## Immutable evidence and recovery

- Source archive: 20,060,483 bytes; SHA-256
  `a6f69317b45b129ce9e7842baedf566bf76e60aa214b8514294cff860fb10aab`;
  verified locally and remotely before extraction.
- Private Linux deploy log: 0600, 31,692 bytes; SHA-256
  `995db62efc40ee0dca73b9dc6ed06028af1af901ccc2ccae9258736e4178b81a`.
- Final smoke receipt: `experience-release-post-20261007T234441544Z.json`,
  SHA-256 `13a576ba01e6b9ddc9701c27f8feb6dbc0598803e285c3460d466a7910b8e7aa`.
- Accepted native receipt: `experience-release-native-final-accepted-c9bf48c.json`,
  SHA-256 `76083863995cccdba9f456cc15384fc7a2abb5d3d487ef472a7db5f265b3be9d`;
  original `5b274558...9e813` and intermediate record remain separate evidence.
- Final acceptance packet: `experience-release-final-acceptance-packet-successor-c9bf48c.json`,
  SHA-256 `def59c63e326cbb32fc76300fa8eff2c5f126928cb657c8e971568c08e3c5d7a`.
- Final independent Production acceptance: `GO_SCOPED_PRODUCTION`,
  `experience-release-independent-final-review-c9bf48c-20261008.json`, SHA-256
  `d6d7bbab6eb4e00bcc771c84e7560e07797cbb5ee61f3abd3893250296571e41`.
  Root read the complete immutable receipt before task closure. All sixteen
  final and eight transition frames were independently physically reviewed.
- Hashed receipts, logs and screenshots retained in ignored
  `.autopilot/runtime/experience-release-c9bf48c5f613`; first-cutover negatives
  also retained separately. Runtime JSON is not added to Git.

Immediate retained paired rollback:

```sh
cd /opt/mgautotech/file-service/releases/c9bf48c5f613
bash scripts/vps/rollback.sh 129a5dbc8c88
```

Both `129a5dbc8c88` images and the original `b4c22314d60f` pair remain available;
the latter is the full package backout, not the immediate previous release.
No database migration occurred, so no unrelated backup/migration gate blocked
this code-only release. The deploy runner built both images before cutover.

## Evidence limits and cleanup

These are scoped release gates, public/anonymous Production checks and selected
native journeys, not proof of actual affected-PC session recovery, authenticated
backend/RLS behavior, real registration/CAPTCHA/email/payment, Ads performance,
conversions, revenue or global perfection. Existing prefixless Tools/request-brief
opening-language/final-Vary and notification read-error debts remain open.
Local agent preview stopped; temporary browser viewport reset; fully loaded
Turkish live homepage left as the deliverable. No owner tabs/processes cleared.
Absent Autopilot controller uses a documented manual fallback; broader paused
goal remains paused, not resumed or completed by this release.
