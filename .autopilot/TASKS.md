# Otonom gorev kuyrugu

> Yalnizca repository incelemesiyle dogrulanan, kucuk veya orta olcekli ve guvenli gorevler eklenir.

## Ready

- [ ] **P2 AUTO-018 - Musteri dashboard kredi gecmisi gercek ledger'dan beslensin**
  - Lane: Product Evolution
  - Domain: Customer credit visibility & billing trust
  - Fingerprint: `customer-experience|dashboard-credit-history-preview|orders-used-as-credit-ledger|safe-ledger-preview`
  - Business impact: 3/5
  - User impact: 4/5
  - Admin impact: 2/5
  - Strategic fit: 4/5
  - Confidence: 5/5
  - Effort: 2/5
  - Risk: 2/5
  - Evidence: `src/components/dashboard/DashboardClient.tsx:153-160` dashboard already loads only the latest 5 orders; `src/components/dashboard/DashboardClient.tsx:278-282` builds `creditHistory` from those orders' `credits_required`; `src/components/dashboard/DashboardClient.tsx:861-894` labels that order-derived preview as "Credit History". The real credit ledger exists at `src/app/dashboard/credits/history/page.tsx:109-118`, where customer-scoped `credit_transactions` are loaded and rendered as all credit movements.
  - Product value: Customers see the same billing/credit source of truth on the dashboard and full ledger page, reducing confusion after top-ups, manual adjustments or order usage.
  - Scope: Replace the dashboard's order-derived credit history preview with a small customer-safe `credit_transactions` preview. Reuse the existing credit ledger field contract; do not mutate payments, credits, Stripe, bank transfer rules or pricing.
  - Acceptance criteria:
    - Dashboard credit preview reads latest customer-scoped `credit_transactions` rows by `user_id`, not recent `orders.credits_required`.
    - Positive and negative credit movements are visually distinguishable and include safe description/type, delta, balance/date where available.
    - Empty state links clearly to buy credits or the full ledger without implying missing order history.
    - Existing recent orders, credit balance, live refresh and `/dashboard/credits/history` behavior remain unchanged.
    - No payment records, source IDs, metadata internals, secrets or admin-only notes are exposed.
  - Validation:
    - `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts`
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`

- [ ] **P2 AUTO-019 - Musteri order teslim tahmini yalniz acik estimate varsa sure gostersin**
  - Lane: Product Evolution
  - Domain: Customer order detail & delivery expectation clarity
  - Fingerprint: `customer-experience|order-detail-estimated-delivery|null-estimate-shows-default-30min|explicit-estimate-only`
  - Business impact: 3/5
  - User impact: 4/5
  - Admin impact: 2/5
  - Strategic fit: 4/5
  - Confidence: 5/5
  - Effort: 1/5
  - Risk: 2/5
  - Evidence: `src/app/dashboard/orders/[id]/page.tsx:54-55` allows `estimated_delivery_label` and note to be null, but `src/app/dashboard/orders/[id]/page.tsx:159-166` maps a null/unknown value through `formatDeliveryEstimate` to the default label "Usually around 30 min"; `src/app/dashboard/orders/[id]/page.tsx:840-846` shows that value in the customer-facing Estimated Delivery card even when no explicit estimate was saved.
  - Product value: Customers get a clearer, support-safe expectation without showing a specific turnaround label that was not explicitly set for their order.
  - Scope: Adjust the customer order detail Estimated Delivery card so null or unknown estimate values show a neutral "estimate not set yet" state, while explicit admin-selected estimate labels and notes continue to display exactly as before. Do not change admin delivery options, pricing, SLA policy, legal text or database schema.
  - Acceptance criteria:
    - Null or unknown `estimated_delivery_label` no longer renders as "Usually around 30 min" on the customer order detail page.
    - Explicit `usually_30_min`, `same_day`, `24h`, `48h` and `manual_review` values still render with their existing labels.
    - The fallback explanatory copy avoids exact turnaround claims unless a label exists.
    - Completed, revision and in-progress order detail actions continue to work.
    - Mobile and desktop Estimated Delivery card text remains readable without overflow.
  - Validation:
    - `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts`
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`

- [ ] **P2 AUTO-020 - Musteri ek dosya yuklemesi asamalari acik geri bildirim versin**
  - Lane: Product Evolution
  - Domain: Customer additional upload experience & retry clarity
  - Fingerprint: `customer-experience|order-detail-additional-upload|single-generic-uploading-state|phase-aware-upload-feedback`
  - Business impact: 3/5
  - User impact: 4/5
  - Admin impact: 3/5
  - Strategic fit: 4/5
  - Confidence: 5/5
  - Effort: 2/5
  - Risk: 2/5
  - Evidence: `src/app/dashboard/orders/[id]/page.tsx:456-516` runs the additional upload flow through prepare, Supabase Storage upload and finalize steps, but tracks only the boolean `additionalUploading`; `src/app/dashboard/orders/[id]/page.tsx:793-797` shows the single generic label "Uploading additional file..." for the whole flow. The product docs at `docs/customer-file-upload-assistant.md:129-137` describe upload phases and retry-safe wording as important customer expectations.
  - Product value: Customers asked for another read, log or support file can see whether the upload is preparing, transferring or verifying, reducing repeat attempts and support uncertainty during a sensitive file action.
  - Scope: Add local phase-aware feedback for the existing customer order detail additional-upload flow. Keep the current prepare/upload/finalize APIs, one-file 32 MB limit, private storage bucket, permission toggle behavior and success state unchanged.
  - Acceptance criteria:
    - Additional upload UI shows distinct customer-safe phases for preparing upload, uploading file and verifying/saving the upload.
    - Errors in prepare, storage upload or finalize reset the phase and leave the customer able to retry without changing the selected order data incorrectly.
    - Success still appends the returned upload entry, disables the one-time upload permission locally and shows the existing uploaded-file list.
    - No raw storage path, signed URL, binary content, hash, secret, payment data, admin-only note or live service operation is exposed.
    - Mobile and desktop text remains readable without overflow.
  - Validation:
    - `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts`
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`

- [ ] **P2 AUTO-021 - Admin request listesi musteri ek dosya sinyalini gostersin**
  - Lane: Product Evolution
  - Domain: Admin request queue & customer-supplied file visibility
  - Fingerprint: `admin-operations|request-control-center|customer-upload-indicator-hidden|show-supporting-file-signal`
  - Business impact: 3/5
  - User impact: 2/5
  - Admin impact: 4/5
  - Strategic fit: 4/5
  - Confidence: 5/5
  - Effort: 1/5
  - Risk: 1/5
  - Evidence: `src/lib/workOrders/server.ts:337-340` already computes `indicators.hasCustomerUpload` from `order.customer_uploads`; `src/app/admin/requests/AdminRequestsClient.tsx:289-292` renders only ORI, MOD and AI indicators in the request control center row, so a customer-supplied supporting file is hidden until the admin opens the detail page.
  - Product value: Admin can spot requests with a newly uploaded supporting file directly in the daily queue, reducing missed customer responses and unnecessary detail-page checks.
  - Scope: Surface the existing boolean `hasCustomerUpload` as a compact, non-sensitive indicator in the admin request control center list. Do not add a new query, expose file names/paths, mutate uploads, alter filters or change payment/credit behavior.
  - Acceptance criteria:
    - Request rows show a clear supporting-file/customer-upload indicator when `item.indicators.hasCustomerUpload` is true.
    - Rows without customer uploads keep the existing ORI/MOD/AI indicator layout stable.
    - No customer file name, storage path, signed URL, hash or binary metadata is exposed in the list.
    - The indicator remains readable on mobile and desktop layouts.
    - Existing search, status filter, priority filter and review-only behavior remain unchanged.
  - Validation:
    - `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts`
    - `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts`
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`

- [ ] **P2 AUTO-022 - Admin audit timeline event gorunurlugunu rozetlesin**
  - Lane: Product Evolution
  - Domain: Admin audit trail & customer visibility safety
  - Fingerprint: `admin-operations|work-order-audit-timeline|customer-visible-events-unbadged|visibility-badges-for-audit-events`
  - Business impact: 3/5
  - User impact: 2/5
  - Admin impact: 4/5
  - Strategic fit: 4/5
  - Confidence: 5/5
  - Effort: 1/5
  - Risk: 1/5
  - Evidence: `src/app/admin/requests/[id]/WorkOrderDetailClient.tsx:69` includes `customer_visible` on each work-order event; `src/app/admin/requests/[id]/WorkOrderDetailClient.tsx:553-561` renders the audit timeline with event type, date and message but no visible distinction between customer-visible and internal-only events.
  - Product value: Admins can quickly understand which timeline events are safe/customer-visible versus internal-only, reducing disclosure mistakes while reviewing request history.
  - Scope: Add a compact visibility badge to each admin work-order audit event using the existing `event.customer_visible` boolean. Keep event messages, ordering, API shape, customer APIs and internal note visibility unchanged.
  - Acceptance criteria:
    - Customer-visible audit events are marked with a clear customer-visible badge.
    - Internal-only audit events are marked separately or clearly distinguishable without exposing hidden/internal payload details.
    - Empty audit state and fallback read-only behavior remain unchanged.
    - No `old_value`, `new_value`, metadata internals, risk flags, private paths, hidden customer messages or admin-only notes are exposed.
    - Event cards remain readable on mobile and desktop.
  - Validation:
    - `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts`
    - `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts`
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

### AUTO-017 [P2] Admin completed-today metrigi teslim zamanini baz alsin

Durum: Done

Fingerprint: `admin-operations|legacy-admin-notification-center|completed-today-uses-created-at|delivery-time-completion-metric`

Kapsam: Legacy admin dashboard `Completed today` metrigi, teslim edilen modified file `uploaded_at` zamanini onceleyen testli bir helper'a tasindi.

Sonuc: Completed orders artik teslim dosyasinin en son `modified_files.uploaded_at` gunu bugunse sayilir. Teslim zaman kaniti yoksa mevcut `created_at` fallback'i korunur; completed olmayan orderlar ve gecersiz tarihli teslim kayitlari sayimi bozmaz. DB migration, production veri degisikligi, odeme/fiyat kurali veya live servis cagrisi yapilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (17/17); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (244/244); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-016 [P2] Musteri dashboard'u eksik profil bilgilerini tamamlatmaya yoneltsin

Durum: Done

Fingerprint: `customer-experience|customer-dashboard-profile|settings-fields-not-surfaced|profile-completion-next-step`

Kapsam: Musteri dashboard'una settings ekraninda zaten duzenlenebilen customer-safe profil alanlarina dayali, yalniz eksik bilgi varsa gorunen profil tamamlama sinyali eklendi.

Sonuc: Dashboard `profiles` sorgusu artik `full_name`, `phone`, `preferred_contact`, `invoice_email`, account/company ve billing address alanlarini credit/customer id ile birlikte yukluyor. Eksik full name, phone/contact, invoice e-mail, account/company veya billing address bilgileri settings linkli "Complete your customer profile" kartinda ozetleniyor; eksik yoksa kart render edilmiyor. Credit display, customer ID formatting, settings save davranisi, payment/pricing kurallari ve account policy degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (16/16); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (243/243); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-014 [P2] Musteri paneli aksiyon gereken siparisleri ayri gostersin

Durum: Done

Fingerprint: `customer-experience|customer-dashboard-orders|action-required-statuses-hidden-in-active-orders|needs-response-surface`

Kapsam: Musteri dashboard'u ve siparis arsivi `customer_info_needed` durumundaki siparisleri ayri "Needs Response" sinyaliyle gosterir.

Sonuc: Dashboard artik customer-safe `customer_info_needed` sayacini yukluyor, masaustu ve mobil navigasyondan `/dashboard/orders?view=needs_response` linki veriyor ve ozet kartinda aksiyon gereken siparis sayisini ayri gosteriyor. Siparis arsivine `needs_response` view'i eklendi; tab secimi URL query state'ini guncelliyor. Active, Completed, Cancelled ve All gorunumleri korundu; `revision` siparisleri "Revision review in progress" olarak aksiyon bekleyen musteri durumundan ayri gosteriliyor.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (15/15); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (242/242); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-013 [P2] Musteri order timeline'i bekleme ve revizyon adimlarini acik gostersin

Durum: Done

Fingerprint: `responsive-ux|customer-order-detail|timeline-collapses-actionable-statuses|clear-next-step-status`

Kapsam: Musteri order detay timeline'i `customer_info_needed` ve `revision` durumlarini generic file-check/in-progress adimlarina sikistirmadan ayri gosterir.

Sonuc: Timeline artik order durumuna gore safe, dinamik adimlar olusturuyor. `customer_info_needed` durumunda "Waiting for Your Information" adimi aktif gorunur; `revision` durumunda teslim sonrasi "Revision Review" adimi Completed sonrasinda gorunur. Download ve revision request aksiyonlari degistirilmedi; timeline basligi ve satirlari uzun status/metin tasmasina karsi wrap davranisi kazandi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (14/14); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (241/241); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-008 [P1] Offline build bagimliligini dokumante et

Durum: Done

Fingerprint: `documentation|offline-build|google-fonts-build-dependency-undocumented|documented-local-automation-note`

Kapsam: `next/font/google` nedeniyle restricted/offline build'in Google Fonts fetch hatasina takildigini README veya docs icinde local automation notu olarak belgele.

Sonuc: Zaten karsilanmis olarak kapatildi. `README.md:73-76` `npm run build` icin restricted/offline automation ortaminda `next/font/google` kaynakli Google Fonts fetch riski oldugunu ve local fonts gecisinin ayri onayli gorev olmasi gerektigini acikliyor. Font, tasarim, uygulama kodu veya ticari metin degistirilmedi.

Dogrulama: Markdown evidence/diff incelemesi, `npm run lint`.

### AUTO-007 [P1] Vehicle JSON fallback icin data integrity testi ekle

Durum: Done

Fingerprint: `vehicle-catalog|json-fallback-data|public-data-contract-untested|covered-integrity-regression`

Kapsam: `data/vehicle-database.json` ve `data/vehicle-performance-overrides.json` public fallback sozlesmesi icin data integrity testleri eklendi.

Sonuc: Gercek JSON fallback satirlari public projection uzerinden forbidden admin/private alanlara karsi kontrol ediliyor; normalize edilmis public duplicate adaylari mevcut import summary raporuyla eslestiriliyor; performance override keyleri dort parcali legacy format ve mevcut fallback satirlariyla uyumlu dogrulaniyor. Data dosyalari degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\vehicle-control-center.test.ts` PASS (41/41); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (240/240); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-015 [P1] Yeni istek formu katalog yokken manuel arac bilgisi kabul etsin

Durum: Done

Fingerprint: `customer-experience|new-request-vehicle-intake|manual-vehicle-copy-without-form-path|manual-catalog-fallback`

Kapsam: Yeni istek formuna katalog secimi varsayilan kalacak sekilde manuel arac bilgisi fallback modu eklendi.

Sonuc: Katalog yuklenemediginde veya katalog bos geldiginde form manuel arac bilgisi moduna gecer; musteri isterse katalog varken de manuel moda gecebilir. Manuel brand/model/engine degerleri request progress, validasyon, ozet ve mevcut order RPC string alanlarinda kullanilir. Katalog secimi ve vehicle intelligence paneli katalog modu icin korunur; manuel degerler UI'da customer-provided/unverified olarak isaretlenir.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (13/13); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (238/238); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-006 [P1] `src/proxy.ts` locale davranisi icin unit test ekle

Durum: Done

Fingerprint: `i18n|proxy-locale-routing|locale-cookie-header-resolution-untested|covered-locale-contract`

Kapsam: Locale cookie/header cozumu ve localized path davranisi icin dar kapsamli unit test eklendi.

Sonuc: `tests/proxy-locale.test.ts` path locale onceligini, path locale yokken cookie dilinin korunmasini, cookie yokken `accept-language` fallback davranisini ve mevcut non-api/static matcher sozlesmesini dogrular. `src/proxy.ts` urun davranisi degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\proxy-locale.test.ts` PASS (4/4); `npm test` PASS (238/238); `npm run lint` PASS; `npm run typecheck` PASS; `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-011 [P1] Admin review filtresi payment ve kalite sinyallerini kapsasin

Durum: Done

Fingerprint: `responsive-ux|admin-request-control-center|review-filter-misses-payment-quality-signals|complete-review-queue`

Kapsam: Admin request listesinde Review only filtresi ve Needs review metrigi ortak `hasReviewSignal` helper'i ile guncellendi.

Sonuc: Mevcut admin status review davranisi korundu; payment `requires_review`, quality `failed`/`needs_review` ve delivery `blocked`/`revision_requested` sinyalleri Review only sonucuna ve Needs review sayacina dahil edildi. Odeme, kredi, fiyat, DB mutasyonu veya production servis islemi yapilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (24/24); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (234/234); `git diff --check` PASS (yalnizca CRLF uyarilari).

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
