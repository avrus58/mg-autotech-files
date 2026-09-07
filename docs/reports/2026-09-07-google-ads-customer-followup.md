# Google Ads ve ilk müşteri talebi — 7 Eylül 2026

## Canlı reklam kontrolü

- MG AutoTech File Service hesabı, mevcut yetkili Chrome oturumu.
- 5–7 Eylül: son yenilemede 272 gösterim, 16 tıklama, €11,86 harcama,
  sıfır Google Ads dönüşümü. Önceki kampanya tablosu 271, arama terimleri
  tablosu 267 gösterimdi; bunlar farklı yenileme anlarına aittir.
- EN Search açık, `Eligible (Learning)`, günlük €5, Maximize clicks ve €0,75
  maksimum CPC. Kampanyaya özel hedef `Submit lead forms` olarak doğrulandı.
- UK/Ireland ve PMax kapalı.
- `61693959` numaralı EN durdurma kuralı Enabled: toplam maliyet >= €73,03,
  yalnız seçili bir kampanya, tüm zamanların verisi, saatte bir kontrol.
  Son çalışma 7 Eylül 15:55. Bu kural anlık kesin harcama tavanı değildir.
- Bütçe, CPC, teklif stratejisi, dönüşüm hedefi ve durdurma eşiği değiştirilmedi.

## Uygulanan reklam düzeltmesi

EN kampanyasına tam eşlemeli negatif `[remap my car]` eklendi. Arama terimi
satırında `Excluded` ve başarılı kayıt mesajı tekrar okunarak doğrulandı.
Bu sorgu 1 tıklama/€0,75 harcama üretmiş; profesyonel dosya hizmeti arama
niyeti zayıf olduğu için yalnız bu tam sorgu engellendi.

Görünür terimler toplamı 1 tıklama/€0,75; Google'ın `Other search terms`
satırı 15 tıklama/€11,11. Gizli sorguların kalitesi hakkında kesin çıkarım yok.

## Kayıt ve ölçüm

Site içi toplu raporda önceki kontrole göre EN'e atfedilen bir ek kayıt var;
aynı aralıkta yeni talep veya ödeme görünmüyor. Kullanıcı bu dönemde test
hesabı açılmadığını belirtti. Önceki €135 ödeme 18 Ağustos Stripe/kart satışı;
bu yeniden testin geliri değildir. Site raporları kayan 30 günlük pencereler
olduğu için tam tarih aralığına ait kesin müşteri edinme maliyeti hesaplanmadı.

Google'ın 5–7 Eylül `All conversions` tablosunda da dört eylemin tamamı sıfır:
registration Inactive/Secondary/One, request No recent conversions/Primary,
purchase Inactive/Primary ve kullanılmayan legacy Secondary.
Registration tanılamasının son yüklenen açıklaması `Unverified conversion`.

Canlı herkese açık HTML'deki Ads ID ve registration label, Google'ın gerçek
kayıt eylemi snippet'indeki `send_to` ile eşleşti. Yalnız bu iki bilinen public
alan karşılaştırıldı; hesap/çerez/secret veya müşteri kimliği okunmadı.
Canlı Docker uygulaması ve analyzer `65a53b606b5f`, sağlıklı.
Bu sürümün ölçüm kaynakları incelenen tabanla aynı; 120 hedefli test geçti.
Kod, izin ve kalıcı kuyruk kontrolleri gerçek Google dönüşüm alındısı değildir.

Kayıt Secondary olduğu için ana Conversions sütununda görünmesi beklenmez;
doğru rapor All conversions'dır. İç analitik kayıt atfı ile reklam izni/Google
atfı aynı şartlara bağlı değildir. Kaynağı doğrulanmayan varsayımsal tracking
yaması uygulanmadı; eski satış yeniden gönderilmedi.
[Google'ın birincil/ikincil eylem açıklaması](https://support.google.com/google-ads/answer/11461796?hl=en).

## İlk talep akışı

Mevcut yayımlanmamış müşteri rehberi tekrar yazılmadı. İncelemede `/new-request`
üzerinden rehberin kredi/sipariş bağlantısına gidilince mevcut talep formunun
kaybolabileceği bulundu. Güncel canlı kaynak üzerine rehberin entegrasyonu ve
bu bağlantı düzeltmesi ayrı `mg-autotech-files-customer-activation-release`
worktree'sinde tamamlandı. Doğrulanan uygulama kaynağı
`fff11e4e613d3ee9eb171396d3bcf9e2249b4b32`: 1627/1627 test, lint, typecheck,
12 dil kontrolü, Production build ve 64/64 sentetik tarayıcı senaryosu geçti.
Kredi ve sipariş bağlantıları talep sayfasından ayrı sekmede açılır; mevcut
alanlar ve seçilen dosya korunur. [Nihai doğrulama kaydı](../customer-activation-integration-2026-09-07.md)
kapsamı ve sınırları açıklar. Siteye henüz yayımlanmadı. Mevcut müşteriler
otomatik rehbere alınmaz; sıfır kredili ve talebi olmayan müşterilere dashboard
sonraki adımı daha belirgin gösterir.

Gerçek kullanıcıya mesaj, test kaydı, talep veya ödeme oluşturulmadı.
Yeni müşteri/gelir garantisi ve otomatik arka plan izleme taahhüdü yok.
