# Otonom gorev kuyrugu

> Yalnizca repository incelemesiyle dogrulanan, kucuk veya orta olcekli ve guvenli gorevler eklenir.

## Ready

## In Progress

## Blocked

### MANUAL-20260828-ADS-MEASUREMENT-FINAL-HARDENING [P0] Reklam edinimi, consent ve dogrulanmis donusum final kapilari

Durum: Blocked (code fully validated; owner/legal, migration, Production release and live receipt gates remain)

Fingerprint: `ads|uk-ie-search|consent-route-isolation|verified-registration-request-payment|growth-report-fail-closed|final-launch-gates`

Sonuc: Public consent/paid-click, register/request/payment exact-once handoff,
first-party attribution, HMAC rotation, partial-report fail-closed davranisi,
exact Google route allowlist'i ve responsive landing-page paketi yerelde
tamamlandi. Kampanyalar ve harcama kapali kaldi; canli Ads edit/upload veya
aktivasyon yapilmadi. Full lint/typecheck/test/i18n/build/performance,
responsive Chrome QA ve bagimsiz immutable review PASS oldu.

2026-08-29 ek ilerleme: canli account-level audit toplam EUR 111.31 / 478 click
/ 0 conversion harcamayi kampanya ve kanal bazinda uzlastirdi. PMax harcamasinin
tamami YouTube, Display ve Discover'da; Search harcamasi sifir bulundu. English
file-service landing'inin birincil ve final CTA'si tekrar dogrudan registration-
first `/new-request` akisina baglandi; servis secimi ikincil yol olarak korundu.
Kayit basari/hata sonucu uzun formun altindan baslik altindaki odaklanan panele
tasindi; basarili kayitta form gizlenir ve e-posta dogrulama/resend aksiyonu ilk
ekranda gorunur. Hedefli funnel suite 25/25 ve scoped lint PASS.

Blokaj: Owner/hukuk onayli guncel VPS + Google Ads/Analytics privacy metni ve
consent version karari; UK/Irlanda emissions-policy uygunluk karari; operasyonel
sure iddialarinin kaniti veya notr metni; edge click-query log retention kaniti;
ayri Production Growth HMAC secret'lari ve migration-first release; acik
Production yayin yetkisi; post-deploy Tag Assistant/network receipt; asset
ticari kullanim/AI disclosure ve canli Google Ads edit/upload icin action-time
onay. Bu kapilar tamamlanmadan kampanya aktivasyonu ve "launch-ready" iddiasi
fail-closed kalir.

### MANUAL-20260823-INTEGRATED-PRODUCTION-RELEASE [P0] Son degisikliklerin guvenli Production yayini

Durum: Blocked (code and VPS runtime validated; secret/backup release gates remain)

Fingerprint: `production-release|current-main-plus-growth-generic-datalog-device-assurance|validated-integrated-artifacts|hosting-backup-secret-and-entitlement-gated`

Kapsam: Current Production uzerindeki son Growth, genel datalog, auth redirect /
Google onboarding, customer device assurance ve canonical 02443-02454 guvenlik
degisikliklerini tek denetlenebilir uygulama/veritabani sirasi olarak yayinla.

Hazir sonuc: Birlesik branch tam test/lint/typecheck/i18n/Webpack/performance
kapilarindan gecti; auth/device/order-verifier P0/P1 review'u temiz. Public
datalog snapshot artik full customer motorunu import etmeyen, 12 KiB build
butcesiyle korunan ayri bounded worker'dir. Exact predecessor ve public edge
branch'leri pushlandi; app ile File Expert analyzer image'lari gercek VPS'te
build ve izole non-root/read-only smoke kapilarindan gecti. Isolated staging
Supabase'de canonical set ile iki device migration shadow modda uygulandi ve
read-only device verifier 7/7 PASS oldu. Production DB, DNS, Caddy ve mevcut
canli container'lar henuz degistirilmedi.

Blocked reason: Hostinger VPS ticari Production hedefi olarak secildi ancak
mevcut Vercel Production env degerleri guvenli aktarilmadi; Production device
HMAC/proxy/analyzer secret'lari ve Supabase Auth password/change kapilari hazir
degil, restorable logical backup kaniti alinmadi. Shadow Preview uygulama,
e-posta ve sentetik File Expert E2E provasi tamamlanmadi. Customer full datalog
motoru browser-local calistigi icin route UI'si korumali olsa da strict kod
gizliligi server-side authenticated isleme veya owner kabul karari gerektirir.

Remediation: Vercel env'i deger yazdirmadan VPS'e aktar; server-only secret ve
Auth ayarlarini hazirla; restorable logical backup al/provala; authenticated
no-store datalog isleme veya browser-local kod extractability icin owner karari
ver; matching Preview ve shadow E2E'yi tamamla. Sonra runbook sirasiyla
Production release ve smoke.

### MANUAL-20260822-GENERIC-DATALOG-STUDIO [P1] Genel datalog denemesi ve müşteri analiz derinliği

Durum: Blocked (public split validated; strict browser-code secrecy requires owner decision)

Fingerprint: `performance-analysis|generic-datalog-access|autotuner-specific-public-bypass-and-2k-cap|public-two-metric-trial-and-customer-multichannel-studio`

Kapsam: AutoTuner'a ozel ad, format ve public tam-surum gecidini kaldir; ana
sayfadaki browser-local denemeyi gercekci boyuttaki genel CSV/TSV/TXT/LOG
exportlarinda yalniz tepe Nm ve torque-derived HP gosterecek sekilde sinirla.
Authenticated customer Studio'da yuksek ama bounded kaynak limitleri, tum
sayisal kanallarin min/ortalama/maksimum ozeti, gercek time/RPM ekseni, EGT ve
yalniz kayitta kanitlanan EGR hareketi/gap gozlemleri sagla.

Kabul kriterleri:

- 2.000 satiri asan desteklenen text dataloglari public denemede sirf satir
  sayisi nedeniyle reddedilmez; file/row/channel limitleri local performans icin
  acik ve bounded kalir.
- Public hazir sonuc yalniz peak torque ve estimated peak power degerlerini
  gosterir; source adi, RPM penceresi, satir/kalite detayi, grafik, raw data ve
  indirilebilir rapor gostermez.
- Eski public AutoTuner analyzer tam calisma alanini render etmez ve protected
  `/dashboard/log-analysis` alanina yonlenir.
- Studio common delimited loglarda marka/tool bagimsiz RPM, Nm/lb-ft, time,
  EGT, EGR actual/target ve diger sayisal kanallari korur; unit bilinmiyorsa
  power veya actual-target sonucu uydurmaz.
- EGR metni yalniz observed channel movement/gap bildirir; fonksiyon, ariza,
  diesel tipi veya disable durumu kesinlestirmez.
- Hedefli testler, lint, typecheck, build, responsive/accessibility browser QA
  ve diff review PASS olur.

Blocked reason: Public snapshot full parser/report dependency graph'inden
ayrildi; yalniz RPM + explicit actual torque ile iki sonuc ureten 6.5 KiB
bounded worker ve 12 KiB build kapisi kullanir. Public UI/full-engine sizintisi
kapandi. Ancak authenticated customer Studio'nun full motoru browser-local
static worker'dir; route/UI korumasi kodun teknik olarak indirilebilir olmasini
engellemez. Full motoru authenticated server'a tasimak mevcut "dosya
tarayicidan cikmaz" urun/gizlilik vaadini degistirir.

Remediation: Owner ya browser-local customer kodunun teknik olarak extract
edilebilir oldugunu acikca kabul edip korumali UI entitlement'iyle yayinlamali
ya da authenticated, no-store, ephemeral server analizi ve buna uygun gizlilik
metni degisikligini onaylamali.

## Later

### AUTO-009 [P2] Production smoke dokumani ile local autopilot smoke ayrimini netlestir

Kapsam: `docs/production-smoke-checklist.md` ve ilgili guvenlik notlarinda production smoke'un insan kontrollu, autopilot smoke'un local-only oldugunu ayir.

Kabul kriterleri:

- Production checklist'teki canli URL komutlari insan kontrollu olarak etiketlenir.
- Otonom Codex dongusu icin localhost disi smoke calistirmama kuralina link/veri verilir.
- Mevcut non-mutating production smoke anlamlari korunur.
- Fiyat, odeme kurali veya operasyonel ticari karar degismez.

Dogrulama: Markdown diff incelemesi, `npm test` ilgili source assertion testleri.

Deferred reason: Selected P1/M roadmap milestone `RMAP-FILE-QUALITY-SCORE-M1-FOUNDATION` has higher strategic value and starts the File Platform AI File Quality Score foundation; this is a low-priority documentation cleanup and does not unlock the selected deterministic quality-score/explainability boundary.

Remediation: Reconsider after the AI File Quality Score M1 milestone is accepted, or if owner explicitly asks for production smoke documentation cleanup.

Expected validation command: `npm test` plus markdown diff review.

### AUTO-010 [P3] Dar kapsamli encoding artifact temizligi yap

Kapsam: Runtime stringlere dokunmadan yalnizca acikca bozulmus kaynak yorumlari veya teknik dokuman satirlarinda encoding artifactlerini temizle.

Kabul kriterleri:

- Ilk pass sadece `src/lib/supabaseServer.ts`, `src/lib/vehicleDatabase.ts` ve gerekirse scraper README yorum/dokuman satirlariyla sinirlidir.
- Public/legal/customer-facing metinler degistirilmez.
- Davranis, API, tasarim ve data icerigi degismez.
- Diff sadece yorum/dokuman karakter duzeltmesi icerir.

Dogrulama: Diff incelemesi, `npm run lint`, `npm run typecheck`.

Deferred reason: Maintenance-only artifact cleanup is intentionally behind selected P1/M roadmap milestone `RMAP-FILE-QUALITY-SCORE-M1-FOUNDATION` and should not consume the Ready queue while a high-impact roadmap slice is available.

Remediation: Batch with a future documentation/source-comment maintenance pass after the AI File Quality Score M1 milestone is accepted, or when no P1/P2 product or roadmap milestone is ready.

Expected validation command: `npm run lint` and `npm run typecheck`.

## Done

### MANUAL-20260830-SITE-WIDE-LOCALIZATION-COMPLETENESS [P0] Dil secicinin vaat ettiği gerçek site kapsamını tamamla

Durum: Done

Fingerprint: `site-i18n|global-language-switcher|excluded-and-dynamic-visible-copy|complete-runtime-and-audited-localization`

Kapsam: Global dil secicinin gorundugu public, auth, musteri, widget, arac,
hazirlik araci, DTC, datalog ve File Expert yuzeyleri 11 non-English locale icin
tamamlandi. Admin-only operasyonlar, yazari belli sabit hukuki belgeler, ham
musteri verisi ve ECU/teknik identifierlar bilincli olarak ceviri disinda kaldi.

Sonuc: 12 locale icin sunucu ilk HTML'i, runtime/dinamik metinler,
placeholder/aria/title alanlari, hata/loading/empty/success durumlari, locale
tercihi ve rota gecisi ortak bir sozlesmeyle yerellestirildi. Kucuk route-bazli
istemci kataloglari uretilerek global kataloglarin ilk yuklemeye sizmasi
engellendi. Auth, kayit, sifre kurtarma/sifirlama, odeme sonucu ve korumali
musteri ekranlarinda ilk boya English sizintisi kapatildi. Teknik otomotiv
terimleri native golden testlerle korundu; ekran okuyucu icin async recovery
sonuclari live region oldu.

Dogrulama: `npm run check:i18n` PASS (12 locale, 2006/2006, temiz English
fallback 0); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS
(1322/1322); `npm run build -- --webpack` PASS (280/280); `npm run
check:performance` PASS (14.6/80 KiB gzip, 3 ilk chunk); `git diff --check`
PASS. Gercek Production build tarayicisinda DE/TR auth, register ve payment
yuzeyleri 1366x768 ile 390x844 boyutlarinda test edildi; yatay tasma ve console
hata 0. Bagimsiz ilk review bulgulari giderildi. Push, Preview, Production
deploy, veritabani veya canli servis mutasyonu yapilmadi.

### MANUAL-20260830-HOMEPAGE-EXPERIENCE-REFRESH [P1] Public ana sayfayi kompakt premium musteri yolculuguna donustur

Durum: Done

Fingerprint: `public-homepage|information-architecture-and-visual-system|long-repetitive-section-stack|compact-premium-conversion-journey`

Sonuc: Yalnizca public root ve 11 localized ana sayfa; kompakt sticky header,
premium hero, gercek arac-performans secici, browser-local public datalog,
servis ve hazirlik rotalari, dort adimli is akisi, guven sinyalleri, marka/ECU
kutuphanesi, fail-closed canli kredi fiyatlari, kaynaklar/SSS, final CTA ve
kompakt footer olarak yeniden kuruldu. Tekrarlanan uzun SEO/rehber bloklari
kanonik detay sayfalarina yonlendirildi; admin, customer dashboard, auth,
request, payment ve database davranisi degistirilmedi.

Olcum: Canli eski sayfaya gore masaustu yuksekligi 14.593 px'den 6.033 px'e
(yaklasik %59), mobil yuksekligi 26.945 px'den 12.383 px'e (yaklasik %54)
indi. 360/390/768/1024/1366/1440 responsive kontrollerinde yatay tasma yok;
menu anchor akisi, BMW progresif arac secimi ve ornek datalog sonucu calisti.
Tum anlamli dusuk-kontrast metinler, otomatik focus davranisi, landmark sirasi
ve tekil `#tools` hedefi duzeltildi. 178 gorunur metin 11 non-English locale
icin reviewed exact ceviri aldi; `/de` ve `/tr` prerender taramasi temizdir.

Kontroller: Homepage/hedefli suite 220/220 PASS; `npm run lint` PASS;
`npm run typecheck` PASS; `npm run check:i18n` 12 locale ve 622/622 PASS;
Webpack Production build 280/280 PASS; performance 10.0/80 KiB gzip ve 6.5/12
KiB public worker PASS; `git diff --check` PASS. Full suite 1154/1156 olup iki
failure ayni base commit'teki clean worktree'de birebir tekrarlandi ve homepage
kapsami disindadir. Bagimsiz review P0/P1/P2 bulmadan GO verdi. Deploy yapilmadi.

### MANUAL-20260828-ADS-MEASUREMENT-RESCUE [P0] Google Ads harcamasini durdur ve kayit olcumunu guvenilir hale getir

Durum: Done (code validated; Production release and receipt proof pending)

Fingerprint: `ads-measurement|server-stable-registration-dedupe|account-bound-auth-resume-retry|uk-ie-search-only`

Sonuc: Google Ads hesabindaki uc kampanya da duraklatildi; toplam gunluk harcama
sifira indirildi. UK & Ireland Search kampanyasi yalniz Birlesik Krallik ve
Irlanda, presence-only konum, Google Search Network, English, phrase/exact
keyword ve kapali broad/AI Max/Display/Search Partners sinirina getirildi. Diger
Search ve Performance Max kampanyalari duraklatilmis kaldi.

2026-08-29 canli account-level uzlastirmada toplam EUR 111.31 / 478 click / 0
conversion dogrulandi. Bunun EUR 54.25 / 398 click'i agirlikla YouTube ve Display
dagitimi yapan PMax'e, EUR 53.03 / 74 click'i tarihsel English Search'e, yalniz
EUR 4.03 / 6 click'i kontrollu UK/Irlanda Search'e aittir. Ilk iki kampanya
yeniden acilmayacak; kontrollu kampanya da Production receipt kanitindan once
harcama baslatmayacak.

Uygulama tarafinda `/file-service` -> `/new-request` edinim yolu netlestirildi;
korumali talep girisinde yeni musteri icin kayit ana, mevcut musteri icin login
ikincil aksiyon oldu. Kayit donusumu artik istemci rastgele kimligi yerine
authenticated `growth_journey_events` satirinin sabit opak UUID'sini kullanir ve
Google'a yalniz SHA-256 transaction ID gider. E-posta/Google kaydi, gec onay,
cihaz dogrulamasi resume'u, basarisiz ilk teslim ve hesap degistirme senaryolari
30 dakikalik, hesaba bagli, PII/click-ID icermeyen iki bagimsiz pending handoff
ile fail-soft ve idempotenttir. PKCE kodu tek kez exchange edilir; normal login,
password reset ve donen Google kullanicisi kayit sayilmaz.

Kontroller: hedefli acquisition/responsive suite PASS (116/116); `npm run lint`
PASS; `npm run typecheck` PASS; `npm test` PASS (1174/1174); `npm run check:i18n`
PASS (12 locale, 617/617); `npm run build -- --webpack` PASS (279/279);
performance PASS (57.0/80 KiB gzip); `git diff --check` PASS. Bagimsiz final
review GO verdi ve P0/P1 bulmadi. Kod henuz Production'a deploy edilmedi; gercek
Tag Assistant receipt kaniti alinmadan veya tek UK/IE kampanyasi kontrollu
olarak yeniden acilmadan reklam harcamasi baslatilmayacak.

### MANUAL-20260825-ADMIN-ORDERS-RESPONSIVE-VIEW [P0] Admin siparis listesini tum ekranlarda gorunur tut

Durum: Done

Fingerprint: `admin-operations|orders-list-responsive-layout|rightmost-file-and-actions-columns-clipped-across-viewports|bounded-desktop-grid-and-dense-responsive-order-cards`

Sonuc: Dokuz sutunlu tablo yalniz guvenli `2xl` genislikte aciliyor; Actions
sutunu ve Details dugmesi yeniden boyutlandirildi, yatay erisim fallback'i
eklendi. Laptop, tablet ve mobil gorunum iki sutuna kadar yogun kartlara geciyor;
musteri kimligi, arac/engine, ECU/read/gearbox, servis, kredi, dosya hazirlik,
dosya adi, durum guncelleme ve detay aksiyonu korunuyor. Grid min-content
tasmasi kapatildi; tablo basliklari, status alanlari ve kartlar erisilebilir
isimler kazandi. Hedefli responsive test 8/8, lint, typecheck, tam test
1015/1015, Webpack Production build 278/278 ve diff review PASS.

### MANUAL-20260825-VEHICLE-PUBLICATION-SYNC-FIX [P0] Yayinlanan arac verisini musteri kataloguna guvenilir aktar

Durum: Done (Production deployed and verified)

Fingerprint: `vehicle-catalog|admin-publish-public-projection|published-verified-stage-values-fall-back-to-stale-cache-review-state|stable-engine-resolution-automatic-cache-sync-and-fresh-detail`

Sonuc: Public exact arac cozumu artik degisebilen cached `vehicleKey` yerine once
kalici engine UUID, sonra benzersiz external ID ve son olarak guncel vehicle key
ile active+published DB kaydini arar. Cache kaynakli eski satir guncel DB detayi
dogrulanamazsa performans degeri fail-closed olur; eski bos Stage satiri musteriye
sessizce basarili sonuc gibi sunulmaz. Admin create/update sonrasinda public
katalog otomatik senkronize edilir ve senkron sonucu API/UI'da acikca gosterilir.
DB kaydi basarili fakat cache senkronu basarisizsa sabit footer uyarisi ile tekrar
deneme aksiyonu gorunur. Exact detay no-store, hiyerarsi ve istemci secenek cache'i
60 saniyedir; eski 15 dakikalik session cache anahtari versiyonlanarak gecersiz
kilinmistir.

Kontroller: Hedefli vehicle/public katalog testleri PASS (55/55); `npm run lint`
PASS; `npm run typecheck` PASS; `npm test` PASS (1014/1014); `npm run build --
--webpack` PASS (278/278); `git diff --check` PASS. Yeni dependency, schema veya
migration yoktur; auth, fiyat, odeme, e-posta, env veya secret degismedi.

Production: Exact `d05dc8c87ec8` app/analyzer cifti Hostinger VPS'e code-only
release olarak yayinlandi. Public katalogun tek `published` cache satiri mevcut
active+published veriyle bir kez rebuild edildi: 102 marka, 1.631 model, 2.463
nesil ve 10.519 motor. E 63 S ve E 300 e exact API ve gercek musteri homepage
secici smoke'unda kayitli Stage degerlerini gosterdi; `Performance data under
review` metni cikmadi. Iki container healthy/restart 0, error-like log sayaci 0;
rollback cifti `53994c4f09a6` olarak hazirdir.
### MANUAL-20260826-EXPLICIT-CREDIT-PRICE-AUTHORITY [P0] Global ve musteri kredi fiyatlarini ayir

Durum: Done (Production deployed and verified)

Fingerprint: `commerce-pricing|global-and-customer-package-custom-authority|single-adjustment-couples-all-credit-products|explicit-final-price-fields-with-atomic-audit`

Sonuc: 10/50/100/250/500 paketlerinin global nihai EUR toplamlari ile global
custom EUR/kredi fiyati birbirinden ayrildi. Musteri politikasinda her paket ve
custom fiyat icin ayri nullable override vardir; bos alan yalniz eslesen global
degeri miras alir. Adminin girdigi EUR degeri nihai odenecek tutardir; KDV,
vergi, ulke, brut/net veya vergi dahil-haric hesabi eklenmedi. Public ve
authenticated quote, Stripe/banka checkout, admin preview ve save akislari ayni
sunucu otoritesini kullanir; stale revision ve eksik/malformed fiyat fail-closed
kalir.

Additive migration mevcut efektif global ve musteri fiyatlarini tam IEEE-754
uyumlu bicimde v2 alanlarina materialize eder. Atomik service-role RPC + audit,
tek yonlu activation gate, legacy-write guard, v2-aware rollback bridge,
SELECT-only guvenlik/continuity verifierleri ve release runbook eklendi. Global
ve musteri admin fiyat alanlari kompaktlastirildi; kredi satin alma ve ana sayfa
paketleri yalniz nihai tutari gosterir, uydurma indirim/karsilastirma kullanmaz.

Kontroller: hedefli pricing/homepage PASS (18/18); `npm run lint` PASS;
`npm run typecheck` PASS; `npm test` PASS (1022/1022); `npm run check:i18n`
PASS (12 locale, 608/608, 0 fallback); `npm run build -- --webpack` PASS
(278/278); `npm run check:performance` PASS (70.1/80 KiB gzip);
`git diff --check` PASS. PostgreSQL 16 sentetik semada migration smoke PASS ve
120.006 legacy kombinasyonda JavaScript parity 0 mismatch; bagimsiz SQL, kod ve
UI review P0/P1 bulmadi.

Production: Exact `bafc6a6aefad` app/analyzer cifti Hostinger VPS'e yayinlandi.
Once isolated staging migration, continuity, aktivasyon, atomik save/stale
conflict ve temizlik kontrolleri gecti. Production etkilenmis tablolar recovery
snapshot'i root-only alindi; additive migration sonrasi 1 global ve 4 musteri
politikasinda continuity mismatch 0 oldu. Canli uygulama smoke'undan sonra v2
write gate exact commit'e tek yonlu baglandi; tum SQL guvenlik alanlari true ve
canli public quote bes paket/custom fiyatla DB'ye birebir eslesti. Iki container
healthy/restart 0, error-like log sayaci 0; gercek odeme, e-posta, musteri
mutasyonu veya fiyat degisikligi yapilmadi.

### MANUAL-20260826-CREDIT-PURCHASE-DENSITY [P1] Kredi satin alma ekranini laptopta kompaktlastir

Durum: Done

Fingerprint: `customer-credits|purchase-page-package-grid-and-payment-selector|oversized-cards-and-delayed-package-choices|compact-wide-first-choice-workspace`

Sonuc: Kredi satin alma alani 1500px genis calisma yuzeyine alindi. Odeme
yontemleri yatay kompakt secime, paketler 1024px laptopta uc ve 1280px ustunde
bes sutuna tasindi; sabit 290/340px kart yukseklikleri kaldirildi. Paket
secimleri kullanim olceginin onune alindi. Loading/error/notice, banka bilgisi,
custom miktar, Stripe ve banka CTA'lari daha kisa ritimde korunurken ana
etkilesimler en az 44px kaldi. Fiyat hesaplamasi ve gostergeleri degismedi.

Kontroller: `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS
(1014/1014); `npm run check:i18n` PASS; `npm run build -- --webpack` PASS
(278/278); hedefli UI + pricing testleri PASS (114/114); `git diff --check`
PASS. Bagimsiz review ACCEPT, P0/P1 yok. Authenticated gercek viewport fixture'i
kullanilmadi; responsive source-contract testleri ve breakpoint incelemesi
390px mobil ile 1024/1280/1366px sinirlarini koruyor.

Kapsam disi olarak fiyat, kredi adedi, indirim/KDV, veritabani, migration,
odeme ayari, canli musteri verisi ve Production deploy degistirilmedi.

### MANUAL-20260825-PORTAL-DENSITY-REFINEMENT [P1] Admin ve musteri panellerini laptopta kompaktlastir

Durum: Done

Fingerprint: `portal-ui|admin-customer-modal-order-desk-and-customer-workspace|oversized-controls-excess-scroll-and-laptop-clipping|compact-readable-full-width-operational-density`

Sonuc: Admin ana workspace, son siparis masasi, tum siparis listesi, musteri
detay penceresi ve siparis detay penceresi laptopta daha fazla is verisini
kesmeden gosteren kompakt responsive duzene tasindi. Dokuz kolonlu tam tablo
yalniz genis ekranda, 1024-1535 araliginda tasmasiz tek satir operasyon gorunumu
kullaniliyor. Musteri shell/sidebar/header/dashboard ile kredi satin alma,
kredi gecmisi, ayarlar ve yeni talep sayfalarindaki tekrar eden buyuk hero,
kart, form ve araliklar desktop-only yogunluk kurallariyla kucultuldu. Mobil
ana etkilesim hedefleri en az 44px, mevcut auth/izin/loading/error/empty state,
kredi/fiyat/odeme, siparis, teslimat, dosya ve mesaj islemleri korundu.

### MANUAL-20260825-VEHICLE-MANUAL-PERFORMANCE-ENTRY [P1] Yeni araci ECU ve manuel Stage kazanciyla tek adimda ekle

Durum: Done (Production deployed and verified)

Fingerprint: `vehicle-catalog|admin-manual-create-and-stage-editor|new-draft-only-captures-one-inactive-stage-and-gains-read-only|complete-safe-ecu-and-three-stage-manual-entry`

Sonuc: Admin yeni arac formu marka/model/nesil/motor ve stock degerleriyle
birlikte ECU family, type, hardware ve software alanlarini kaydeder. Stage 1,
Stage 2 ve Stage 3 ayri ayri etkinlestirilir; her Stage icin after-tuning HP/Nm
veya dogrudan `+HP`/`+Nm` kazanci girilebilir. Kazanc girisi stock degerine gore
after-tuning sonucunu aninda gunceller; sonuc girisi de gorunen kazanci yeniden
hesaplar. Ayni davranis mevcut arac detay editorunde de vardir. Etkin Stage
profili ve hizmet listesi tek kaynaktan gonderilir; kayit unpublished ve
unverified olarak guvenli taslak kalir. Sunucu canonical kazanci stock/tuned
degerlerinden hesaplamayi surdurur; schema veya migration gerekmedi.

Kontroller: Hedefli vehicle-control testleri PASS (47/47); `npm run lint` PASS;
`npm run typecheck` PASS; `npm test` PASS (1012/1012); `npm run build --
--webpack` PASS (278/278); `git diff --check` PASS. Bagimsiz incelemede P0/P1
engel bulunmadi. Yeni dependency, canli DB/katalog/musteri mutasyonu, fiyat,
odeme, e-posta veya env/secret degisikligi yapilmadi.

Production: Exact `53994c4f09a6` app/analyzer cifti Hostinger VPS'e code-only
release olarak yayinlandi. Release-state previous/rollback cifti
`5e6a96b8a4fa` olarak korundu; iki container healthy, restart 0 ve runtime
error-like log sayaci 0. Public/admin boundary ve vehicle/widget smoke kapilari
PASS; migration, canli katalog/musteri verisi veya env degisikligi yapilmadi.

### MANUAL-20260825-VEHICLE-CATALOG-ADMIN [P1] Arac widget katalogunu sade ve Stage 1/2/3 yonetilebilir yap

Durum: Done (Production deployed and verified)

Fingerprint: `vehicle-catalog|admin-editor-and-public-widget|stage3-already-stored-but-admin-and-widget-incomplete|simple-hierarchical-three-stage-management`

Sonuc: Admin arac katalogu tum veri setinde server-side arama, hiyerarsik
filtreleme, sayfalama, yayin/dogrulama ve Stage hazirlik rozetleriyle
sadelestirildi; import, enrichment, coverage, validation ve audit araclari
silinmeden `Advanced tools` altinda toplandi. Arac detayinda marka, model,
nesil, motor, birincil ECU/TCU ve diger hizmetlerle birlikte Stage 1, Stage 2
ve Stage 3 tuned HP/Nm profilleri ayri kartlardan yonetilir. Kazanclar sunucuda
stock/tuned degerlerinden hesaplanir; exact ECU kimligi ve gercek hiyerarsi FK'i
korunur; eski payload, eksik profil ve eski service/profile uyumsuzluklari veri
kaybetmeden ele alinir. React widget, script widget ve enquiry/e-posta akisi
yalniz gercek active+published Stage 3 verisini ayni allowlist ile destekler;
uydurma Stage 3 degeri eklenmedi ve migration gerekmedi.

Kontroller: Hedefli vehicle/widget testleri PASS (60/60); `npm run lint` PASS;
`npm run typecheck` PASS; `npm test` PASS (1011/1011); `npm run build --
--webpack` PASS (278/278); `git diff --check` PASS. Public marka -> model ->
nesil -> motor secimi ile sonuc karti yerel tarayicida calisti; 1366x768 laptop
ve 390x844 mobil viewport'larda yatay overflow yok. Authenticated admin ekranina
yerel staff oturumu olmadigi icin browser dogrulamasi login guvenlik sinirinda
kaldi; derleme, kaynak kontrolleri ve permission testleri bu yolu dogruladi.
Canli migration/veri, gercek musteri/katalog mutasyonu, fiyat, odeme, e-posta,
env/secret veya dependency degisikligi yapilmadi.

Production: Exact `53994c4f09a6` source archive'i hash parity ile Hostinger
VPS'e aktarildi ve immutable app/analyzer release'i healthy tamamlandi. Public
vehicle smoke 102 brand/cache, widget Stage 3 contract smoke ve anonim admin API
401 siniri PASS; rollback `5e6a96b8a4fa` olarak hazir tutuldu.

### MANUAL-20260824-CREDIT-PRICING-STABILITY [P0] Global ve musteri-ozel kredi fiyatini tek otoritede sabitle

Durum: Done (Production deployed and verified)

Fingerprint: `commerce-pricing|global-inheritance-and-customer-fixed-rate|admin-partial-save-race-and-checkout-drift|authoritative-versioned-quote-fail-closed`

Sonuc: Global ve musteri-ozel kredi fiyatlari tek server-side teklif otoritesine
baglandi. Explicit musteri sabit fiyati nihai birim fiyat olarak kalir; policy
satiri olmayan yeni ve mevcut hesaplar en guncel global ayari miras alir.
Admin profil ve fiyat kayitlari ayrildi; gec A/B musteri cevaplari, stale yazma
ve kismi form kaybi engellendi. Homepage, musteri kredi ekrani, Stripe ve banka
havalesi ayni versioned quote'u kullanir; browser tutari kabul edilmez ve
altyapi/stale quote durumlari eski fiyatla odeme acmak yerine fail-closed olur.
Authenticated dogrudan tablo yazma yolunu kapatan additive migration ile
SELECT-only verifier hazirdir; gelecekteki Production release migration'i
uygulamayla birlikte calistirmali ve verifier'in tum sonuclarini true
gormelidir.

Kontroller: `npm run lint` PASS; `npm run typecheck` PASS; `npm run
check:i18n` PASS (11 non-English locale, 608/608); `npm test` PASS
(1005/1005); `npm run build -- --webpack` PASS (277/277); `npm run
check:performance` PASS (70.1 KiB gzip / 80 KiB budget); `git diff --check`
PASS. Bagimsiz final audit GO ve P0/P1 temiz. Yerel browser QA'da 1366x768 ve
390x844 gorunumlerde yatay overflow yok; local fiyat servisi kullanilamazken
stale fiyat yerine erisilebilir hata/retry durumu gorundu. Canli DB mutation,
gercek musteri verisi, fiyat degeri, env/secret veya package/dependency
degismedi. Exact `5e6a96b8a4fa` uygulama/analyzer cifti, reviewed additive
Production migration'i ve all-true verifier kapisiyla Hostinger VPS'e deploy
edildi; rollback cifti `d39ab2c8140e`, iki container healthy ve restart 0.

### MANUAL-20260824-ADMIN-BACK-NAVIGATION-RECOVERY [P1] Admin geri/ileri navigasyonunda eski panel geri yuklenmesin

Durum: Done

Fingerprint: `admin-operations|browser-back-forward-navigation|pre-release-admin-bundle-and-terminal-sync-error-restored|fresh-protected-workspace-on-history-return`

Sonuc: Ortak admin layout artik persisted BFCache restore'u, gercek document
`back_forward` donusunu ve admin alt rotasindan `/admin` kokune browser-history
donusunu ayirt ederek tek sefer temiz reload yapiyor. Ilk dogrudan admin
acilisi, normal Link navigasyonu ve admin child-to-child gecisleri reload
etmiyor; cift reload korumasi ve listener cleanup mevcut. Guard auth sinirinin
disinda yalniz lifecycle recovery uygular; Supabase session/RLS, API, SQL,
musteri verisi ve gorunur UI degismedi.

Kontroller: Hedefli admin navigation/session/sync testleri PASS (21/21);
`npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (991/991);
`npm run build -- --webpack` PASS (277/277); gercek browser Back smoke uc
ardisik tur PASS, terminal sync karti 0 ve console warning/error 0; iki bagimsiz
review P0/P1 temiz; `git diff --check` PASS (yalniz Windows CRLF
bilgilendirmeleri). Yeni dependency, migration, env/secret veya canli veri
islemi yoktur. Exact `d39ab2c8140e` source archive SHA-256 eslesmesiyle
Hostinger VPS Production'a deploy edildi; current app/analyzer cifti
`d39ab2c8140e`, rollback/previous cifti `9e72861c8a19`, iki container healthy ve
restart 0. Public/admin smoke, canli uc turlu Back testi ve bounded log kontrolu
PASS; kritik regresyon gorulmedigi icin rollback uygulanmadi.

### MANUAL-20260824-ADS-CONVERSION-PREDIRECT-HANDOFF [P0] Dönüşümü özel route yönlendirmesinden önce Google kuyruğuna aktar

Durum: Done

Fingerprint: `google-ads|verified-conversion-handoff|script-load-after-private-route-redirect|allowed-route-queue-before-navigation`

Sonuc: Advertising consent verilmiş kayıt, doğrulanmış talep ve doğrulanmış
kredi satın alımı artık dış Google betiğinin yüklenmesini beklemeden standart
gtag/dataLayer kuyruğuna aktarılıyor. Kayıt, talep ve ödeme başarı yüzeyleri
yalnız yerel SHA-256/persistence/queue adımını fail-soft bekleyip sonra özel
dashboard rotasına geçiyor; ödeme başarı bağlantıları da bu adımdan önce
açılmıyor. GA4 ve Ads olayları sabit, query içermeyen canonical URL ile boş
referrer kullanıyor; callback code, Stripe session ID, müşteri, sipariş, araç ve
dosya verisi payload veya outbox'a girmiyor. Consent revoke, private-route pause,
retry, dedupe, provider throw ve senkron callback davranışları korunuyor.

Kontroller: Hedefli auth/analytics/Ads testleri PASS (34/34); `npm run lint`
PASS; `npm run typecheck` PASS; `npm test` PASS (981/981); `npm run build --
--webpack` PASS (277/277); bağımsız privacy/release review GO; `git diff
--check` PASS (yalnız Windows CRLF bilgilendirmeleri). DB/migration, package,
env/secret, Ads hesabı/bütçesi, payment doğrulaması, e-posta veya müşteri verisi
değişmedi. Exact `8f0f4b8ce6d8` source archive SHA-256 eşleşmesiyle Hostinger
VPS Production'a deploy edildi; app/analyzer healthy, restart 0, smoke PASS ve
rollback çifti `512921b18659` olarak korundu.

### MANUAL-20260824-ADS-MEASUREMENT-FUNNEL [P1] Google Ads olcum ve musteri edinim sistemini guvenilir hale getir

Durum: Done

Fingerprint: `google-ads-measurement|consent-queue-auth-intent-b2b-landing|verified-site-outcomes-zero-ads-receipts|retry-safe-client-handoff-and-account-cleanup`

Sonuc: Google Ads registration, verified file request ve verified credit
purchase sinyalleri consent-aware, PII icermeyen bounded outbox ve retry-safe
Google tag yukleme akisi ile guvenilir hale getirildi. Auth redirect niyeti,
register fail-soft bootstrap, workshop landing niteligi, VPS measurement env
contract ve admin Ads truthfulness ayni release'te tamamlandi.

Canli Ads: Search-only, presence targeting, EUR 5/gun ve paused PMax korundu.
Sekiz dar negatif kaydedildi; liste 32'den 40'a cikti. Verified credit purchase
Primary/Every; verified file request ve registration Secondary/One olarak
dogrulandi. Billing, butce, reklam metni veya payment ayari degismedi.

Production: Exact `512921b18659` code-only archive SHA-256 ile VPS'te
dogrulandi ve Hostinger Production'a healthy olarak deploy edildi. Current
release `512921b18659`, rollback/previous `bc1e7d7`; iki container healthy,
restart 0 ve host port publish yok. Public/admin smoke PASS, ana mgautotech.de
200 ve son 10 dakika error-like log sayaclari 0.

Olcum kaniti: Production Tag Assistant iki tag buldu (`G-PX085CX6M0` ve
`AW-18379047445`). Consent Default ad/analytics/ad-user-data/personalization
Denied; izin sonrasi ad, analytics ve ad-user-data Granted, personalization
Denied. Google Ads config Page View hit'i `AW-18379047445` hedefiyle goruldu.

Dogrulama: `npm run lint`, `npm run typecheck`, `npm test` (979/979), hedefli
testler (72/72), `npm run check:i18n`, `npm run build -- --webpack` (277/277),
`npm run check:performance`, diff check, responsive Chrome QA, VPS env
preflight, Production smoke ve Tag Assistant PASS.

### MANUAL-20260824-CUSTOMER-PORTAL-BLACK-PALETTE [P1] Musteri portalini public/auth siyah paletine hizala

Durum: Done

Fingerprint: `customer-experience|authenticated-portal-palette|blue-gray-surfaces-drift-from-public-auth-black|shared-black-graphite-theme-with-preserved-layout`

Sonuc: Mevcut customer portal layoutu ve tum islevleri korunurken merkezi
`--mg-portal-*` tokenlariyla canvas `#050505`, sidebar `#090909`, siyah-grafit
header, auth benzeri yari saydam kartlar, `#111111` kontroller ve beyaz/10
border ailesine tasindi. Dashboard, orders/detail/chat, credits/history,
settings, File Expert, Datalog Studio, Vehicle Widget ve new-request ayni renk
dilini kullaniyor. Eski mavi-gri workspace ailesi kaldirildi; MG AutoTech
`#b1121b` CTA tonu ile mavi/amber/yesil operasyon durumlari korundu.

Dogrulama: hedefli UI safety testi PASS (99/99); `npm run lint` PASS; `npm run
typecheck` PASS; `npm test` PASS (968/968); `npm run check:i18n` PASS (11
non-English locale, 603/603); `npm run build -- --webpack` PASS (277/277 static
pages); `git diff --check` PASS. Bagimsiz diff incelemesindeki welcome gradient
ve test kapsami bulgulari giderildi; tekrar inceleme blocking bulgu vermedi.

Kapsam disi: Production deploy/push, SQL/migration, Production DB, env/secret,
payment, e-posta, auth veya gercek musteri verisi islemi yapilmadi.

### MANUAL-20260824-CUSTOMER-WORKSPACE-UNIFICATION [P1] Musteri sayfalarini tek portal tasariminda birlestir

Durum: Done

Fingerprint: `customer-experience|authenticated-portal-routes|dashboard-and-destinations-use-conflicting-shells|shared-workspace-chrome-with-preserved-functions`

Sonuc: `/dashboard` ve `/new-request` altindaki authenticated customer
sayfalari tek `CustomerPortalFrame`, ortak desktop sidebar, ayni rota
kaynagindan uretilen mobil nav ve ortak compact page header kullaniyor. Orders,
File Expert, Datalog Studio, Vehicle Widget, credits/history, notifications,
settings ve new-request icindeki legacy ikinci sidebar/logo/header kopyalari
kaldirildi; mevcut form, upload, checkout, realtime, indirme, chat, analiz ve
yonlendirme davranislari korundu. Aktif mobil hedef yatay eksende otomatik
gorunur, Support mobilde de erisilebilir ve dashboard/order-detail kendi scroll
alanini kullanirken diger rotalar ortak scroll sahibini kullaniyor.

Dogrulama: `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS
(967/967); `npm run check:i18n` PASS (11 dilde 603/603); `npm run build --
--webpack` PASS (277/277 static pages); `git diff --check` PASS. Authenticated
local route dogru auth sinirinda login gerektirdigi icin gercek hesapla lokal
icerik QA yapilmadi; 1366x768 canli referans salt-okunur incelendi, responsive
ve accessibility sozlesmeleri source/test/build ile dogrulandi.

Kapsam disi: Production deploy, push, SQL/migration, Production DB,
env/secret, payment, e-posta veya gercek musteri verisi degisikligi yapilmadi.

### MANUAL-20260824-CUSTOMER-WORKSPACE-BRAND-TONE [P1] Yeni musteri workspace kirmizi tonunu mevcut portalla esitle

Durum: Done

Fingerprint: `customer-experience|customer-workspace-brand-tone|new-sidebar-and-order-shell-red-drift|existing-portal-red-token-alignment`

Sonuc: Yeni customer workspace'te aktif sidebar secimi kahve/bordo `#2d1719`
tonundan cikti ve mevcut portal brand ailesiyle uyumlu `rgba(177,18,27,...)`
surface/border kullaniyor. Order-detail background accent'i de
`rgba(177,18,27,0.25)` ile login/register ve mevcut customer portal CTA
kirmizisi `#b1121b` / `#c91824` ailesine hizalandi. Veri, auth, route, odeme,
layout davranisi, package/lockfile, DB/migration, env/secret veya customer data
akisi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts`
PASS (97/97); `npm run lint` PASS; `npm run typecheck` PASS; `npm run build
-- --webpack` PASS (277/277 static pages); `git diff --check` PASS (yalniz CRLF
uyarilari).

### MANUAL-20260823-CUSTOMER-WORKSPACE-CAREFILE-DENSITY [P1] Musteri paneli ve siparis detayini ferah calisma alanina yaklastir

Durum: Done

Fingerprint: `customer-experience|dashboard-and-order-detail-laptop-density|zoomed-workspace-and-detached-order-page|carecufile-informed-sidebar-balance-and-single-scroll`

Sonuc: Dashboard ve siparis detayi ortak customer sidebar bilesenine tasindi; masaustu sol altta guncel kredi bakiyesi ve `/dashboard/credits` kredi alma CTA'si sabit gorunur. Siparis detayi eski detached/uc-dar-sutun ve 640px zorlamasindan cikarilip laptop/PC'de tek ana scroll, genis is emri alani ve sticky chat paneli kullanan daha ferah workspace'e donustu. Download, source file indirme gorunurlugu, additional upload, revision, DTC, delivery history, chat, auth ve realtime yenileme akislari korundu. CarecuFile yalniz density/layout referansi olarak kullanildi; baska markaya ait metin, veri veya ticari iddia kopyalanmadi.

Dogrulama: targeted dashboard/order tests PASS; full test suite PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm run check:i18n` PASS; `npm run check:performance` PASS (68.2 KB gzip / 80 KB); `npm run build -- --webpack` PASS (277/277 static pages); `git diff --check` PASS (yalniz CRLF uyarilari). Yeni dependency, SQL/migration, env/secret, odeme ayari, production servis veya musteri verisi mutasyonu yoktur.

### MANUAL-20260823-CUSTOMER-DASHBOARD-BRAND-RED [P1] Dashboard vurgu rengini MG AutoTech kirmizisina geri al

Durum: Done

Fingerprint: `customer-experience|customer-dashboard-brand-color|reference-orange-accent|mg-autotech-red-accent`

Sonuc: Referans layout ve tum dashboard davranislari korunurken buton, banner,
logo, aktif navigasyon, focus ring, kredi ve request accent yuzeyleri MG AutoTech
ana kirmizisi `#b1121b` ve hover kirmizisi `#c91824` paletine cevrildi. Mavi,
amber ve yesil operasyon durumlari semantik anlamlariyla korundu. Primary
yuzeylerde beyaz/kirmizi kontrasti 7.07:1'dir; render edilen dashboard'da turuncu
brand token kalmadi.

Dogrulama: hedefli dashboard 8/8 PASS; scoped ESLint PASS; `git diff --check`
PASS; sentetik local browser 639x496'da sifir yatay tasma, exact red computed
color, sifir turuncu literal ve sifir yeni console error ile PASS. Veri, auth,
route, layout, package/lockfile, env, DB veya deploy degisikligi yoktur.

### MANUAL-20260823-CUSTOMER-DASHBOARD-REFERENCE-LAYOUT [P1] Musteri dashboard'unu owner referans duzenine uyarla

Durum: Done

Fingerprint: `customer-experience|customer-dashboard-home|owner-reference-layout|sidebar-toolbar-kpi-recent-orders-ledger-first-fold`

Sonuc: Dashboard owner referansindaki sabit sol navigasyon, kompakt ust kontrol
cubugu, welcome/CTA, dort KPI ve masaustunde yan yana recent requests/gercek
credit ledger hiyerarsisine uyarlandi. Son bes talep, needs-response onceligi,
profil/kredi/aktif-is next-action mantigi, order aksiyonlari, Customer ID,
quick actions, workflow, tum musteri rotalari, auth, Supabase/realtime ve
loading/error/empty davranislari korundu. Referanstaki baska isletmeye ait
calisma saati veya servis iddiasi kopyalanmadi; e-posta aksiyonu yalniz Support
olarak adlandirildi. Brand CTA ve kucuk metin kontrasti, bildirim accessible
name'i ve saniyelik saat render kapsami final review sonrasinda duzeltildi.

Dogrulama: hedefli dashboard 8/8 PASS; seri full test 965/965 PASS; ESLint PASS;
web + customer-uploader TypeScript PASS; public i18n/SEO 12 dil ve customer i18n
11 dilde 607/607 PASS; Webpack Production build 277/277 PASS; performans 68.2 KB
gzip / 80 KB butce PASS. Sentetik browser QA 1366x768, 1024x768, 390x844 ve
son 639x496 gorunumlerinde yatay tasma olmadan PASS; final reload'da yeni console
error yok; bagimsiz final review P0/P1/P2 temiz. Paket/lockfile, SQL/migration,
env/secret, push veya Production deploy degisikligi yapilmadi.

### MANUAL-20260823-CUSTOMER-DASHBOARD-EFFERD-SHELL [P1] Mevcut musteri dashboard'unu Efferd operating UI diline uyarla

Durum: Done

Fingerprint: `customer-experience|customer-dashboard-visual-shell|rounded-promotional-panels-and-mixed-density|efferd-inspired-dense-operating-workspace`

Sonuc: `/dashboard`, `EfferdDashboard2 -> AppShell -> Dashboard ->
DashboardClient` zinciriyle shadcn uyumlu `src/components/ui` girisine
tasindi. Canli veri/auth/realtime/loading/error/empty akislari degismeden sabit
desktop sidebar/topbar, yalniz ana yuzeyde scroll, yogun siparis listesi, 2x2
KPI gridi, ince sinirlar ve dusuk radius'lu Efferd-inspired operating UI
uygulandi. Onceki 17 sabit/dinamik hedefin 17'si, son bes siparis, baglamsal
aksiyonlar, workflow, kredi, destek ve mobil nav korundu. Kullanilmayan demo,
stock asset, Recharts/Radix veya yeni production dependency eklenmedi.

Dogrulama: hedefli dashboard/UI 99/99 PASS; full test 965/965 PASS; full ESLint
PASS; web + customer-uploader TypeScript PASS; public i18n/SEO 12 dil ve
customer i18n 11 dilde 595/595 PASS; Webpack Production build 277/277 PASS;
performans 68.2 KB gzip / 80 KB butce PASS; diff check PASS. Static responsive,
scroll ve erisilebilir disclosure incelemesinde ve bagimsiz final review'da
P0/P1 bulgu yok. Paket/lockfile, DB, migration, env/secret, push, Preview veya
Production degisikligi yapilmadi; oturumlu browser smoke yayinlanmis artifact
icin owner yayin talimatinda yapilacak.

### MANUAL-20260823-CUSTOMER-DASHBOARD-STATUS-FIRST [P1] Laptop dashboard'u siparis odakli sadelestir

Durum: Done

Fingerprint: `customer-experience|customer-dashboard-first-fold|recent-orders-buried-behind-promotional-workflow|status-first-compact-laptop-home`

Kapsam: Mevcut veri ve guvenlik akisini koruyarak laptop ilk gorunumunu son
talepler, siparis durumu ve tek oncelikli aksiyon etrafinda yeniden sirala.
Buyuk welcome/workflow/reference/metric tekrarlarini kompakt veya ikincil alana
tasi; loading, error, empty, mobile ve erisilebilirlik davranislarini koru.

Sonuc: Son bes talep ve musteriye acik durumlari dashboard'un ilk calisma
alanina tasindi. 1180 px laptop breakpoint'inde talep listesi ile oncelikli
aksiyon/sayaclar yan yana, daha dar ekranda talep listesi ilk sirada tam
genislikte kalir. Tekrarlanan tanitim/CTA bloklari kaldirildi; araclar, workflow
ve kredi gecmisi klavye erisimli disclosure alanlarina alindi. Musteri cevabi
profil tamamlamadan once onceliklenir; revision ve delivery durumlari ayrik
gosterilir. Gecersiz Customer ID artik sahte banka referansina donusmez ve son
talep sorgusu yalniz gorunen alanlari getirir.

Dogrulama: Chrome canli baseline 1265x529'da Recent Requests'in 2056 px asagida
oldugunu dogruladi; hedefli dashboard/performance 98/98 PASS; full test 964/964
PASS; ESLint PASS; web + customer-uploader TypeScript PASS; customer i18n 11
dilde 595/595 PASS; Webpack Production build 277/277 PASS; diff check PASS.
Production release `9b75a5b` PASS; rollback cifti `b82617a`. Oturumlu Chrome
smoke 1265x529, 1024x768 ve 390x844 gorunumlerinde PASS; yatay tasma, session
spinner veya console hatasi yok.

### MANUAL-20260823-AUTH-SESSION-INCIDENT [P0] Bound Production auth bootstrap waits

Durum: Done

Fingerprint: `production-auth|browser-session-bootstrap|unbounded-supabase-and-device-assurance-waits|bounded-fail-closed-recovery`

Sonuc: Basarili parola/Google/OAuth oturumu browser-memory snapshot'a hemen
aktariliyor; Supabase session bootstrap, account-context ve device-assurance
istekleri bounded. Cached session dahil protected-route watchdog her zaman
calisiyor; timeout guvenlik kapisini gevsetmeden retry/unavailable ekranina
geciyor. Production `b82617a` olarak yayinlandi, `1a5b46a` rollback cifti
korundu ve gercek oturumlu Chrome'da iki temiz dashboard yenilemesi gecti.

### MANUAL-20260823-VPS-FILE-SERVICE-PACKAGING [P0] File Service bağımsız VPS stack paketi

Durum: Done

Fingerprint: `hosting|vercel-commercial-blocker|existing-caddy-kvm1|hardened-standalone-app-analyzer-stack`

Sonuc: Next standalone ve tek-worker File Expert analyzer, host portu
yayinlamayan Production Compose stack'inde birlestirildi. App exact external
Caddy edge agi ile outbound backend agina; analyzer yalniz backend agina
baglanir. Ayri root-owned env dosyalari, non-root/read-only container sinirlari,
dusuk CPU shares + hard resource cap, process-local health, uc release'lik
hashed static asset union'u ve release-bazli ephemeral Next cache'i korunur.
Env preflight deger yazdirmadan proxy/analyzer/core Production sozlesmesini
dogrular; analyzer-first deploy ve rollback scriptleri clean-Git, health ve
idempotency kapilarini uygular. Docker/VPS/Caddy/DB/env/push/deploy mutation
yapilmadi.

Dogrulama: Paketleme/recovery testleri 14/14, full repository 949/949 ve Python
execution/network 6/6 PASS; Bash syntax ve Compose YAML parse PASS; full ESLint,
web + desktop TypeScript, i18n ve performans kapilari PASS; Webpack Production
standalone build 277/277 PASS. Build manifest 302 static dosya ve build-ID match;
standalone localhost readiness smoke 200 + minimal no-store/noindex JSON PASS;
iki bagimsiz review sonrasinda acik P0/P1 kalmadi. `git diff --check` yalniz
line-ending uyarilari verdi.

### MANUAL-20260820-PRODUCTION-AUTHORITY-EMERGENCY [P0] Production authority and finance containment

Durum: Done

Fingerprint: `production-security|signup-metadata-admin-and-direct-finance-authority|live-catalog-confirmed|pinned-emergency-containment`

Sonuc: Frozen emergency migration current-Production ve post-02454 staging
sekillerinde rollback prova edildi; iki prova ve exact verifier 21/21 PASS oldu.
Migration Production'a `current_production_authority_emergency_hardening`
adiyla hosted version `20260821002453` olarak bir kez uygulandi. Post-apply
verifier 21/21, aggregate normal-operation kapisi ve immediate public/auth-deny
smoke PASS; app/hosting degismedi ve musteri, kredi, siparis, odeme, dosya veya
e-posta verisi mutasyona ugramadi.

### MANUAL-20260823-ADAPTIVE-CUSTOMER-DEVICE-VERIFICATION [P1] Tanınmayan cihazda müşteri e-posta doğrulaması

Durum: Done

Fingerprint: `auth-security|customer-password-login|unknown-device-session-accepted-without-step-up|server-enforced-email-device-verification`

Sonuc: Müşteri parola/Google girişinden sonra yeni veya güvenilmeyen tarayıcı,
10 dakika geçerli ve 5 denemeli tek kullanımlık e-posta koduyla doğrulanır.
İsteğe bağlı 30 günlük güven HttpOnly/Secure/host-only cookie'de; sunucuda yalnız
HMAC olarak tutulur ve ham token API JSON cevabına girmez. Müşteri cihaz listesini
görüp tek cihazı veya diğer cihazları iptal edebilir. Parola değişimi her zaman
15 dakika içinde taze e-posta kodu ister ve tüm cihaz güvenini iptal eder.

Pending/revoked müşteri oturumları API, Data API, korumalı Storage ve sipariş
RPC'lerinde migration/RLS/ACL katmanıyla fail-closed kalır; shadow, legacy grace,
trusted-cookie ve eşzamanlı challenge kenarları kapatıldı. IP yalnız rate-limit
sinyalidir; ham IP/parmak izi tutulmaz. Google bootstrap son kayıt penceresiyle
sınırlı, desteklenmeyen desktop 428 ile kapalı ve güçlü müşteri parola kuralı
12-128 karaktere yükseltildi.

Dogrulama: Hedef güvenlik paketi 12/12 PASS; full suite 806/806 PASS; full ESLint
PASS; web ve customer-uploader üç TypeScript projesi PASS; public 12 locale ve
customer 11 locale x 637/637 PASS; Production Next build 275/275 PASS; homepage
performans 66.4 KB gzip / 80 KB PASS; bağımsız SQL ve TS/API/UI review P0=0/P1=0;
`git diff --check` PASS. Migration yalnız statik incelendi, shadow-first ve canlıya
uygulanmadı; secret, gerçek e-posta/müşteri, Supabase/Vercel, push veya deploy
mutation yapılmadı. Production activation için isolated staging SQL/E2E provası,
Secure Password Change/Auth-layer kontrolü ve desktop disable/min-version kapısı
zorunludur; bu custom kontrol native MFA/AAL2 değildir.
### MANUAL-20260822-GROWTH-CLASSIFICATION-SIMPLE-SAVE [P1] Growth müşteri tipi akışını sadeleştir

Durum: Done

Fingerprint: `admin-growth|customer-classification|mandatory-evidence-note-busywork|one-selection-standardized-audit-save`

Sonuc: Growth & Customer Success Center icinde admin artik yalniz musteri tipini
secer ve degisiklikleri kaydeder; evidence/reason yazma zorunlulugu, not alani,
evidence-gap sayaci ve ilgili uyarilar kaldirildi. Audit kaydi istemciden gelen
serbest metne guvenmeden sunucuda deterministik uretilir. `customers.manage`,
service-role RPC, actor kaydi, atomik batch, optimistic concurrency ve 100
degisiklik siniri korundu. Mobil/tablet kartlari yatay kaymadan calisir; kaydetme
sirasinda secimler kilitlenir ve kaydedilmemis degisiklikler sayfa gecisinde
uyarilir. Veritabani semasi ve canli veri degismedi.

Dogrulama: hedef Growth paketi 34/34 PASS; full suite 794/794 PASS; web ve
customer-uploader TypeScript PASS; ESLint PASS; Production Next webpack build
271/271 PASS; responsive/erisilebilirlik ve bagimsiz review P0/P1=0; `git diff
--check` yalniz CRLF uyarilari. Korunan admin route'u yerel browser'da staff
login kapisina kadar hatasiz yuklendi; push, deploy veya canli servis mutation
yapilmadi.

### MANUAL-20260822-ADAPTIVE-AUTH-TURNSTILE [P1] Bes hatadan sonra gorunur Turnstile

Durum: Done

Fingerprint: `auth-security|shared-password-login|always-visible-captcha-friction|managed-interaction-only-with-five-failure-escalation`

Sonuc: Shared web password logininde Cloudflare Managed Turnstile ilk durumda
`interaction-only` calisir; normal ziyaretci icin bos CAPTCHA karti ayirmaz,
Cloudflare risk gorurse daha erken challenge gosterebilir. Ayni browser origininde
ilk hatadan baslayan sabit 15 dakikada bes `invalid_credentials` sonucu widget'i
`always` moduna gecirir. PII/token icermeyen sayac sekmeler arasinda senkronize,
sure dolumunda ve basarili giriste temiz; network/provider/e-mail-confirmation
hatalari sayilmaz. Besinci hatada accessible alert + fokus challenge'i aciklar.
Register/recovery/desktop varsayilan gorunur davranisi ve her-denemede tek
kullanimli Supabase `captchaToken` yenilemesi korunur.

Dogrulama: hedef CAPTCHA paketi 15/15 PASS; full suite 794/794 PASS; web ve
customer-uploader TypeScript PASS; full ESLint PASS; customer i18n 11 locale x
613/613 ve public i18n/SEO 12 locale PASS; Production Next build 271/271 PASS;
CAPTCHA readiness default safe-off PASS; bagimsiz review P0/P1=0; `git diff
--check` yalniz CRLF uyarilari. Remote Supabase CAPTCHA halen OFF; Cloudflare,
Vercel, session, secret, push veya deploy mutation yapilmadi.

### MANUAL-20260821-AUTH-CAPTCHA-ROLLOUT [P1] Web ve desktop Auth CAPTCHA hazirligi

Durum: Done

Fingerprint: `auth-security|supabase-password-flows|project-wide-captcha-breaks-file-electron-client|hosted-turnstile-state-bound-handoff-and-release-gate`

Sonuc: Web login, kayit, verification resend ve recovery request akislari
Cloudflare Turnstile tokenini Supabase `captchaToken` sozlesmesiyle gonderecek
sekilde configuration-ready. Windows uploader `0.2.1`, Turnstile'in
desteklemedigi `file://` yerine canonical HTTPS challenge sayfasini sandbox
BrowserWindow'da acar; exact renderer/mainFrame/origin/path, one-use random
state, 2048 token siniri, 270 saniye timeout, navigation/permission deny ve
listener cleanup ile tokeni desktop password loginine tasir. Env yoksa onceki
login davranisi korunur; explicit required ama eksik config fail-closed kalir.
Production remote toggle; 0.2.1 signed release, minimum-version enforcement,
hostname/provider config, staging E2E ve readiness receiptleri tamamlanmadan
acilamaz. Strict password 10-attempt siniri uydurulmadi: Supabase password token
limiti 1800/saat ve burst 30 olarak sabittir; 10/5 dakika dashboard siniri
signup/resend/magic-link/OTP icin faydalidir.

Dogrulama: CAPTCHA/uploader/header hedefli paket 40/40 PASS; full test 788/788
PASS; web ve uploader renderer/electron/node TypeScript PASS; full ESLint PASS;
Production Next build PASS (271 static page); auth CAPTCHA schema-only/default
safe-off gate PASS; `git diff --check` PASS (yalniz CRLF uyarilari). Remote
Supabase/Cloudflare/Vercel mutation, secret okuma/loglama, push veya deploy
yapilmadi.

### MANUAL-20260820-SOURCE-DOWNLOAD-ACTIVITY [P1] Customer source-file download activity

Durum: Done

Fingerprint: `admin-work-order|customer-source-files|missing-owner-download-surface-and-activity|tenant-bound-secure-link-request-metrics`

Sonuc: Orijinal ve ek müşteri uploadları müşteri order ekranından exact
tenant/request-bound kimlikle yeniden indirilebilir. Admin canonical Files &
delivery görünümü her source/delivery dosyasında müşteri portal link talebi
sayısı, son talep ve requested/not-requested durumunu gösterir. Staff indirmesi
müşteri metriğine girmez; body ve distributed rate-limit fail-closed, audit
private ve storage path/hash içermez. UI bunun byte-complete transfer değil,
güvenli geçici link talebi olduğunu açıkça söyler. Yeni müşteri metinleri 11
locale için mevcut translation sistemine eklendi.

Dogrulama: Download/file-label testleri 18/18 PASS; birleşik ilgili testler
163/163 PASS; customer i18n 11 locale x 612/612 PASS; web+uploader typecheck,
full ESLint ve `git diff --check` PASS. Authenticated Preview/Chrome smoke,
canonical DB/app release sırasından sonra ayrı yayın kapısı olarak kalır.
### MANUAL-20260822-LOG-STUDIO-PRODUCTION-RELEASE [P0] Log Analysis Studio Production release

Durum: Done

Fingerprint: `release|log-analysis-studio|validated-code-awaiting-production|ready-current-and-smoke-verified`

Sonuc: `3c4b931` tek commit olarak `main` dalina non-force fast-forward pushlandi. Vercel deployment `L8ooNmegzzz7oqgNRvffqWqLxVaH` `Ready`, `Production`, `Current` oldu ve `file.mgautotech.de` domainine atandi. Public Basic demo, sabit login/register, anonim Studio auth guard'i ve yetkili Studio demo/grafik/tab/mobile akislarinin tamami canlida dogrulandi. Kritik rollback hedefi onceki current `2n47rqK99TEPrmKJGCq8TM2aqhSX` / `70afff4` olarak sabitlendi.

Dogrulama: Hedefli testler 34/34 PASS; lint PASS; web+desktop typecheck PASS; Webpack Production build 271/271 PASS; non-mutating public smoke PASS; izole auth ve Studio browser smoke sifir page overflow/console warning/error ile PASS. SQL/migration, env, payment, e-posta, customer-data veya gercek log islemi yoktur.

### MANUAL-20260822-LOG-ANALYSIS-STUDIO [P0] Public Basic ve customer Log Analysis Studio

Durum: Done

Fingerprint: `performance-analysis|public-basic-and-customer-studio|complex-single-surface-and-flat-auth-background|local-multichannel-professional-workspaces`

Sonuc: Login ve register sayfalari ortak, sabit ve erisilebilir premium arka planla guncellendi. Ana sayfadaki karmasik AutoTuner bolumu yerel dosya isleyen sade bir Basic Log Snapshot akisi oldu. Authenticated customer dashboard'a yeni sidebar/mobile nav girisiyle profesyonel Log Analysis Studio eklendi: CSV/TSV/TXT kanal tespiti, kalite ozeti, en fazla uc normalize kanal karsilastirmasi, satir inceleyici, kanal/veri tablolari, guvenli ve kanita bagli yorumlar, local vehicle context, kopyalanabilir ozet ve yalnizca uygun gercek baslikli RPM/Nm loglarinda local checklist/SVG rapor saglar. Dosyalar tarayicidan cikmaz; uygulama dyno sonucu, ariza teshisi, tuning onayi, flash guvenligi veya kesin kazanc iddiasi uretmez.

Dogrulama: Hedefli log/public/auth/session testleri PASS; `npm run lint` PASS; `npm run typecheck` PASS (web + desktop); `npm run build -- --webpack` PASS (271 static page); `npm run check:i18n` PASS (11 non-English locale, 592/592 ve 0 English fallback); Chrome QA 390x844, 768x1024 ve 1440x900 boyutlarinda responsive/overflow, bos-yukleniyor-hata-hazir durumlari, klavye tab gezinimi, sentetik demo ve sifir layout animasyonu ile PASS; `git diff --check` PASS. Full suite 712/734; kalan 22 failure ayni onceden kayitli homepage `ui-ux-safety` kaynak-kontrat baseline'idir ve yeni/hedefli testler gecmistir.

Sinirlar: Yeni dependency, SQL/migration, API/storage/persistence, env/secret okuma, Production Supabase/customer/payment/e-posta islemi, push veya deploy yapilmadi. Chrome native file chooser otomasyonu eklentinin file URL izni olmadigi icin calistirilamadi; parser unit testleri ve tarayici icindeki sentetik dosya akisi ayri ayri dogrulandi.

### MANUAL-20260822-LOGIN-LAYOUT-STABILITY [P0] Login Google butonu layout dongusu hotfix

Durum: Done

Fingerprint: `customer-auth|google-identity-button|self-triggering-resize-render-loop|stable-single-render-login-card`

Sonuc: Canli login sayfasinda Google Identity Services butonunun kendi degistirdigi container'i `ResizeObserver` ile izleyip iframe'i tekrar tekrar silerek olusturmasi durduruldu. Observer sabit wrapper'a tasindi; ayni genislikte yeniden render engellendi; ilk render/reset davranisi korundu ve Google alani 48px sabit yukseklige alindi. Hotfix `3417e68` commit'iyle Production'a yayinlandi.

Dogrulama: Hotfix oncesi canli 50-ornek/~5s olcumde 46 farkli Google iframe kimligi, 48-81.33px Google alani ve 696.67-730px kart yuksekligi goruldu. Production hotfix sonrasi ayni olcumde tek iframe kimligi, 48px Google alani ve 696.67px sabit kart yuksekligi PASS; console warning/error yok. Hedefli login testi 8/8, auth/CAPTCHA/register/session paketi 34/34, lint, web+customer-uploader typecheck, Webpack production build (270/270) ve diff check PASS. Full suite 686/708; kalan 22 failure ayni ilgisiz homepage `ui-ux-safety` baseline'idir. SQL/migration, env/secret, CAPTCHA ayari, payment veya customer-data degisikligi yoktur.

### MANUAL-20260822-PREMIUM-LOGIN-AUTH-PARITY [P1] Premium login ve kayit CAPTCHA esligi

Durum: Done

Fingerprint: `customer-auth|login-register|split-screen-and-production-captcha-opt-out|premium-single-card-fail-closed-auth`

Sonuc: Login sayfasindaki agir iki sutunlu tanitim duzeni, register tasarim diliyle uyumlu 560px ortalanmis premium tek karta cevrildi. Tek H1, acik label/name/autocomplete alanlari, 48px ana kontroller, klavye focus state'leri ve basari/hata live-region ayrimi eklendi. Mevcut adaptive 5-basarisiz-parola CAPTCHA gorunurluk esigi, Supabase `captchaToken`, yonlendirme ve hata sayaci korunurken login ve register Google akislari resmi Google Identity Services butonu + nonce bagli `signInWithIdToken` + Turnstile tokenina tasindi; iki UI'da da `signInWithOAuth` kaldirildi. Register e-posta sign-up/resend `auth_register`, Google kaydi `auth_register_google`, login parola/Google yolu `auth_login` tokenini kullanir. Google script timeout/error retry, stale callback engeli, senkron request lock, storage-error cleanup, dar ekranda compact/flexible Turnstile ve register step focus/`aria-current` eklendi. Production CAPTCHA/test-key bypass'i ve eksik/gecersiz Google client ID fail-closed olur.

Dogrulama: Auth/CAPTCHA/register/login/security hedefli testler PASS (39/39); `npm run lint` PASS; `npm run typecheck` PASS (web + desktop); `npm run build -- --webpack` PASS (270 route/page entry); `npm run check:i18n` PASS (12 locale, 589/589 ve 0 English fallback); `git diff --check` PASS. In-app Browser QA 320, 360, 375, 390 ve 1280px genisliklerde sifir yatay tasma, tek H1, resmi 40px Google butonu, step focus/`aria-current` ve sifir console error/warning ile PASS. Full suite 686/708; kalan ayni 22 ana dal `ui-ux-safety` kaynak-kontrat baseline failure'idir. Release gate hosted Supabase CAPTCHA aktivasyonu ve missing/invalid-token reddi, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` ile Supabase provider Web Client ID esitligi, Production JS origin, tum aktif Google Web client'larindan `https://jujaeyvyaeesmipihrrw.supabase.co/auth/v1/callback` (ve varsa custom Auth domain esdegeri) URI'sinin kaldirilmasi ve dogrudan `/authorize` negatif smoke ister. Yeni dependency, SQL/migration, env/secret, Production data, push veya deploy yoktur.

### MANUAL-20260822-REGISTER-PHONE-COUNTRY-CODE [P1] Auto-detect an editable calling code during registration

Durum: Done

Fingerprint: `customer-registration|phone-country-code|fixed-germany-placeholder|detected-editable-flag-and-calling-code`

Sonuc: Kayit formundaki sabit Almanya ornekli telefon alani, mevcut ulke tespitiyle baslayan ve musteri tarafindan bagimsiz degistirilebilen native calling-code secicisine cevrildi. 243 operasyonel bolge dogrulanmis ulke kodu, Unicode bayragi ve localized ulke adiyla listelenir; ayri bir telefon plani bulunmayan 7 katalog bolgesine kod uydurulmaz. Tespit edilen `US` `+1`, `DE` `+49`, `TR` `+90` ile baslar. Manuel telefon ulkesi secimi gec tespit veya profil ulkesi degisikligiyle ezilmez. Telefon opsiyonel kalir, bos kod kaydedilmez ve e-posta/Google kayit yollarinin ikisi de ayni `+` ile baslayan formatlanmis degeri kullanir.

Dogrulama: register/country/profile hedefli testleri PASS (23/23); `npm run lint` PASS; `npm run typecheck` PASS (web + desktop); `npm run build -- --webpack` PASS (270 route/page entry); `npm run check:i18n` PASS (12 locale, 596/596 ve 0 English fallback). Chrome QA 390x844, 768x1024 ve 1280x720 boyutlarinda 44px kontroller, sifir yatay tasma, profil ulkesinden `+90` senkronu, manuel `+1` seciminin korunmasi ve sifir console warning/error ile PASS. Local header smoke `US` -> `{countryCode:"US"}` PASS. Full suite 678/700 PASS; kalan ayni 22 ana dal `ui-ux-safety` kaynak-kontrat baseline failure'idir. Yeni dependency, SQL/migration, env/secret, Production data, push veya deploy yoktur.

### MANUAL-20260822-REGISTER-SIMPLIFICATION [P1] Focus registration on one clear form card

Durum: Done

Fingerprint: `customer-registration|register-layout|redundant-left-marketing-column|centered-single-card-form`

Sonuc: Kayit sayfasindaki formu tekrar eden masaustu tanitim sutunu, uc ozellik
karti ve durum etiketi kaldirildi. Kayit akisi 760px genisliginde ortalanmis tek
bir karta toplandi; kart icine kompakt marka basligi ve masaustu/tablet guven
etiketi eklendi. `Create Account` sayfanin tek ana basligi yapildi. Mevcut
private/business secimi, form alanlari, ulke zorunlulugu, Google/e-posta auth
akislari ve CAPTCHA davranisi degistirilmedi.

Dogrulama: register/country/CAPTCHA targeted tests PASS (17/17); `npm run lint`
PASS; `npm run typecheck` PASS (web + desktop); `npm run build -- --webpack`
PASS (270 route/page entry); `npm run check:i18n` PASS (12 locale, 596/596 ve
0 English fallback). Browser QA 1280x720, 768x1024 ve 390x844 boyutlarinda
yatay tasma olmamasi, tek H1, 250 secilebilir ulke, 48px mobil ana aksiyon ve
sifir console warning/error ile PASS. Full suite 672/694 PASS; kalan ayni 22
`ui-ux-safety` failure'i ana dalda onceden mevcut kaynak-kontrat baseline'idir.
Yeni dependency, SQL/migration, env/secret, Production data, push veya deploy
yoktur.

### MANUAL-20260822-REGISTRATION-COUNTRY [P1] Require an auto-detected, editable registration country

Durum: Done

Fingerprint: `customer-registration|country-selection|silent-germany-default-and-oauth-gap|required-ip-assisted-editable-global-country`

Sonuc: Kayit formunun ilk adimina 249 ISO 3166-1 ulkesi ve Kosovo secenegini
iceren zorunlu native ulke secimi eklendi. Vercel'in iki harfli ulke basligi
yalniz varsayilan secimi yapmak icin kullanilir; IP okunmaz, loglanmaz veya
saklanmaz. Algilama basarisizsa Almanya varsayilmaz ve manuel secim zorunlu
kalir; musteri otomatik secimi her zaman degistirebilir. E-posta kaydi, kayit
sayfasi Google akisi ve login sayfasindan olusan yeni Google hesabi ayni ulke
zorunluluguna baglandi. Eksik yeni Google hesaplari kalici pending metadata ve
dashboard/new-request guard'i ile profil tamamlamaya yonlendirilir. Profil
satiri dogrulanmadan Auth metadata'si tamamlanmis sayilmaz. Settings ulke alani
da ayni tam katalogu kullanir ve bos profilde Almanya uydurmaz.

Dogrulama: country/auth targeted tests PASS (25/25); `npm run lint` PASS;
`npm run typecheck` PASS (web + desktop); `npm run build -- --webpack` PASS
(270 route/page entry); `npm run check:i18n` PASS (12 locale, 11 non-English
customer locale'de 0 English fallback); responsive Browser QA PASS (390x844 ve
1366x768, yatay tasma ve console error yok); public country endpoint local
header smoke PASS. Full suite 672/694 PASS; kalan 22 `ui-ux-safety` failure'i
bu branch'in degistirmedigi ana dal kaynak-kontrat baseline'idir ve yeni hedefli
ve auth session testlerine ek failure gelmemistir. Dependency, SQL, env,
Production data, push veya deploy yoktur.

### MANUAL-20260809-GOOGLE-ADS-LAUNCH-GATE [P1] Complete verified conversion launch controls

Durum: Done

Fingerprint: `google-ads|verified-conversions|consent-default-and-language-destinations|launch-gate`

Sonuc: Google Consent Mode v2 default-denied komutu tag yuklenmeden ve kayitli
izin update'i uygulanmadan once tek sefer kuyruklanir. Analytics/reklam izni
olmadan registration seed veya optional storage olusmaz. Request conversion
tekillestirmesi yalniz basarili RPC'nin gercek order ID sonucundan turetilen
browser-side SHA-256 transaction hash'i ile yapilir; Google'a order/customer ID
gonderilmez. Admin Ads Performance merkezi, 12 dilde allowlistli HTTPS landing
URL builder, account launch checklist ve external receipt sinirini gosterir.
Campaign tokenlari allowlistlidir; arbitrary redirect veya customer data URL'ye
eklenemez. Dedicated File Service Google Ads hesabi disindaki mevcut kampanya ve
conversion hedeflerine dokunulmamistir.

Dogrulama: targeted tests PASS (26/26); full tests PASS (667/667); lint PASS;
web+desktop typecheck PASS; production build PASS (268 route); i18n/SEO PASS
(12 locale, 611/611); homepage performance PASS (66.3 KB gzip / 80 KB);
payment schema-only PASS ve env okunmadi; production audit PASS (0
vulnerability); `git diff --check` PASS. SQL, account/campaign/budget/billing
mutation, customer data access, push veya deploy yoktur. External blockers:
dedicated File Service Ads hesabi setup'i tamamlanmali, browser ad blocker
kapatilmali, conversion action ID/label'lari olusturulmali ve Production public
measurement env'leri owner-controlled release sirasinda tanimlanmalidir.

### MANUAL-20260808-GROWTH-MEASUREMENT [P1] Consented growth measurement reliability

Durum: Done

Fingerprint: `growth-measurement|public-attribution|delayed-consent-loses-first-touch|memory-preserved-first-touch-and-observed-health`

Sonuc: Consent karari verilmeden onceki public landing/campaign temasi yalniz
gecici bellekte korunur; storage veya network yazimi yapilmaz. Izin verildiginde
ilk temas mevcut route temasindan once, deduplicate edilerek gonderilir. Gecici
ag hatalari uc bounded retry ve online recovery alir. Ads Performance merkezi
configuration, consented traffic, request ve verified revenue kanitlarini PII
olmadan ayirir. GA4 hazirligi verified measurement gate'ine dahil edildi.
Mevcut nanoid ve PostCSS transitive paketleri high/moderate advisory'leri kapatan
patch surumlerine sabitlendi; yeni dependency eklenmedi.

Dogrulama: targeted tests 36/36 PASS; full tests 664/664 PASS; lint PASS;
web+desktop typecheck PASS; production build PASS; i18n/SEO PASS (12 locale,
611/611 customer string); homepage performance PASS (66.2 KB gzip / 80 KB);
payment schema-only PASS ve env okunmadi; production dependency audit PASS
(0 vulnerability); `git diff --check` PASS. SQL, production mutation, push veya
deploy yoktur.

### MANUAL-20260807-TCU-STAGE-PRICING [P1] Split TCU tuning into explicit stages

Durum: Done

Fingerprint: `request-catalog|tcu-stage-pricing|single-tcu-option|owner-defined-15-20-30`

Sonuc: Web ve desktop request kataloglarinda TCU Stage 1 (15 kredi), TCU Stage 2
(20 kredi) ve TCU Stage 3 (30 kredi) secenekleri eklendi. Server-side desktop
kredi dogrulamasi ayni katalogu kullanir; Tune Advisor eski genel TCU inceleme
etiketiyle geriye uyumlu kalir.

Dogrulama: 660/660 test PASS; lint PASS; typecheck PASS; production build PASS;
`git diff --check` PASS.

### MANUAL-20260806-GOOGLE-ADS-READINESS [P1] Google Ads readiness and verified conversion measurement

Durum: Done

Fingerprint: `growth|google-ads-readiness|organic-traffic-without-verified-paid-conversion-loop|consented-registration-request-payment-measurement`

Sonuc: Mevcut GA4, Search Console ve gizlilik dostu Growth attribution altyapisi
Consent Mode v2 ile genisletildi. Kayit, talep ve odeme donusumleri yalnizca
sunucu tarafindan dogrulanan is akisi tamamlandiktan sonra, anonim SHA-256
transaction kimlikleri ve tekrar gonderim korumasiyla olculur. Ham click ID, PII,
siparis/dosya icerigi veya private metadata Google'a gonderilmez; reklam
kisisellestirme kapali kalir. `/admin/ads-performance` konfigurasyon, donusum
hiyerarsisi, landing-page ve izinli kampanya/kaynak performansini admin-only
olarak gosterir. 12 dilde granular izin deneyimi ve localized belge dili
duzeltildi.

Dogrulama: 659/659 test PASS; lint PASS; web+desktop typecheck PASS; production
build PASS (268 route); i18n/SEO PASS (12 locale, 30 source file); payment
schema-only PASS ve env okunmadi; audit high threshold PASS (0 high/critical,
mevcut Next/PostCSS zincirinde 2 moderate advisory); 1440x900, 1366x768,
768x1024 ve 390x844 browser QA PASS; yatay tasma ve console error yok;
git diff check PASS. SQL, dependency, production mutation, push veya deploy
yoktur.

### MANUAL-20260806-FILE-SERVICE-SEARCH-ARCHITECTURE [P1] Global file-service search intent architecture

Durum: Done

Fingerprint: `seo|file-service-search-architecture|fragmented-sector-vocabulary|canonical-intent-routing-without-doorways`

Sonuc: Guncel sektor arastirmasi ve mevcut MG AutoTech urun gercekleriyle 121
arama ifadesi, 32 public hedef ve 7 ticari niyet ailesi tek typed route ownership
haritasina baglandi. `/services` server-rendered, crawlable ve kompakt accordion
navigator aldi; yalniz ilk grup varsayilan acik, her kartta en fazla uc faydali
es anlamli ifade gorunur. `/file-service` ile `/services` metadata ve gorunur H1
dogal high-intent diline getirildi. Ayni hedefler JSON-LD ItemList ile eslesir;
ana sayfa uzatilmadi, yeni thin/doorway rota veya `meta keywords` eklenmedi.

Dogrulama: 641/641 test PASS; lint PASS; web+desktop typecheck PASS;
production build PASS (266 static page); i18n/SEO PASS (12 locale, 611/611);
homepage performance PASS (61.1 KB gzip / 80 KB); payment schema-only PASS ve
env okunmadi; audit high threshold PASS (0 high/critical, mevcut 2 moderate
Next/PostCSS advisory); 1280x720 ve 390x844 browser QA PASS, yatay tasma yok ve
7 gruptan yalniz 1'i acik; diff check PASS. SQL, dependency, production mutation,
push veya deploy yoktur.

### MANUAL-20260806-STAGE1-SEO-AUTHORITY [P1] Stage 1 organic search authority

Durum: Done

Fingerprint: `stage-1-seo|exact-search-intent|thin-controller-context|canonical-authority-and-crawlable-guide-network`

Sonuc: Mevcut `/services/stage-1` tek kanonik Stage 1 sayfasi olarak
korundu. Exact-intent title, description, H1, workshop fit guidance, original
file/read-method cevaplari, dogrudan request CTA'si, genisletilmis FAQ ve
customer-safe ItemList semasi eklendi. Sekiz marka ve yedi ECU platform rehberi
Stage 1 sayfasindan crawlable link alir; ECU platform rehberleri de Stage 1'e
geri baglanir. Ana sayfaya yeni bolum veya yeni thin SEO rotasi eklenmedi.

Dogrulama: Focused tests PASS (5/5); full tests PASS (636/636); lint PASS;
web+desktop typecheck PASS; production build PASS (266 static page); i18n/SEO
PASS (12 locale, 611/611); homepage performance PASS (61.1 KB gzip / 80 KB);
payment schema-only PASS ve env okunmadi; audit high threshold PASS (0
high/critical, mevcut 2 moderate Next/PostCSS advisory); responsive browser QA
PASS (1440x1000 ve 390x844, yatay tasma ve console error yok); diff check PASS.
SQL, dependency, production mutation, push veya deploy yoktur.

### MANUAL-20260805-DELIVERY-METRICS [P1] Teslim edilen surumler ve indirme metrikleri

Durum: Done

Fingerprint: `admin-work-order|delivery-version-history|delivery-files-without-usage-visibility|safe-version-download-metrics`

Sonuc: Admin is emrindeki Files alani teslim edilen surum sayisi, toplam portal
indirme sayisi, son teslim ve son indirme zamanini tek ozet halinde gosterir. Her
surum kronolojik olarak label, dosya adi, teslim zamani, indirme sayisi ve son
indirme zamaniyla listelenir; custom version label korunur. Indirme audit kaydi
gecici olarak okunamazsa yaniltici sifir yerine unavailable durumu gosterilir.
Yeni projection storage path, signed URL veya provider metadata icermez.

Dogrulama: Delivery tests PASS (11/11); full tests PASS (631/631); lint PASS;
web+desktop typecheck PASS; production build PASS (266 static page); payment
schema-only PASS ve env okunmadi; audit high threshold PASS (0 high/critical,
mevcut 2 moderate Next/PostCSS advisory); diff check PASS. Yeni SQL gerekmez.

### MANUAL-20260805-REQUEST-CHAT [P0] Request chat professional UX and access hardening

Durum: Done

Fingerprint: `request-chat|customer-admin-conversation|transient-sync-errors-and-broad-table-access|resilient-secure-professional-channel`

Sonuc: Customer ve admin request chat tek, responsive ve erisilebilir bir secure
conversation yuzeyine alindi. Initial loading/empty/failure, retry, silent reconnect,
gun gruplama, sender identity, bounded composer, message stored state ve background
sync bilgisi eklendi. Loaded history transient hatada korunur; hidden tab polling'i
durur, overlapping fetch/send engellenir. API order ownership veya `messages.manage`
yetkisiyle calisir; yalniz visible ve non-internal message projection'i dondurur,
history'yi 200 satirla sinirlar ve private/no-store generic errors kullanir. Additive
security migration'i anon/authenticated direct Data API grants ve broad policy'leri
kaldirarak message table'i service-role server API sinirina alir.

Dogrulama: Targeted tests PASS (115/115); full tests PASS (629/629); lint PASS;
web+desktop typecheck PASS; production build PASS (266 static page); i18n/SEO PASS
(12 locale, 30 source file); payment schema-only PASS ve env okunmadi; audit high
threshold PASS (0 high/critical, Next/PostCSS zincirinde mevcut 2 moderate advisory);
desktop/laptop sentetik browser visual QA PASS; git diff check PASS. Migration canliya
uygulanmadi ve push/deploy yapilmadi.

### MANUAL-20260805-HOMEPAGE-FLOW [P1] Ana sayfa alt akis ve gorsel ritmini duzenle

Durum: Done

Fingerprint: `public-homepage|section-order-and-density|repeated-workflow-route-and-trust-bands|coherent-customer-journey`

Sonuc: Hero sonrasindaki ana sayfa akisi Performance Tools, File Service Navigator, Services, tek bir dort adimli workflow ve live workload sirasina alindi. Tekrarlanan workflow anlatimi tek bolumde birlestirildi; mevcut route ve CTA'lar korundu. Alt bolumlerin dikey bosluklari, baslik olcekleri ve koyu arka plan gecisleri dengelendi. Mobil servis, workflow, navigator, marka, ECU platformu, kullanim senaryosu ve fiyat kartlari snap rail davranisina alindi. Tum offscreen bolumlere ayni sahte yuksekligi veren `contain-intrinsic-size` kaldirilarak scroll sirasindaki yerlesim sicramasi kokten giderildi; agir performans araci ayrica lazy-load edilmeye devam eder.

Dogrulama: Targeted responsive/UI/performance testleri PASS (104/104); full tests PASS (625/625); lint PASS; web+desktop typecheck PASS; production build PASS (266 static page); i18n/SEO PASS (12 locale, 611/611); homepage performance PASS (61.1 KB gzip / 80 KB); audit high threshold PASS (0 high, mevcut 2 moderate Next/PostCSS advisory); responsive browser QA PASS (1440x900, 1024x768, 768x1024, 390x844; sifir yatay tasma, scroll-height delta 0, console error yok); diff check PASS.

### MANUAL-20260805-HOMEPAGE-HERO [P1] Ana sayfa ilk ekranini urun odakli sadeleştir

Durum: Done

Fingerprint: `public-homepage|hero-product-preview|abstract-chip-visual-and-unbalanced-cta-grid|compact-four-step-workflow-preview`

Sonuc: Hero sag panelindeki soyut ECU gorseli, Register, Load Credits, Upload File ve Download File adimlarini gosteren kompakt urun akisi onizlemesine cevrildi. CTA alani dengeli iki sutuna alindi; hero ve preview yuksekligi ekran yuksekligine uyumlu hale getirildi. Yeni Load Credits etiketi 11 non-English locale icin cevrildi. Kucuk laptopta Almanca guven etiketlerinin tasmasi giderildi; mevcut rota ve is mantiklari korunarak yeni alt bolum eklenmedi.

Dogrulama: Targeted UI/i18n/performance testleri PASS (101/101); full tests PASS (625/625); lint PASS; web+desktop typecheck PASS; production build PASS (266 static page); i18n/SEO PASS (12 locale, 30 source file); homepage performance PASS (60.9 KB gzip / 80 KB); payment schema-only PASS ve env okunmadi; high-severity audit threshold PASS (Next/PostCSS zincirinde 2 mevcut moderate advisory); responsive browser QA PASS (1440x900, 1366x768, 1024x768, 390x844; sifir yatay tasma, fresh English console error yok); diff check PASS.

### MANUAL-021 [P0] Widget SaaS ticari kontrol merkezi ve guvenlik sertlestirmesi

Durum: Done

Fingerprint: `widget-saas|commercial-control-center|fragmented-client-operations-and-fail-open-edges|audited-professional-workspace`

Kapsam: Widget Clients ve global Widget SaaS yonetimini ticari hesap sagligi,
onboarding, kullanim, lead teslimi, domain/key yasam dongusu ve admin aksiyon
kuyruguyla tek profesyonel merkezde birlestir. Musteri paneline kurulum hazirligi
ve guvenli aggregate metrikler ekle; public/customer projection, domain, key,
kota ve oran sinirlarini fail-closed hale getir. Fiyat ve Stripe sahipligi
degistirilmez.

Sonuc: Admin listesi ticari portfoy ozeti, aksiyon kuyrugu ve responsive hesap
tablosu; detay ekrani Overview/Configuration/Security/Leads/Activity sekmeleri;
global ayarlar kontrollu emergency stop ve server-only security readiness sunar.
Musteri paneli dort adimli kurulum, aylik yukleme ve lead sagligini gosterir.
Domain ve key islemleri atomik RPC, neden zorunlulugu, audit triggerlari ve tekil
DB indeksleriyle korunur. Ham Stripe kimligi, IP hash, user-agent ve audit
internalleri customer/public response'a cikmaz. Dedicated widget session secret
ve IP hash salt zorunludur; kota/rate-limit altyapisi dogrulanamazsa widget
fail-closed durur.

Dogrulama: Targeted regression tests PASS (112/112); lint PASS; web+desktop typecheck PASS;
full tests PASS (625/625); production build PASS (266 static page); i18n/SEO
PASS (12 locale, 611/611); payment schema-only PASS ve env okunmadi; homepage
performance PASS (60.9 KB gzip / 80 KB); high-severity audit threshold PASS
(Next/PostCSS zincirinde 2 mevcut moderate advisory); local responsive browser
gate QA PASS (1440x900, 1024x720, 768x1024, 390x844; sifir yatay tasma ve
console error); diff check PASS.

Release notu: `scripts/harden-widget-saas-commercial.sql` additif migration ve
`scripts/verify-widget-saas-commercial.sql` read-only dogrulamadir. Migration
calistirilmadi. Canli release oncesi dokumandaki conflict preflight, SQL,
verification ve `WIDGET_SESSION_SECRET` / `WIDGET_IP_HASH_SALT` konfigurasyonu
tamamlanmalidir. Push/deploy veya production mutation yapilmadi.

### MANUAL-020 [P0] Search Console ve GA4 canli raporlama baglantisi

Durum: Done

Fingerprint: `seo-reporting|search-console-ga4|server-reporting-not-configured|least-privilege-live-connection`

Kapsam: `file.mgautotech.de` icin Search Console sorgu/sayfa/ulke metriklerini ve
GA4 consented public landing-page/request event metriklerini mevcut admin-only
SEO Opportunity Center'a bagla. Servis hesabi yalniz dar okuma yetkisi alir;
query-to-customer identity stitching, public veri ifsasi veya customer mutation
yapilmaz.

Sonuc: Dedicated Google Cloud raporlama projesinde Search Console API ve GA4
Data API acildi. Exact URL-prefix Search Console mulku otomatik dogrulandi ve
servis hesabina Restricted erisim verildi. GA4 erisimi Viewer + No Cost/Revenue
Metrics ile sinirlandi. Dort server-only Vercel Production degiskeni sensitive
olarak kaydedildi; private key istemciye veya repoya girmedi ve yerel key kopyasi
aktarimdan sonra silindi. Canli panel Search Console sorgu, sayfa ve ulke
satirlarini gosteriyor; GA4 kaynagi hazir fakat mulkte henuz tarihsel consented
event satiri yok.

Dogrulama: lint PASS; web+desktop typecheck PASS; full tests PASS (612/612);
production build PASS (266 static page); i18n/SEO PASS (12 locale, 30 source
file); payment schema-only PASS; high-severity audit PASS (2 mevcut moderate
PostCSS advisory); anonymous SEO API 401; vehicle cache 200/cache; authenticated
production SEO panelinde Search Console ve GA4 source state `ready`.

### MANUAL-019 [P0] E-posta yasam dongusu sertifikasyonu ve operasyon sagligi

Durum: Done

Fingerprint: `email-operations|customer-journey-certification|live-flows-lack-one-safe-end-to-end-gate|admin-render-only-certification`

Kapsam: Kayit, talep, anlamli is emri durumlari, musteri gorunur mesaji, ek dosya, teslim ve iptal e-postalarini; Supabase Auth sablonlarini; teslimat/suppression politikasini; 12 dilde musteri guvenligi kurallarini gercek e-posta veya production veri mutasyonu olmadan tek admin-only sertifikasyon raporunda dogrula. Teslimat sorunlarinin mevcut admin bildirim yuzeyini acik operasyon sagligi ozetiyle guclendir.

Kabul kriterleri:

- Sertifikasyon yalniz sample context kullanir; e-posta gondermez ve DB yazmaz.
- Tum musteri yolculugu kilometre taslari ve anlamli status gecisleri kapsanir.
- Tum transactional ve Supabase Auth sablonlari 12 dilde render edilir.
- Internal/private alanlar, hidden message ve tehlikeli URL sinyalleri fail-closed reddedilir.
- Delivery delayed/bounce/complaint/failure/suppression durumu admin icin PII'siz ozetlenir.
- Admin API anonymous/customer erisimine kapali kalir.

Dogrulama: Targeted email tests PASS (43/43); lint PASS; web+desktop typecheck PASS; full tests PASS (612/612); production build PASS (266 static page); i18n/SEO PASS (12 locale, 30 source file); payment schema-only PASS ve env okunmadi; high-severity audit threshold PASS (2 mevcut moderate PostCSS advisory); diff check PASS. Responsive class contract targeted test ile korunur; authenticated visual smoke deploy turuna aittir.

### MANUAL-018 [P0] Cok dilli musteri donusum yolculugunu tamamla

Durum: Done

Fingerprint: `customer-conversion|register-auth-request-dashboard|english-fallback-and-locale-blind-funnel|complete-localized-journey`

Kapsam: Kompakt ve responsive kayit akisini sirket profiliyle guclendir; auth, yeni talep ve musteri panelindeki gercek English fallback metinlerini desteklenen dillere tamamla; mevcut Growth Center icinde locale ve ulke bazli gizlilik-dostu kayit, talep ve odeme donusumunu gorunur yap. Mevcut payment, vehicle, AI, work-order ve authorization davranisi korunur.

Sonuc: Private/company kaydi ayrildi; company name yalniz sirket hesabinda zorunlu ve Google OAuth callback boyunca bounded profile draft ile korunur. Customer auth, request, dashboard, order, delivery, File Expert, payment, widget ve teknik rehber yuzeylerindeki 611 gorunur metin 11 non-English locale icin exact veya intentional invariant hale geldi. Nested JSX ve visible custom prop metinleri de AST denetimine katildi. Customer lifecycle ve hosted Auth e-postalari 12 dili destekler; admin operasyon e-postasi English kalir. Growth Center mevcut privacy-safe locale alanindan visit, registration, request ve paid funnel dagilimi uretir; yeni PII veya SQL gerekmez.

Dogrulama: Full tests PASS (605/605); lint PASS; web+desktop typecheck PASS; production build PASS (266 static page); i18n/SEO PASS (12 locale, 611/611 source string, 0 English fallback); payment schema-only PASS ve env okunmadi; performance PASS (60.9 KB gzip / 80 KB); high-severity audit PASS (2 mevcut moderate PostCSS advisory); Chrome QA PASS (390x844, 768x1024, 1366x768, 1440x900, private/company, Chinese register/login/password/new-request/dashboard gate); sifir horizontal overflow ve sifir console error; diff check PASS. SQL, production, push veya deploy islemi yapilmadi.

### MANUAL-017 [P0] Tum dillerde tek kaynakli ana sayfa paritesi

Durum: Done

Fingerprint: `public-i18n|localized-homepage|separate-layout-drift-from-english|single-layout-locale-copy`

Kapsam: English kok ana sayfa ile 11 locale-prefixed ana sayfanin ayni React bilesen agacini, tasarimi, bolumleri ve responsive davranisi kullanmasini sagla. Yalnizca metin, locale-aware public baglantilar ve SEO metadata/JSON-LD dili farkli olsun; ayri localized homepage tasarimi kalmasin.

Sonuc: `/`, `/de`, `/tr`, `/fr`, `/nl`, `/it`, `/es`, `/pt`, `/pl`, `/ru`, `/zh` ve `/sq` artik ayni 20 bolumlu `UnifiedHomePage` agacini kullanir. Eski ayri `LocalizedSeoHome` kaldirildi. Kritik hero, guven sinyalleri, public navigasyon ve footer server tarafinda locale-aware olur; deferred araclar mevcut translation observer ile ayni locale icinde kalir. Canonical, 13 hreflang ve localized JSON-LD korunur; localized public linkler yalniz gercek locale rotalarina yonelir, private rotalar degismez. Document language hydration oncesi locale'e ayarlanir. Uzun locale basliklari ve nav etiketleri telefon/kucuk laptop icin tasma yapmadan olceklenir. Analytics consent penceresinin baslik, aciklama, aksiyon, accessibility ve durum metinleri de 12 desteklenen dilin tamami icin merkezi hale getirildi.

Dogrulama: Full tests PASS (597/597); lint PASS; web+desktop typecheck PASS; production build PASS (266 static page); i18n/SEO PASS (12 locale); payment schema-only PASS; performance PASS (57.9 KB gzip / 80 KB); high-severity audit PASS (2 mevcut moderate PostCSS advisory); static parity PASS (11 locale x 20 section, localized canonical, 13 hreflang); browser QA PASS (390x844 German, 768x1024 Turkish, 1366x768 German, 1920x1080 French ve uzun baslikli RU/NL/PL/SQ/ZH mobile); localized consent QA PASS; sifir horizontal overflow ve sifir console warning/error; diff check PASS. SQL veya customer data islemi yapilmadi.

### MANUAL-016 [P0] Growth customer data quality and first verified revenue

Durum: Done

Fingerprint: `growth-analytics|customer-classification|internal-test-accounts-contaminate-metrics|audited-real-growth-snapshot`

Kapsam: Admin, gercek musteri ile internal/test/staff-operated hesaplari acik kanitla siniflandirir; dislanan hesaplar Growth metrikleri ve terk edilmis talep hatirlatmalarindan cikarilir. Ilk dogrulanmis gelir yolculugu yalniz acikca gercek olarak dogrulanan hesap ve varsa consented first-touch attribution ile gosterilir.

Sonuc: Iki private RLS tablosu, atomik auditli classification RPC'si, DB ve uygulama seviyesinde reminder engeli, admin data-quality workspace'i, strict Real Growth Snapshot ve ilk dogrulanmis revenue timeline'i eklendi. Mevcut hesap, siparis, kredi ve odeme kayitlari degistirilmez; mevcut hesaplar otomatik siniflandirilmaz ve kaynak gecmisi uydurulmaz.

Dogrulama: Targeted tests PASS (19/19); full tests PASS (585/585); lint PASS; web+desktop typecheck PASS; production build PASS (266 static page); i18n PASS (12 locale); payment schema-only PASS ve env okunmadi; local security smoke PASS (73 admin API methodu, 16 customer API rotasi, 8 private page header kontrolu, 4 public-safe kontrol); browser responsive gate QA PASS (390x844, 768x1024, 1440x900); high-severity audit threshold PASS (2 mevcut moderate PostCSS advisory); diff check PASS. Docker engine ve `psql` kullanilabilir olmadigi icin migration yerel PostgreSQL uzerinde calistirilamadi; production erisimi yapilmadi.

### MANUAL-015 [P0] Growth & Customer Success Center

Durum: Done

Fingerprint: `growth-ops|privacy-first-attribution-to-revenue|safe-abandonment-and-retention-actions|admin-center`

Kapsam: Izinli ve takma kimlikli edinim izini mevcut SEO, profil, siparis, odeme ve e-posta verileriyle admin-only raporda birlestir; kayit/talep/odeme hunisi, tekrar siparis, gelir, hizmet/marka/ulke performansi, teslimat ve kayip riski gorunurlugu ekle. Yalniz acikca izin veren musteri icin idempotent, admin kontrollu yarim talep hatirlatmasi hazirla. Customer/public veri sizintisi ve otomatik spam olmasin.

Sonuc: Admin-only Growth & Customer Success Center 30/90/180/365 gunluk huni, consented attribution, Search Console sorgu gorunurlugu, net/gross/refund gelir, retention, hizmet/marka/ulke performansi, e-posta teslimati ve gunluk aksiyonlari bir araya getirir. Attribution yalniz acik analytics izniyle, ham IP, tam referrer, e-posta, not veya dosya verisi olmadan tek yonlu HMAC kimlikle tutulur. Yarim talep hatirlatmasi varsayilan kapali, customer opt-in, admin onayli, 24 saat-14 gun pencereli, suppression/idempotency ve 30 gun customer cooldown korumalidir; otomatik gonderici yoktur. RLS, dar grant, service-role-only RPC ve advisory lock ile cift gonderim/cross-tenant erisim engellenir. Public ana sayfa growth istemcisi auth/Supabase runtime'dan ayrilarak ilk yuk performansi korunmustur.

Dogrulama: Growth targeted testleri PASS (12/12); lint PASS; web+desktop typecheck PASS; full tests PASS (578/578); production build PASS (265 static page, `/admin/growth` ve growth API rotalari dahil); performance budget PASS (56.6 KB gzip / 80 KB, forbidden runtime yok); i18n/SEO PASS (12 locale, 28 source file); customer i18n PASS (11 non-English locale, 480 source string); payment schema-only PASS ve env okunmadi; high-severity audit threshold PASS (2 mevcut moderate PostCSS advisory); `git diff --check` PASS. Chrome QA 390x844, 768x1024, 1366x768 ve 1920x1080 boyutlarinda sifir document overflow, calisan source/country ve service/brand kontrolleri, anonim admin login gate ve sifir console error ile PASS. Gecici sentetik QA rotasi kaldirildi; production servisine, Supabase'e veya gercek e-postaya dokunulmadi.

### MANUAL-014 [P0] Cok dilli Auth e-postalari ve teslimat guvenilirligi

Durum: Done

Fingerprint: `email-reliability|supabase-auth-en-de-tr|signed-resend-webhook|suppression-and-admin-delivery-visibility`

Kapsam: Supabase Auth e-postalarini English, Deutsch ve Turkce olarak hazirlamak; Resend teslim durumlarini imzali webhook ile izlemek; kalici bounce, complaint ve provider suppression sonrasinda yeniden gonderimi engellemek; admin bildirim ve e-posta merkezinde teslim sorunlarini guvenli bicimde gostermek; yalniz admin hesabina gidebilen test ve sample-only onizleme akisini tamamlamak.

Sonuc: On uc Supabase Auth sablonu EN/DE/TR ve English fallback ile olusturuldu. Signed/bounded Resend webhook yalniz allowlistli eventleri kabul eder; raw payload saklanmaz. `email_events` teslim durumu kazandi; private RLS-protected delivery event ve suppression kayitlari eklendi. Kalici bounce, complaint ve provider suppression yeni gercek gonderimleri fail-closed engeller; delayed durum engellemez. Admin merkezi sent/delivered/delayed/bounced/complained durumlarini, aktif teslim sorunlarini ve suppression kayitlarini recipient veya provider payload'i ifsa etmeden gosterir. Test gonderimi yalniz oturumdaki admin adresine ve mevcut `admin_email_test` olayina sinirlidir; Auth onizlemeleri sample veridir.

Dogrulama: Targeted email reliability tests PASS; lint PASS; web+desktop typecheck PASS; full tests PASS (566/566); production build PASS (261 static page, `/api/webhooks/resend` dahil); payment schema-only PASS ve env okunmadi; high-severity audit threshold PASS (2 mevcut moderate PostCSS advisory); `git diff --check` PASS. Gercek e-posta gonderilmedi, production Supabase/Resend erisimi veya deploy yapilmadi.

### MANUAL-012 [P0] File Service dil ve canonical URL stabilizasyonu

Durum: Done

Fingerprint: `file-service-i18n|duplicate-en-canonicals-and-route-fallbacks|customer-portal-translation-drift|typed-coverage-gate`

Kapsam: Yalniz `file.mgautotech.de` icin root English canonical yapisini tekillestir; `/en` tekrarlarini kalici yonlendir; sitemap, robots, hreflang ve dil secici davranisini gercek ceviri rotalariyla hizala; dashboard, siparis, new request, auth ve payment yuzeylerindeki yeni metinleri 11 non-English dilde tamamla ve kalici source-string coverage kontrolu ekle.

Sonuc: English root URL ailesi tek canonical kaynak oldu; `/en` ve `/en/*` permanent redirect ile kok esdegerlerine alindi. Static locale generation, sitemap ve robots yalniz 11 non-English prefix uretir. Dil secici cevirisi olmayan English-only public resource'u 404 veya ilgisiz homepage'e tasimaz. Kritik auth/new-request cumleleri ve compact customer portal etiketleri typed 11-locale katmanina alindi; uzun ve profesyonel cevirisi olmayan teknik metinler karisik dil uretmek yerine temiz English fallback olarak kalir. Admin, legal copy, payment business logic, vehicle data ve work-order davranisi degismedi.

Dogrulama: `npm run check:i18n` PASS (12 public locale, 477 customer source string); lint PASS; web+desktop typecheck PASS; full tests PASS (544/544); production build PASS (260 static page, `/en` static kopyasi yok); performance PASS (55.8 KB gzip / 80 KB); payment schema-only PASS; audit PASS (0 vulnerabilities); `git diff --check` PASS. Local production browser QA 12 locale root, legacy `/en` redirect, Turkish/Russian/Chinese/Albanian auth gate, unsupported service switcher davranisi ve 390x844/768x1024/1366x768 responsive boyutlarinda sifir horizontal overflow, sifir unnamed control ve sifir console error ile PASS.

### MANUAL-013 [P0] Bot, scraper ve veri sizdirma savunmasi

Durum: Done

Fingerprint: `platform-security|instance-local-public-rate-limits|privacy-safe-distributed-counter-and-anomaly-signals|normal-user-tolerant-defense`

Kapsam: Public katalog ve dusuk maliyetli API yuzeylerinde mevcut instance-local limitleri merkezi, gizlilik-korumali ve opsiyonel paylasilan sayacla guclendirmek; rate-limit cevaplarini standartlastirmak; PII icermeyen guvenlik sinyalleri ve WAF/MFA operasyon plani eklemek. Normal customer akislarini, cache/fallback davranisini, payment ve production konfigurasyonunu degistirmemek.

Sonuc: Vercel anti-spoofing IP header'i onceliklendirildi ve IP degerleri dogrulandi. Ortak adaptive guard her zaman yerel sayaci, acikca etkinlestirildiginde atomik HTTPS Redis REST sayacini kullanir. Ortak anahtar yalniz salted HMAC fingerprint tasir; saglayici kesintisinde normal customer yerel korumayla devam eder. Public vehicle, client observability ve authenticated email trigger rotalari standart 429 kontratina tasindi. Security signal loglari allowlistli ve bes dakikalik cooldown'lidir. Canli WAF/MFA/Turnstile aktivasyonu yapilmadi; gozlem esikleri ve geri alinabilir rollout adimlari belgelendi.

Dogrulama: Targeted PASS (20/20); lint PASS; web+desktop typecheck PASS; full tests PASS (546/546); production build PASS (268 route/page entry); performance budget PASS (55.6 KB gzip / 80 KB); i18n/SEO PASS (12 locale, 25 source file); payment schema-only PASS; production audit PASS (0 vulnerabilities); diff check PASS.

### MANUAL-011 [P0] Platform guvenlik ve coklu cihaz assurance denetimi

Durum: Done

Fingerprint: `platform-security|anonymous-api-and-ssrf-boundaries|transient-auth-500-and-accessibility-gaps|local-production-assurance-suite`

Kapsam: Production verisine veya secretlara dokunmadan tum admin API methodlarini, kritik customer API'lerini, SSRF sinirlarini, private page headerlarini, client bundle secret izlerini, dependency'leri, SEO rotalarini ve telefon/tablet/laptop/desktop responsive davranisini yerel production build uzerinde denetlemek.

Sonuc: IPv4-mapped IPv6 ve ek non-public IP araliklari URL enrichment katmaninda bloklandi. File Expert admin feedback merkezi `file_expert.manage` guard'ina tasindi; anonim File Expert ve customer revision istekleri Supabase/client olusturmadan once reddediliyor. Revision malformed JSON davranisi bounded 400 oldu. Private/auth sayfalari frame-deny, no-store, noindex ve CSP ile sertlestirildi. Homepage vehicle selectleri ve icon-only registration linki accessible name kazandi. Local-only reusable security smoke ve static security assurance suite eklendi.

Dogrulama: Local production smoke PASS (69 admin method 401/403 veya bilinen disabled demo 404; 16 customer API 401/403; 8 private page header; 4 public-safe validation); lint PASS; web+desktop typecheck PASS; full tests PASS (539/539); production build PASS (268 entry; ilk deneme gecici Google Fonts ag hatasi, tekrar PASS); performance budget PASS (3 chunk, 211.4 KB raw, 55.6 KB gzip / 80 KB); i18n/SEO PASS (12 locale, 25 source file); payment schema-only PASS; web+desktop production audit PASS (0 vulnerabilities); client bundle secret scan PASS; sitemap PASS (146 public URL, 0 private route); diff check PASS. Browser QA 390x844, 768x1024, 1366x768 ve 1920x1080 boyutlarinda sifir horizontal overflow, sifir unnamed control ve sifir console error ile PASS.

### MANUAL-010 [P0] Platform oturum, yenileme ve operasyon guvenilirligi

Durum: Done

Fingerprint: `platform-reliability|transient-auth-and-refresh-failures|visible-data-flash-and-silent-email-risk|fail-stable-observability-and-retry`

Kapsam: Admin/customer oturum yenilemesini gecici ag hatalarina karsi fail-stable yapmak; veri polling cakismalarini azaltmak; public-safe crash/Web Vitals gozlemi, provider idempotent email retry davranisi ve operasyonel SEO konfigurasyon gorunurlugu eklemek.

Sonuc: Browser session snapshot'i server modulunden ayrildi; admin authorization icin tekrarli kesin red gerekliligi eklendi. Admin ve customer dashboard veri yenilemeleri gorunmeyen sekmede durur, cakisan fetch baslatmaz ve mevcut dogrulanmis veriyi gecici hatada korur. Strict allowlistli, PII icermeyen runtime/Web Vitals gozlemi ile global error ekranlari eklendi. Resend gonderimleri ayni provider idempotency anahtariyla yalniz transient hatalarda sinirli retry yapar. Mevcut SEO/GA4/Search Console sistemi tekrar edilmeden admin operasyon sagligina konfigurasyon sinyali eklendi.

Dogrulama: Targeted tests PASS (72/72); lint PASS; web + desktop typecheck PASS; full tests PASS (529/529); production build PASS (268 route/page entry); performance budget PASS (3 initial chunk, 211.4 KB raw, 55.6 KB gzip, 80 KB budget); i18n/SEO PASS (12 locale, 25 source file); production dependency audit PASS (0 vulnerabilities); diff check PASS. Browser QA 390x844, 768x1024, 1366x768 ve 1920x1080 boyutlarinda sifir horizontal overflow; `/admin`, `/new-request` ve `/dashboard` anonim login kapilari ve sifir console error ile PASS.

### MANUAL-009 [P0] Public web initial-load performance budget

Durum: Done

Fingerprint: `public-performance|homepage-initial-js-241kb-gzip|supabase-i18n-motion-eager|52kb-budgeted-runtime`

Kapsam: Ana sayfanin ilk render yolundan buyuk ceviri kataloglarini, Supabase session/notification runtime'ini, Framer Motion runtime'ini ve below-the-fold performance tools modulunu cikarmak; arac marka secicisini ilk HTML'de hazir tutmak ve kalici bir build-time JavaScript butcesi eklemek.

Sonuc: Locale tanimlari kucuk merkezi config'e ayrildi; buyuk ceviri kataloglari yalniz runtime cevirisi gercekten gereken rotalarda dinamik yuklenir. Public session bridge ve bildirimler idle/background yuklenir, authenticated/private rotalarda gerekli davranis korunur. Ana sayfa dekoratif motion kullanimi CSS tabanli hale getirildi; torque/log araclari viewport'a yaklasinca yuklenir. Ilk homepage JavaScript'i 241.4 KB gzip baseline'dan 52 KB gzip seviyesine indi. Public vehicle brand select ilk render'da placeholder + 102 canonical marka ile hazirdir.

Dogrulama: `npm test` PASS (515/515); lint PASS; web + desktop typecheck PASS; production build PASS (267 route/page entry); performance budget PASS (3 initial chunk, 200.8 KB raw, 52 KB gzip, 80 KB budget, forbidden runtime yok); i18n/SEO PASS (12 locale, 25 source file); payment schema-only PASS; production dependency audit PASS (0 vulnerabilities); diff check PASS. Browser QA 390x844, 768x1024, 1366x768 ve 1920x1080 boyutlarinda sifir horizontal overflow, ilk render'da 103 marka option, viewport-yakin tool load ve sifir console error ile PASS.

### MANUAL-006 [P0] New Request gecici oturum kesintisi kaldirilsin

Durum: Done

Fingerprint: `customer-auth|new-request-transition|transient-session-check-shows-blocking-error|cached-session-and-background-recovery`

Kapsam: `/new-request` gecisinde devam eden Supabase session baslatma veya token yenileme islemini gercek cikis gibi gosteren tam ekran kesinti durumunu kaldir; mevcut dogrulanmis oturumu aninda koru, gecici hatalari sinirli arka plan retry ile toparla ve yalniz dogrulanmis signed-out durumda login kapisini goster.

Sonuc: Ortak `BrowserAuthBoundary`, kullanilabilir verified session snapshot'ini bekleyen network/storage kontrolunden once kullanir. Tek gecici hata artik eski tam ekran kesinti durumuna gecmez; otomatik bounded retry ve sakin `Restoring secure session...` progress durumu kullanilir. Manuel retry ancak 30 saniyelik surekli erisilemezlikten sonra gorunur. Confirmed signed-out AuthRequired davranisi, API auth, staff/customer authorization ve RLS sinirlari korunur.

Dogrulama: targeted auth tests PASS (7/7); lint PASS; web+desktop typecheck PASS; full tests PASS (502/502); production build PASS (267 route/page entry); payment schema-only PASS; production dependency audit PASS (0 vulnerabilities); diff check PASS. Local browser QA `/new-request` login gate, eski transient mesajin yoklugu, console error olmamasi ve 390x844/1366x768 overflow kontrolleriyle PASS.

### MANUAL-007 [P1] Ana sayfa hazir kredi paketlerini ortak katalogla esitle

Durum: Done

Fingerprint: `homepage-commerce|ready-credit-package-catalog|four-card-filter-and-rounded-unit-price|shared-five-package-responsive-rail`

Kapsam: Ana sayfadaki kredi fiyat bolumunu musteri kredi ekraninin kullandigi mevcut ortak hazir paket kataloguyla esitle; fiyat veya odeme davranisini degistirmeden tum paketleri, paket adlarini ve dogru kredi basi fiyat hassasiyetini goster. Telefon ve tablette ana sayfayi uzatmayan kontrollu yatay paket seridi kullan.

Sonuc: Eski `<= 250` filtresi kaldirildi; Starter, Workshop, Professional, Partner ve Enterprise paketlerinin tamami `src/lib/creditPackages.ts` kaynagindan render ediliyor. Birim fiyatlar iki ondalik hassasiyetle gosteriliyor. Mobil/tablet tek satir snap rail, genis masaustu bes kolon kullaniyor; checkout hedefi mevcut `/dashboard/credits` olarak korundu.

Dogrulama: Focused katalog testleri ve full suite PASS; lint PASS; web + desktop typecheck PASS; production build PASS; payment schema-only PASS; production dependency audit PASS; responsive browser QA 390x844, 768x1024 ve 1440x900 boyutlarinda yatay govde tasmasi olmadan PASS; diff check PASS.

### MANUAL-008 [P1] Safe repeat request workflow ve world-class program

Durum: Done

Fingerprint: `customer-workflow|owned-order-repeat|safe-current-catalog-prefill|workshop-velocity-program`

Kapsam: Musterinin kendi onceki siparisinden yeni bir talep baslatmasini hizlandiran, yalniz guvenli arac alanlarini ve guncel katalogda birebir eslesen hizmetleri tasiyan Create Similar akisi ile kanita dayali file-service urun programi.

Sonuc: Order listesi ve order detail uzerinden yeni talep formuna guvenli repeat girisleri eklendi. Dosya, not, plaka, kredi, odeme, mesaj, teslimat, approval, AI ve admin metadatasi kopyalanmaz; servis fiyatlari mevcut katalogdan yeniden hesaplanir ve belirsiz/eski servisler tahmin edilmez. `docs/world-class-file-service-program.md` icinde guvenilirlik, workshop hizi, talep hazirligi, siparis seffafligi, guvenlik ve SEO icin olculebilir yol haritasi olusturuldu.

Dogrulama: targeted repeat tests PASS (6/6); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (465/465); `npm run build` PASS (259 page/route entries); payment schema-only PASS; i18n/SEO PASS (12 locale, 19 source file); production dependency audit PASS (0 vulnerabilities); protected-route browser smoke PASS.

### MANUAL-005 [P1] ECU file-service search-intent architecture

Durum: Done

Fingerprint: `public-seo|ecu-file-service-stage-audi-intents|canonical-coverage-and-conversion|review-led-content-cluster`

Kapsam: Search Console'da gorunen `ecu file service`, `ecu files`, `audi ecu software`, Stage 1/2/3, DPF, AdBlue ve DTC arama niyetlerini mevcut canonical public rotalarda derinlestir; yeni Stage 3 rotasi, karsilastirma yuzeyi, gorunen breadcrumb/FAQ, tutarli metadata/schema ve taranabilir ic baglantilar ekle. Doorway sayfa, desteklenmeyen guc rakami, sahte ceviri, otomatik yazilim vaadi veya private veri aciklamasi olusturma.

Sonuc: `/file-service` tek ana ECU file-service hub'i olarak korundu ve request odakli teknik bilgi, Stage karsilastirmasi, mevcut servis rotalari, marka baglantilari ve 12 gorunen FAQ ile guclendirildi. `/services/stage-3` benzersiz review-led advanced calibration rotasi olarak eklendi; Stage 1 ve Stage 2 mevcut canonical rotalarinda kaldi. `/brands/audi` exact HW/SW, original read, TDI/TFSI, SIMOS/Bosch ve S tronic baglamiyla benzersizlestirildi. DPF/EGR/AdBlue rotalarina jurisdiction duyurusu, DTC rotasina root-cause diagnostic siniri eklendi. Public selector, private routes, payment, AI, vehicle ve work-order akislari degismedi.

Dogrulama: targeted SEO tests PASS (15/15); i18n/SEO checker PASS (12 locale, 25 source file); lint PASS; web + desktop typecheck PASS; full tests PASS (501/501); production build PASS (267 page/route entries); payment schema-only PASS ve env dosyasi okunmadi; production dependency audit PASS (0 vulnerabilities); responsive browser QA 390x844, 768x1024 ve 1440x900 boyutlarinda horizontal overflow, clipped controls ve console errors olmadan PASS; diff check PASS.

### MANUAL-004 [P1] SEO firsat ve donusum merkezi

Durum: Done

Fingerprint: `admin-seo|google-reporting-opportunity-center|aggregate-data-siloed|privacy-safe-priority-and-coverage-dashboard`

Kapsam: Google Search Console ve GA4 Data API aggregate raporlarini read-only admin merkezinde birlestir; positions 4-20 firsatlarini, CTR gaplerini, ulke talebini, public landing-page request intent sinyallerini, canonical route coverage'i ve kanita dayali haftalik aksiyon kuyrugunu hesapla. Customer/request/file/payment metadata kullanma, Search Console sorgularini tamamlanan taleplerle user-level eslestirme ve otomatik sayfa yayinlama yapma.

Sonuc: `/admin/seo-performance` artik server-only Google service-account OAuth, strict source configuration, 28/90 gun araligi, fail-closed partial source states, 15 dakikalik aggregate report cache, deterministic opportunity scoring, mevcut canonical public route inventory ve responsive admin workbench sunar. Page-level firsatlar yalniz consented sessions + request CTA clicks kullanir; tamamlanan talepler ayri global funnel metrigi olarak kalir. Rapor API'si staff permission ile korunur, `private, no-store` dondurur ve credential/PII/customer metadata expose etmez.

Dogrulama: SEO targeted tests PASS (21/21); lint PASS; web + desktop typecheck PASS; full tests PASS (494/494); production build PASS (266 page/route entries); i18n/SEO PASS (12 locale, 25 source file); payment schema-only PASS ve env dosyasi okunmadi; production dependency audit PASS (0 vulnerabilities); responsive browser QA 390x844, 768x1024, 1366x768 ve 1536x900 boyutlarinda horizontal page overflow/clipped UI/console error olmadan PASS; diff check PASS.

### MANUAL-003 [P1] SEO sorgu, ulke, tiklama ve talep donusumu olcumu

Durum: Done

Fingerprint: `public-seo|search-console-ga4-measurement|query-country-click-request-conversion|consent-and-private-data-allowlist`

Kapsam: Search Console sorgu, ulke, gosterim ve Google tiklama kaynagi olarak korundu. Izinli public sayfa/tiklama, request CTA, dogrulanmis request baslangici ve basarili talep donusumu icin merkezi, typed GA4 event katmani eklendi. `/admin/seo-performance` read-only olcum merkezi Search Console ve GA4 raporlarini, aktivasyon durumunu ve event allowlist'ini tek yerde gosterir.

Sonuc: Google etiketi yalniz gecerli `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`, production host ve acik ziyaretci izni birlikte varsa yuklenir. Query/fragment, referrer ve private rota bilgisi gonderilmez; public URL'ler query-free olarak yeniden kurulur. Admin/dashboard/payment gibi private rotalara geciste analytics acikca reddedilir. Customer, order, vehicle, service, file, payment, note, admin veya AI metadata event contract'ina giremez. Config yoksa site ve request akisi etkilenmeden olcum fail-closed kalir.

Dogrulama: Targeted analytics tests PASS (8/8); lint PASS; full web + desktop typecheck PASS; full tests PASS (481/481); production build PASS (265 page/route entries); i18n/SEO PASS (12 locale, 25 source file); payment schema-only PASS; production dependency audit PASS (0 vulnerabilities); diff check PASS.

### MANUAL-002 [P1] Global high-intent SEO coverage guclendirilsin

Durum: Done

Fingerprint: `public-seo|global-service-intent-coverage|stage2-tcu-file-check-routes-missing|deep-intent-pages-and-safe-discovery`

Kapsam: Ana sayfayi yeniden uzatmadan Stage 2, TCU tuning ve ECU file check arama niyetleri icin benzersiz, review-first English servis sayfalari ekle; servis katalogu, file-service hub, workshop guides, footer, sitemap, RSS ve public discovery baglantilarini kur. Duplicate title suffix sorunlarini gider ve private/customer metadata sinirini testlerle koru.

Sonuc: `/services/stage-2`, `/services/tcu-tuning` ve `/services/ecu-file-check` statik servis rotalari; customer-safe `/feed.xml` ve `/llms.txt`; genisletilmis internal linking/sitemap/robots kesfi; services, file-service ve How It Works sayfalarinda tek marka suffix'li title davranisi eklendi. Ana sayfaya yeni bolum eklenmedi; yalniz mevcut TCU karti dogru public service rotasina baglandi.

Dogrulama: Yeni SEO testleri PASS (8/8); ilgili UI/SEO testleri PASS (102/102); i18n/SEO PASS (12 locale, 25 source file); lint PASS; web + desktop typecheck PASS; full tests PASS (473/473); production build PASS (264 static/dynamic page entries); payment schema-only PASS; production dependency audit PASS (0 vulnerabilities); diff check PASS. Local browser QA 390x844 ve 1440x900 boyutlarinda yatay tasma ve console error olmadan tamamlandi.

### MANUAL-001 [P1] Homepage vehicle widget ilk acilista hazir olsun

Durum: Done

Fingerprint: `public-vehicle-widget|first-render-brand-bootstrap|hydration-delays-brand-options|safe-seed-and-progressive-access`

Kapsam: Ana sayfa vehicle widget marka listesini hydration sonrasi network istegine bagimli olmaktan cikar; public-safe canonical brand seed ile ilk HTML'de hazirla. Model/generation/engine verisini yalniz kullanici secimi ilerledikce yukle; bulk katalog endpointi acma ve normal kullanimi etkilemeyecek sekilde hizli enumeration davranisini sinirla.

Sonuc: 102 canonical marka ilk server render HTML'inde hazir gelir. Public API toplu katalog indirme sunmaz; yalniz exact brands -> models -> generations -> engines -> vehicle zincirini kabul eder. Bilinmeyen/tekrarlanan cache-bust parametreleri reddedilir. On dakikada 48 standart secim istegi regresyon testinde engellenmezken 41 farkli markayi hizla enumerate eden istemci sessiz anti-abuse kapisina takilir. Existing per-URL memory/session cache ile cache -> DB -> JSON fallback davranisi korunur.

Dogrulama: Targeted vehicle tests PASS (47/47); lint PASS; full typecheck PASS; full tests PASS (465/465); production build PASS (259 pages); payment schema-only PASS; i18n/SEO PASS (12 locale, 19 source file); production dependency audit PASS (0 vulnerabilities); diff check PASS. Ilk HTML'de brand select 103 option (placeholder + 102 marka) tasir. BMW models endpointi 39 model dondurur. Ayni secime 50 hizli tekrar 200 kalirken 41 farkli marka enumeration isteginin 41'incisi 429 olur.
### AUTO-083 [P1] Homepage file-service platform stack eklensin

Durum: Done

Fingerprint: `public-seo|homepage-platform-proof-stack|platform-capabilities-not-grouped-as-trust-stack|visible-proof-stack-and-itemlist-schema`

Kapsam: Root homepage'de MG AutoTech file service'in public service hub, preparation tools, vehicle context path, private account workflow, human review boundary and customer-safe information design katmanlarini tek gorunur platform stack bolumunde topla; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Platform Stack` bolumu eklendi. Bolum public service hub, preparation tools, vehicle context path, private account workflow, human review boundary and customer-safe information design kartlariyla public route, preparation, vehicle context, account-based follow-up and privacy boundary sinyallerini bir araya getirir. Kartlar `/file-service`, `/tools`, `/tools/request-brief-builder`, `/how-it-works`, `/#professional-file-service-comparison` and `/#file-service-privacy-controls` public rotalarina baglanir. `homepageResourceJsonLd` graph'i platform-stack `ItemList` icerir ve root `WebPage` schema'si `/#file-service-platform-stack` hasPart referansi tasir. Bolum public workflow capabilities only olarak files inspect etmedigini, account data acmadigini, requests degistirmedigini veya deliverable files create etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (92/92); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (365/365); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-082 [P1] Homepage file-service reality check eklensin

Durum: Done

Fingerprint: `public-seo|homepage-reality-check|wrong-file-service-expectations-not-corrected|visible-myth-fact-and-itemlist-schema`

Kapsam: Root homepage'de file service aramasindan gelen kullanicilarin yanlis beklentilerini customer-safe myth/fact bolumuyle duzelt; file drop, homepage editing, generic route, read method, status and public detail expectations icin public route linkleri ve ItemList/WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Reality Check` bolumu eklendi. Bolum "It is just a file drop", "The homepage edits files", "Every request uses one generic route", "Read method does not matter", "Status is just a support question" and "Public pages should expose every detail" beklentilerini safe reality cevaplariyla duzeltir. Kartlar `/tools/request-brief-builder`, `/tools/file-readiness-check`, `/file-service`, `/tools/ecu-read-method-advisor`, `/how-it-works` and `/#file-service-privacy-controls` public rotalarina baglanir. `homepageResourceJsonLd` graph'i myth-checks `ItemList` icerir ve root `WebPage` schema'si `/#file-service-myth-checks` hasPart referansi tasir. Bolum public expectation correction only olarak files inspect etmedigini, account handling baslatmadigini, orders degistirmedigini veya deliverable files create etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (91/91); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (364/364); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-081 [P1] Homepage file-service verification checkpoints eklensin

Durum: Done

Fingerprint: `public-seo|homepage-verification-checkpoints|trust-verification-before-submit-not-visible|visible-checkpoints-and-itemlist-schema`

Kapsam: Root homepage'de kullanicinin secure account flow'a girmeden once file-service workflow'unu nasil dogrulayacagini anlatan customer-safe verification checkpoints bolumu ekle; route clarity, vehicle context, read method, preparation, status tracking and human review boundary sinyallerini ItemList and WebPage `hasPart` ile bagla.

Sonuc: Ana sayfaya `File Service Verification Checkpoints` bolumu eklendi. Bolum public route is clear, vehicle context is prepared, read method is understood, preparation happens before submission, status remains trackable and human review boundary is visible checkpointlerini aciklar. Kartlar `/file-service`, `/tools/request-brief-builder`, `/tools/ecu-read-method-advisor`, `/tools/file-readiness-check`, `/how-it-works` and `/#professional-file-service-comparison` public rotalarina baglanir. `homepageResourceJsonLd` graph'i verification-checkpoints `ItemList` icerir ve root `WebPage` schema'si `/#file-service-verification-checkpoints` hasPart referansi tasir. Bolum public guidance only olarak files inspect etmedigini, account data acmadigini, request handling baslatmadigini veya deliverable files create etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (90/90); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (363/363); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-080 [P1] Homepage professional file-service comparison eklensin

Durum: Done

Fingerprint: `public-seo|homepage-trust-comparison|professional-file-service-differentiation-not-visible|visible-comparison-and-itemlist-schema`

Kapsam: Root homepage'de MG AutoTech file service'in basit file handoff'tan farkini anlatan customer-safe professional comparison bolumu ekle; structured vehicle context, controller route, preparation, account workflow, human review boundary and public-site safety sinyallerini ItemList and WebPage `hasPart` ile bagla.

Sonuc: Ana sayfaya `Professional File Service Standard` bolumu eklendi. Bolum structured vehicle context, controller-specific route, preparation before submission, account-tracked workflow, human review boundary and customer-safe public website sinyallerini "without structure" vs "MG AutoTech workflow" karsilastirmasiyla aciklar. Kartlar `/tools/request-brief-builder`, `/ecu-platforms/transmission-control-units`, `/tools/file-readiness-check`, `/how-it-works` and `/file-service` public rotalarina baglanir. `homepageResourceJsonLd` graph'i professional-file-service-comparison `ItemList` icerir ve root `WebPage` schema'si `/#professional-file-service-comparison` hasPart referansi tasir. Bolum public workflow standards only olarak account data acmadigini, customer files inspect etmedigini, technical changes yapmadigini veya deliverable files create etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (89/89); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (362/362); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-079 [P1] Homepage file-service snippet summary eklensin

Durum: Done

Fingerprint: `public-seo|homepage-snippet-summary|file-service-summary-not-snippet-ready|visible-at-a-glance-summary-and-itemlist-schema`

Kapsam: Root homepage'de "what it is / who it helps / what to prepare / where secure handling starts / what public tools do / what happens after submission" cevaplarini tek gorunur At A Glance bolumunde topla; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service At A Glance` bolumu eklendi. Bolum 6 customer-safe kartla ECU/TCU file service'in ne oldugunu, kime yardim ettigini, hangi bilgilerin hazirlanacagini, secure handling'in nerede basladigini, public tools'un ne yaptigini ve submission sonrasi akisi aciklar. Kartlar `/file-service`, `/how-it-works`, `/tools/request-brief-builder`, `/tools/file-readiness-check` and `/tools/ecu-read-method-advisor` public rotalarina baglanir. `homepageResourceJsonLd` graph'i snippet-summary `ItemList` icerir ve root `WebPage` schema'si `/#file-service-snippet-summary` hasPart referansi tasir. Bolum public summary only olarak files inspect etmedigini, customer accounts degistirmedigini, requests create etmedigini veya deliverable files generate etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (88/88); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (361/361); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-078 [P1] Homepage file-service search route index eklensin

Durum: Done

Fingerprint: `public-seo|homepage-search-route-index|long-tail-file-service-queries-lack-route-map|visible-route-index-and-itemlist-schema`

Kapsam: Root homepage'de ECU file service online, TCU/gearbox file service, Stage 1 ECU file service, DTC file service request, DPF/EGR/AdBlue file request, ECU read method help, file readiness check and request brief aramalarini mevcut public route'lara baglayan gorunur long-tail route index ekle; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Search Index` bolumu eklendi. Bolum common search phrase, best route, what to prepare and open action kolonlariyla 8 arama niyetini `/file-service`, `/ecu-platforms/transmission-control-units`, `/services/stage-1`, `/services/dtc-off`, `/services/dpf-off`, `/tools/ecu-read-method-advisor`, `/tools/file-readiness-check` and `/tools/request-brief-builder` public rotalarina yonlendirir. `homepageResourceJsonLd` graph'i search-route-index `ItemList` icerir ve root `WebPage` schema'si `/#file-service-search-index` hasPart referansi tasir. Bolum existing public resources icin tek route index oldugunu ve requests create etmedigini, files inspect etmedigini, customer accounts acmadigini veya deliverable files generate etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (87/87); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (360/360); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-077 [P1] Homepage file-service answer library eklensin

Durum: Done

Fingerprint: `public-seo|homepage-answer-library|file-service-faq-depth-limited|visible-answer-library-and-faq-schema`

Kapsam: Root homepage'de online ECU file service, TCU file service, vehicle details, read method, Stage 1 route choice, diagnostic code context, homepage safety and post-submit workflow gibi arama niyetlerini cevaplayan gorunur answer library ekle; FAQPage, ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Answer Library` bolumu eklendi. Bolum 8 customer-safe soru-cevap kartiyla kullaniciyi `/file-service`, `/ecu-platforms/transmission-control-units`, `/tools/request-brief-builder`, `/tools/ecu-read-method-advisor`, `/#file-service-decision-matrix`, `/services/dtc-off`, `/tools/file-readiness-check` and `/how-it-works` public rotalarina yonlendirir. `fileServiceAnswerLibraryJsonLd` FAQPage schema'si visible cevaplardan uretilir; `homepageResourceJsonLd` graph'i answer-library `ItemList` icerir ve root `WebPage` schema'si `/#file-service-answer-library` hasPart referansi tasir. Bolum public guidance only olarak files inspect etmedigini, private account records acmadigini, account balances degistirmedigini veya delivery assets yaratmadigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (86/86); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (359/359); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-076 [P1] Homepage file-service navigator eklensin

Durum: Done

Fingerprint: `public-seo|homepage-file-service-navigator|deep-homepage-sections-hard-to-scan|visible-anchor-directory-and-itemlist-schema`

Kapsam: Root homepage'de zenginlesen file-service bolumlerini tek bir gorunur on-page navigator ile bagla; quick paths, decision matrix, use cases, workshop profiles, read methods, brief requirements, privacy controls and glossary bolumlerine customer-safe anchor linkleri ekle; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Navigator` bolumu eklendi. Bolum popular service paths, route decision matrix, workshop use cases, workshop profiles, read method routes, brief requirements, privacy controls and terminology glossary kartlariyla kullaniciyi mevcut on-page public bolumlere yonlendirir. `homepageResourceJsonLd` graph'i navigator `ItemList` icerir ve root `WebPage` schema'si `/#file-service-navigator` hasPart referansi tasir. Bolum public on-page navigation only olarak requests create etmedigini, customer files inspect etmedigini, account data acmadigini, payments degistirmedigini veya files deliver etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (85/85); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (358/358); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-075 [P1] Homepage workshop file-service profiles eklensin

Durum: Done

Fingerprint: `public-seo|homepage-workshop-profiles|workshop-audience-intent-not-visible|visible-workshop-profiles-and-itemlist-schema`

Kapsam: Root homepage'de performance workshop, diesel diagnostics workshop, transmission specialist, mobile technician, multi-brand workshop and first-time customer audience intentlerini public preparation route'larina baglayan gorunur workshop profile bolumu ekle; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `Workshop File Service Profiles` bolumu eklendi. Bolum performance workshop, diesel diagnostics workshop, transmission specialist, mobile technician, multi-brand workshop and first-time customer kartlariyla kullaniciyi `/services/stage-1`, `/services/dpf-off`, `/ecu-platforms/transmission-control-units`, `/tools/ecu-read-method-advisor`, `/brands` and `/how-it-works` public rotalarina yonlendirir. `homepageResourceJsonLd` graph'i workshop-profiles `ItemList` icerir ve root `WebPage` schema'si `/#file-service-workshop-profiles` hasPart referansi tasir. Bolum public routing guidance only olarak requests create etmedigini, customer files inspect etmedigini, customer records expose etmedigini, payments degistirmedigini veya files deliver etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (84/84); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (357/357); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-074 [P1] Homepage file-service quality signals eklensin

Durum: Done

Fingerprint: `public-seo|homepage-quality-signals|review-readiness-quality-not-visible|visible-quality-signals-and-itemlist-schema`

Kapsam: Root homepage'de ECU/TCU file-service request review clarity icin vehicle identity, controller context, service intent, file readiness, workshop notes and human review boundary sinyallerini aciklayan gorunur quality signals bolumu ekle; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Quality Signals` bolumu eklendi. Bolum vehicle identity is complete, controller context is clear, service intent is separated, file readiness is known, workshop notes are usable and human review boundary is clear kartlariyla kullaniciyi `/tools/request-brief-builder`, `/tools/ecu-read-method-advisor`, `/file-service`, `/tools/file-readiness-check` and `/how-it-works` public rotalarina yonlendirir. `homepageResourceJsonLd` graph'i quality-signals `ItemList` icerir ve root `WebPage` schema'si `/#file-service-quality-signals` hasPart referansi tasir. Bolum public preparation guidance only olarak customer files score etmedigini, uploaded content inspect etmedigini, learning evidence approve etmedigini, files generate etmedigini veya file integrity data degistirmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (83/83); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (356/356); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-073 [P1] Homepage file-service use case library eklensin

Durum: Done

Fingerprint: `public-seo|homepage-use-case-library|workshop-intents-not-mapped-to-public-routes|visible-use-case-library-and-itemlist-schema`

Kapsam: Root homepage'de Stage 1 ECU request, TCU/gearbox request, diesel technical request, diagnostic code request, unknown read method and incomplete vehicle context gibi gercek workshop arama niyetlerini public route'lara baglayan gorunur use-case library ekle; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Use Case Library` bolumu eklendi. Bolum Stage 1 ECU request, TCU and gearbox request, diesel technical request, diagnostic code request, unknown read method and incomplete vehicle context kartlariyla kullaniciyi `/services/stage-1`, `/ecu-platforms/transmission-control-units`, `/services/dpf-off`, `/services/dtc-off`, `/tools/ecu-read-method-advisor` and `/tools/request-brief-builder` public rotalarina yonlendirir. `homepageResourceJsonLd` graph'i use-case-library `ItemList` icerir ve root `WebPage` schema'si `/#file-service-use-cases` hasPart referansi tasir. Bolum public routing guidance only olarak customer files inspect etmedigini, request yaratmadigini, upload action baslatmadigini veya files modify etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (82/82); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (355/355); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-072 [P1] Homepage secure file-service privacy controls eklensin

Durum: Done

Fingerprint: `public-seo|homepage-privacy-controls|secure-file-service-boundaries-not-visible|visible-privacy-controls-and-itemlist-schema`

Kapsam: Root homepage'de secure ECU/TCU file-service privacy ve public/private boundary controls bolumu ekle; authenticated portal, public education pages, customer-visible notes separation, technical context, private delivery and support-safe explanation maddelerini public route'lara bagla; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `Secure File Service Privacy Controls` bolumu eklendi. Bolum secure ECU/TCU file service icin authenticated portal first, public pages stay educational, customer-visible notes are separated, technical context is prepared first, private delivery path and support-safe explanation maddelerini aciklar ve `/how-it-works`, `/file-service` and `/tools/request-brief-builder` public rotalarina yonlendirir. `homepageResourceJsonLd` graph'i privacy-controls `ItemList` icerir ve root `WebPage` schema'si `/#file-service-privacy-controls` hasPart referansi tasir. Bolum public privacy boundary olarak customer identity, order records, internal notes, file paths, binary data, private review metadata or delivery assets expose etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (81/81); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (354/354); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-071 [P1] Homepage file-service status guide eklensin

Durum: Done

Fingerprint: `public-seo|homepage-status-guide|status-meaning-not-visible|visible-status-guide-and-itemlist-schema`

Kapsam: Root homepage'de ECU/TCU file-service request tracking durumlarini customer-safe sekilde aciklayan gorunur status guide ekle; received, access verified, in review, waiting for customer, in progress and completed/delivered durumlarini public route'lara bagla; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Status Guide` bolumu eklendi. Bolum request tracking durumlarinin public anlamini anlatir ve `/how-it-works`, `/file-service` and `/tools/request-brief-builder` public rotalarina yonlendirir. `homepageResourceJsonLd` graph'i status-guide `ItemList` icerir ve root `WebPage` schema'si `/#file-service-status-guide` hasPart referansi tasir. Bolum sadece status anlamlarini aciklar; live order state, customer messages, internal workflow notes, file paths, binary data or delivery assets expose etmez. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (80/80); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (353/353); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-070 [P1] Homepage file-service outcome preview eklensin

Durum: Done

Fingerprint: `public-seo|homepage-outcome-preview|post-submission-flow-not-visible|visible-outcome-preview-and-itemlist-schema`

Kapsam: Root homepage'de secure ECU/TCU file-service request sonrasinda musteri tarafinda ne oldugunu anlatan gorunur outcome preview ekle; request received, human review, status tracking, customer messages, private delivery and support context adimlarini customer-safe public route'lara bagla; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Outcome Preview` bolumu eklendi. Bolum secure submission sonrasi request received, human review, status tracking, customer messages, private delivery and support context adimlarini `/how-it-works`, `/file-service` and `/tools/request-brief-builder` public rotalarina baglar. `homepageResourceJsonLd` graph'i outcome-preview `ItemList` icerir ve root `WebPage` schema'si `/#file-service-outcome-preview` hasPart referansi tasir. Bolum customer-visible boundary olarak order records, internal notes, file paths, binary data, private review metadata or generated ECU/TCU outputs expose etmedigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (79/79); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (352/352); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-069 [P1] Homepage file-service fit checker eklensin

Durum: Done

Fingerprint: `public-seo|homepage-fit-checker|customer-current-situation-not-routed|visible-fit-checker-and-itemlist-schema`

Kapsam: Root homepage'de kullanicinin mevcut file-service durumunu secip dogru public preparation route'una gitmesini saglayan gorunur fit checker ekle; ready, missing data, unclear read method, gearbox request, unclear service category and workflow-first durumlarini customer-safe linklerle bagla; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Fit Checker` bolumu eklendi. Bolum kullanicinin mevcut durumunu `/file-service`, `/tools/request-brief-builder`, `/tools/ecu-read-method-advisor`, `/ecu-platforms/transmission-control-units`, `/tools/file-readiness-check` and `/how-it-works` public rotalarina yonlendirir. `homepageResourceJsonLd` graph'i fit-checker `ItemList` icerir ve root `WebPage` schema'si `/#file-service-fit-checker` hasPart referansi tasir. Bolum sadece public preparation page routing yapar; dosyalara erismez, request olusturmaz, storage acmaz, analysis calistirmaz veya delivery karari vermez. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (78/78); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (351/351); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-068 [P1] Homepage file-service brief requirements eklensin

Durum: Done

Fingerprint: `public-seo|homepage-brief-requirements|file-service-request-requirements-not-visible|visible-brief-requirements-and-itemlist-schema`

Kapsam: Root homepage'de profesyonel ECU/TCU file-service request brief'inin hangi bilgi alanlariyla hazirlanacagini gorunur hale getir; vehicle identity, controller identity, service intent, file context, customer notes and delivery path maddelerini public preparation route'larina bagla; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Brief Requirements` bolumu eklendi. Bolum vehicle identity, controller identity, service intent, file context, customer notes and delivery path kartlariyla kullaniciyi `/tools/request-brief-builder`, `/tools/ecu-read-method-advisor`, `/file-service`, `/tools/file-readiness-check` and `/how-it-works` public rotalarina yonlendirir. `homepageResourceJsonLd` graph'i brief-requirements `ItemList` icerir ve root `WebPage` schema'si `/#file-service-brief-requirements` hasPart referansi tasir. Bolum acikca homepage'in dosya istemedigini, file content inspect etmedigini, private storage data gostermedigini veya ECU/TCU output yaratmadigini belirtir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (77/77); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (350/350); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-067 [P1] Homepage read-method route finder eklensin

Durum: Done

Fingerprint: `public-seo|homepage-read-method-router|read-method-search-intent-lacks-visible-route-finder|visible-read-method-router-and-itemlist-schema`

Kapsam: Root homepage'de OBD, bench, boot, virtual read, TCU and unknown read-method arama niyetlerini public, customer-safe preparation route'larina baglayan gorunur route finder ekle; ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfaya `Read Method Route Finder` bolumu eklendi. Bolum OBD read, bench read, boot mode context, virtual read/stock file, TCU/gearbox read and unknown read-method durumlarini `/tools/ecu-read-method-advisor`, `/tools/request-brief-builder`, `/file-service`, `/ecu-platforms/transmission-control-units` and `/tools/file-readiness-check` public rotalarina yonlendirir. `homepageResourceJsonLd` graph'i read-method route `ItemList` icerir ve root `WebPage` schema'si `/#file-service-read-methods` hasPart referansi tasir. Bolum acikca informational-only sinirini belirtir; file upload, file inspection, file editing, MOD generation, checksum, admin/private metadata, payment, AI, vehicle, desktop veya work-order logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (76/76); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (349/349); `npm run build` PASS; `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (CRLF warnings only). `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-066 [P1] Homepage above-the-fold file-service quick paths eklensin

Durum: Done

Fingerprint: `public-seo|homepage-file-service-quick-paths|above-fold-users-lack-direct-file-service-routing|visible-quick-path-navigation-and-sitenavigation-schema`

Kapsam: Root homepage hero alanina ECU file service, TCU/gearbox, Stage 1, DTC, readiness tools and workflow icin gorunur quick-path navigasyonu ekle; customer-safe `SiteNavigationElement`, ItemList and WebPage `hasPart` baglantilarini ekle.

Sonuc: Ana sayfa hero bolumune `Popular file-service paths` navigasyon bandi eklendi. Kullanici sayfaya girer girmez `/file-service`, `/ecu-platforms/transmission-control-units`, `/services/stage-1`, `/services/dtc-off`, `/tools/file-readiness-check` ve `/how-it-works` public rotalarina yonlenebilir. `homepageQuickPathJsonLd` `SiteNavigationElement` schema'si visible `homepageQuickServicePaths` listesinden uretilir; `homepageResourceJsonLd` graph'i quick-path `ItemList` icerir ve root `WebPage` schema'si `/#file-service-quick-paths` hasPart referansi tasir. Gated `/new-request` veya `/dashboard` route'lari bu quick-path schema'sina eklenmedi. File upload, raw/hex, MOD generation, checksum, admin/private metadata, payment, AI, vehicle, desktop veya work-order logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (75/75); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (348/348); `node scripts/check-payment-env.js --schema-only` PASS; `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir. `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-065 [P1] Homepage file-service glossary ve DefinedTermSet schema eklensin

Durum: Done

Fingerprint: `public-seo|homepage-file-service-glossary|technical-search-terms-lack-visible-explanations|visible-glossary-and-definedterm-schema`

Kapsam: Root homepage'de ECU/TCU file service teknik terimlerini customer-safe bir glossary olarak gorunur hale getir; ORI, MOD, read method, DTC request, secure upload and private delivery gibi arama niyetlerini public route'lara bagla; `DefinedTermSet` structured data ve ItemList/WebPage baglantilarini ekle.

Sonuc: Ana sayfaya `File Service Glossary` bolumu eklendi. Bolum ECU file service, TCU file service, ORI file, MOD file, read method, DTC request, secure upload ve private delivery terimlerini public, customer-safe copy ile aciklar ve mevcut public hub/tool/service/workflow rotalarina baglar. `homepageFileServiceGlossaryJsonLd` `DefinedTermSet` structured data'si visible `fileServiceGlossaryTerms` listesinden uretilir; `homepageResourceJsonLd` graph'i glossary `ItemList` icerir ve root `WebPage` schema'si `/#file-service-glossary` hasPart referansi tasir. File upload, raw/hex, MOD generation, checksum, admin/private metadata, payment, AI, vehicle, desktop veya work-order logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (74/74); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (347/347); `node scripts/check-payment-env.js --schema-only` PASS; `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir. `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-064 [P1] Homepage online file-service operating standard eklensin

Durum: Done

Fingerprint: `public-seo|homepage-file-service-operating-standard|trust-boundary-not-visible|visible-operating-standard-and-itemlist-schema`

Kapsam: Root homepage'de online ECU/TCU file service icin guven ve operasyon standardini gorunur hale getir; secure intake, vehicle context, human review boundary ve private dashboard delivery ilkelerini public route'lara bagla; customer-safe ItemList structured data ve WebPage `hasPart` baglantisini ekle.

Sonuc: Ana sayfaya `Online File Service Standard` bolumu eklendi. Bolum MG AutoTech file-service akisini sadece bir upload formu gibi degil, secure request intake, vehicle context before review, human review boundary ve private dashboard delivery standardi olarak anlatir. Kartlar public `/file-service`, `/tools/request-brief-builder` ve `/how-it-works` rotalarina baglanir; structured data ItemList icinde gated `/new-request` veya `/dashboard` route'u kullanilmaz. Public copy file okumaz, storage path acmaz, private metadata gostermeyiz veya customer-ready ECU/TCU output olusturmayiz sinirini netlestirir. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (73/73); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (346/346); `node scripts/check-payment-env.js --schema-only` PASS; `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir. `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-063 [P1] Homepage file-service decision matrix ve metadata search variants eklensin

Durum: Done

Fingerprint: `public-seo|homepage-file-service-decision-matrix|broad-file-service-users-lack-route-selection|visible-decision-matrix-and-metadata-keywords`

Kapsam: Root homepage'de broad online ECU/TCU file-service aramalarindan gelen kullaniciyi dogru public route'a yonlendiren gorunur karar matrisi ekle; root metadata/OG/Twitter alanlarina customer-safe online file-service arama varyantlarini ekle; checker ve UI safety testleriyle guardla.

Sonuc: Ana sayfaya `File Service Decision Matrix` bolumu eklendi. Bolum online ECU file service, TCU file service, Stage 1 file service, diesel technical request, DTC request ve emin olmayan kullanici niyetlerini mevcut public hub/service/tool rotalarina baglar; her satir customer need, best path, upload oncesi hazirlik ve CTA gosterir. Root `metadata` artik online ECU File Service, TCU File Service, ECU File Upload Service ve ECU/TCU tuning file service varyantlarini hedefler; OpenGraph/Twitter copy daha net file-service odaklidir. `homepageResourceJsonLd` graph'i decision-matrix `ItemList` icerir ve root `WebPage` schema'si `/#file-service-decision-matrix` hasPart referansi tasir. File upload, raw/hex, MOD generation, checksum, admin/private metadata, payment, AI, vehicle, desktop veya work-order logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (72/72); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (345/345); `node scripts/check-payment-env.js --schema-only` PASS; `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir. `npm run check:payments` normal modda local env dosyalari okudugu icin calistirilmadi.

### AUTO-062 [P1] Homepage file-service knowledge map ve ItemList schema eklensin

Durum: Done

Fingerprint: `public-seo|homepage-file-service-knowledge-map|broad-file-service-intent-lacks-guided-topic-map|visible-topic-map-and-itemlist-schema`

Kapsam: Root homepage'de broad `file service`, `ECU file service`, `TCU file service`, Stage 1, diesel/diagnostic request ve readiness intentlerini tek bir gorunur bilgi haritasinda topla; customer-safe ItemList structured data ve WebPage `hasPart` baglantisini ekle.

Sonuc: Ana sayfaya `File Service Knowledge Map` bolumu eklendi. Bolum broad file-service aramalarini ECU file service, TCU file service, Stage 1 file preparation, diesel support request path, DTC request preparation ve request readiness tools rotalarina yonlendirir. `homepageResourceJsonLd` graph'i yeni knowledge-map `ItemList` icerir ve root `WebPage` schema'si `/#file-service-knowledge-map` parcasina baglanir. Checker ve UI safety testleri bu bolumu ve schema baglantisini guardlar. File upload, raw/hex, MOD generation, checksum, admin/private metadata, payment, AI, vehicle, desktop veya work-order logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (70/70); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (343/343); `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir. `npm run check:payments` de AGENTS kurallari geregi acik onay olmadan calistirilmadi.

### AUTO-061 [P1] Localized file-service hub hreflang ve route mapping eklensin

Durum: Done

Fingerprint: `public-seo|localized-file-service-hub|english-only-file-service-hub-lacks-hreflang-routes|localized-indexable-hub`

Kapsam: `/file-service` public hub'ini localized SEO ailesine bagla; `/[locale]/file-service` route'u, reusable file-service copy/structured-data helper'i, localized homepage/footer linkleri, route switcher mapping, sitemap, robots, i18n checker ve tests guncellensin.

Sonuc: `src/lib/fileServiceI18n.ts` ile English/German/Turkish-first File Service Hub copy ve `fileServiceJsonLd` structured data helper'i eklendi. `/de/file-service`, `/tr/file-service` ve tum supported SEO locale route'lari ayni customer-safe hub yapisini render eder; canonical/hreflang, Open Graph locale alternates, `CollectionPage`, `Service`, `FAQPage`, `BreadcrumbList` ve `ItemList` graph'i uretir. Localized homepage ve localized footer artik localized file-service hub'a link verir. Language switcher helper'i `/file-service` route'unu locale'ler arasinda korur. Root `/file-service` metadata'si de language alternates yayimlar. Sitemap ve robots localized file-service route'larini kapsar. Payment, AI, vehicle, desktop, work-order, upload, MOD generation, checksum, raw/hex veya private metadata logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts tests\i18n-routing.test.ts` PASS (69/69); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (342/342); `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir. `npm run check:payments` de AGENTS kurallari geregi acik onay olmadan calistirilmadi.

### AUTO-060 [P1] Public file-service hub ve indexable SEO route eklensin

Durum: Done

Fingerprint: `public-seo|file-service-hub|generic-file-service-intent-lacks-indexable-hub|homepage-linked-public-hub`

Kapsam: Root homepage'deki file-service arama niyeti bolumunu ayri, indexlenebilir `/file-service` public hub sayfasina bagla; header/footer, sitemap, robots ve SEO checker/test guardlarini guncelle.

Sonuc: `/file-service` artik ECU & TCU File Service Hub olarak public, customer-safe landing/resource sayfasi sunar. Sayfa ECU File Service, TCU File Service, Stage 1 File Service ve Diesel/Diagnostic File Requests kategorilerini, request workflow adimlarini, public preparation tools/resource linklerini, safety boundary kartlarini ve FAQ icerigini gosterir. Header, footer ve homepage bu hub'a link verir; sitemap ve robots route'u public discoverable hale getirir. Sayfa `CollectionPage`, `Service`, `FAQPage`, `BreadcrumbList` ve `ItemList` structured data uretir. File upload, raw/hex, MOD generation, checksum, admin/private metadata, payment, vehicle DB, AI, desktop veya work-order logic degismedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (66/66); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (341/341); `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir.

### AUTO-059 [P1] Homepage file-service search intent hub ve Service schema guclendirilsin

Durum: Done

Fingerprint: `public-seo|homepage-file-service-intent|generic-file-service-query-lacks-focused-section|visible-service-hub-and-service-schema`

Kapsam: Root homepage'e ust akis icinde gorunur ECU/TCU file service intent hub'i, safe request checklist'i ve customer-safe `Service` JSON-LD eklendi.

Sonuc: Ana sayfa Live Workload sonrasinda `Professional ECU & TCU file service for workshops` bolumu gosterir. Bolum ECU File Service, TCU File Service, Stage 1 File Service ve DPF/EGR/AdBlue/DTC file request kartlarini mevcut public request/service/platform rotalarina baglar. `homepageFileServiceJsonLd` Service schema'si `#ecu-tcu-file-service` id'siyle root WebPage graph'ina baglandi ve OfferCatalog mevcut public service landing page listesi uzerinden uretiliyor. Homepage veya schema file upload, raw/hex, MOD generation, checksum, admin/private metadata, payment change veya customer data icermiyor.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (65/65); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (340/340); `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir.

### RMAP-FILE-QUALITY-SCORE-M1-FOUNDATION [P1] AI File Quality Score deterministic baseline and explainability foundation

Durum: Done

Fingerprint: `ai-capability|file-quality-score|file-request-quality-lacks-explainable-deterministic-baseline|deterministic-quality-score-foundation`

Kapsam: AI File Quality Score M1 icin local-only `file-quality-score-v1` deterministic quality/readiness contract, factor scoring, provider/unavailable/fallback states, customer/expert projection boundary and operator runbook eklendi.

Sonuc: `src/lib/fileQualityScore` request metadata, structured File Expert analyzer evidence, integrity/risk signals, service context and review blockers uzerinden bounded 0-100 score, grade, readiness, factor breakdown, evidence reasons, missing-information list, risk flags, recommendations, human-review gate, safety boundaries and blocked production actions uretir. Default provider unconfigured kalir ve deterministic non-AI fallback kullanir; provider unavailable, provider-unavailable fallback, provider-error fallback and invalid-input states explicit kalir ve fallback output `isAiGenerated: false` tasir. Customer projection provider id/kind/status, model name, prompt version, fallback internals, factor weights, raw binary/hex, offsets, hashes, filenames, storage paths, signed URLs, customer identifiers, sample IDs and admin-only notes tasimaz. Expert projection provider/fallback status, weighted factors, required human checks and blocked production actions tasir. No UI/API route, DB migration, live provider call, production analytics persistence, pricing/payment policy, MOD output, checksum approval, deploy, package install, `.env*`, secret, commit or push yapildi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (96/96); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (62/62); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (333/333); `git diff --check` PASS (CRLF warnings only); new File Quality Score source forbidden live-service/env/secret pattern scan PASS; new-file trailing whitespace scan PASS. `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir, bu no-env/no-live-network foundation run siniri icin guvenli degil.

### RMAP-FILE-AI-EXPLAIN-LAYER-M1-FOUNDATION [P1] AI Explain Layer source labels and unavailable-state foundation

Durum: Done

Fingerprint: `ai-capability|explain-layer|ai-recommendation-surfaces-lack-source-labeled-unavailable-contract|source-label-unavailable-foundation`

Kapsam: AI Explain Layer M1 icin reusable local-only `ai-explain-layer-v1` contract, source-label generation, provider/unavailable/fallback states, customer/expert projection boundary and operator runbook eklendi.

Sonuc: `src/lib/aiExplain` evidence, recommendation, risk flag, human-review gate, provider-state and fallback-state source labelsini uretir. Default provider unconfigured kalir ve deterministic non-AI fallback kullanir; provider unavailable, provider-unavailable fallback, provider-error fallback and invalid-input states explicit kalir ve successful AI output gibi sunulmaz. Customer projection provider id/kind/status, model name, prompt version, fallback internals, raw binary/hex/CSV, hashes, signed URLs, storage paths, filenames, customer identifiers, sample ids and admin-only notes tasimaz. Expert projection provider status, fallback reason, source labels, required human checks and blocked production actions tasir. No live provider routing, UI/API endpoint, DB migration, production analytics persistence, MOD output, checksum approval, delivery automation, `.env*`, secret, package install, commit, push or deploy yapildi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (90/90); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (61/61); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (326/326); `git diff --check` PASS (CRLF warnings only). Reviewer expert/source-label projection boundary regression fix applied. `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir, bu no-env/no-live-network foundation run siniri icin guvenli degil.

### RMAP-FILE-AI-LOG-ANALYZER-M1-FOUNDATION [P1] AI Log Analyzer provider fallback and safe log summary foundation

Durum: Done

Fingerprint: `ai-capability|log-analyzer|browser-log-tool-lacks-provider-safe-analysis-contract|provider-fallback-safe-summary-foundation`

Kapsam: AI Log Analyzer M1 icin local-only provider-neutral contract, deterministic non-AI RPM/Nm log summary fallback, customer/expert projection boundary and review-gated runbook eklendi.

Sonuc: `src/lib/logAnalyzer` `log-analyzer-v1` contract'i ile provider unavailable/error/invalid-input states, deterministic fallback, confidence/readiness semantics, evidence, risk flags, recommendation categories, `humanReview.required === true` and blocked production actions saglar. Fallback AutoTuner CSV headersini ve simple RPM/Nm rows'u normalize eder; valid/rejected row count, RPM range, torque range, average torque and peak estimated torque/power facts uretir, fakat AI gibi davranmaz ve dyno-equivalent claim yapmaz. Customer projection provider/model/prompt/fallback internals, raw CSV rows, raw binary/hex, filenames, storage paths, signed URLs, hashes, customer identifiers and admin-only notes tasimaz; expert projection provider/fallback status, normalized counts, required human checks and blocked production actions tasir. No live provider call, upload endpoint, DB migration, public claim, MOD output, checksum approval, production access, `.env*`, secret, package install, commit, push or deploy yapildi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (84/84); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (60/60); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (319/319); `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir, bu no-env/no-live-network foundation run siniri icin guvenli degil.

### RMAP-FILE-AI-TUNE-ADVISOR-M1-FOUNDATION [P1] AI Tune Advisor rule fallback and expert review foundation

Durum: Done

Fingerprint: `ai-capability|tune-advisor|request-service-guidance-lacks-safe-rule-fallback|rule-fallback-expert-review-contract`

Kapsam: AI Tune Advisor M1 icin request/service metadata uzerinden local-only provider-neutral contract, deterministic non-AI fallback, customer/expert projection boundary and review-gated runbook eklendi.

Sonuc: `src/lib/tuneAdvisor` `tune-advisor-v1` contract'i ile provider unavailable/error/invalid-input states, deterministic fallback, confidence/readiness semantics, missing evidence, risk flags, recommendation categories, safety boundaries, `humanReview.required === true` and blocked production actions saglar. Stage/eco/TCU/only-options/original-file plus selected advanced service contexts existing desktop/new-request service taxonomy'sinden cozulur. Customer projection provider/model/prompt/fallback internals, storage paths, hashes, raw binary/hex, sample IDs and admin-only notes tasimaz; expert projection provider/fallback status, required human checks and blocked production actions tasir. Runbook future live/provider rollout icin operator-only decisions and safe validation gates'i belgeler. No pricing, credits, request submission, upload behavior, delivery, MOD output, checksum workflow, public legal/commercial claim, live provider config, production access, migration, `.env*`, secret, package install, commit, push or deploy yapildi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (79/79); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (59/59); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (313/313); `git diff --check` PASS (CRLF warnings only). `npm run build` not run because this repo build can load local Next env files and request Google Fonts, outside this run's no-env/no-live-network boundary.

### RMAP-FILE-AI-EXPERT-V2-M1-FOUNDATION [P1] AI File Expert V2 provider fallback and review gate foundation

Durum: Done

Fingerprint: `ai-capability|file-expert-v2|ai-report-lacks-explicit-review-gate-status-contract|provider-fallback-review-foundation`

Kapsam: Existing File Expert AI report flow now has a local V2 provider/fallback status and review-gate contract without DB migration, live provider call, production access or MOD/checksum export.

Sonuc: `generateAiFileExpertReport` now attaches provider generation metadata for provider-generated, deterministic fallback and provider-error fallback states. `src/lib/fileExpert/reportStatus.ts` defines `file-expert-v2-report-gate-v1` with provider/model/prompt status, fallback reason, human-review requirement, export lock and blocked production actions. New analyses store the status in existing `result_json.ai_report_status`; admin File Expert shows the state and blocked production actions, while customer projection converts it to a provider-free human-review/export-lock notice. The runbook documents safe local validation and operator-only production decisions. No secrets, `.env*`, live service, production data, migration, package install, pricing/legal change, customer-ready MOD output, checksum approval, commit, push or deploy was performed.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (73/73); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (58/58); `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (28/28); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (306/306); `git diff --check` PASS (CRLF warnings only). `npm run build` not run because this repo build can load local Next env files and request Google Fonts, outside this run's no-env/no-live-network boundary.

### RMAP-FILE-DTC-M5-ROLLOUT-READINESS [P1] AI DTC Analyzer rollout readiness pack

Durum: Done

Fingerprint: `ai-capability|dtc-analyzer|rollout-readiness-missing|regression-analytics-documentation-pack`

Kapsam: DTC Analyzer M5 icin local-only rollout readiness contract/report, sanitized fixture analytics helper ve operator runbook eklendi.

Sonuc: `src/lib/dtcAnalyzer/rolloutReadiness.ts` `buildDtcRolloutReadinessReport` ve `projectDtcRolloutAnalyticsSnapshot` helperlarini saglar; regression scenario coverage, provider/fallback/usage boundary summary, allow-listed audit metadata aggregation, blocked production actions and validation gates local kod sozlesmesi olarak raporlanir. `docs/dtc-analyzer-rollout-readiness.md` safe local validation komutlarini, operator-only production rollout checks listesini ve kalan limitasyonlari belgeler. Testler readiness contract, sanitized analytics no-leak behavior and runbook local-only boundaries icin genisletildi. Live provider call, production analytics query, `.env*` read, migration, package install, pricing/legal change, DTC-off approval, checksum/MOD output veya deploy yapilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (71/71); `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (28/28); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (57/57); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (303/303); `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir.

### RMAP-FILE-DTC-M4-ADMIN-CONFIGURATION [P1] AI DTC Analyzer admin configuration and usage limits

Durum: Done

Fingerprint: `ai-capability|dtc-analyzer|admin-provider-state-and-usage-limits-missing|admin-configuration-boundary`

Kapsam: Existing DTC Analyzer request routes now share a local-only admin configuration and usage-limit boundary before analysis.

Sonuc: Added `src/lib/dtcAnalyzer/config.ts` with provider-unavailable status, deterministic fallback mode, local request/text/code limits and reusable usage guard. Customer/admin DTC routes now enforce the same guard before analysis, return safe over-limit payloads with retry timing where applicable, and skip generated-analysis audit writes for rejected usage. Admin DTC Expert Review now displays provider availability, fallback mode, configured usage limits and limit/failure state while preserving loading, empty, error, retry and accessibility behavior. Customer projection still hides provider/model/prompt/config internals, raw notes, storage paths, hashes, binary/hex data, sample ids and private metadata. Audit metadata marks provider unavailable/error and `analysis_success: false` for fallback/unavailable states.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (69/69); `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (28/28); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (56/56); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (300/300); `git diff --check` PASS (CRLF warnings only). `npm run build` not run because this repo build can load local env files and request Google Fonts, which is outside this run's no-env/no-live-network boundary.

### RMAP-FILE-DTC-M3-REQUEST-INTEGRATION [P1] AI DTC Analyzer request boundary and audit integration

Durum: Done

Fingerprint: `ai-capability|dtc-analyzer|request-notes-not-connected-to-safe-analysis|request-boundary-audit-integration`

Kapsam: Existing DTC analyzer response contract is now connected to request detail lifecycle surfaces with customer/expert projection boundaries and best-effort internal audit events.

Sonuc: Added `src/lib/dtcAnalyzer/requestIntegration.ts` to build request-level DTC analysis from existing order text, service and vehicle fields, project customer-safe and expert/admin-safe responses, and produce sanitized audit metadata. Added authenticated customer and admin POST routes for request DTC analysis with order ownership and `orders.view` staff boundaries. Customer order detail now shows `DTC Diagnostic Guidance` with empty/loading/error/retry/result states and only customer-safe summary, detected codes, missing info, evidence/recommendations/confidence and safety/human-review boundaries. Admin work-order detail now shows `DTC Expert Review` with provider/fallback status and detailed evidence/risk/recommendation structure, then refreshes the internal-only audit timeline. No DB schema, migration execution, live provider call, desktop DTC activation, file processing, MOD output, checksum action, pricing, legal or commercial policy change was added.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (66/66); `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (28/28); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (56/56); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (297/297); `npm run build` PASS (228/228, Next reported `.env.local` presence but no secret values were logged); `git diff --check` PASS (CRLF warnings only).

### RMAP-FILE-DTC-M2-ANALYSIS-SERVICE [P1] AI DTC Analyzer analysis service contract

Durum: Done

Fingerprint: `ai-capability|dtc-analyzer|fallback-output-lacks-evidence-risk-confidence-model|analysis-service-contract`

Kapsam: Existing `src/lib/dtcAnalyzer` response contract now carries local-only analysis-service semantics for structured evidence, deterministic risk flags, categorized recommendations and explicit confidence reasons.

Sonuc: `DtcAnalyzerResponse` and per-code analysis now expose customer-safe `evidence`, `riskFlags`, `recommendations` and `confidenceReasons`. Known DTCs remain capped at `medium`, unknown valid DTCs stay `low`, invalid input stays `none`, and provider-unavailable/provider-error fallback paths preserve provider identity, fallback reason and `isAiGenerated: false`. Recommendation categories separate diagnostic checks, missing information and human review gates without approving DTC-off, file edits, byte patches, checksum work or customer-ready MOD output. No UI, API route, DB schema, migration, external provider, env read, file processing, MOD/checksum action, pricing or customer-data access was added.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (64/64); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (55/55); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (293/293); `npm run build` PASS (228/228); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-058 [P2] Public preparation tools sitemap/robots discovery guclendirilsin

Durum: Done

Fingerprint: `public-seo|public-preparation-tools|homepage-linked-tools-not-crawler-discovered|sitemap-robots-discovery`

Kapsam: Homepage ve tools hub'da one cikan guvenli hazirlik araclari, sitemap ve robots allow listesinde crawler-discoverable hale getirildi.

Sonuc: `/tools/file-readiness-check`, `/tools/request-brief-builder` ve `/tools/ecu-read-method-advisor` `sitemap.ts` toolPaths listesine ve `robots.ts` public allow listesine eklendi. `scripts/check-i18n-seo.mjs` bu uc route'u sitemap/robots kontrati olarak zorunlu kontrol eder. Private/admin/dashboard/API/upload-session/raw/binary/checksum/MOD alanlari sitemap discovery'ye eklenmedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (55/55); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (291/291); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-057 [P2] Homepage request preparation HowTo structured data eklensin

Durum: Done

Fingerprint: `public-seo|homepage-request-preparation|visible-readiness-steps-not-machine-readable|safe-howto-jsonld`

Kapsam: Homepage'deki gorunur `Request Readiness Cockpit` adimlari, customer-safe `HowTo` structured data olarak arama motoru/AI search tarafina da anlatildi.

Sonuc: `homepageRequestPreparationHowToJsonLd` eklendi ve mevcut `requestReadinessSteps` kaynagindan uretilir hale getirildi. Root `WebPage` graph'i bu HowTo graph'ini `hasPart` ile referanslar. HowTo yalniz dosya talebine hazirlik, teknik brief, read-method planlama ve secure portal submission adimlarini anlatir; file picker, upload session, binary read, raw/hex, checksum, MOD generation, payment veya admin/private metadata icermez.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (54/54); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (290/290); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-056 [P2] Root homepage page-level structured data guclendirilsin

Durum: Done

Fingerprint: `public-seo|root-homepage|root-page-lacks-webpage-identity-schema|homepage-webpage-jsonld`

Kapsam: Root `/` homepage, FAQPage ve resource ItemList graph'lerinin yaninda explicit WebPage identity JSON-LD basar hale getirildi.

Sonuc: `homepagePageJsonLd` eklendi; root homepage canonical URL, language, Organization/WebSite linkleri, primary image ve FAQ/service/brand/platform schema part referanslariyla page-level identity kazanir. `homepageSearchIntentJsonLd` ve ItemList graph'leri stable `@id` degerleriyle baglandi. Private/admin/payment/AI/file-generation alanlari yok.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (53/53); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (289/289); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-055 [P2] Localized homepage page-level structured data guclendirilsin

Durum: Done

Fingerprint: `public-seo|localized-homepage|locale-routes-lack-page-level-service-schema|localized-webpage-service-itemlist-jsonld`

Kapsam: `/de`, `/tr`, `/fr` ve diger localized homepage route'lari, Organization/WebSite graph'inin yaninda locale-specific WebPage ve service ItemList structured data basar hale getirildi.

Sonuc: `src/app/[locale]/page.tsx` icinde `buildLocalizedHomepageJsonLd` helper'i eklendi. Her localized homepage kendi canonical localized URL'si, language code'u, organization/website baglantisi, primary image ve localized public service listesiyle `WebPage` + `ItemList` JSON-LD uretir. Service listesi `publicServiceSlugs` ve `getServiceSeo(slug, locale)` kaynaklarindan gelir; fiyat/credit, payment, private/admin metadata, API call, DB query, AI generation, file upload veya vehicle import eklenmedi. `scripts/check-i18n-seo.mjs` bu kontrati regression olarak kontrol eder.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (52/52); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (288/288); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-054 [P2] Homepage resource structured data public link hub'larini tanitsin

Durum: Done

Fingerprint: `public-seo|homepage-resource-structured-data|visible-link-hubs-not-described-as-itemlists|resource-itemlist-jsonld`

Kapsam: Homepage'deki service, brand ve ECU platform public link hub'lari, ayni kaynak veriden uretilen customer-safe ItemList structured data ile arama motorlarina aciklandi.

Sonuc: `/` artik FAQPage JSON-LD'nin yaninda service landing page, supported brand guide ve ECU/TCU platform guide ItemList JSON-LD graph'i basar. Service ItemList sadece mevcut `/services/...` landing page'leri kapsar; TCU `new-request` fallback'i structured data'ya resource gibi eklenmez. Fiyat/credit, raw/private/admin metadata, API call, DB query, payment/credit mutation, AI generation, vehicle import, email, desktop veya work-order logic eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (51/51); `node scripts/check-i18n-seo.mjs` PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (287/287); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-053 [P2] Homepage ECU platform library public guide ic linklerini guclendirsin

Durum: Done

Fingerprint: `public-seo|homepage-ecu-platform-library|platform-pages-not-linked-from-homepage|deep-linked-ecu-platform-hub`

Kapsam: Public ana sayfaya, mevcut `/ecu-platforms/[slug]` technical guide sayfalarina dogrudan ic link veren `ECU Platform Library` bolumu eklendi.

Sonuc: `/` artik Bosch EDC17, Bosch MD1, Bosch MG1, Continental SIMOS, Continental SID, Delphi DCM, Denso ve TCU & Gearbox public guide sayfalarina gorunur kartlarla link verir. Bolum controller family, read method ve identification bilgisi hazirlamayi anlatir; public guide'larin dosya edit/uretme/checksum-correct yapmadigi guvenli sinir olarak belirtilir. Yeni API, DB query, payment/credit mutation, AI generation, vehicle import, email, desktop veya work-order logic eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (50/50); `node scripts/check-i18n-seo.mjs` PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (286/286); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-052 [P2] Homepage brand cards public brand page ic linklerini guclendirsin

Durum: Done

Fingerprint: `public-seo|homepage-brand-cards|brand-pages-not-linked-from-homepage|deep-linked-brand-hub-cards`

Kapsam: Public ana sayfadaki supported brand kartlari, mevcut `/brands/[slug]` landing page'lere dogrudan ic link veren tiklanabilir kartlara donusturuldu.

Sonuc: `/` icindeki `Supported Brands` kartlari artik BMW, Mercedes-Benz, Audi, Volkswagen, Porsche, Opel, Renault ve Peugeot icin mevcut `/brands/...` sayfalarina gider. Kartlara net marka CTA'si eklendi; `Need another brand?` manual request yolu korunur. Yeni API, DB query, payment/credit mutation, AI generation, vehicle import, email, desktop veya work-order logic eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (49/49); `node scripts/check-i18n-seo.mjs` PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (285/285); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-051 [P2] Homepage servis kartlari public landing page ic linklerini guclendirsin

Durum: Done

Fingerprint: `public-seo|homepage-service-cards|service-pages-not-linked-from-cards|deep-linked-service-hub-cards`

Kapsam: Public ana sayfadaki servis kartlari, mevcut public service landing page'lere dogrudan ic link veren tıklanabilir kartlara donusturuldu.

Sonuc: `/` icindeki `Our Services` kartlari artik Stage 1, DPF OFF, EGR / AGR OFF, AdBlue OFF ve DTC OFF icin mevcut `/services/...` landing page'lerine gider. TCU Tuning karti, public service slug'i olmadigi icin yeni claim uretmeden mevcut `/new-request` review yoluna gider. Kartlara service intent rozeti ve net CTA eklendi. Fiyat/credit metinleri degistirilmedi. Yeni upload, file picker, API call, DB query, payment/credit mutation, AI generation, vehicle import, email, desktop veya work-order logic eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (48/48); `node scripts/check-i18n-seo.mjs` PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (284/284); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-050 [P2] Homepage search-intent FAQ schema ve workshop guide gostersin

Durum: Done

Fingerprint: `public-seo|homepage-search-intent|common-file-service-questions-hidden|faq-schema-workshop-guide`

Kapsam: Public ana sayfa, dosya yuklemeden once aranan temel file-service sorularini gorunur `Workshop Search Guide` bolumu ve customer-safe `FAQPage` structured data ile cevaplar hale getirildi.

Sonuc: `/` artik `Workshop Search Guide` bolumunde file request hazirligi, public preparation tools siniri, private dashboard delivery ve manual vehicle request yolunu net cevaplar. Ayni kaynak veriden `homepageSearchIntentJsonLd` uretilir ve `application/ld+json` olarak sayfaya eklenir. Bolum yalniz mevcut `/tools`, `/tools/file-readiness-check`, `/how-it-works` ve `/new-request` route'larina gider. Yeni upload, file picker, API call, DB query, payment/credit mutation, AI generation, vehicle import, email, desktop veya work-order logic eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (47/47); `node scripts/check-i18n-seo.mjs` PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (283/283); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-049 [P2] Musteri dashboard preparation-to-delivery workflow map gostersin

Durum: Done

Fingerprint: `customer-experience|dashboard-workflow|actions-scattered-without-end-to-end-map|preparation-to-delivery-workflow-map`

Kapsam: Musteri dashboard, hazirlik araclari, secure request, order tracking ve delivery adimlarini tek bir `Customer Workflow Map` bolumunde siraladi.

Sonuc: `/dashboard` artik `Customer Workflow Map` ile `Prepare file`, `Build request brief`, `Submit secure request`, `Track live work` ve `Review delivery` adimlarini gosterir. Adimlar yalniz mevcut public tool, new-request ve customer dashboard route'larina gider. `Track live work` needs-response varsa dogrudan response filtresine, yoksa order listesine gider. Bolum `No raw file is handled by these prep tools` sinirini aciklar. Yeni API, DB query, payment/credit policy, upload flow, AI, vehicle, email, desktop veya work-order logic degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (46/46); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (282/282); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-048 [P2] Musteri settings hesap hazirligini canli gostersin

Durum: Done

Fingerprint: `customer-experience|settings-profile|form-only-account-details|live-account-readiness-and-copy-reference`

Kapsam: Musteri settings sayfasi, sadece editable profil formu olmaktan cikarak canli account readiness ozeti ve tek tik bank-transfer reference kopyalama aksiyonu kazandi.

Sonuc: `/dashboard/settings` artik `Account Readiness` bolumunde contact details, invoice contact, billing address ve account type/company profile kontrollerini canli tamamlandi/eksik durumuyla gosterir. Readiness yuzdesi form alanlari degistikce hesaplanir. Bank Transfer Reference kartina `Copy reference` aksiyonu eklendi; kopyalama basariliysa `Reference copied`, basarisizsa customer-safe manuel kopyalama mesaji gosterir. Yeni API, DB query, payment mutation, email, vehicle, AI, desktop veya work-order logic degismedi; referans mevcut customer ID formatter'indan gelir.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (45/45); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (281/281); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-047 [P2] Legacy admin dashboard daily command brief gostersin

Durum: Done

Fingerprint: `admin-operations|legacy-admin-dashboard|priority-signals-scattered|daily-command-brief`

Kapsam: Legacy `/admin` dashboard, mevcut order/customer metriklerini tek bir `Daily Command Brief` bolumunde oncelikli operasyon kararina cevirdi.

Sonuc: Admin ana paneli artik `Daily Command Brief` ile `Start with new file intake`, `Resolve customer info blockers`, `Clear revision requests`, `Move file checks forward`, `Monitor active work` ve `Queue under control` onceliklerini otomatik siralar. `Open priority queue` mevcut order filtresini ayarlar; `Queue health` file coverage/open work/blocked signal/last sync gosterir. `Operational links` permission-gated olarak Work-order Center, File Expert, Vehicle Database ve Revenue Control'a gider. Yeni API, DB mutation, payment/credit policy, AI, vehicle, email, desktop veya work-order logic degismedi; customer email, internal note, file path, signed URL, storage, raw/hex gibi private alanlar bu brief'te kullanilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (44/44); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (280/280); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-046 [P2] Public homepage request readiness cockpit gostersin

Durum: Done

Fingerprint: `public-homepage|request-preparation|tools-hidden-below-fold|readiness-cockpit-before-upload`

Kapsam: Public homepage, tools hub'daki guvenli hazirlik araclarini ana sayfada gorunur bir `Request Readiness Cockpit` bolumune bagladi.

Sonuc: `/` artik live workload bolumunden sonra `Request Readiness Cockpit` gosterir. Bolum musteriyi sirayla file readiness check, request brief builder, ECU read method advisor ve secure new-request akisine yonlendirir. Yan panelde hazirlik araclarinin file upload/modification yapmadigi, kredilerin request creation sirasinda dogrulandigi, teslimlerin customer dashboard icinde kaldigi ve kompleks islerin human review altinda oldugu netlesir. Yeni bolum yalniz mevcut public tool/new-request linklerine gider; file picker, upload session, API/admin call, binary read, checksum veya MOD generation eklenmedi. Payment/credit policy, customer auth, AI, vehicle, email, desktop ve work-order mantigi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (43/43); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (279/279); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-045 [P2] Public tools hub musteri hazirlik akisini gostersin

Durum: Done

Fingerprint: `public-tools|tools-hub|tool-list-without-guided-flow|recommended-request-prep-workflow`

Kapsam: Public `/tools` sayfasi, tek tek arac listesinin yaninda musteriye dosya talebinden once hangi sirayla hazirlanacagini gosteren guvenli bir workflow seridi ve guncel SEO aciklamalariyla iyilestirildi.

Sonuc: Tools hub artik `Recommended workflow` bolumunde `Check readiness`, `Build a clean brief`, `Plan the read method` ve `Submit the request` adimlarini gosterir. Hero, metadata, Open Graph, Twitter ve JSON-LD aciklamalari yalniz eski torque/log araclarina odaklanmak yerine mevcut readiness, brief builder, read method advisor ve browser-based calculator kapsamini yansitir. Yeni bolum yalniz mevcut public tool/new-request linklerine gider; file picker, upload session, API/admin call, binary read, checksum veya MOD generation eklenmedi. Payment/credit policy, customer auth, AI, vehicle, email, desktop ve work-order mantigi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (42/42); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (278/278); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-044 [P2] Musteri order detayinda guvenli destek ozetini kopyalat

Durum: Done

Fingerprint: `customer-experience|order-detail-support-summary|manual-reference-copying|safe-copyable-support-summary`

Kapsam: Musteri order detail destek bolumune, destek ekibine yazarken kullanilabilecek customer-safe siparis ozetini tek tikla kopyalama aksiyonu eklendi.

Sonuc: `/dashboard/orders/[id]` Support karti artik `Support summary` bolumu ve `Copy safe summary` aksiyonu gosterir. Kopyalanan metin yalniz siparis referansi, durum, arac ozeti, hizmet ve olusturma tarihini icerir. Storage path, signed URL, raw/hex, hash, admin note, internal note, source/confidence veya dosya yolu gibi private alanlar ozete dahil edilmez. Mevcut mailto support linki, download, revision, additional upload, live sync ve customer-scoped order query davranisi korunur. Payment/credit policy, order mutation, AI, vehicle, email, desktop ve work-order mantigi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (41/41); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (277/277); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-043 [P2] Musteri siparis arsivi yuklenen sayfa ozetini gostersin

Durum: Done

Fingerprint: `customer-experience|order-archive-loaded-summary|loaded-orders-hidden-context|safe-page-level-summary-strip`

Kapsam: Musteri siparis arsivi, aktif filtrede yuklenen sayfanin kac kayit, kac aksiyon gereken is, kac teslim dosyasi ve kac kredi degeri icerdigini kompakt customer-safe ozet kartlariyla gosterir hale getirildi.

Sonuc: `/dashboard/orders` artik order archive sync basarili oldugunda `Loaded page`, `Action needed`, `Delivered files` ve `Credits shown` kartlarini gosterir. Ozet sadece mevcut customer-scoped loaded orders listesinden hesaplanir ve tam arşiv toplamı gibi yaniltici iddia uretmez; `Loaded page` karti `loaded / total` gosterir. Search, view filtreleri, pagination, retryable error state, order detail linkleri ve existing order query scoping korunur. Payment/credit policy, order mutation, AI, vehicle, email, desktop ve work-order mantigi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (40/40); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (276/276); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-042 [P2] Musteri dashboard'u tek oncelikli siradaki aksiyonu gostersin

Durum: Done

Fingerprint: `customer-experience|dashboard-next-action|scattered-action-signals|prioritized-next-best-action-card`

Kapsam: Musteri dashboard'undaki profil, aksiyon gereken siparis, kredi, aktif is ve yeni talep sinyalleri tek bir `Next best action` kartinda onceliklendirildi.

Sonuc: Dashboard artik customer-safe bir ust aksiyon karti gosterir. Oncelik sirasiyla eksik profil bilgileri, `customer_info_needed` siparisleri, 0 kredi bakiyesi, aktif is takibi ve yeni dosya talebi CTA'sina yonlendirir. Mevcut profil completion karti, kredi/siparis metrikleri, quick actions, credit ledger preview, realtime sync ve retryable dashboard hata state'i korunur. Payment/credit policy, request creation, order mutation, AI, vehicle, email, desktop ve work-order mantigi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (39/39); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (275/275); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-041 [P2] Yeni istek formu submit oncesi hazirlik checklist'i gostersin

Durum: Done

Fingerprint: `customer-experience|new-request-submit|missing-required-step-visibility-before-click|live-submit-readiness-checklist`

Kapsam: Yeni istek ekranindaki sticky `Request Summary`, submit butonuna tiklamadan once zorunlu adimlarin hangilerinin tamamlandigini canli checklist olarak gosterir hale getirildi.

Sonuc: Summary kartinda `Submit Readiness` bolumu; arac/motor, servis, orijinal dosya, kredi uygunlugu, kredi kullanim onayi ve sorumluluk onayini tamamlandi/eksik olarak gosterir. `Create Request` butonu eksik zorunlu adimlar varken `Complete Required Steps` etiketiyle disabled kalir. `handleSubmit` icindeki mevcut validasyonlar korunur; payment/credit policy, kredi hesabi, upload flow, RPC payload shape, servis katalogu ve customer privacy davranisi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (38/38); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (274/274); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities).

### AUTO-040 [P2] Yeni istek ozeti secilen ekstra hizmetleri isimleriyle gostersin

Durum: Done

Fingerprint: `customer-experience|new-request-summary|extra-options-count-only|selected-extra-service-names`

Kapsam: Yeni istek ekranindaki sticky `Request Summary`, secilen ekstra hizmetleri sadece adet olarak gostermek yerine isim ve krediyle customer-visible hale getirildi.

Sonuc: Summary kartinda `Extra Options` satiri secili ekstra hizmetleri tek tek listeler ve hic secim yoksa `None selected` gosterir. Toplam kredi hesabi ve backend'e giden `serviceSummary` ayni `selectedExtraServices` kaynagindan beslenir. Kredi fiyatlari, submit validasyonu, payment/credit policy, RPC payload shape, servis katalogu ve advanced service collapse davranisi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (37/37); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (273/273); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities).

### AUTO-025 [P3] Desktop uploader local history statuslari okunabilir etiket kullansin

Durum: Done

Fingerprint: `desktop-uploader|local-upload-history|raw-status-values-in-history|human-readable-status-labels`

Kapsam: Desktop uploader local upload history preview, filter chip ve row status gorunumleri mevcut `statusLabel` helper'iyle customer-readable hale getirildi.

Sonuc: Dashboard local history preview ve full Local Upload History rows artik `Submitted`, `Failed` gibi okunabilir etiketler gosterir. Filter chip'leri de okunabilir etiket kullanir, ancak stored `row.status` degeri ve filtreleme semantigi degismeden kalir. Request list/detail status label davranisi, local-only history storage, request links, checksum satiri ve diagnostic privacy korunur.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\customer-uploader.test.ts` PASS (23/23); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (272/272); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities).

### AUTO-036 [P2] Musteri settings profil hatasinda varsayilan form gostermesin

Durum: Done

Fingerprint: `customer-experience|settings-profile-load|supabase-profile-error-renders-default-editable-form|retryable-profile-settings-error-state`

Kapsam: Musteri settings profil yukleme hatasi, default editable profile formu ve varsayilan bank-transfer reference gostermeden retry edilebilir customer-safe hata state'iyle ayrildi.

Sonuc: Ilk profile sync hatasinda `Customer settings sync failed` karti gorunur; settings formu, default `MGA-10001` customer reference ve bank-transfer reference render edilmez. Basarili profile yuklemesi sonrasi mevcut Customer ID, credits, contact/company/address fields ve save akisi korunur. Save failure raw backend mesajini basmaz; `Settings could not be saved...` customer-safe kopyasi kullanilir ve kullanicinin girdigi form degerleri retry icin korunur. Login redirect, verified-email guard ve own-profile `id` scoping degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (36/36); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (271/271); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities).

### AUTO-032 [P2] Musteri siparis arsivi sorgu hatasini bos liste gibi gostermesin

Durum: Done

Fingerprint: `customer-experience|order-archive|supabase-query-error-renders-with-empty-state|retryable-order-archive-error-state`

Kapsam: Musteri siparis arsivi, ilk `orders` sorgu hatasini normal bos liste gibi gostermek yerine retry edilebilir customer-safe hata state'iyle ayiracak sekilde guncellendi.

Sonuc: Ilk order archive sync hatasinda `Order archive sync failed` retry karti gorunur ve `No orders found in this view` bos state'i render edilmez. Basarili yukleme sonrasi load-more, search/reload veya realtime refresh hatasi olursa son yuklu order listesi korunur ve inline `Order archive sync needs retry` uyarisi gorunur. Basarili sifir-result yuklemelerinde mevcut bos state korunur. Active, Needs Response, Completed, Cancelled ve All view filtreleri, search, pagination, realtime refresh, customer_id scoping, login redirect ve verified-email guard davranislari korunur.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (35/35); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (270/270); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities).

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

### MANUAL-2026-08-04-GROWTH-BULK-REVIEW [P0] Growth musteri siniflandirmasini atomik toplu kayda tasima

Durum: Done

Fingerprint: `growth|customer-classification|per-row-unsaved-refresh-and-stale-write-gap|atomic-evidence-backed-bulk-review`

Kapsam: Growth Center musteri siniflandirma masasindaki satir bazli kayit akisi; toplu taslak, kanit notu, optimistic concurrency ve toplu audit ile guclendirildi.

Sonuc: Admin degisiklikleri once yerel taslak olarak gorur ve tek `Save all changes` aksiyonuyla atomik kaydeder. F5/navigation bekleyen degisiklikleri sessizce kaybettirmez. Incelenmis her durum kanit notu ister; stale ekran, duplicate customer, staff target, bilinmeyen durum ve 100 kayit siniri fail-closed reddedilir. Mevcut legacy siniflandirmalar otomatik degistirilmez; eksik kanitlar ayrica gosterilir.

Dogrulama: Targeted tests PASS (8/8); lint PASS; web + desktop typecheck PASS; full tests PASS (586/586); production build PASS (266 page/route entry); i18n PASS (12 locale); payment schema-only PASS ve env okunmadi; local security smoke PASS (74 admin method, 16 customer API, 8 private page header, 4 public-safe endpoint); homepage performance PASS (56.6 KB gzip / 80 KB); high-severity audit threshold PASS (2 mevcut moderate PostCSS advisory); responsive anonymous admin gate QA PASS; diff check PASS.
