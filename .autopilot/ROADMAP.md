# Product Roadmap

## Active milestone

### MILESTONE-20261006-SITE-EXCELLENCE — Local-first product, design and acquisition quality

- Owner objective: "websitesini gercekten dunyanin en iyi tasarimi ve islevsel
  olarak en iyi olana kadar calismaya devam et, reklamlar seolar tasarim yazilar
  hersey akilna gelebilecek hersey en iyisi olsun, once herseyi local olarak tut,
  en iyisi derken yillarca calisma ama bir hedefimiz olsun gercekten iyi birseyler
  ortaya cikartalim". This full objective remains active, not satisfied by the
  already accepted homepage alone. No global ranking/perfection claim is made.
- Scope: File Service product in this repository; coherent public/auth/customer/
  admin experience, conversion-oriented content and preparation, SEO discovery,
  advertising readiness, usability, accessibility and reliability. Keep all work
  local; no push, Preview, Production or Ads account/spend changes in this phase.
- Current verified local source:2a98f865, three accepted homepage packages and
  accepted five-service/all12-locale compact experience (buildJnRpeAAvSidfUgVRbdTFs).
  Tested admin draft source8fa6853 still awaits interactive acceptance.
  Owner primary checkout is dirty and must remain untouched. Previous turn is
  concrete progress (source commits and bounded evidence), not idle.
  Historical release/Ads/SEO receipts are not current account metrics.
- Acceptance matrix (all remain unproven until their own authoritative receipt):
  - Design: coherent black/red hierarchy, compact useful content, no clipped
    actions or horizontal overflow on mobile/compact laptop; no decorative
    effect at the expense of clarity, accessibility or performance.
  - Functional product: request preparation, account entry, request/order/file/
    delivery/report/credit journeys and admin editing/sync preserve state and
    expose actionable loading/error/empty/success states. Tests must cover real
    application boundaries, not only a duplicated model or a source regex.
  - Localization/content: every changed user-visible surface complete in all12
    supported languages; initial HTML, semantics and schema agree with rendered
    copy. Preserve approved commercial/legal facts; no fake testimonials, power,
    turnaround, coverage, expertise or customer-activity assertions.
  - SEO: real useful pages, correct first-response languages, crawlable genuine
    links, canonical/reciprocal alternatives/sitemap/JSON-LD alignment; no thin
    doorway multiplication or assumption that client translations prove indexing.
  - Advertising/acquisition: local intent-to-page/copy/CTA/consent/conversion
    contracts and campaign assets match actual supported services. Live spend,
    signup/sales attribution and field results need their own current authorized
    evidence; synthetic smoke or historical clicks cannot prove customers.
  - Verification: required i18n, targeted behavior, lint, full types/tests/build,
    relevant asset/performance/security checks, responsive/browser evidence and
    immutable independent review for each product package. Keep missing evidence
    explicitly pending; no broad completion claim from one green subset.
- Evidence-led sequence from the independent6October source audit:
  1. P1 admin customer drafts: every successful20-second/recovery snapshot
     reconstructs an open profile+commercial form, discarding edits and loaded
     pricing while readiness remains ready (admin/page:493-522,932-935,1238-1245).
     Current implementation task MANUAL-20261006-ADMIN-CUSTOMER-DRAFTS.
  2. Core service semantic/design parity: accepted locally, not published,
     MANUAL-20261006-CORE-SERVICE-PARITY source2a98f865. Shared compact review-led
     body restores notices/Stage1 authority/FAQ parity and removes stale timing
     without altering facts.52new rows/572values,6inherited terminology rows
     refined. Full1917/120targeted/i18n/build plus60HTTP and40GUI/10interaction/
     4menu/8otherlocale checks and immutable independent final GO recorded.
  3. Request brief accuracy/continuity: frozen 561a0f0 corrects baseline empty 33%
     and false conditional 100%, adds native percentage/named ARIA and strict
     service-token-only handoff. 1924 full/43 targeted/fresh build and 8 GUI/144 states
     pass. Task stays In Progress: mandatory raw opening document-language gate
     is RED (11 non-English prefixless languages emit html lang=en). Diagnostic
     native body subset and hydrated JS language correction do not waive it.
     Prioritize a separately reviewed server-document-language remedy preserving
     all 139 current static prerenders; do not make the shared root request-bound.
     Next bounded task MANUAL-20261007-REQUEST-BRIEF-SSR-LANGUAGE is a verified
     framework-routing pilot, not a global route rewrite. Wider isolation design
     is PROPOSAL-20261007-PREFIXLESS-DOCUMENT-LANGUAGE, not implemented.
  4. Locale discovery for the four already translated newer service guides:
     current route/sitemap eligibility is legacy-only. Add genuine locale URLs
     and reciprocal discovery without feeding intent guides into legacy templates.
  5. Finish public catalog/content and offline advertising message-match review,
     then customer/admin cross-flow quality sweep. Select concrete remaining
     gaps from new evidence rather than repeatedly repainting the homepage.
- Explicit global usability followup: existing floating language/availability
  widgets can overlap non-actionable mobile text. Core-service scoped acceptance
  does not close this P3 gap or imply authenticated admin acceptance.
- Existing request-brief copy needs a later native semantic sweep (ToolsHeader
  Tools in TR/ZH, literal brief nouns and German not-provided meaning). This
  behavioral fix reuses unchanged copy, not a claim that translation quality is
  globally perfect. Keep the localization contract and exact scope intact.
- This sequence is bounded initial product work, not a redefinition of the goal
  or a claim that five packages exhaust every requirement. Reassess uncovered
  requirements after each accepted package; keep the thread goal active until
  the full current-state completion audit can prove the requested end state.

### MILESTONE-20260712-PRODUCT-EVOLUTION - B2B SaaS operasyon ve musteri deneyimi

- Source request: `MANUAL-20260712-120055` in `INBOX.md`.
- Goal: file.mgautotech.de platformunda admin operasyon hizini, musteri durum netligini ve profesyonel B2B SaaS urun hissini kucuk/orta olcekli, kanitli ve geri alinabilir iyilestirmelerle artirmak.
- Guardrails: mevcut calisan akislari korunur; production deploy, canli Supabase/Stripe/Resend islemi, fiyat/hukuki metin degisikligi, gercek musteri verisi ve yeni dependency yoktur.
- Initial audited domains: Responsive UX & product flow; Observability & error handling.
- Initial slices:
  - Musteri order detayinda status timeline ve siradaki adim netligi.
  - Admin request control center icinde review kuyrugu dogrulugu.
  - Admin work-order fallback/error modlarinda yaniltici aksiyonlari engelleme.
- Current planned slices:
  - Musteri paneli ve siparis arsivi, `customer_info_needed` durumundaki isleri aksiyon gereken isler olarak ayri gostersin.
  - Yeni istek formu, arac katalogu yuklenemediginde veya arac listede olmadiginda mevcut string alanlarla manuel arac bilgisi alabilsin.
  - Musteri dashboard'u, eksik profil/contact/billing bilgilerini mevcut settings akisini bozmadan tamamlatmaya yoneltsin.
  - Legacy admin notification center `Completed today` metrigi, is gercekten teslim edildigi zamani baz alsin.
  - Musteri dashboard kredi gecmisi, son siparislerden turetilen tahmin yerine `credit_transactions` ledger kaynagindan beslensin.
  - Musteri order detayinda teslim tahmini, yalniz admin tarafindan acik estimate kaydedildiginde spesifik sure etiketi gostersin.
  - Musteri order detayinda ek dosya yukleme sureci prepare/upload/verify asamalarini acik gostersin.
  - Admin request control center, musteri tarafindan yuklenen ek destek dosyasi sinyalini listede gostersin.
  - Admin work-order audit timeline, customer-visible ve internal-only eventleri rozetlerle ayirsin.
  - Admin widget clients listesi, bekleyen domain-change taleplerini liste ve metriklerde kacirmadan gostersin.
  - Musteri widget dashboard'u, bekleyen domain-change talebi varken ikinci talebi gonderilebilir gibi gostermesin.
  - Windows desktop uploader local upload history, raw status degerleri yerine ayni guvenli status etiketlerini kullansin.
  - Request chat composer, mevcut 4000 karakter API sinirini gonderimden once musteriye ve admin kullanicisina gostersin.
  - Musteri bildirim paneli, bildirim yuklenemeyince sessiz bos durum yerine retry edilebilir hata/yukleme durumunu gostersin.
  - Windows desktop uploader yeni istek not/ECU/read-method alanlari, desktop finalize API uzunluk sozlesmesini gonderimden once musteriye gostersin.
  - Musteri dashboard'u, profil/order/credit senkron hatalarini bos veya sifir durum gibi gostermek yerine retry edilebilir hata durumuyla ayirsin.
  - Musteri kredi ledger sayfasi, transaction sorgu hatalarini gercek bos hareket listesi gibi gostermek yerine retry edilebilir hata durumuyla ayirsin.
  - Admin Payment & Revenue Control bank payment formu, server action kontratini gonderimden once yerel olarak dogrulasin.
  - Musteri siparis arsivi, order sorgu hatalarini normal bos liste durumundan ayirsin ve retry aksiyonu sunsun.
  - Legacy admin order modal, kaydedilmemis teslim tahminini gizli `usually_30_min` varsayimina cevirmeden acik admin secimi istesin.
  - Legacy admin ana paneli, orders/customers sorgu hatalarini bos operasyon kuyrugu veya ham DB mesaji gibi gostermesin.
  - Musteri widget workspace'i, widget client yukleme hatasini abonelik yok durumundan ayirsin.
  - Musteri settings sayfasi, profil sync hatasinda varsayilan editable profil ve bank reference gostermez.
  - File Expert yukleme formu, mevcut dosya ve metadata limitlerini prepare/upload oncesi musteriye gosterir.
  - Admin request control center, API yukleme hatasini bos filtre sonucu gibi gostermek yerine retry edilebilir admin-safe state ile ayirir.
  - File Expert dashboard'u, analiz gecmisi yukleme hatasini gercek bos analiz listesiyle karistirmadan retry aksiyonu sunar.
  - Roadmap V2 selected task `RMAP-FILE-DTC-M1`, AI DTC Analyzer icin provider-neutral contract, deterministic fallback, unavailable state ve no-fake-AI test temelini kurar.
  - Roadmap V2 selected task `RMAP-FILE-DTC-M2-ANALYSIS-SERVICE`, AI DTC Analyzer icin evidence model, risk flags, recommendation categories ve confidence semantics katmanini mevcut local fallback uzerine kurar.
  - Roadmap V2 selected task `RMAP-FILE-DTC-M3-REQUEST-INTEGRATION`, AI DTC Analyzer sonucunu request lifecycle'a customer/expert boundary ve internal-only audit event ile guvenli sekilde baglar.
  - Roadmap V2 selected task `RMAP-FILE-DTC-M4-ADMIN-CONFIGURATION`, AI DTC Analyzer icin provider availability, usage limit ve failure handling sinirlarini admin-safe configuration/status katmaniyla netlestirir.
  - Roadmap V2 selected task `RMAP-FILE-DTC-M5-ROLLOUT-READINESS`, AI DTC Analyzer icin regression suite, sanitized analytics/readiness summary ve operator-readable rollout dokumantasyonunu production/veri erisimi olmadan tamamlar.
  - Roadmap V2 selected task `RMAP-FILE-AI-EXPERT-V2-M1-FOUNDATION`, AI File Expert report flow icin provider/fallback status, deterministic fallback ve human-review/export-lock review gate sozlesmesini local-only foundation olarak netlestirir.
  - Roadmap V2 selected task `RMAP-FILE-AI-TUNE-ADVISOR-M1-FOUNDATION`, AI Tune Advisor icin request/service metadata uzerinden deterministic rule fallback, provider-unavailable semantics, expert review gate ve no-MOD/no-checksum safety contract temelini local-only kurar.
  - Roadmap V2 selected task `RMAP-FILE-AI-LOG-ANALYZER-M1-FOUNDATION`, AI Log Analyzer icin log-derived summary, provider unavailable/error states, deterministic fallback, customer/expert projection boundary ve no-raw-data safety contract temelini local-only kurar.
  - Roadmap V2 selected task `RMAP-FILE-AI-EXPLAIN-LAYER-M1-FOUNDATION`, AI Explain Layer icin customer-safe source labels, explicit unavailable/provider/fallback state, recommendation explanation boundary ve expert projection temelini local-only kurar.
  - Roadmap V2 selected task `RMAP-FILE-QUALITY-SCORE-M1-FOUNDATION`, AI File Quality Score icin deterministic quality/readiness baseline, explainable factor breakdown, customer/expert projection boundary ve no-fake-AI safety contract temelini local-only kurar.
- Success signals:
  - Musteri, talebin gercek durumunu ve kendi aksiyon gereksinimini detay ekraninda ayri gorebilir.
  - Musteri, aksiyon bekleyen siparisi liste veya dashboard uzerinden hizlica bulabilir.
  - Katalog kapsami veya gecici katalog hatasi, guvenli manuel talep olusturmayi tamamen engellemez.
  - Musteri, profil bilgileri eksikken destek veya faturalama gecikmesi yasamadan settings ekranina yonlendirilir.
  - Musteri, dashboard kredi gecmisi ile tam credit ledger arasinda ayni hareket kaynagini gorur.
  - Musteri, kaydedilmemis teslim tahmini icin varsayilan spesifik sure vaadi yerine not-set durumunu gorur.
  - Musteri, ek dosya yuklerken islemin hangi asamada oldugunu gorur ve hata sonrasi tekrar deneyebilir.
  - Admin, payment/QC/delivery review sinyallerini kacirmadan filtreleyebilir.
  - Admin, gunluk tamamlanan is sinyalini request yaratilis tarihi yerine teslim dosyasi zamanina gore gorur.
  - Admin, musteri ek dosyasi gelen requestleri liste uzerinden kacirmadan fark eder.
  - Admin, audit eventinin customer-visible mi internal-only mi oldugunu detay ekraninda hizlica ayirt eder.
  - Admin, widget domain degisiklik talebini tek tek musteri detayi acmadan listede fark eder.
  - Musteri, widget domain degisikligi zaten incelemedeyken tekrar denemek yerine bekleyen durumu gorur.
  - Desktop uploader kullanicisi, local history filtre ve satirlarinda teknik raw status yerine okunabilir durum etiketleri gorur.
  - Musteri ve admin, uzun request chat mesajinin API limitine takilacagini gondermeden once gorur.
  - Musteri, bildirim panelinin gercekten bos mu yoksa senkron hatasinda mi oldugunu ayirt eder.
  - Desktop uploader kullanicisi, uzun not veya teknik metadata alaninin sessizce kirpilmeden once hangi sinira takildigini gorur.
  - Musteri dashboard kullanicisi, order/kredi/profile verisi yuklenemediginde bunu gercek bos durumdan ayirt edip tekrar deneyebilir.
  - Musteri full credit ledger kullanicisi, ledger senkron hatasini gercek hareket yok durumundan ayirt edip tekrar deneyebilir.
  - Admin, manuel bank payment kaydinda eksik veya limit disi degerleri audited action denemesinden once gorur.
  - Musteri order archive kullanicisi, siparis sorgu hatasini gercek bos sonuc veya filtre sonucu ile karistirmadan tekrar deneyebilir.
  - Admin, legacy order modalinda teslim tahmini kaydetmeden once spesifik sure etiketini bilincli olarak secer.
  - Admin, legacy operasyon panelinde veri senkron hatasini bos is kuyrugundan ayirt edip tekrar deneyebilir.
  - Musteri widget dashboard kullanicisi, gecici widget client yukleme hatasini gercek abonelik eksikligiyle karistirmaz.
  - Musteri settings kullanicisi, profil verisi yuklenemediginde bunu gercek kayitli profil yerine retry edilebilir hata olarak gorur.
  - File Expert kullanicisi, desteklenen dosya tipi, 32 MB siniri ve metadata karakter limitlerini API hatasindan once gorur.
  - Admin, request control center senkron hatasini gercek bos filtre sonucu sanmadan son basarili kuyrugu veya retry aksiyonunu gorur.
  - File Expert kullanicisi, analiz gecmisi yuklenemediginde bunu gercekten hic analiz olmamasi durumundan ayirt eder.
  - DTC Analyzer gelecekteki musteri/admin yuzeylerine gecmeden once, text DTC girdisi icin fake AI uretmeyen provider boundary ve deterministic fallback sozlesmesine sahip olur.
  - DTC Analyzer response'u musteri/admin yuzeylerine baglanmadan once structured evidence, risk flags ve confidence reasons tasir; provider unavailable durumunda AI gibi davranmaz.
  - DTC Analyzer request entegrasyonu, musteriye yalniz customer-safe aciklama gosterirken admine review icin evidence/risk detaylarini ve internal-only audit kaydini saglar.
  - DTC Analyzer admin configuration milestone'u, provider unavailable/fallback durumunu ve usage limitlerini musteriye veya admine yaniltici AI basarisi gibi gostermeden aciklar.
  - DTC Analyzer rollout readiness milestone'u, regression coverage, local analytics/readiness signals and safe operator documentation ile future rollout kararini production access olmadan okunabilir hale getirir.
  - AI File Expert V2 foundation milestone'u, existing File Expert AI report provider/fallback akisini review-gate status, human review requirement ve export locked sinirlariyla operator-readable hale getirir.
  - AI Tune Advisor foundation milestone'u, stage/eco/TCU/advanced service talepleri icin AI gibi davranmayan rule fallback, eksik evidence listesi, risk flags, required human checks ve blocked production actions sozlesmesini saglar.
  - AI Log Analyzer foundation milestone'u, mevcut browser-local log utility'den ayrilan provider-safe local contract ile log summary, uncertainty, fallback status, customer-safe projection ve expert review sinirlarini tanimlar.
  - AI Explain Layer foundation milestone'u, DTC/Tune/Log/File Expert gibi AI-assisted ciktilar icin source-labeled, customer-safe explanation contract'i ve provider-unavailable durumda fake AI uretmeyen projection boundary saglar.
  - AI File Quality Score foundation milestone'u, File Expert/request evidence uzerinden kotu veya eksik submission riskini deterministic, aciklanabilir ve human-review gated kalite sinyaline cevirir.
  - Migration/fallback durumlarinda mutasyon aksiyonlari read-only davranir ve hata yerine acik mesaj verir.

## Owner priorities

- PRODUCT EVOLUTION MODE aktif: yeni gorevler urun, admin paneli, musteri paneli, UX veya operasyon degeri tasimali; yalniz test/guard/dokumantasyon gorevleriyle sinirli kalinmamali.

## Candidate milestones

## Needs owner decision

- Yeni database alani, migration uygulama, fiyat/odeme politikasi, hukuki metin veya production servis islemi gerektiren product-evolution isleri owner onayi olmadan Ready yapilmaz.
- Desktop uploader true resumable/chunked upload, storage/API tasarimi ve olasi migration gerektirdigi icin `FEATURE_PROPOSALS.md` icinde owner karari bekleyen proposal olarak tutulur.

## Completed milestones
