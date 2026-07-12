# Otonom gorev kuyrugu

> Yalnizca repository incelemesiyle dogrulanan, kucuk veya orta olcekli ve guvenli gorevler eklenir.

## Ready

### AUTO-006 [P1] `src/proxy.ts` locale davranisi icin unit test ekle

Kapsam: Locale cookie/header cozumu ve localized path davranisi icin dar kapsamli test ekle.

Kabul kriterleri:

- Locale path varsa `x-mg-locale` ona gore set edilir.
- Cookie varsa ve path locale icermiyorsa cookie dili korunur.
- Cookie yoksa `accept-language` fallback davranisi test edilir.
- API/private matcher davranisi uzerinde urun route degisikligi yapilmaz.

Dogrulama: `npm test`.

### AUTO-007 [P1] Vehicle JSON fallback icin data integrity testi ekle

Kapsam: `data/vehicle-database.json` ve `data/vehicle-performance-overrides.json` public fallback sozlesmesini testle.

Kabul kriterleri:

- Public fallback kayitlari forbidden admin/private alanlari icermez.
- Normalize edilmis public key duplicate adaylari raporlanir.
- Override keyleri beklenen formatta ve mevcut data ile uyumlu kontrol edilir.
- Test veri icerigini otomatik degistirmez.

Dogrulama: `npm test`.

### AUTO-008 [P1] Offline build bagimliligini dokumante et

Kapsam: `next/font/google` nedeniyle restricted/offline build'in Google Fonts fetch hatasina takildigini README veya docs icinde local automation notu olarak belgele.

Kabul kriterleri:

- `npm run build` icin ag gereksinimi ve bootstrap hata nedeni aciklanir.
- Font/tasarim degisikligi yapilmaz.
- Yerel fonta gecis istenirse bunun ayri onayli gorev olacagi belirtilir.
- STATUS/PROJECT ile celismeyen tek bir kaynak notu olusturulur.

Dogrulama: Markdown diff incelemesi, `npm run lint`.

- [ ] **P1 AUTO-011 - Admin review filtresi payment ve kalite sinyallerini kapsasin**
  - Domain: Responsive UX & product flow
  - Fingerprint: `responsive-ux|admin-request-control-center|review-filter-misses-payment-quality-signals|complete-review-queue`
  - Impact: 4/5
  - Confidence: 5/5
  - Effort: 2/5
  - Evidence: `src/app/admin/requests/AdminRequestsClient.tsx:167` Review only filtresi yalniz `workOrder.admin_status` degerini kontrol ediyor; `src/app/admin/requests/AdminRequestsClient.tsx:177` Needs review metrigi ayni dar kontrolu kullaniyor. Ayni ekranda `payment_review_status` gosteriliyor (`src/app/admin/requests/AdminRequestsClient.tsx:280`) ve tipte `quality_check_status` mevcut (`src/app/admin/requests/AdminRequestsClient.tsx:48-50`).
  - Scope: Admin request listesinde tek bir review-signal helper'i ile review-only filtresi ve Needs review metrigini payment/QC/delivery blokaj sinyallerini kapsayacak sekilde dar kapsamda guncelle.
  - Acceptance criteria:
    - `admin_status` review durumlari mevcut davranisi korur.
    - `payment_review_status === "requires_review"` ve `quality_check_status` failed/needs_review gibi gercek inceleme gerektiren durumlar Review only sonucuna ve Needs review sayacina girer.
    - Filtre, arama ve priority secimleriyle birlikte calismaya devam eder.
    - Odeme, kredi, fiyat veya DB mutasyonu yapilmaz.
  - Validation:
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`

- [ ] **P2 AUTO-013 - Musteri order timeline'i bekleme ve revizyon adimlarini acik gostersin**
  - Domain: Responsive UX & product flow
  - Fingerprint: `responsive-ux|customer-order-detail|timeline-collapses-actionable-statuses|clear-next-step-status`
  - Impact: 3/5
  - Confidence: 5/5
  - Effort: 2/5
  - Evidence: `src/app/dashboard/orders/[id]/page.tsx:171` timeline yalniz `new_request`, `file_check`, `in_progress`, `completed` adimlarindan olusuyor; `src/app/dashboard/orders/[id]/page.tsx:197-199` `revision` statusunu `in_progress`, `customer_info_needed` statusunu `file_check` adimina sikistiriyor. Ayni sayfada current-step metni bu iki statusu ayri ele aliyor (`src/app/dashboard/orders/[id]/page.tsx:831-836`).
  - Scope: Musteri order detay sayfasinda timeline adimlarini musteriye acik ve guvenli sekilde `customer_info_needed` ve `revision` durumlarini gosterecek bicimde guncelle.
  - Acceptance criteria:
    - `customer_info_needed` musteriye aksiyon gerektiren ayri bir bekleme/adim olarak gorunur.
    - `revision` teslim sonrasi revizyon sureci olarak ayri gorunur ve mevcut revision request paneliyle celismez.
    - Completed/download davranisi ve private/admin-only bilgi gizliligi korunur.
    - Mobil/desktop layoutta timeline metinleri tasmaz.
  - Validation:
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`

## In Progress

## Blocked

## Later

### AUTO-009 [P2] Production smoke dokumani ile local autopilot smoke ayrimini netlestir

Kapsam: `docs/production-smoke-checklist.md` ve ilgili guvenlik notlarinda production smoke'un insan kontrollu, autopilot smoke'un local-only oldugunu ayir.

Kabul kriterleri:

- Production checklist'teki canli URL komutlari insan kontrollu olarak etiketlenir.
- Otonom Codex dongusu icin localhost disi smoke calistirmama kuralina link/veri verilir.
- Mevcut non-mutating production smoke anlamlari korunur.
- Fiyat, odeme kurali veya operasyonel ticari karar degismez.

Dogrulama: Markdown diff incelemesi, `npm test` ilgili source assertion testleri.

### AUTO-010 [P3] Dar kapsamli encoding artifact temizligi yap

Kapsam: Runtime stringlere dokunmadan yalnizca acikca bozulmus kaynak yorumlari veya teknik dokuman satirlarinda encoding artifactlerini temizle.

Kabul kriterleri:

- Ilk pass sadece `src/lib/supabaseServer.ts`, `src/lib/vehicleDatabase.ts` ve gerekirse scraper README yorum/dokuman satirlariyla sinirlidir.
- Public/legal/customer-facing metinler degistirilmez.
- Davranis, API, tasarim ve data icerigi degismez.
- Diff sadece yorum/dokuman karakter duzeltmesi icerir.

Dogrulama: Diff incelemesi, `npm run lint`, `npm run typecheck`.

## Done

### AUTO-012 [P1] Work-order fallback modunda mutasyon kontrollerini read-only yap

Durum: Done

Fingerprint: `observability|admin-work-order-detail|fallback-mode-actions-still-enabled|read-only-state-with-actionable-feedback`

Kapsam: `payload.migrationReady === false` fallback modunda admin work-order detay ekranindaki mutasyon kontrolleri read-only/disabled hale getirildi.

Sonuc: Start Work, status/priority/tuner/payment review/quality/delivery/final file secimleri, note ekleme, customer upload permission ve customer message visibility aksiyonlari fallback modunda tetiklenemez. Mevcut read-only banner genisletildi; Refresh, ozet panelleri ve migration hazir oldugundaki mevcut aksiyon davranislari korundu.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (23/23); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (233/233); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-005 [P0] Scraper scriptlerine explicit network guard ekle

Durum: Done

Fingerprint: `security|scraper-scripts|external-network-without-explicit-opt-in|explicit-careecufile-network-guard`

Kapsam: `scripts/carecufile-scraper.mjs` ve `scripts/scrape-all-brands.mjs` dis aga cikmadan once explicit `--allow-network` flag'i veya `ALLOW_CAREECU_NETWORK=1` env izni gerektirir.

Sonuc: Izin yokken scraperlar fetch, child scraping veya veri dosyasi yazma adimina gelmeden anlasilir mesajla cikar. Explicit izinle mevcut scraping argumanlari korunur; tum marka scripti `--allow-network` bayragini child scraper'a aktarir. `scripts/README-carecufile-scraper.md` yeni guard'i aciklar.

Dogrulama: `node scripts/carecufile-scraper.mjs --brands-only` beklenen guard cikisi; `.\node_modules\.bin\tsx.cmd --test tests/carecufile-scraper-guard.test.ts` PASS (4/4); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (232/232); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-004 [P0] Smoke scriptlerine non-local hedef guard'i ekle

Durum: Done

Fingerprint: `security|smoke-scripts|non-local-target-without-explicit-override|local-only-autopilot-guard`

Kapsam: `scripts/smoke-public-platform.mjs`, `scripts/smoke-admin-unauthenticated.mjs`, `scripts/smoke-admin-work-orders.mjs` ve `scripts/smoke-vehicle-control-center.mjs` icin ortak local-only smoke URL guard'i eklendi.

Sonuc: Default `localhost` hedefleri korunur; non-local smoke hedefleri `ALLOW_NON_LOCAL_SMOKE=1` olmadan fetch'e gecmeden reddedilir. Production smoke dokumanlari human-controlled override kosulunu gosterir; non-mutating source assertion testleri korundu ve guard testi eklendi.

Dogrulama: no-network guard kontrolu PASS; hedefli `tsx --test tests/admin-work-orders.test.ts tests/vehicle-control-center.test.ts` PASS (61/61); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (228/228); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-003 [P0] Desktop env checker icin otonom guvenli mod ekle

Durum: Done

Fingerprint: `security|desktop-env-checker|env-file-secret-read|schema-only-public-contract-validation`

Kapsam: `apps/customer-uploader/scripts/check-env.mjs` icin `.env`/`.env.local` okumayan ve yalnizca public desktop env sozlesmesini dogrulayan guvenli mod eklendi.

Sonuc: Varsayilan desktop build/dev oncesi env kontrol davranisi korundu; `--schema-only` modu root/app `.env*` dosyalarina dokunmadan yalnizca public Vite env sozlesmesini raporlar ve service-role/server secret uyarisi yapar.

Dogrulama: `node apps/customer-uploader/scripts/check-env.mjs --schema-only`, hedefli desktop test, `npm run lint`, `npm run typecheck`, `npm test`.

### AUTO-002 [P0] Payment env checker icin otonom guvenli mod ekle

Durum: Done

Fingerprint: `security|payment-env-checker|env-local-secret-read|schema-only-contract-validation`

Kapsam: `scripts/check-payment-env.js` icin `.env.local` okumadan yalnizca gerekli key listesini ve dokumantasyon sozlesmesini kontrol eden `--schema-only` modu eklendi.

Sonuc: Varsayilan OK/MISS raporu korundu; `--schema-only` modu env dosyasi okumadan yalnizca gerekli key sozlesmesini raporlar. Yeni testler guvenli modun dosya okuma API'lerine gitmedigini ve output'un deger basmadigini dogrular.

Dogrulama: `node scripts/check-payment-env.js --schema-only`, hedefli test, `npm run lint`, `npm run typecheck`, `npm test`.

### AUTO-001 [P0] Root README'yi gercek proje rehberine cevir

Durum: Done

Fingerprint: `developer-experience|root-readme|default-create-next-app|project-specific-safe-setup-guide`

Kapsam: Default create-next-app README icerigini, bu repository'nin gercek amaci, mimarisi, npm komutlari, local setup notlari ve guvenli calisma sinirlariyla degistir.

Kabul kriterleri:

- README kok Next.js app, `apps/customer-uploader` desktop app ve opsiyonel `file-expert-analyzer` rollerini aciklar.
- npm package manager ve mevcut guvenli komutlar listelenir.
- `.env` okumama, production servislerine baglanmama, SQL/deploy calistirmama sinirlari net yazilir.
- Fiyat, garanti, hukuki iddia veya yeni urun vaadi eklenmez.

Dogrulama: Markdown diff incelemesi, `npm run lint`.
