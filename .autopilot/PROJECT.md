# Proje calisma bilgisi

Bootstrap tarihi: 2026-07-12 (Europe/Berlin)
Aktif branch: codex/autopilot

Bu dosya repository incelemesine dayali yerel ve guvenli Codex calisma sozlesmesidir.

## Urun

MG AutoTech file platformu, `file.mgautotech.de` icin gelistirilmis bir Next.js uygulamasidir. Kapsamda:

- public pazarlama/SEO sayfalari ve cok dilli servis sayfalari
- musteri auth, dashboard, kredi, yeni istek ve dosya yukleme akislari
- File Expert ve AI/ECU kanit/analiz panelleri
- admin operasyon panelleri, is emri, arac katalogu, odeme ve e-posta kontrol alanlari
- public vehicle/widget endpointleri
- `apps/customer-uploader` altinda Windows Electron/Vite musteri yukleme asistani
- `file-expert-analyzer` altinda opsiyonel FastAPI binary analiz servisi

## Teknoloji ve mimari

- Kok uygulama: Next.js 16.2.10 App Router, React 19.2.4, TypeScript strict, Tailwind CSS v4/PostCSS, ESLint 9.
- Route yapisi: `src/app` altinda public, auth, dashboard, admin, API, widget ve embed route'lari.
- Paylasilan kod: `src/components` UI bilesenleri, `src/lib` domain modulleri.
- Baslica domain modulleri: Supabase auth/server/admin clientleri, staff permissions, payments/credits, email, File Expert, AI/ECU intelligence, desktop upload, vehicle control/enrichment, widget, i18n/SEO.
- Veri fallbackleri: `data/vehicle-database.json`, `data/vehicle-performance-overrides.json`, `src/lib/generated/vehicleDatabase.sample.json`.
- Test altyapisi: Node `node:test` + `tsx --test`, testler `tests/*.test.ts` altinda.
- Desktop app: `apps/customer-uploader`, Vite 7 + React 19 + Electron 39 + TypeScript + electron-builder.
- Opsiyonel analyzer: `file-expert-analyzer`, FastAPI/uvicorn/httpx/pydantic.

## Package manager

- Package manager: npm.
- Kok lockfile: `package-lock.json`.
- Desktop app lockfile: `apps/customer-uploader/package-lock.json`.
- Workspace tanimi yok; kok proje ve desktop app ayri npm projeleri gibi ele alinmali.
- Yeni dependency kurulmaz. Yeni dependency gerekiyorsa ilgili gorev Blocked yapilir.

## Dogrulama komutlari

Kok `package.json` scriptleri:

- `npm run lint`: ESLint. Bootstrap sirasinda gecti.
- `npm run typecheck`: `tsc --noEmit`. Bootstrap sirasinda gecti.
- `npm test`: `tsx --test tests/*.test.ts`. Bootstrap sirasinda 221/221 test gecti.
- `npm run build`: `next build`. Bootstrap sirasinda ag kapali ortamda Google Fonts (`next/font/google`) fetch hatasiyla basarisiz oldu. Bu ortam/harici ag bagimliligi olarak kaydedildi; font veya tasarim onaysiz degistirilmez.
- `npm run check:payments`: `scripts/check-payment-env.js`; `.env.local` okur. Otonom Codex dongusunde calistirilmez.
- `npm run fixtures:ecu-intelligence`: fixture uretir; gorev acikca istemedikce calistirilmez.
- `npm run test:ecu-intelligence`: tek ECU testi icin guvenli test komutu.

Desktop `apps/customer-uploader/package.json` scriptleri:

- `npm run check-env`: `.env`, `.env.local` ve public Vite env degerlerini okur; otonom dongude calistirilmez.
- `npm run dev`, `npm run build`, `npm run package:win`: desktop env ve packaging bagimliliklari nedeniyle yalnizca acik gorevle calistirilir.

Ek guvenli script:

- `node scripts/check-i18n-seo.mjs`: public SEO/i18n saglik kontrolu; SEO veya translation degisikliklerinde uygundur.

Calistirilmayan veya insan onayi isteyen kontroller:

- SQL migration/verification scriptleri canli Supabase'e uygulanmaz.
- Smoke scriptleri production URL ile calistirilmez.
- Scraper scriptleri internet gerektirir ve otonom dongude calistirilmez.
- `npm audit` package registry/internet gerektirebilir; ag kapali ortamda calistirilmaz.

## Hassas alanlar

- Supabase auth, server/admin client, service-role key, RLS ve SQL migration dosyalari.
- Supabase Storage pathleri, signed URL'ler, ECU/TCU dosya yukleme ve finalize akislari.
- Stripe checkout/webhook, payment ledger, credit balance, refund/reconciliation kodlari.
- PayPal route'lari legacy/disabled durumdadir; aktif ticari karar gibi ele alinmaz.
- Resend/transactional email ve email event loglari.
- Bank transfer env degerleri ve odeme kurallari.
- AI/File Expert analiz sonucunda raw binary, hex, offset, hash, sample id, source metadata ve admin-only alanlar.
- Vehicle catalog import/enrichment, public cache rebuild, scraper ciktisi ve `data/vehicle-*` dosyalari.
- Widget domain/session/key dogrulama.
- `.env`, `.env.*`, `.vercel/`, deployment metadata, musteri dosyalari ve gercek musteri verileri.

## Dokunulmamasi gereken alanlar

- Fiyat, kredi paketi, ticari odeme kurali, garanti, hukuki metin veya hizmet iddiasi.
- Production deploy, Vercel proje baglantisi, branch/commit/push islemleri.
- Production Supabase/Stripe/Resend/PayPal veya baska ucuncu taraf servis cagrilari.
- SQL migration calistirma veya production DB mutasyonu.
- `.env` icerigi okuma/yazma/loglama.
- Gercek musteri dosyasi, hash, storage path veya musteri kaydi.
- Public/legal/company beyanlari; sadece teknik SEO veya test/dokumantasyon gorevi aciksa dar kapsamda duzenlenir.
- Desktop app signing, installer ve release ciktisi; acik gorev yoksa dokunulmaz.

## Bilinen sorunlar ve teknik borc

- Root `README.md` hala default create-next-app icerigi tasiyor; proje ozel local setup ve guvenlik sinirlari eksik.
- Offline/restricted build `next/font/google` nedeniyle Google Fonts fetch hatasina takiliyor.
- `scripts/check-payment-env.js` ve desktop `check-env.mjs` `.env`/`.env.local` okuyor; otonom dongu icin schema-only guvenli mod yok.
- Smoke scriptleri default localhost olsa da env ile production URL hedefleyebilir; otonom guard yok.
- CareEcuFile scraper scriptleri dis aga baglanir ve veri dosyalarini yazar; otonom dongude risklidir.
- Bazi yorum/dokumanlarda encoding artifactleri goruldu; runtime etkisi yok, dar kapsamli duzeltme gerektirir.
- `.autopilot/runtime/` Git tarafindan `.gitignore:55` ile ignore ediliyor.
