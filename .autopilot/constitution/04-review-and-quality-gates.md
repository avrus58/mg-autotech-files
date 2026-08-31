# Review and Quality Gates

Reviewer yalnız kod stilini incelemez.

## Kabul kriterleri

- Gerçek ürün veya işletme değeri var
- Aynı iş daha önce yapılmamış
- Evidence gerçek
- Kapsam kontrollü
- Mevcut akış bozulmamış
- UX profesyonel
- Responsive korunmuş
- Erişilebilirlik korunmuş
- Error/loading/empty state düşünülmüş
- Güvenlik ve veri riski yok
- Uydurma ticari bilgi yok
- Testler uygun
- Commit mesajı doğru

## Localization release kapısı

- Global dil seçicinin kapsadığı her kullanıcıya görünür UI değişikliği aynı
  commit içinde bütün `supportedLocales` için tamamlanır.
- SSR/client copy, durum metinleri, erişilebilirlik attribute'ları, metadata,
  structured data ve müşteriye giden e-posta metinlerinde İngilizce fallback
  sıfır olmalıdır.
- Yeni public/müşteri route veya component fail-closed i18n envanterinde açıkça
  sınıflandırılmalı; broad `data-no-translate` veya sınıflandırılmamış dinamik
  copy kabul edilmez.
- Generic route/component exemption kabul edilmez. Exact legacy yüzey için
  kullanılan frozen-source fingerprint'i yenilenemez; değişiklikten önce yüzey
  shared typed locale katalog/renderer mimarisine taşınır ve freeze kaldırılır.
- `npm run check:i18n` ve Production build geçmeden reviewer kabul veremez.
- Internal admin, owner/hukuk onaylı exact legal route ve ham müşteri/teknik
  değer istisnaları dar allowlist ve testle korunur; müşteriye görünen çevre
  metni istisna değildir.

## Red kriterleri

- Busywork
- Aynı görevin tekrarı
- Kanıtsız özellik
- Aşırı kapsam
- Doorway SEO
- Uydurma hizmet/fiyat/garanti
- Secret/canlı veri riski
- Çalışan özelliği zayıflatma
- Başarısız zorunlu kontrol
- Kapsam dışı geniş refactor
- Desteklenen dillerde eksik copy, İngilizce fallback, envanter dışı kullanıcı
  yüzeyi veya sınıflandırılmamış görünür dinamik metin
