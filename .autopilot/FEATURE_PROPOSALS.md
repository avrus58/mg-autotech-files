# Feature Proposals

## Proposed

### PROPOSAL-20261007-PREFIXLESS-DOCUMENT-LANGUAGE — Native server document language with static/runtime isolation

- Evidence: exact 561a0f0/build kIQ9QYifKY3YStuM1-tij brief HTML has native body,
  Content-Language and descendant script markers, but 11 non-English opening
  html tags are en. Unchanged RootDocument can read child locale route params,
  not prefixless request preferences. Earlier address release deferred it.
- Goal: initial no-JS document/body/metadata language agreement across already
  request-localized public/auth/customer surfaces, retaining all 139 currently
  prerendered routes (88 localized public plus static/fixed/legal/admin/assets).
- Broad coherent candidate: separate static/fixed and request-localized root
  route groups sharing the existing shell/runtimes exactly once. Public URLs
  remain unchanged, but cross-root navigation becomes a full document load;
  unfinished form/auth/navigation consequences need explicit product review.
  This is a wider mechanical architecture change, NOT implemented here.
- Smaller first step: exact internal locale-param rewrite pilot for the current
  request-brief route only. Keep direct aliases non-public and canonical/body
  unchanged, test actual installed-framework HTML/RSC/hydration behavior. This
  can resolve one acceptance dependency; it cannot close every prefixless page.
- Pilot evidence now exists: 3cff2dd / WpzO54pyZuc84KH_DZqOz strict initial HTML
  12/12 and exact 139-entry prerender parity pass. Overall pilot acceptance is
  still RED: installed Next app-page template overwrites final Vary even on the
  unchanged English route. Private/no-store mitigates caching, not the declared
  header contract. Preserve failed evidence; assess a scoped real final-response
  boundary before broad migration. No framework monkeypatch, header-test waiver
  or test-only proxy may be represented as an application fix.
- Bounded two-agent supported-options review on 7 October converged, without
  more prototypes: installed 16.2.11 app-page/module.js136-146 computes fixed
  RSC Vary and template445-446 overwrites config/Proxy. Pinned Proxy documentation
  confirms both configuration headers and Proxy run before Page render. A Route
  Handler controls only its own Response, conflicts with a Page at the same path
  and does not preserve its layouts/native navigation. Request headers(), after()
  and build adapter hooks are not final Page-response setters. Main re-read the
  installed overwrite and pinned Proxy/route-resolution docs. Existing EN control
  and the unchanged strict101 receipt remain decisive RED, not a cache-leak claim.
- No supported in-place final-header implementation was proved within that
  one-route/standalone boundary. Reopen only with a supported reviewed framework
  fix or an explicitly scoped real final-response layer. Existing documented
  Caddy -> file-service:3000 makes a separate edge-layer design plausible, not
  implemented/authorized here; a fake local gateway cannot pass the preserved
  direct-Next gate. No dependency/custom-server/Next monkeypatch or validator
  relaxation. Stop repetitive prototypes and continue other safe product work.
- Pinned option references:
  [16.2.11 Proxy order](https://raw.githubusercontent.com/vercel/next.js/v16.2.11/docs/01-app/03-api-reference/03-file-conventions/proxy.mdx),
  [16.2.11 route resolution](https://raw.githubusercontent.com/vercel/next.js/v16.2.11/docs/01-app/01-getting-started/15-route-handlers.mdx).
  These references were used to reject unsafe shortcuts, not to assert a later
  framework version or a completed infrastructure remedy.
- Rejected shortcuts: whole-root request headers that remove static prerendering,
  post-render regex/HTML mutation, duplicate html tags, script-only/no-JS waivers,
  unchecked query locale values, new libraries or newly indexable alias pages.
- Required proof before any broad migration: exact route/metadata/error/loading
  inventory migration without relaxing source fingerprints, all-locale first
  HTML, full original prerender membership, one runtime/provider installation,
  auth/private cache/anonymous denial, responsive/native navigation and existing
  workflow/state regressions. Local/synthetic only; no backend/customer/env data.
- Official design references checked 7 October 2026:
  [Proxy rewrites](https://nextjs.org/docs/app/api-reference/file-conventions/proxy),
  [locale route params](https://nextjs.org/docs/app/guides/internationalization),
  [request-time headers](https://nextjs.org/docs/app/api-reference/functions/headers).
  Docs currently describe later 16.x; validate against actual installed 16.2.11 rather
  than introducing unavailable new APIs. Selection remains design/prototype
  work, not a completed global language fix or authorization to deploy.

### PROPOSAL-20260823-AUTHENTICATED-DATALOG-ENTITLEMENT - Gercek customer-only detayli datalog analizi

- Problem: Public iki-metrik snapshot ve customer Studio ayni browser-local
  parser/report dependency graph'ini kullaniyor. UI route kilidi gorunumu
  sinirliyor, fakat anonim static JavaScript icindeki full analiz motorunun
  indirilmesini veya yeniden calistirilmasini engellemiyor.
- Target user: Detayli Studio'yu musteri avantaji olarak sunmak isteyen owner ve
  dosyasinin nasil islenecegini acikca bilmesi gereken musteri.
- Proposed solution: Full analizi authenticated, device-assured, rate-limited,
  no-store ve ephemeral bir server endpoint'ine tasi; public client'ta yalniz
  iki-metrik icin ayri minimal motor birak. Ham logu loglama/persist etme,
  response'u detayli entitlement sozlesmesiyle sinirla ve abuse/timeout/size
  limitlerini server'da uygula.
- Privacy/product tradeoff: Bu model strict entitlement saglar ama mevcut
  "dosya tarayicidan cikmaz" vaadini degistirir. Owner, transfer/retention
  metnini ve gerekli consent/gizlilik dilini onaylamadan uygulanmamalidir.
- Alternative: Browser-local mimari korunur ve UI-only entitlement'in client
  kodu extractability'sini engellemedigi acikca kabul edilir; bu secenek strict
  customer-only teknik sinir olarak tanimlanamaz.
- Acceptance criteria:
  - Anonymous assets full Studio parser/report uygulamasini icermez.
  - Detayli endpoint base auth + device assurance + tenant/rate/resource
    sinirlarinda fail-closed kalir.
  - Upload/log/persistence kapali oldugu test ve runtime header/log politikasi
    ile kanitlanir.
  - Public snapshot yalniz Nm ve estimated HP doner; detayli sonuc anonim veya
    assurance'siz session'a verilmez.
  - Gizlilik ve urun metni owner tarafindan onaylanir.
- Owner decision required: Ephemeral server processing ve buna bagli gizlilik
  metni degisikligini onayla veya browser-local extractability riskini kabul et.

### PROPOSAL-20260713-DESKTOP-RESUMABLE-UPLOAD - Desktop uploader true resumable chunked upload

- Problem: Large ECU/TCU uploads can fail on unstable customer connections. The desktop app currently supports retry-safe idempotency, but not true chunked resume.
- Target user: Customers using the Windows upload assistant and admins who need fewer duplicate or failed upload support cases.
- Current limitation: `apps/customer-uploader/src/App.tsx:1110-1119` uploads the selected file in one storage request through `uploadToPrivateStorage`, and `apps/customer-uploader/src/App.tsx:1301` explicitly tells the customer that true chunked resume is not enabled yet. `src/app/api/desktop/upload-session/route.ts:73-88` returns one object upload target and instructs the app to upload the exact file once before finalize.
- Proposed solution: Design a resumable upload protocol for the desktop assistant with chunk manifest creation, per-chunk retry/resume, server-side finalize/compose verification, checksum validation, local resume metadata and safe cleanup for abandoned sessions.
- Business value: Fewer failed uploads and duplicate customer requests for larger files, stronger professional desktop uploader experience and lower support load.
- User/Admin value: Customers can resume interrupted uploads without starting over; admins receive cleaner request history and fewer local-only failed attempts.
- Data model impact: Likely requires upload session/chunk metadata, expiry state and cleanup policy. This should be designed before any migration file is prepared.
- API impact: New or extended desktop upload-session, chunk upload, status and finalize endpoints may be needed. Existing single-object upload behavior should remain during rollout.
- Security impact: Must keep customer ownership scoping, file type/size limits, SHA-256 validation, private bucket paths, app-check headers and idempotency. No raw binary, storage path, signed URL or token should be exposed beyond the existing upload boundary.
- Rollout: Owner-approved technical design, local prototype with fixture files, beta-only desktop app build, local tests, then production migration/deploy handled outside Codex autonomous runs.
- Acceptance criteria:
  - Upload can resume after network interruption without duplicating the request.
  - Server verifies full-file checksum before request finalization.
  - Expired or abandoned chunks are auditable and cleanable.
  - Existing non-chunked upload remains available until the new path is proven.
  - No production migration, package install, deploy or customer-data test happens inside autonomous Codex runs.
- Owner decision required:
  - Approve data model and storage strategy.
  - Approve whether to use Supabase native resumable upload, a custom chunk protocol or another managed storage path.
  - Approve rollout timing for desktop beta distribution.

## Needs owner decision

## Approved

## Rejected

## Implemented

### PROPOSAL-20260826-EXPLICIT-CREDIT-PRICE-AUTHORITY - Paket ve ozel miktar fiyatlarini ayir

- Owner decision: Admin tarafinda girilen her EUR degeri nihai odenecek tutardir.
  KDV/vergi, ulke, brut/net veya vergi dahil-haric hesabi bu modelde yoktur.
- Implemented solution: Bes global paket toplami ve global custom EUR/kredi
  ayri otoritelerdir. Her musteri icin bes nullable paket override'i ile nullable
  custom EUR/kredi override'i vardir; bos alan yalniz eslesen global fiyati miras
  alir. Bir fiyat alani baska bir paketi veya custom fiyati degistirmez.
- Integrity: Admin kayitlari revision kontrollu atomik RPC ve audit ile yapilir;
  quote revision checkout'ta tekrar dogrulanir; browser tutari canonical kabul
  edilmez. Additive migration mevcut efektif fiyatlari IEEE-754 uyumlu olarak
  materialize eder ve v2-aware rollback bridge kaydedilmeden yeni fiyat yazimini
  fail-closed tutar.
- Delivery state: Kod, UI, migration, SELECT-only verifierler ve release runbook
  yerelde tamamlanip dogrulandi. Isolated staging/Production migrationi ve deploy
  ayri acik yayin talebine kadar uygulanmadi.
