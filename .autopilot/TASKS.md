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

- [ ] **P2 AUTO-032 - Musteri siparis arsivi sorgu hatasini bos liste gibi gostermesin**
  - Lane: Product Evolution
  - Domain: Customer order archive reliability & status clarity
  - Fingerprint: `customer-experience|order-archive|supabase-query-error-renders-with-empty-state|retryable-order-archive-error-state`
  - Business impact: 2/5
  - User impact: 4/5
  - Admin impact: 2/5
  - Strategic fit: 3/5
  - Confidence: 5/5
  - Effort: 2/5
  - Risk: 2/5
  - Evidence: `src/app/dashboard/orders/page.tsx:133-148` sets `message` when the customer-scoped orders query fails but still clears loading/loadingMore and leaves the list state unchanged. `src/app/dashboard/orders/page.tsx:234-239` then renders the error message and, when the current list is empty, also renders `No orders found in this view`, so an initial archive sync failure can be presented alongside the normal empty state without a retry action.
  - Product value: Customers can distinguish a real empty order archive from a temporary sync failure and retry without assuming their requests disappeared.
  - Scope: Add a customer-safe, retryable load-error state for the order archive. Preserve auth redirects, verified-email guard, `customer_id` scoping, view tabs, search, pagination, realtime refresh and existing order card fields.
  - Acceptance criteria:
    - Initial order archive query failures show a clear customer-safe error state with a retry action instead of the normal empty-order message.
    - Successful zero-result loads still show the existing empty state for the selected view/search.
    - Load-more or realtime refresh failures clear loading indicators and preserve the last successfully loaded order list.
    - Supabase table internals, storage paths, signed URLs, raw binary metadata, payment internals, secrets and admin-only fields are not exposed.
    - Existing Active, Needs Response, Completed, Cancelled and All views keep their current filters and URL behavior.
  - Validation:
    - `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts`
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`

- [ ] **P2 AUTO-036 - Musteri settings profil hatasinda varsayilan form gostermesin**
  - Lane: Product Evolution
  - Domain: Customer profile reliability & support reduction
  - Fingerprint: `customer-experience|settings-profile-load|supabase-profile-error-renders-default-editable-form|retryable-profile-settings-error-state`
  - Business impact: 2/5
  - User impact: 4/5
  - Admin impact: 2/5
  - Strategic fit: 3/5
  - Confidence: 5/5
  - Effort: 2/5
  - Risk: 2/5
  - Evidence: `src/app/dashboard/settings/page.tsx:99-101` sets raw `error.message` and exits loading when the customer profile query fails, while `src/app/dashboard/settings/page.tsx:37-43` and `src/app/dashboard/settings/page.tsx:68` can format a fallback `MGA-10001` customer reference from a null profile. The settings form still renders after loading at `src/app/dashboard/settings/page.tsx:277`, so an initial profile sync failure can show editable default/blank profile fields and a bank-transfer reference as if settings loaded correctly. Save failures also surface raw backend copy at `src/app/dashboard/settings/page.tsx:164-166`.
  - Product value: Customers can distinguish a real editable profile from a temporary settings sync failure, avoiding wrong bank-transfer references and support confusion.
  - Scope: Add a customer-safe retryable settings load-error state and customer-safe save-error copy. Preserve auth redirects, verified-email guard, own-profile `id` scoping, successful settings load/save behavior, bank reference behavior after successful load and existing profile fields.
  - Acceptance criteria:
    - Initial profile query failures show a clear retryable customer-safe error state instead of the settings form, default customer reference, blank loaded fields or raw backend error.
    - Successful profile loads still render the existing settings form, customer ID card, bank-transfer reference and editable fields.
    - Save failures show customer-safe copy and keep the user's entered form values available for retry.
    - Supabase table/column internals, secrets, service-role details, payment internals, admin-only fields and raw backend messages are not exposed.
    - Existing login redirect and unverified-email redirect behavior remains unchanged.
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

### RMAP-FILE-DTC-M1 [P1] AI DTC Analyzer provider boundary and deterministic fallback

Durum: Done

Fingerprint: `ai-capability|dtc-analyzer|missing-provider-boundary-and-fallback|deterministic-provider-contract`

Roadmap: `file-platform`; Epic: `file-ai-dtc-analyzer`; Feature: `file-dtc-m1-provider-boundary`; Scope class: L.

Kapsam: Text DTC input icin provider-neutral analyzer contract, explicit provider-unavailable response state ve deterministic non-AI fallback eklendi.

Sonuc: `src/lib/dtcAnalyzer` altinda `DtcAnalyzerProvider` interface'i, `dtc-analyzer-v1` response contract'i, unavailable provider, deterministic fallback provider, input normalization/validation ve `analyzeDtcText` entrypoint'i olusturuldu. Fallback `P0401`, `P2002`, `U0100` gibi valid DTC kodlarini normalize eder, bilinen kodlar icin diagnostic context/check guidance uretir, invalid/empty input'u provider cagirmadan customer-safe sekilde reddeder ve her response'ta fallback usage, provider identity/status, confidence/uncertainty, missing information, safety boundaries ve human review requirement ayirir. No fake AI output: default provider explicit unavailable kalir ve fallback `isAiGenerated: false` dondurur. Dosya yukleme, binary inspection, API route, database schema, MOD generation, checksum result, price/payment/service claim, env read veya production service cagrisi eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (62/62); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (34/34); `.\node_modules\.bin\tsx.cmd --test tests\customer-uploader.test.ts` PASS (22/22); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (269/269); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-039 [P2] File Expert analiz listesi yukleme hatasini bos analiz gibi gostermesin

Durum: Done

Fingerprint: `customer-experience|file-expert-dashboard-load|jobs-api-error-renders-empty-analysis-list|retryable-file-expert-jobs-error-state`

Kapsam: Musteri File Expert dashboard'u, analiz gecmisi `/api/file-expert/jobs` yukleme hatalarini gercek bos analiz listesi veya sifir metrik gibi gostermek yerine retry edilebilir customer-safe hata durumuyla ayiracak sekilde guncellendi.

Sonuc: Ilk jobs API hatasinda `File Expert history sync failed` retry karti gorunur; history metrikleri ve `No analysis yet` bos durumu render edilmez. Basarili yukleme sonrasi silent refresh hatasi olursa son yuklu analiz listesi ve metrikler korunur, inline `File Expert history sync needs retry` uyarisi ve retry aksiyonu gosterilir. Basarili sifir-job yuklemelerinde mevcut `No analysis yet` bos durumu korunur. Jobs API GET sorgu hatasinda raw backend mesaji yerine generic `File Expert jobs could not be loaded.` cevabi dondurur. Login redirect, verified-email guard, intake limit guidance, prepare/upload/finalize akisi, report navigation, status label'lari ve customer-safe job projection korunur. Raw backend mesajlari, Supabase/analyzer internalleri, raw binary data, storage path, signed URL, token veya admin-only alan hata UI'inda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (33/33); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (264/264); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-038 [P2] Admin request control center yukleme hatasini bos filtre gibi gostermesin

Durum: Done

Fingerprint: `admin-operations|request-control-center-load|api-load-error-renders-empty-filter|retryable-admin-requests-error-state`

Kapsam: Admin request control center, `/api/admin/requests` yukleme hatalarini normal bos filtre sonucu veya sifir metrik gibi gostermek yerine retry edilebilir admin-safe hata durumuyla ayiracak sekilde guncellendi.

Sonuc: Ilk request queue API hatasinda `Request queue sync failed` retry state'i gorunur; metrikler, filtreler ve `No work orders match this filter` bos sonucu render edilmez. Basarili yukleme sonrasi manuel refresh/API hatasi olursa son yuklu queue, metrikler, filtreler, Review only davranisi ve migration fallback banner korunur; inline `Admin request sync needs retry` uyarisi ve retry aksiyonu gosterilir. API catch artik raw exception mesajini dondurmez ve generic `Admin requests could not be loaded.` cevabi kullanir. Login redirect, verified-email guard, staff permission boundary, work-order satir alanlari ve review signal logic degistirilmedi. Raw Supabase hata metni, stack trace, service-role detayi, storage path, signed URL, payment internali, customer file internali veya admin-only payload internali hata UI'inda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (27/27); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (32/32); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (263/263); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-030 [P2] Musteri kredi ledger hatasini bos hareket gibi gostermesin

Durum: Done

Fingerprint: `customer-experience|credit-ledger-page|credit-transaction-query-error-looks-empty|retryable-ledger-error-state`

Kapsam: Musteri kredi ledger history sayfasi, profile veya `credit_transactions` sorgu hatalarini gercek bos hareket listesi gibi gostermek yerine retry edilebilir customer-safe hata durumuyla ayiracak sekilde guncellendi.

Sonuc: Ilk yukleme hatasinda `Credit ledger sync failed` retry karti gorunur ve `No credit ledger yet` bos hareket durumu render edilmez. Basarili yukleme sonrasi manuel, interval veya realtime refresh hatasi olursa son yuklu balance ve ledger hareketleri korunur, refreshing indikatoru kapanir ve inline `Credit ledger sync needs retry` uyarisi gorunur. Basarili sifir transaction yuklemelerinde mevcut bos ledger state'i ve Buy Credits linki korunur. Login redirect, unverified-email redirect, customer-scoped `user_id` ledger sorgusu, live polling/subscription davranisi, ledger formatting ve payment/credit policy degistirilmedi. Raw backend error, metadata select'i, visible `credit_transactions` table copy'si, storage path, signed URL, secret veya admin-only alan hata UI'inda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (31/31); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (261/261); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-037 [P2] File Expert yukleme formu API limitlerini gondermeden once gostersin

Durum: Done

Fingerprint: `customer-experience|file-expert-intake|server-side-file-and-field-limits-only|client-side-file-expert-limit-guidance`

Kapsam: Musteri File Expert intake formu, mevcut server text/file limitlerini prepare cagrisindan once gorunur ve local olarak dogrulanir hale getirildi.

Sonuc: Brand/model/engine alanlari 100, ECU/TCU hint 120 ve customer notes 2000 karakter kontratini `maxLength` ve kalan karakter yardimiyla gosterir. ORI/MOD secicileri desteklenen `.bin/.ori/.mod/.frf/.hex/.zip` uzantilarini ve 32 MB limitini gosterir; bos, buyuk veya desteklenmeyen dosyalar `/api/file-expert/jobs/prepare` cagrilmadan once reddedilir. Submit, en az bir gecerli ORI veya MOD dosyasi secilmeden ve text alanlari limit icinde olmadan disabled kalir. Prepare/upload/finalize akisi, private bucket upload davranisi, report navigation ve customer-safe redaction korunur. Raw binary, private storage path, signed URL, hash, analyzer internali, secret veya admin-only alan UI'da aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (30/30); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (260/260); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-035 [P2] Musteri widget workspace yukleme hatasini abonelik yok gibi gostermesin

Durum: Done

Fingerprint: `customer-experience|widget-dashboard-client-load|api-load-error-looks-like-missing-subscription|retryable-widget-load-error`

Kapsam: Musteri widget dashboard client yukleme akisi, `/api/widget/client` hatalarini no-subscription/plan CTA fallback'i yerine ayri customer-safe retry state ile gosterecek sekilde guncellendi.

Sonuc: Widget workspace ilk yukleme hatasinda artik `Widget workspace sync failed` retry ekrani gorunur; `View plans` no-subscription CTA'si sadece gercek no-client/no-subscription sonucu icin kalir. Retry ayni `load` yolunu kullanir ve mevcut login/verified-email redirectlerini korur. Basarili client yuklemesi sonrasi tekrar sync hatasi olursa son yuklu widget ayarlari korunur ve inline `Retry sync` uyarisi gorunur. Billing portal, domain-change request, pending domain guidance, settings save, embed code generation ve live preview davranislari korunur. Raw API hata mesaji, Stripe internali, Supabase internali, audit detayi, secret veya admin-only alan hata UI'inda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (29/29); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (259/259); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-034 [P2] Legacy admin panel yukleme hatasini bos operasyon listesi gibi gostermesin

Durum: Done

Fingerprint: `admin-operations|legacy-admin-dashboard|orders-customers-query-error-renders-empty-state|retryable-admin-load-error`

Kapsam: Legacy admin dashboard data-load akisi, orders/customers query hatalarini admin-safe retry state ile ele alacak ve basarisiz sync durumunda son basarili operasyon verisini koruyacak sekilde guncellendi.

Sonuc: Dashboard artik orders veya customers sorgu hatasinda raw backend mesajini `message` banner'ina basmaz. Ilk yukleme hatasinda `Admin data sync failed` retry karti gorunur ve orders/customers panelleri render edilmedigi icin normal `No orders found` veya `No customers found` bos durumlariyla karismaz. Basarili yukleme sonrasi silent/live refresh hatasinda `Admin sync needs retry` inline uyarisi gorunur, syncing indikatoru kapanir ve son basarili orders/customers listeleri ile secimler korunur. Auth/session redirectleri, verified-email guard, staff permission denial, filtreler, order/customer selection, notification sound, delivery estimate behavior ve mutation permission kontrolleri korunur. Supabase table/column internalleri, raw error mesajlari, storage path, signed URL, secret, payment internali veya customer file internali hata UI'inda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (28/28); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (258/258); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-029 [P2] Musteri dashboard veri senkron hatasini bos durum gibi gostermesin

Durum: Done

Fingerprint: `customer-experience|dashboard-data-sync|supabase-load-errors-look-empty-or-syncing|retryable-error-state`

Kapsam: Musteri dashboard data-load akisi, profile/orders/credit ledger/count query hatalarini customer-safe retry state ile ele alacak ve basarisiz sync durumunda son basarili dashboard verisini koruyacak sekilde guncellendi.

Sonuc: Dashboard artik Supabase query error degerlerini toplu kontrol eder ve tum queryler basarili olmadan credits, orders, ledger preview veya status count state'lerini overwrite etmez. Ilk yukleme hatasinda `Dashboard sync failed` ekrani ve `Try again` aksiyonu gorunur; live/silent refresh hatasinda syncing indikatoru kapanir, son basarili veri korunur ve inline retry banner'i gosterilir. Auth/session ve verified-email redirect akisi, customer-scoped `user_id` / `customer_id` queryleri, realtime subscriptions, profile completion karti, credit ledger preview, order count kartlari ve signed-url download davranisi korundu. Supabase table internals, storage path, signed URL, payment internals, secret, metadata veya admin-only alan aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (27/27); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (257/257); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-033 [P2] Legacy admin teslim tahmini kaydedilmeden 30 dk varsaymasin

Durum: Done

Fingerprint: `admin-operations|legacy-admin-order-modal|unset-delivery-estimate-defaults-to-30-min|explicit-estimate-selection`

Kapsam: Legacy admin order modal delivery estimate control'u, null estimate durumunu neutral not-set olarak gosterecek ve kayit icin acik estimate secimi isteyecek sekilde guncellendi.

Sonuc: Modal artik unset `estimated_delivery_label` degerini `usually_30_min` olarak baslatmaz. Preview `Estimate not set yet` gosterir, select disabled not-set placeholder'i gosterir, delivery note ve save aksiyonu explicit estimate secilene kadar disabled kalir. Mevcut non-null estimate label'lari, optional note edit davranisi, permission guard, SQL-column fallback mesaji, order status akisi ve customer detail display korunur. Fiyat, garanti, hukuki claim, SLA policy, database schema, production data veya live service davranisi degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (26/26); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (256/256); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-028 [P2] Desktop uploader not alanlari API sinirini gondermeden once gostersin

Durum: Done

Fingerprint: `desktop-uploader|request-notes-contract|api-length-limits-and-silent-1000-char-truncation|client-side-field-limits-guidance`

Kapsam: Desktop request wizard notes adimi, mevcut finalize API kontratina gore ECU, gearbox, read-method ve combined notes limitlerini musteriye gorunur hale getirecek sekilde guncellendi.

Sonuc: ECU ve gearbox alanlari 200, read method 120 karakter limitini `maxLength` ve kalan karakter yardimiyla gosterir. Customer notes ve special request alanlari combined finalize notes payload'una bagli 4000 karakter sayacini gosterir; notes adimindan review'a gecis ve review submit aksiyonu over-limit durumda engellenir. Finalize payload artik ayni shared notes builder'i kullanir ve `safeUploadPayload` bu path icin 4000 karakterlik API kontratini korur; varsayilan 1000 karakter guvenli payload davranisi diger kullanimlar icin korunur. Service catalogue, credit calculation, upload idempotency, private storage upload, app-check, local history, price/credit policy, raw file data, storage path, token ve admin-only alanlar degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\customer-uploader.test.ts` PASS (21/21); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (255/255); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

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
