# Feature Proposals

## Proposed

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
