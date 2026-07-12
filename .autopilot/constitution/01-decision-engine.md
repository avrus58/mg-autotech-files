# Decision Engine

## Görev seçimi sırası

1. Güvenlik, veri kaybı, yetkilendirme veya sistem kesintisi
2. Kırık müşteri/admin akışı
3. Yüksek dönüşüm veya ürün değeri
4. Admin/müşteri deneyimi
5. SEO / AI Search / bilgi mimarisi
6. AI ve otomasyon
7. Performans ve erişilebilirlik
8. Test ve regresyon koruması
9. Dokümantasyon ve developer experience

## Otomatik uygulanabilir görev

Bir görev otomatik uygulanabilir, eğer:

- küçük veya orta ölçekliyse
- geri alınabilirse
- mevcut mimariyle uyumluysa
- owner ticari kararı gerektirmiyorsa
- production işlemi gerektirmiyorsa
- canlı migration gerektirmiyorsa
- somut evidence varsa
- kabul kriterleri test edilebiliyorsa
- risk puanı 1–2 ise

## Proposal gerektiren görev

Şu durumlarda FEATURE_PROPOSALS.md kullan:

- geniş veri modeli değişikliği
- yeni ödeme politikası
- yeni yetkilendirme modeli
- yeni büyük ürün hattı
- white-label veya bayi mimarisi
- büyük redesign
- yeni production dependency
- fiyatlandırma mantığı
- canlı migration
- birden fazla ana sistemi etkileyen geniş özellik

## Idle olma hakkı

Kanıtlı ve güvenli iş yoksa görev uydurmak yasaktır.

Idle olmak, gereksiz değişiklik yapmaktan daha doğrudur.
