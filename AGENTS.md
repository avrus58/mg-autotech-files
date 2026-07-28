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


## Permanent owner-authorized File Service engineering and release policy

This section is the final governing policy for future MG AutoTech File Service
tasks. It supersedes earlier conflicting blanket prohibitions against Codex
creating branches/worktrees, modifying files, committing, pushing, configuring
isolated staging, deploying Vercel Preview, applying reviewed additive
migrations, and deploying Production.

Historical one-time exceptions remain audit history but do not restrict this
permanent policy for future owner-authorized tasks.

Canonical project identity:

- Repository/workspace: MG AutoTech File Service
- Public domain: file.mgautotech.de
- Vercel project: mg-autotech-files
- Production Supabase ref: jujaeyvyaeesmipihrrw
- Isolated staging Supabase ref: vxdxdvtsopsjatukdbuq

### Default implementation authorization

An ordinary owner request to build, fix, redesign, update, add, remove, or
improve a feature authorizes Codex to:

- inspect the repository and connected services;
- select or create a clean feature branch/worktree;
- modify the necessary files;
- run local/disposable database verification where required;
- run lint, typecheck, tests, build and security checks;
- create focused commits;
- preserve unrelated owner work;
- return one final result without requiring routine terminal commands from the
  owner.

An ordinary implementation request does not by itself authorize Production
deployment.

### Push and Preview authorization

When the owner explicitly says any equivalent of:

- pushla
- Preview'a çıkar
- önizleme hazırla
- staging'e çıkar
- test ortamına yayınla

Codex may:

- push only the relevant feature/release branch;
- configure branch-scoped Vercel Preview variables;
- use only the isolated staging Supabase project;
- apply reviewed additive migrations only to isolated staging when the feature
  requires them;
- create Vercel Preview deployments;
- create and delete disposable staging test users and fixtures;
- run authenticated Preview smoke/E2E tests;
- leave the verified Preview available for owner review.

Preview must never inherit Production Supabase credentials.

### Production release authorization

When the owner explicitly says any equivalent of:

- yayınla
- canlıya al
- deploy et
- production'a çıkar
- siteye yükle
- bunu şimdi canlıya ver

Codex may execute the complete scoped Production release without requesting
routine Git, terminal, Supabase, or Vercel actions from the owner.

Before Production release Codex must:

- identify the exact requested release scope;
- exclude unrelated changes;
- run the full relevant validation suite;
- inspect migration and environment impact;
- verify an appropriate rollback/recovery method when database changes exist;
- preserve secrets and customer data;
- deploy only the approved scope;
- run immediate Production smoke tests;
- perform an application rollback when a critical regression is detected.

A code-only release with no database change must not be blocked by unrelated
database migration or backup work.

### Database authorization

When the requested feature genuinely requires schema changes, Codex may:

- inspect the real schema;
- create additive versioned migrations;
- test them locally and in isolated staging;
- apply reviewed pending additive migrations to the explicitly authorized
  environment;
- verify RLS, grants, constraints and application behavior.

Codex must never run a destructive Production database reset, silently delete
Production rows, copy Production customer data into staging, or execute
unreviewed destructive SQL.

### Owner communication

Codex must not ask the owner to run routine commands such as:

- git status
- git add
- git commit
- git push
- npm install
- npm test
- Vercel deploy commands
- Supabase migration commands

Codex must perform routine technical work itself.

Codex may stop and ask only when:

- an external human-only login, payment, purchase, CAPTCHA, or approval screen
  makes automation technically impossible;
- legal/consent wording requires an owner decision;
- a destructive or irreversible operation has an ambiguous target;
- required business information cannot be discovered from the repository,
  connected services, or deployment;
- a secret cannot be transferred without displaying or exposing it.

### Permanent safety boundaries

This policy never authorizes Codex to:

- expose credentials, cookies, tokens, Supabase secret/service keys, JWT
  secrets, payment data, customer PII, or firmware contents;
- weaken RLS or authentication merely to pass a test;
- mix unrelated dirty worktree changes into a release;
- delete Production data without a separate explicit owner instruction;
- change payment configuration without explicit owner instruction;
- invent legal consent wording;
- enable automatic ECU/Stage/DTC/MOD generation unless the owner explicitly
  requests that exact capability and the required technical gates exist;
- enable A3/A4/A5 or customer automatic firmware delivery without a separate
  explicit owner instruction.

For urgent customer-impacting incidents, Codex must pause unrelated work,
prepare the smallest coherent hotfix, validate it, deploy it when explicitly
authorized, smoke-test it immediately, and roll back on a critical regression.

Codex should return one concise final report rather than a chronological diary.
