# Otonom calisma gunlugu

Bu dosya her planner, worker ve reviewer calistirmasindan sonra guncellenir.

## 2026-07-12 reviewer run AUTO-004

- Gorev: Mevcut uncommitted AUTO-004 degisikliklerini bagimsiz reviewer olarak incelemek.
- Sonuc: Accepted. Smoke scriptleri ortak local-only URL guard'i ile default localhost davranisini koruyor; non-local hedefler `ALLOW_NON_LOCAL_SMOKE=1` olmadan fetch'e gecmeden reddediliyor.
- Duplicate/evidence kontrolu: ROADMAP, TASKS, TASK_HISTORY, STATUS ve yakin Git gecmisi incelendi; ayni fingerprint daha once tamamlanmis gorunmedi. Evidence gercek: HEAD'deki smoke scriptleri env-provided non-local base URL'leri guard olmadan kabul ediyordu.
- Reviewer duzeltmesi: STATUS son durum ozeti AUTO-004 dogrulamasiyla guncellendi.
- Risk kontrolu: Production servis cagrisi, migration, secret, musteri verisi, yeni dependency, debug kodu veya kapsam disi refactor tespit edilmedi. UI degisikligi olmadigi icin responsive/accessibility/loading/error/empty state etkisi yok.
- Calistirilan kontroller: no-network guard kontrolu PASS; `.\node_modules\.bin\tsx.cmd --test tests/admin-work-orders.test.ts tests/vehicle-control-center.test.ts` PASS (61/61); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (228/228); `git diff --check` PASS (yalnizca CRLF uyarilari).
- Calistirilmayan kontroller: `npm run build` script/test/docs odakli degisiklik ve bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi. Smoke scriptleri production hedefe karsi calistirilmadi.
- Kalan risk: Scraper explicit network guard'i ve diger Ready product-evolution gorevleri henuz uygulanmadi; production smoke sadece insan kontrollu calistirilmalidir.

## 2026-07-12 worker run AUTO-004

- Gorev: Smoke scriptlerine non-local hedef guard'i eklemek.
- Fingerprint: `security|smoke-scripts|non-local-target-without-explicit-override|local-only-autopilot-guard`.
- Duplicate kontrolu: TASK_HISTORY, Done gorevleri ve yakin Git gecmisi incelendi; ayni fingerprint veya uygulanmis ortak smoke URL guard'i bulunmadi.
- Evidence kontrolu: `scripts/smoke-public-platform.mjs`, `scripts/smoke-admin-unauthenticated.mjs`, `scripts/smoke-admin-work-orders.mjs` ve `scripts/smoke-vehicle-control-center.mjs` env-provided non-local base URL'leri guard olmadan kabul ediyordu.
- Degisen dosyalar: `scripts/smoke-url-guard.mjs`, `scripts/smoke-public-platform.mjs`, `scripts/smoke-admin-unauthenticated.mjs`, `scripts/smoke-admin-work-orders.mjs`, `scripts/smoke-vehicle-control-center.mjs`, `tests/admin-work-orders.test.ts`, `tests/vehicle-control-center.test.ts`, `docs/production-smoke-checklist.md`, `docs/security-notes.md`, `docs/vehicle-control-center-production-smoke.md`, `.autopilot/TASKS.md`, `.autopilot/TASK_HISTORY.md`, `.autopilot/STATUS.md`, `.autopilot/runtime/last-result.json`.
- Sonuc: Ortak smoke URL guard'i default localhost davranisini korur; non-local hedefler `ALLOW_NON_LOCAL_SMOKE=1` olmadan fetch'e gecmeden reddedilir. Production smoke dokumanlari bu override'in yalniz human-controlled production smoke icin oldugunu belirtir.
- Guvenlik/UI kontrolu: `.env`, secret, musteri verisi, production servis cagrisi, migration, deploy veya yeni dependency kullanilmadi. UI degisikligi olmadigi icin responsive/accessibility/loading/error/empty state etkisi yok.
- Calistirilan kontroller: no-network guard kontrolu PASS; `.\node_modules\.bin\tsx.cmd --test tests/admin-work-orders.test.ts tests/vehicle-control-center.test.ts` PASS (61/61); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (228/228); `git diff --check` PASS (yalnizca CRLF uyarilari).
- Calistirilmayan kontroller: `npm run build` script/test/docs odakli gorev ve bu repoda bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi. Smoke scriptleri localhost sunucusu gerektirdigi ve production hedefe otonom calistirma yasak oldugu icin gercek endpointlere karsi calistirilmadi.
- Kalan risk: Scraper explicit network guard'i ve diger Ready product-evolution gorevleri henuz uygulanmadi; production smoke sadece insan kontrollu calistirilmalidir.

## 2026-07-12 planner run PRODUCT EVOLUTION MODE

- Gorev: Portfoy planlamasi ve guvenli gorev kesfi; kullanici talimatina uygun olarak uygulama kodu degistirilmedi.
- Okunan kaynaklar: `AGENTS.md`, `.autopilot/PROJECT.md`, `.autopilot/ROADMAP.md`, `.autopilot/INBOX.md`, `.autopilot/IMPROVEMENT_AREAS.md`, `.autopilot/TASKS.md`, `.autopilot/TASK_HISTORY.md`, `.autopilot/PLANNER_STATE.json`, `.autopilot/STATUS.md`, kok ve desktop `package.json`, mevcut Git durumu ve son 100 commit ozeti.
- INBOX sonucu: `MANUAL-20260712-120055` buyuk owner hedefi olarak islendi; `MILESTONE-20260712-PRODUCT-EVOLUTION` aktif roadmap milestone'una tasindi ve INBOX `Planned` altina alindi.
- Duplicate kontrolu: ROADMAP, TASKS, TASK_HISTORY, STATUS ve son 100 commit incelendi. Yeni gorevler mevcut smoke/scraper/env/docs/test guard islerinin veya onceki genel operasyon commitlerinin aynisi degil; her biri yeni, somut kod kanitina dayaniyor.
- Audited domains: Responsive UX & product flow; Observability & error handling.
- Eklenen Ready gorevler: `AUTO-011` admin review filtresi payment/QC sinyallerini kapsasin; `AUTO-012` work-order fallback modunda mutasyon kontrolleri read-only olsun; `AUTO-013` musteri order timeline'i bekleme ve revizyon adimlarini acik gostersin.
- Degisen dosyalar: `.autopilot/ROADMAP.md`, `.autopilot/INBOX.md`, `.autopilot/TASKS.md`, `.autopilot/PLANNER_STATE.json`, `.autopilot/STATUS.md`, `.autopilot/runtime/planner-result.json`.
- Calistirilan kontroller: zorunlu dosyalar `Get-Content` ile okundu; `git status --short --branch`; `git log -n 100 --oneline`; kok ve desktop `package.json` script incelemesi; `Select-String` ile admin/musteri UX kanit aramasi; `ConvertFrom-Json` ile planner/runtime JSON parse kontrolu; Ready gorev sayimi 8; `git diff --name-only` yalniz izinli autopilot dosyalarini gosterdi; `git check-ignore -v .autopilot/runtime/planner-result.json` PASS; `git diff --check` PASS (yalniz CRLF uyarilari).
- Calistirilmayan kontroller: Uygulama kodu degismedigi icin `npm run lint`, `npm run typecheck`, `npm test` ve `npm run build` calistirilmadi. Build icin bilinen restricted-network Google Fonts riski devam ediyor.
- Kalan risk: Ready kuyrugunda onceki P0/P1 guard isleri ve yeni product-evolution gorevleri henuz uygulanmadi; canli servis, migration, fiyat/hukuki metin ve gercek musteri verisi sinirlari korunmali.

## Son durum

- Kurulum tarihi: 2026-07-12 (Europe/Berlin)
- Aktif branch: codex/autopilot
- Son basarili gorev: AUTO-004 Smoke scriptlerine non-local hedef guard'i ekle
- Son dogrulama: reviewer no-network guard kontrolu PASS; hedefli smoke/work-order test PASS (61/61); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (228/228); `git diff --check` PASS (yalnizca CRLF uyarilari)
- Insan mudahalesi gereken konu: Offline build icin Google Fonts/`next/font/google` stratejisi onayi; production smoke, SQL migration, deploy ve normal env kontrolleri insan onayi gerektirir.

## 2026-07-12 reviewer run AUTO-003

- Gorev: Mevcut uncommitted AUTO-003 degisikliklerini bagimsiz reviewer olarak incelemek.
- Sonuc: Accepted. Desktop env checker `--schema-only` modu root/app `.env*` dosyalarini okumadan public desktop Vite env sozlesmesini raporlar; varsayilan normal env kontrol davranisi korunur.
- Duplicate/evidence kontrolu: ROADMAP, TASKS, TASK_HISTORY, STATUS ve Git gecmisi incelendi; ayni fingerprint daha once tamamlanmis gorunmedi. Evidence gercek: HEAD'deki `apps/customer-uploader/scripts/check-env.mjs` safe mode branch'i olmadan root/app `.env` ve `.env.local` kaynaklarini okuyordu.
- Reviewer duzeltmesi: `.autopilot/PROJECT.md` icindeki stale desktop schema-only notlari guncellendi; normal mod ve guvenli `--schema-only` modu ayrimi eklendi.
- Risk kontrolu: Production servis, migration, secret, musteri verisi, yeni dependency, debug kodu veya kapsam disi refactor tespit edilmedi. UI degisikligi olmadigi icin responsive/accessibility/loading/error/empty state etkisi yok.
- Calistirilan kontroller: `node apps/customer-uploader/scripts/check-env.mjs --schema-only` PASS; `.\node_modules\.bin\tsx.cmd --test tests/customer-uploader.test.ts` PASS (20/20); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (227/227); `git diff --check` PASS (yalnizca CRLF uyarilari).
- Calistirilmayan kontroller: `npm run build` script/test/autopilot-doc odakli degisiklik ve bilinen restricted-network Google Fonts bagimliligi nedeniyle calistirilmadi. Desktop normal `npm run check-env`, `dev`, `build` ve `package:win` `.env*` veya packaging bagimliliklari nedeniyle calistirilmadi.
- Kalan risk: Smoke ve scraper guard gorevleri Ready kuyrugunda devam ediyor; offline build Google Fonts stratejisi owner onayi bekliyor.

## 2026-07-12 worker run AUTO-003

- Gorev: Desktop env checker icin otonom guvenli `--schema-only` modu eklemek.
- Fingerprint: `security|desktop-env-checker|env-file-secret-read|schema-only-public-contract-validation`.
- Duplicate kontrolu: TASK_HISTORY, Done gorevleri ve yakin Git gecmisi incelendi; ayni fingerprint veya uygulanmis desktop `schema-only` modu bulunmadi.
- Evidence kontrolu: `apps/customer-uploader/scripts/check-env.mjs` baslangicta safe mode branch'i olmadan root/app `.env` ve `.env.local` dosyalarini top-level parse ediyordu.
- Degisen dosyalar: `apps/customer-uploader/scripts/check-env.mjs`, `tests/customer-uploader.test.ts`, `.autopilot/TASKS.md`, `.autopilot/TASK_HISTORY.md`, `.autopilot/STATUS.md`, `.autopilot/runtime/last-result.json`.
- Sonuc: `node apps/customer-uploader/scripts/check-env.mjs --schema-only` root/app `.env*` dosyalarini okumadan public desktop Vite env sozlesmesini raporlar. Varsayilan desktop build/dev oncesi env kontrol davranisi korunur.
- Guvenlik/UI kontrolu: `.env`, secret, musteri verisi, production servis, migration, deploy veya yeni dependency kullanilmadi. UI degisikligi olmadigi icin responsive/accessibility/loading/error/empty state etkisi yok.
- Calistirilan kontroller: `node apps/customer-uploader/scripts/check-env.mjs --schema-only` PASS; `.\node_modules\.bin\tsx.cmd --test tests/customer-uploader.test.ts` PASS (20/20); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (227/227); `git diff --check` PASS (yalnizca CRLF uyarilari).
- Calistirilmayan kontroller: `npm run build` script/test odakli gorev ve bu repoda bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi. Desktop normal `npm run check-env`, `dev`, `build` ve `package:win` `.env*` veya packaging bagimliliklari nedeniyle calistirilmadi.
- Kalan risk: Smoke ve scraper guard gorevleri Ready kuyrugunda devam ediyor; offline build Google Fonts stratejisi owner onayi bekliyor.

## 2026-07-12 reviewer run AUTO-002

- Gorev: Mevcut uncommitted AUTO-002 degisikliklerini bagimsiz reviewer olarak incelemek.
- Sonuc: Accepted. Payment env checker `--schema-only` modu env dosyasi okumadan sozlesme raporu veriyor; varsayilan `.env.local` tabanli OK/MISS davranisi korunuyor.
- Duplicate/evidence kontrolu: TASKS, TASK_HISTORY, STATUS ve Git gecmisi incelendi; ayni fingerprint daha once tamamlanmis gorunmedi. Evidence gercek: HEAD'deki script safe mode branch'i olmadan `.env.local` varligini kontrol edip dosyayi okuyordu.
- Reviewer duzeltmesi: `.autopilot/PROJECT.md` icindeki stale README ve payment checker schema-only notlari guncellendi; guvenli mod ve normal mod ayrimi eklendi.
- Risk kontrolu: Production servis, migration, secret, musteri verisi, yeni dependency, debug kodu veya kapsam disi refactor tespit edilmedi. UI degisikligi olmadigi icin responsive/accessibility/loading/error/empty state etkisi yok.
- Calistirilan kontroller: `node scripts/check-payment-env.js --schema-only` PASS; `.\node_modules\.bin\tsx.cmd --test tests/payment-env-checker.test.ts` PASS (3/3); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (224/224); `git diff --check` PASS (yalnizca CRLF uyarilari).
- Calistirilmayan kontroller: `npm run build` script/test/autopilot-doc odakli degisiklik ve bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi. `npm run check:payments` normal mod `.env.local` okudugu icin calistirilmadi.
- Kalan risk: Desktop env checker, smoke ve scraper guard gorevleri Ready kuyrugunda devam ediyor; offline build Google Fonts stratejisi owner onayi bekliyor.

## 2026-07-12 worker run AUTO-002

- Gorev: Payment env checker icin otonom guvenli `--schema-only` modu eklemek.
- Fingerprint: `security|payment-env-checker|env-local-secret-read|schema-only-contract-validation`.
- Duplicate kontrolu: TASK_HISTORY, Done gorevleri ve yakin Git gecmisi incelendi; ayni fingerprint veya uygulanmis `schema-only` modu bulunmadi.
- Evidence kontrolu: `scripts/check-payment-env.js` baslangicta safe mode branch'i olmadan `.env.local` varligini kontrol ediyor ve dosyayi okuyordu.
- Degisen dosyalar: `scripts/check-payment-env.js`, `tests/payment-env-checker.test.ts`, `.autopilot/TASKS.md`, `.autopilot/TASK_HISTORY.md`, `.autopilot/STATUS.md`, `.autopilot/runtime/last-result.json`.
- Sonuc: `node scripts/check-payment-env.js --schema-only` env dosyasi okumadan gerekli Stripe, Bank Transfer ve Site key sozlesmesini raporlar. Varsayilan modun OK/MISS raporu korunur ve secret degerleri basmaz.
- Guvenlik/UI kontrolu: `.env`, secret, musteri verisi, production servis, migration, deploy veya yeni dependency kullanilmadi. UI degisikligi olmadigi icin responsive/accessibility/loading/error/empty state etkisi yok.
- Calistirilan kontroller: `node scripts/check-payment-env.js --schema-only` PASS; `.\node_modules\.bin\tsx.cmd --test tests/payment-env-checker.test.ts` PASS (3/3); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (224/224); `git diff --check` PASS (yalnizca CRLF uyarilari).
- Calistirilmayan kontroller: `npm run build` script/test odakli gorev ve bu repoda bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi. `npm run check:payments` normal mod `.env.local` okudugu icin calistirilmadi.
- Kalan risk: Desktop env checker, smoke ve scraper guard gorevleri Ready kuyrugunda devam ediyor; offline build Google Fonts stratejisi owner onayi bekliyor.

## 2026-07-12 reviewer run AUTO-001

- Gorev: Mevcut uncommitted AUTO-001 degisikliklerini bagimsiz reviewer olarak incelemek.
- Sonuc: Accepted. README degisikligi gorev kapsaminda; TASKS, TASK_HISTORY ve STATUS kayitlari worker sonucuyla uyumlu.
- Duplicate/evidence kontrolu: HEAD README default create-next-app icerigiydi; HEAD TASK_HISTORY bos idi; fingerprint yalnizca yeni Done/TASK_HISTORY kayitlarinda gorundu.
- Risk kontrolu: Production servis, migration, secret, musteri verisi, yeni dependency, debug kodu veya kapsam disi refactor tespit edilmedi.
- Calistirilan kontroller: `git diff --check` PASS (yalnizca CRLF uyarilari); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (221/221).
- Calistirilmayan kontroller: `npm run build` README-only gorev icin calistirilmadi; restricted network Google Fonts bagimliligi ve Next env yukleme davranisi bilinen risk olarak kayitli.

## 2026-07-12 worker run AUTO-001

- Gorev: Root README'yi default create-next-app iceriginden gercek proje rehberine cevirmek.
- Fingerprint: `developer-experience|root-readme|default-create-next-app|project-specific-safe-setup-guide`.
- Duplicate kontrolu: TASK_HISTORY, Done gorevleri ve yakin Git gecmisi incelendi; ayni amacin tamamlandigina dair kayit bulunmadi.
- Evidence kontrolu: `README.md` baslangicta default create-next-app metni iceriyordu.
- Degisen dosyalar: `README.md`, `.autopilot/TASKS.md`, `.autopilot/TASK_HISTORY.md`, `.autopilot/STATUS.md`, `.autopilot/runtime/last-result.json`.
- Sonuc: README kok Next.js app, desktop uploader, opsiyonel analyzer, npm komutlari, local setup notlari ve guvenli calisma sinirlariyla guncellendi. Fiyat, garanti, hukuki iddia veya yeni urun vaadi eklenmedi.
- Calistirilan kontroller: Markdown diff incelemesi PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (221/221).
- Calistirilmayan kontroller: `npm run build` README-only gorev icin zorunlu olmadigi ve restricted network ortaminda Google Fonts fetch bagimliligi bilindigi icin calistirilmadi; `npm run check:payments`, desktop env/build/package, smoke, scraper ve SQL komutlari hassas sinirlar nedeniyle calistirilmadi.
- Kalan risk: Offline build Google Fonts stratejisi onayi bekliyor; env checker, smoke ve scraper guard gorevleri henuz Ready kuyrugunda.

## 2026-07-12 planner run

- Gorev: Portfoy planlamasi ve guvenli gorev kesfi; uygulama koduna dokunulmadi.
- Okunan kaynaklar: `AGENTS.md`, `.autopilot/PROJECT.md`, `.autopilot/ROADMAP.md`, `.autopilot/INBOX.md`, `.autopilot/IMPROVEMENT_AREAS.md`, `.autopilot/TASKS.md`, `.autopilot/TASK_HISTORY.md`, `.autopilot/PLANNER_STATE.json`, `.autopilot/STATUS.md`, `package.json`, `git status --short --branch`, son 100 commit ozeti.
- INBOX sonucu: `New requests` bos; owner kaynakli yeni istek islenmedi.
- Duplicate kontrolu: TASKS/ROADMAP/TASK_HISTORY/STATUS ve son 100 commit incelendi; mevcut guvenli isler zaten `AUTO-001` - `AUTO-010` olarak kayitli.
- Degisen dosyalar: `.autopilot/TASKS.md`, `.autopilot/PLANNER_STATE.json`, `.autopilot/STATUS.md`, `.autopilot/runtime/planner-result.json`.
- Sonuc: Yeni gorev eklenmedi. Ready hedef araligi icin `AUTO-009` ve `AUTO-010` Later bolumune tasindi; Ready sayisi 8 oldu.
- Calistirilan kontroller: `git status --short --branch`; `git log -100 --pretty=format:'%h %ad %s' --date=short`; `Get-Content` ile zorunlu planlama dosyalari; `package.json` script incelemesi.
- Calistirilmayan kontroller: Uygulama kodu degismedigi icin `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` calistirilmadi.
- Kalan risk: Ready kuyrugundaki mevcut P0/P1 isler uygulanmadikca env checker, smoke, scraper ve offline build riskleri devam eder.

## Bootstrap bulgulari

- Git durumu baslangicta dirty idi: `.gitignore` modified, `.autopilot/` ve `AGENTS.md` untracked gorundu. Bu calisma mevcut degisiklikleri geri almaz.
- `.autopilot/runtime/` Git tarafindan ignore ediliyor: `.gitignore:55:.autopilot/runtime/`.
- `rg` ortamda yok; dosya envanteri PowerShell `Get-ChildItem` ile yapildi.
- Package manager npm; kok ve desktop app icin ayri `package-lock.json` var.
- Kok uygulama Next.js App Router, React, TypeScript, Tailwind/PostCSS, Supabase, Stripe, Resend ve zod kullaniyor.
- Desktop app `apps/customer-uploader` altinda Vite/React/Electron/TypeScript ile ayrilmis.
- Opsiyonel Python analyzer `file-expert-analyzer` FastAPI tabanli.
- Test kapsami guclu: admin/customer API auth, payment/email, desktop uploader, File Expert/AI, vehicle control/enrichment, i18n/SEO ve UI safety testleri var.
- Hassas entegrasyonlar: Supabase admin/service-role, Storage upload pathleri, Stripe/webhook/credit ledger, Resend email, bank transfer env, File Expert analyzer signed URL'leri, scraperlar ve SQL migration dosyalari.
- `scripts/check-payment-env.js` kok `.env.local` dosyasini okur; bootstrap sirasinda calistirilmadi.
- `apps/customer-uploader/scripts/check-env.mjs` root/app `.env` ve `.env.local` okuyabilir; bootstrap sirasinda calistirilmadi.
- Scraper scriptleri dis aga baglanir; bootstrap sirasinda calistirilmadi.
- SQL dosyalari incelendi ancak hicbir migration/production DB islemi calistirilmadi.

## Degisen dosyalar

- `AGENTS.md`: mevcut icerik korunarak repository-ozel guvenli calisma ekleri eklendi.
- `.autopilot/PROJECT.md`: gercek repo bulgulariyla dolduruldu.
- `.autopilot/TASKS.md`: 10 Ready gorev eklendi (`AUTO-001` - `AUTO-010`).
- `.autopilot/STATUS.md`: bootstrap bulgulari, kontroller ve onerilen calisma sirasi yazildi.
- `.autopilot/runtime/bootstrap-result.json`: bootstrap sonucu icin valid JSON yazildi.

## Calistirilan kontroller

- `git status --short --branch`: branch `codex/autopilot`; dirty worktree belirlendi.
- `git check-ignore -v .autopilot/runtime/bootstrap-result.json`: runtime JSON ignore kuralinin calistigini dogruladi.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 221/221.
- `npm run build`: FAIL. Next.js build Google Fonts (`Geist`, `Geist Mono`) icin `fonts.googleapis.com` fetch etmeye calisti; ag kapali oldugu icin build tamamlanmadi. Dummy/local env set edilmisti, fakat Next yine `.env.local` dosyasinin varligini raporladi; secret degeri loglanmadi.

## Calistirilmayan kontroller

- `npm run check:payments`: `.env.local` okudugu icin calistirilmadi.
- `apps/customer-uploader` `check-env/dev/build/package`: `.env*`, production API base veya signing/package bagimliligi nedeniyle calistirilmadi.
- Smoke scriptleri: production veya local server hedefi gerektirdigi icin calistirilmadi.
- Scraper scriptleri: internet ve veri dosyasi mutasyonu riski nedeniyle calistirilmadi.
- SQL migration/verification scriptleri: Supabase/production DB siniri nedeniyle calistirilmadi.

## Onerilen ilk calisma sirasi

1. `AUTO-001` README'yi gercek proje rehberine cevir.
2. `AUTO-002` ve `AUTO-003` env checker'lara otonom guvenli mod ekle.
3. `AUTO-004` smoke scriptlerini local-only guard ile guvenli hale getir.
4. `AUTO-005` scraper scriptleri icin explicit network izni zorunlu yap.
5. `AUTO-006` ve `AUTO-007` dar kapsamli test kapsamini genislet.
6. `AUTO-008` ve `AUTO-009` local automation ile human production smoke ayrimini dokumante et.
7. `AUTO-010` sadece yorum/dokuman encoding artifactlerini temizle.

## Kalan riskler

- Offline build basarisiz; Google Fonts bagimliligi cozulmeden restricted Codex ortaminda `npm run build` gecmeyebilir.
- Env checker scriptleri icin guvenli schema-only mod henuz uygulanmadi.
- Smoke/scraper scriptleri non-local/dis ag guard'i henuz uygulamadi.
