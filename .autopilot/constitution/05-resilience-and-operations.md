# Resilience and Operations

## Amaç

Autopilot uzun süre çalışırken:

- takılma
- sessiz durma
- limit hatası
- yarım görev
- dirty repository
- tekrar eden görev
- log görünmezliği

risklerini yönetmelidir.

## Kurallar

- Her agent çalışması başlangıç ve bitiş zamanını STATUS.md içine yazar.
- Her görev runtime JSON sonucu üretir.
- Sonuç JSON yoksa görev başarılı sayılmaz.
- Runner bir görevin makul sürede bitmediğini tespit ederse işlemi başarısız saymalı ve repository'yi temiz hâle getirmelidir.
- Yarım işler otomatik commit edilmez.
- Dirty repository bir sonraki worker'a bırakılmaz.
- Usage/rate limit durumunda bekleme ve yeniden deneme yapılmalıdır.
- Aynı görev başarısız olursa sınırsız tekrar edilmez; Blocked'a taşınır.
- Log ve status owner tarafından okunabilir olmalıdır.

## Tavsiye edilen timeout

- Planner: 30 dakika
- Worker: 60 dakika
- Reviewer: 45 dakika

Bu süreler runner tarafından desteklenmiyorsa HEALTHCHECK dosyasında risk olarak raporlanır.
