# Otonom gorev kuyrugu

> Yalnizca repository incelemesiyle dogrulanan, kucuk veya orta olcekli ve guvenli gorevler eklenir.

## Ready

### AUTO-001 [P0] Root README'yi gercek proje rehberine cevir

Kapsam: Default create-next-app README icerigini, bu repository'nin gercek amaci, mimarisi, npm komutlari, local setup notlari ve guvenli calisma sinirlariyla degistir.

Kabul kriterleri:

- README kok Next.js app, `apps/customer-uploader` desktop app ve opsiyonel `file-expert-analyzer` rollerini aciklar.
- npm package manager ve mevcut guvenli komutlar listelenir.
- `.env` okumama, production servislerine baglanmama, SQL/deploy calistirmama sinirlari net yazilir.
- Fiyat, garanti, hukuki iddia veya yeni urun vaadi eklenmez.

Dogrulama: Markdown diff incelemesi, `npm run lint`.

### AUTO-002 [P0] Payment env checker icin otonom guvenli mod ekle

Kapsam: `scripts/check-payment-env.js` icin `.env.local` okumadan yalnizca gerekli key listesini ve dokumantasyon sozlesmesini kontrol eden `--schema-only` benzeri bir mod ekle.

Kabul kriterleri:

- Varsayilan davranis bozulmaz; manuel kullanim hala OK/MISS raporu verir.
- Yeni guvenli mod `.env`, `.env.local` veya secret icerigi okumaz.
- Output secret degeri basmaz, sadece key adlari ve durum basar.
- Test veya source assertion yeni modun `.env.local` okumadigini dogrular.

Dogrulama: `node scripts/check-payment-env.js --schema-only`, `npm test`.

### AUTO-003 [P0] Desktop env checker icin otonom guvenli mod ekle

Kapsam: `apps/customer-uploader/scripts/check-env.mjs` icin `.env`/`.env.local` okumayan ve yalnizca public desktop env sozlesmesini dogrulayan guvenli mod ekle.

Kabul kriterleri:

- Normal desktop build/dev oncesi env kontrol davranisi korunur.
- Yeni mod root/app `.env*` dosyalarini okumaz.
- Service-role key veya secret kullanimi tesvik edilmez.
- Mevcut desktop safety testleri yeni modu da kapsar.

Dogrulama: `node apps/customer-uploader/scripts/check-env.mjs --schema-only`, `npm test`.

### AUTO-004 [P0] Smoke scriptlerine non-local hedef guard'i ekle

Kapsam: `scripts/smoke-public-platform.mjs`, `scripts/smoke-admin-unauthenticated.mjs`, `scripts/smoke-admin-work-orders.mjs` ve `scripts/smoke-vehicle-control-center.mjs` icin otonom dongude non-local URL kullanimini engelleyen ortak guard ekle.

Kabul kriterleri:

- Default `localhost` hedefleri korunur.
- `https://file.mgautotech.de` gibi non-local hedefler acik override olmadan calismaz.
- Override env adi dokumante edilir ve production smoke'un insan kontrollu oldugu belirtilir.
- Smoke scriptlerinin non-mutating guvenlik sozlesmesi testlerde korunur.

Dogrulama: `npm test`; local URL guard test/source assertion.

### AUTO-005 [P0] Scraper scriptlerine explicit network guard ekle

Kapsam: `scripts/carecufile-scraper.mjs` ve `scripts/scrape-all-brands.mjs` dis aga cikmadan once explicit flag/env gerektirsin.

Kabul kriterleri:

- Flag/env yokken script network istegi yapmadan anlasilir mesajla cikar.
- Explicit izinle mevcut scraper davranisi korunur.
- `scripts/README-carecufile-scraper.md` yeni guard'i aciklar.
- Veri dosyalarinda otomatik icerik degisikligi yapilmaz.

Dogrulama: Guard'i tetikleyen no-network komutu, `npm test`.

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
