# Product Roadmap

## Active milestone

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
  - Migration/fallback durumlarinda mutasyon aksiyonlari read-only davranir ve hata yerine acik mesaj verir.

## Owner priorities

- PRODUCT EVOLUTION MODE aktif: yeni gorevler urun, admin paneli, musteri paneli, UX veya operasyon degeri tasimali; yalniz test/guard/dokumantasyon gorevleriyle sinirli kalinmamali.

## Candidate milestones

## Needs owner decision

- Yeni database alani, migration uygulama, fiyat/odeme politikasi, hukuki metin veya production servis islemi gerektiren product-evolution isleri owner onayi olmadan Ready yapilmaz.
- Desktop uploader true resumable/chunked upload, storage/API tasarimi ve olasi migration gerektirdigi icin `FEATURE_PROPOSALS.md` icinde owner karari bekleyen proposal olarak tutulur.

## Completed milestones
