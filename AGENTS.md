# MG AutoTech Codex çalışma kuralları

## Repository ozel guvenli calisma ekleri

- Package manager npm'dir. Kok proje ve `apps/customer-uploader` kendi `package-lock.json` dosyalarina sahiptir; yeni package kurma.
- Kok web uygulamasi Next.js App Router kullanir. `npm run lint`, `npm run typecheck` ve `npm test` yerel ve guvenli kontrollerdir.
- `npm run build` bu repoda `next/font/google` nedeniyle Google Fonts'a ag isteyebilir. Ag kapali Codex kosullarinda bu kontrol basarisiz olursa STATUS.md icine ortam kaynakli olarak yaz; font veya tasarimi onaysiz degistirme.
- `npm run check:payments`, `scripts/check-payment-env.js`, `apps/customer-uploader/scripts/check-env.mjs`, desktop `dev/build/package` komutlari `.env` veya `.env.local` okuyabilir. Acik kullanici onayi ve guvenli test env'i olmadan calistirma.
- `scripts/*.sql` dosyalari Supabase migration/verification amaclidir. Codex icinde migration calistirma, production DB'ye baglanma veya SQL'i canli servise uygulama.
- `scripts/carecufile-scraper.mjs` ve `scripts/scrape-all-brands.mjs` dis aga baglanan veri cekme araclaridir. Otonom dongude calistirma.
- Smoke scriptleri yalnizca yerel `localhost` hedefe karsi guvenlidir. Production URL ile smoke test insan tarafindan acikca istenmedikce calistirilmaz.
- `data/vehicle-database*.json` ve `data/vehicle-performance-overrides.json` urun/katalog verisidir. Veri icerigini veya ticari arac kapsam iddialarini kanitsiz degistirme.
- `.vercel/`, deploy ciktisi ve proje baglanti metadatasidir. Deploy veya Vercel durumunu Codex icinden degistirme.
- `file-expert-analyzer` opsiyonel FastAPI servisidir; signed URL, yerel dosya yolu ve binary analiz sinirlari hassastir. Gercek musteri dosyasi ile test yapma.

## Temel çalışma biçimi

- Her çalıştırmada önce `.autopilot/PROJECT.md`, `.autopilot/TASKS.md` ve `.autopilot/STATUS.md` dosyalarını oku.
- Bir çalıştırmada yalnızca bir küçük veya orta ölçekli görevi tamamla.
- Mevcut mimariyi, tasarım sistemini, kullanıcı akışlarını ve çalışan davranışı koru.
- Kanıta dayanmayan özellik, sayfa, metin, veri modeli veya yeniden tasarım uydurma.
- Değişiklikleri küçük, geri alınabilir ve görev kapsamıyla sınırlı tut.
- Repository içindeki mevcut package manager'ı lockfile üzerinden belirle ve onu kullan.
- Yeni production dependency kurma. Yeni dependency gerekirse görevi Blocked yap.
- Codex içinde `git commit`, `git push`, deploy veya branch değiştirme yapma. Commit işlemini dış runner yapar.

## Zorunlu doğrulama

- `package.json` içindeki mevcut scriptleri incele.
- Uygun olan lint, typecheck, test ve build kontrollerini çalıştır.
- Mevcut script yoksa uydurma komut kullanma; bunu STATUS.md içinde belirt.
- Başarısız kontrol varken görevi Done yapma.
- Değişiklikten sonra diff'i kendin incele; kapsam dışı değişiklikleri geri al.
- Kullanıcı arayüzü değiştiyse responsive davranış, loading/error/empty state ve erişilebilirliği kontrol et.

## Kesin yasaklar

- Production deploy yapma.
- Canlı Supabase, Stripe, ödeme, e-posta veya üçüncü taraf servislerinde işlem yapma.
- Production veritabanına bağlanma veya migration çalıştırma.
- `.env`, `.env.*`, secret, token, API key veya müşteri verisi okuma, yazma ya da loglama.
- Hizmet fiyatlarını, hukuki metinleri, ticari kuralları veya şirket beyanlarını kendi kararınla değiştirme.
- Gerçek müşteri verisi oluşturma, değiştirme veya silme.
- Çalışan bir özelliği kaldırma.
- Büyük mimari dönüşüm, framework değişimi veya kapsamlı yeniden tasarım yapma.
- İnternet erişimi, package installation veya yönetici yetkisi gerektiren çözümü otomatik uygulama.
- Destructive Git komutları kullanma.

## Görev durumu

- Hazır görevler `.autopilot/TASKS.md` içindeki `Ready` bölümündedir.
- Üzerinde çalışılan görev geçici olarak `In Progress` bölümüne taşınır.
- Başarıyla doğrulanan görev `Done` bölümüne taşınır.
- Secret, ticari karar, production erişimi, yeni dependency veya çelişkili gereksinim gerekiyorsa görev `Blocked` bölümüne taşınır.
- Her çalıştırmada `.autopilot/STATUS.md` dosyasına tarih, görev, değişen dosyalar, çalıştırılan kontroller, sonuç ve kalan riskleri yaz.
- Runtime JSON dosyaları `.autopilot/runtime/` altına yazılır ve Git'e eklenmez.

## Projeye özel notlar

- Bu repository için gerçek komutlar, mimari ve hassas alanlar `.autopilot/PROJECT.md` içinde tutulur.
- `file.mgautotech.de` gibi ödeme/veritabanı kullanan projelerde entegrasyon kodu düzenlenebilir; ancak canlı servise çağrı, veri mutasyonu veya migration çalıştırılamaz.
- `mgautotech.de` içeriğinde mevcut işletme gerçekleri korunur. Teknik SEO düzeltilebilir; fiyat, garanti, yasal iddia ve hizmet kapsamı uydurulamaz.

<!-- SMART_AUTOPILOT_V2 -->
## Akıllı otonom planlama

- Yeni görev oluşturmadan önce ROADMAP, INBOX, TASK_HISTORY, TASKS, STATUS ve Git geçmişini kontrol et.
- Aynı amacı farklı başlıkla tekrar etme.
- Her görev somut kanıta ve kalıcı Fingerprint değerine dayanmalıdır.
- Geliştirme alanlarını dönüşümlü incele.
- Güvenli ve kanıtlı iş yoksa idle kal.
- Aynı öncelikte MANUAL görevlerini AUTO görevlerinden önce ele al.

<!-- MG_AI_OS_V3_PRO -->
## MG AI Operating System V3 Pro

- Her planner, worker ve reviewer .autopilot/constitution/ altındaki tüm dosyaları okur.
- Kod kalitesi tek başına amaç değildir; ürün, kullanıcı, admin ve işletme değeri amaçtır.
- Aynı işi tekrar etme.
- Üç tur üst üste yalnız test/docs/guard görevi üretme.
- Küçük ve orta ölçekli ürün özelliklerini güvenli sınırlar içinde otomatik uygula.
- Büyük fikirleri .autopilot/FEATURE_PROPOSALS.md içine yaz.
- Product scorecard yalnız gerçek kanıtla güncellenir.
- Production deploy, canlı migration, secret, gerçek müşteri verisi, fiyat ve hukuki iddia owner onayı olmadan yasaktır.

## Explicit isolated staging release exception

Only when the repository owner explicitly names the production project ref,
isolated staging project ref, staging Git branch, and release commit, Codex may:

- read the production database only through schema-only dump operations or
  SELECT-only access to pg_catalog, information_schema, policy, function,
  trigger, grant, extension, and migration-history metadata;
- never read or export application rows, auth users, storage objects,
  customer/order/payment data, firmware metadata, paths, credentials, or PII;
- apply a reviewed schema-only baseline and additive migrations only to the
  explicitly named isolated staging project after proving that its ref differs
  from production and that it is bootstrap-safe;
- use staging-only credentials in memory to configure branch-scoped Vercel
  Preview variables, without printing, persisting, or committing their values;
- create focused staging commits, push only the explicitly named staging branch,
  and deploy only a Vercel Preview without --prod or promotion.

This exception never permits production database mutation, production
migration, production environment changes, production deployment, production
branch merge, production data export, customer-data copying, real ECU
processing, firmware/MOD generation, A3/A4/A5, real integrity adapters, or
customer automatic delivery.

Stop immediately if any target identity, credential scope, dump content, or
environment scope is ambiguous.
