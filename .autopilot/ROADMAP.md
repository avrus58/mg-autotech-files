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
  - Migration/fallback durumlarinda mutasyon aksiyonlari read-only davranir ve hata yerine acik mesaj verir.

## Owner priorities

- PRODUCT EVOLUTION MODE aktif: yeni gorevler urun, admin paneli, musteri paneli, UX veya operasyon degeri tasimali; yalniz test/guard/dokumantasyon gorevleriyle sinirli kalinmamali.

## Candidate milestones

## Needs owner decision

- Yeni database alani, migration uygulama, fiyat/odeme politikasi, hukuki metin veya production servis islemi gerektiren product-evolution isleri owner onayi olmadan Ready yapilmaz.

## Completed milestones
