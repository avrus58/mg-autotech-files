# Otonom gorev kuyrugu

> Yalnizca repository incelemesiyle dogrulanan, kucuk veya orta olcekli ve guvenli gorevler eklenir.

## Ready

- [ ] **P3 AUTO-025 - Desktop uploader local history statuslari okunabilir etiket kullansin**
  - Lane: Product Evolution
  - Domain: Desktop uploader customer clarity & support reduction
  - Fingerprint: `desktop-uploader|local-upload-history|raw-status-values-in-history|human-readable-status-labels`
  - Business impact: 2/5
  - User impact: 3/5
  - Admin impact: 2/5
  - Strategic fit: 3/5
  - Confidence: 5/5
  - Effort: 1/5
  - Risk: 1/5
  - Evidence: `apps/customer-uploader/src/App.tsx:88-90` defines `statusLabel`, and current request details/list already use it at `apps/customer-uploader/src/App.tsx:685` and `apps/customer-uploader/src/App.tsx:722`. The dashboard local-history preview still renders `item.status` at `apps/customer-uploader/src/App.tsx:604-609`, and the full local upload history still renders raw stored status values in filter chips and rows at `apps/customer-uploader/src/App.tsx:730-754`, producing labels like `submitted` or `failed` instead of the same human-readable format.
  - Product value: The desktop uploader feels more consistent and support-safe; customers can scan local upload history without seeing implementation-style status strings.
  - Scope: Reuse the existing `statusLabel` helper for local history filter labels and history rows. Keep stored history values, filtering semantics, safe local-only storage, request links and diagnostic privacy unchanged.
  - Acceptance criteria:
    - Dashboard local-history preview uses the same human-readable status labels as request list/detail.
    - Local history filter chips show human-readable status labels while still filtering by the original stored status value.
    - Local history rows display the human-readable status label next to file size.
    - Current request list/detail status labels remain unchanged.
    - No raw local paths, storage paths, tokens, binary content, hashes beyond the existing customer-visible checksum row, or admin-only notes are exposed.
    - Desktop UI tests cover the label consistency.
  - Validation:
    - `.\node_modules\.bin\tsx.cmd --test tests\customer-uploader.test.ts`
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`

- [ ] **P2 AUTO-028 - Desktop uploader not alanlari API sinirini gondermeden once gostersin**
  - Lane: Product Evolution
  - Domain: Desktop uploader request intake & API contract clarity
  - Fingerprint: `desktop-uploader|request-notes-contract|api-length-limits-and-silent-1000-char-truncation|client-side-field-limits-guidance`
  - Business impact: 2/5
  - User impact: 3/5
  - Admin impact: 2/5
  - Strategic fit: 3/5
  - Confidence: 5/5
  - Effort: 2/5
  - Risk: 1/5
  - Evidence: Desktop finalize API enforces `notes` max 4000, `ecu`/`gearbox` max 200 and `readMethod` max 120 at `src/app/api/desktop/requests/finalize/route.ts:39-42`. The desktop request wizard notes step renders plain inputs/textareas without visible limits at `apps/customer-uploader/src/App.tsx:1278-1282`. `apps/customer-uploader/src/validation.ts:36-40` also truncates any string longer than 1000 characters inside `safeUploadPayload`, so a long customer note or special request can be silently clipped before reaching the server contract.
  - Product value: Customers know the exact text limits before submit, and support receives complete, intentional request context instead of silently shortened notes.
  - Scope: Add customer-visible length guidance and submit guards for desktop notes/ECU/read-method metadata using the existing API contract. Keep service catalogue, credit calculation, upload idempotency, private storage upload, app-check and local history behavior unchanged.
  - Acceptance criteria:
    - ECU, gearbox and read-method fields expose limits aligned with the desktop finalize API.
    - Notes and special-request fields expose visible remaining-character guidance and prevent over-limit submit before upload/finalize starts.
    - Combined notes payload is not silently clipped by `safeUploadPayload` without a matching customer-visible limit.
    - Existing file validation, SHA-256 calculation, upload session creation, finalization, duplicate prevention and local history writes remain unchanged.
    - No prices, credit values, service labels, raw file data, storage paths, tokens or admin-only fields are changed or exposed.
  - Validation:
    - `.\node_modules\.bin\tsx.cmd --test tests\customer-uploader.test.ts`
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`

- [ ] **P2 AUTO-029 - Musteri dashboard veri senkron hatasini bos durum gibi gostermesin**
  - Lane: Product Evolution
  - Domain: Customer dashboard reliability & status clarity
  - Fingerprint: `customer-experience|dashboard-data-sync|supabase-load-errors-look-empty-or-syncing|retryable-error-state`
  - Business impact: 2/5
  - User impact: 4/5
  - Admin impact: 2/5
  - Strategic fit: 3/5
  - Confidence: 5/5
  - Effort: 2/5
  - Risk: 2/5
  - Evidence: `src/components/dashboard/DashboardClient.tsx:215-299` loads profile, recent orders, credit ledger and order counts but reads only `data`/`count` and ignores Supabase `error` values, so failed queries can leave previous defaults and make the dashboard look empty or zeroed. `src/components/dashboard/DashboardClient.tsx:192` sets `liveRefreshing` for silent sync, while `src/components/dashboard/DashboardClient.tsx:300-301` clears loading/syncing only after the successful path completes.
  - Product value: Customers can distinguish a real empty dashboard from a sync failure and retry without assuming orders, credits or actions disappeared.
  - Scope: Add a customer-safe, retryable dashboard data-load error state. Preserve existing customer-scoped queries, auth redirects, realtime subscriptions, profile completion, order counts, credit ledger preview and live-sync behavior.
  - Acceptance criteria:
    - Initial dashboard load failures show a clear customer-safe error state with a retry action instead of rendering empty orders/zero counts.
    - Silent/live refresh failures clear the syncing indicator and preserve the last successfully loaded dashboard data.
    - Supabase errors from profile, recent orders, credit ledger and count queries are handled consistently without leaking table internals.
    - Auth/session and unverified-email redirects continue to work as before.
    - No new customer data fields, admin-only fields, storage paths, payment internals, secrets or live service mutations are introduced.
  - Validation:
    - `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts`
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`

- [ ] **P2 AUTO-030 - Musteri kredi ledger hatasini bos hareket gibi gostermesin**
  - Lane: Product Evolution
  - Domain: Customer credit visibility & support reduction
  - Fingerprint: `customer-experience|credit-ledger-page|credit-transaction-query-error-looks-empty|retryable-ledger-error-state`
  - Business impact: 2/5
  - User impact: 4/5
  - Admin impact: 2/5
  - Strategic fit: 3/5
  - Confidence: 5/5
  - Effort: 2/5
  - Risk: 2/5
  - Evidence: `src/app/dashboard/credits/history/page.tsx:98-107` loads customer credit profile data without handling Supabase errors, and `src/app/dashboard/credits/history/page.tsx:109-119` ignores `credit_transactions` errors by only setting transactions on the non-error path. `src/app/dashboard/credits/history/page.tsx:121-122` then clears loading/refreshing, and `src/app/dashboard/credits/history/page.tsx:322-327` renders `No credit ledger yet` whenever the transaction array is empty, so a ledger query failure can look like a real empty ledger.
  - Product value: Customers can distinguish a real empty credit history from a sync failure, reducing payment/credit confusion and support follow-up.
  - Scope: Add a customer-safe, retryable error state for the full credit history page. Preserve auth redirects, verified-email guard, customer-scoped `user_id` ledger query, live polling/subscription behavior, ledger formatting, Buy Credits link and payment/credit policy.
  - Acceptance criteria:
    - Initial profile or credit ledger load failures show a clear customer-safe error state with a retry action instead of the empty ledger state.
    - Successful zero-transaction loads still show the existing empty ledger state.
    - Silent/live refresh failures clear the refreshing indicator and preserve the last successfully loaded credit balance and transaction list.
    - Supabase table internals, metadata, payment internals, storage paths, secrets and admin-only fields are not exposed.
    - Existing auth/session and unverified-email redirects continue to work as before.
  - Validation:
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

### AUTO-031 [P2] Admin bank payment formu API kontratini gondermeden once dogrulasin

Durum: Done

Fingerprint: `admin-operations|payment-control-bank-entry|server-side-payment-action-limits-only|client-side-bank-payment-validation`

Kapsam: Admin Payment & Revenue Control bank payment formuna mevcut server action kontratiyla uyumlu yerel dogrulama, input limitleri, not kalan karakter bilgisi ve inline guidance eklendi.

Sonuc: Customer secimi, bank reference, credits, amount EUR ve internal note alanlari POST oncesinde dogrulanir. Match payment & add credits aksiyonu form valid, migration ready ve saving degilken aktif olur; invalid durumda handler POST'a gecmeden admin-safe mesaj verir. Submitted payload shape, `admin_record_bank_payment` RPC, audit/email/server validation, Stripe/refund davranisi, fiyat/credit policy ve customer list loading degistirilmedi. Canli payment servisi, production servis cagrisi, migration, secret veya gercek musteri verisi kullanilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (25/25); `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (59/59); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (254/254); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-027 [P2] Musteri bildirim paneli yukleme hatasini sessiz gecmesin

Durum: Done

Fingerprint: `customer-experience|notification-bell|load-error-silent-empty-state|visible-retryable-notification-state`

Kapsam: Musteri notification bell dropdown'i, ilk yukleme ve Supabase query hatalarini sessiz bos durum gibi gostermek yerine yerel loading/error/retry state'leriyle guncellendi.

Sonuc: Bildirimler ilk yuklenirken dropdown kompakt `Loading notifications...` durumunu gosterir. Query hata verirse customer-safe `Notification sync failed` mesaji ve `Try again` aksiyonu gorunur; retry mevcut customer-scoped notification sorgusunu tekrar tetikler. Basarili yuklemede mevcut notification itemlari, unread count, toast, sound toggle, order linkleri, polling/realtime sync ve mark-all-read `user_id` scope'u korunur. Uzun notification title/body metinleri dropdown genisligi icinde wrap davranisi kazandi; storage path, signed URL, secret, admin note, metadata veya admin-only alan aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (24/24); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (253/253); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-023 [P2] Admin widget clients listesi bekleyen domain taleplerini gostersin

Durum: Done

Fingerprint: `admin-operations|widget-clients-list|pending-domain-requests-hidden|domain-request-queue-signal`

Kapsam: Admin widget clients list API'si ve liste UI'i, mevcut `widget_domain_change_requests` pending taleplerinden yalniz guvenli ozet sinyali kullanacak sekilde guncellendi.

Sonuc: Liste API'si pending domain taleplerini `client_id`, `requested_domain` ve `created_at` alanlariyla okur, her client icin pending count ve latest requested domain dondurur. Admin liste UI'i toplam pending domain request metrigi, masaustu `Domain review` link rozeti ve mobil `Pending` metric'i gosterir; search latest requested domain ve pending review terimleriyle de eslesir. Activate/suspend, copy embed, public key, usage, blocked-domain ve existing Stripe display davranisi korunur.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (23/23); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (252/252); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-026 [P2] Request chat uzun mesajlari gondermeden once sinirlasin

Durum: Done

Fingerprint: `customer-experience|request-chat-composer|api-4000-character-limit-only-server-side|client-side-length-guidance`

Kapsam: Customer/admin request chat composer mevcut `/api/requests/[id]/messages` 4000 karakter sozlesmesine uygun sekilde yerel `maxLength`, kalan karakter sayaci ve ortak send-disable durumu ile guncellendi.

Sonuc: Composer artik 4000 karakter ustunu textarea seviyesinde engeller, kalan karakter sayisini gorunur ve `aria-live` destekli olarak gosterir, bos trimlenmis mesajlari ve sending durumunu tek `canSendMessage` guard'i ile bloke eder. Enter ile gonderme ve Shift+Enter ile yeni satir davranisi, mevcut API hata mesaji alani, mesaj yukleme/senkron, visibility filtering, permission, notification sound ve message storage davranisi korunur.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (22/22); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (251/251); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-024 [P2] Musteri widget domain talebi beklemedeyken tekrar gonderilemesin

Durum: Done

Fingerprint: `customer-experience|widget-dashboard-domain-change|pending-request-still-submit-able|pending-state-guidance`

Kapsam: Musteri widget dashboard domain-change karti, mevcut `domainRequests` payload'undaki pending talebi customer-safe sekilde kullanarak ikinci talep gonderimini engelleyecek sekilde guncellendi.

Sonuc: Bekleyen domain-change talebi varsa dashboard artik istenen domaini `Pending admin review` durumuyla gosterir, input ve Send aksiyonunu disabled yapar ve handler seviyesinde duplicate gonderimi durdurur. Approved/rejected gecmis talepler listede gorunmeye devam eder ve pending yoksa yeni talep akisi korunur. Domain normalization, admin approval/rejection, Stripe billing, pricing, schema, audit log detayi ve private/internal alanlar degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (21/21); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (250/250); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-020 [P2] Musteri ek dosya yuklemesi asamalari acik geri bildirim versin

Durum: Done

Fingerprint: `customer-experience|order-detail-additional-upload|single-generic-uploading-state|phase-aware-upload-feedback`

Kapsam: Musteri order detayindaki ek dosya yukleme akisi, tek generic uploading etiketi yerine prepare, upload ve verify/save asamalarini musteriye guvenli sekilde gosterecek yerel phase state ile guncellendi.

Sonuc: Ek dosya yukleme karti artik "Preparing upload", "Uploading file" ve "Verifying upload" asamalarini aktif/tamamlanan/bekleyen durumlarla gosterir. Prepare, Supabase Storage upload ve finalize API akisi, tek dosya 32 MB siniri, private bucket, one-time permission kapatma ve basarili upload listeye ekleme davranisi korundu. Hata durumlarinda phase `idle` durumuna doner ve musteri yeniden deneyebilir; storage path, signed URL, hash, binary data, secret, payment data veya admin-only not aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (20/20); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (249/249); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-019 [P2] Musteri order teslim tahmini yalniz acik estimate varsa sure gostersin

Durum: Done

Fingerprint: `customer-experience|order-detail-estimated-delivery|null-estimate-shows-default-30min|explicit-estimate-only`

Kapsam: Musteri order detayindaki Estimated Delivery karti, null veya taninmayan `estimated_delivery_label` icin varsayilan "Usually around 30 min" etiketi yerine not-set durumunu gosterecek sekilde guncellendi.

Sonuc: Explicit admin secimleri `usually_30_min`, `same_day`, `24h`, `48h` ve `manual_review` icin mevcut etiketler korunur. Estimate yoksa kart "Estimate not set yet" ve review sonrasi estimate gelecegini belirten neutral copy gosterir. Explicit estimate yokken saved note veya varsayilan spesifik sure iddiasi gosterilmez; order actions, revision/download akisi, admin delivery secenekleri, SLA/fiyat/hukuki metin ve schema degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (19/19); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (248/248); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-018 [P2] Musteri dashboard kredi gecmisi gercek ledger'dan beslensin

Durum: Done

Fingerprint: `customer-experience|dashboard-credit-history-preview|orders-used-as-credit-ledger|safe-ledger-preview`

Kapsam: Musteri dashboard `Credit History` onizlemesi, son siparislerin `credits_required` alanindan turetilmek yerine customer-scoped `credit_transactions` ledger satirlarindan beslenecek sekilde guncellendi.

Sonuc: Dashboard artik son kredi hareketlerini `user_id` ile filtrelenen ledger kaynagindan yukler; description/type, delta, balance-after ve tarih alanlarini customer-safe sekilde gosterir. Pozitif hareketler yesil, negatif hareketler kirmizi ayrilir. Bos state buy credits ve full ledger linkleri verir. Recent orders, credit balance, live refresh ve `/dashboard/credits/history` akisi korunur; source id, metadata, odeme kaydi internali, secret veya admin-only not aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (18/18); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (247/247); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-022 [P2] Admin audit timeline event gorunurlugunu rozetlesin

Durum: Done

Fingerprint: `admin-operations|work-order-audit-timeline|customer-visible-events-unbadged|visibility-badges-for-audit-events`

Kapsam: Admin work-order audit timeline kartlarina mevcut `event.customer_visible` boolean'ini kullanan kompakt gorunurluk rozeti eklendi.

Sonuc: Customer-visible eventler `Customer-visible`, internal-only eventler `Internal-only` olarak ayriliyor. Event tipi, tarih, mesaj, siralama, API shape, customer API'leri, internal note gorunurlugu ve fallback empty/read-only davranislari korunur. `old_value`, `new_value`, metadata, risk flag, private path, hidden customer message veya admin-only note payload'i audit kartlarinda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (26/26); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (17/17); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (246/246); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-021 [P2] Admin request listesi musteri ek dosya sinyalini gostersin

Durum: Done

Fingerprint: `admin-operations|request-control-center|customer-upload-indicator-hidden|show-supporting-file-signal`

Kapsam: Admin request control center listesine mevcut `item.indicators.hasCustomerUpload` boolean'ini kullanan kompakt, non-sensitive musteri ek dosya rozeti eklendi.

Sonuc: Ek musteri dosyasi olan request satirlari artik `Customer file` rozetiyle listede fark edilir. ORI/MOD/AI indikator grid'i korunur; dosya adi, storage path, signed URL, hash, binary metadata, odeme/kredi verisi veya admin-only note listede aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (25/25); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (17/17); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (245/245); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

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
