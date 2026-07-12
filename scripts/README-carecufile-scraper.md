# CareEcuFile Vehicle Scraper

Bu paket CareEcuFile araç seçme sisteminden verileri çekip JSON'a çevirmek için hazırlandı.

## 1) Dosyayı projeye koy

ZIP içindeki dosyayı şu klasöre koy:

```text
scripts/carecufile-scraper.mjs
```

## Network guard

Bu scraper CareEcuFile'a dis ag istegi yapar. Yanlislikla otomatik calismamasi icin varsayilan olarak network'e cikmadan durur.

Gercek scraping icin komuta `--allow-network` ekle:

```powershell
node scripts/carecufile-scraper.mjs --allow-network --brands-only
```

Alternatif olarak yalniz bilerek calistirilan oturumda env izni verilebilir:

```powershell
$env:ALLOW_CAREECU_NETWORK="1"
node scripts/carecufile-scraper.mjs --brands-only
```

Tum marka dongusu de ayni izni ister:

```powershell
node scripts/scrape-all-brands.mjs --allow-network
```

## 2) İlk test: marka listesi

PowerShell:

```powershell
cd C:\Users\gokka\Desktop\mg-autotech-files
node scripts/carecufile-scraper.mjs --allow-network --brands-only
```

Çıktı:

```text
data/carecufile-brands.json
```

## 3) BMW test

Önce küçük test yap:

```powershell
node scripts/carecufile-scraper.mjs --allow-network --brand-id 7 --brand-name BMW --limit-models 1 --limit-generations 1 --limit-engines 2
```

Çıktı:

```text
data/vehicle-database.json
data/vehicle-database-errors.json
```

## 4) Daha büyük çekim

BMW komple:

```powershell
node scripts/carecufile-scraper.mjs --allow-network --brand-id 7 --brand-name BMW
```

Tüm markalar:

```powershell
node scripts/carecufile-scraper.mjs --allow-network --all
```

## 5) Cloudflare / session sorunu olursa

Önce cookiesiz dene. Eğer 403, boş response veya Cloudflare sayfası gelirse kendi tarayıcındaki cookie gerekir.

PowerShell örnek:

```powershell
$env:CAREECU_COOKIE="PHPSESSID=BURAYA; cf_clearance=BURAYA"
node scripts/carecufile-scraper.mjs --allow-network --brand-id 7 --brand-name BMW --limit-models 1 --limit-generations 1 --limit-engines 2
```

Cookie'yi kimseyle paylaşma.

## 6) Script ne çekiyor?

Final JSON formatı:

```json
{
  "brand": "BMW",
  "brandId": "7",
  "model": "5 serie",
  "modelId": "82",
  "generation": "F10/11 - 2010 - 2016",
  "generationId": "187",
  "engine": "520D 163hp",
  "engineId": "1162",
  "fuelType": "2.0 - Turbo-Diesel",
  "ecu": ["Bosch MD1", "Bosch EDC17C50"],
  "stage1": {
    "stockHp": 163,
    "tunedHp": 220,
    "gainHp": 57,
    "stockNm": 380,
    "tunedNm": 440,
    "gainNm": 60
  },
  "stage2": {
    "stockHp": 163,
    "tunedHp": 248,
    "gainHp": 85,
    "stockNm": 380,
    "tunedNm": 530,
    "gainNm": 150
  },
  "readMethods": ["Autotuner Bench", "Autotuner OBD"],
  "services": ["AdBlue OFF", "Stage 1", "DPF OFF", "DTC OFF", "EGR OFF"]
}
```

## Not

Generation payload'ı için script birkaç farklı form-data kombinasyonu deniyor. Eğer `vehicle-database-errors.json` içinde `No working generation payload` hatası çıkarsa, Chrome Network'ten model seçerken çıkan payload'ı gönder. O zaman scriptte tek satır düzeltiriz.


## Append / Merge Modu

Normalde script her çalışınca `data/vehicle-database.json` dosyasını yeniden yazar.

Eski datayı silmeden yeni markayı eklemek için `--append` kullan:

```powershell
node scripts/carecufile-scraper.mjs --allow-network --brand-id 7 --brand-name BMW --append
node scripts/carecufile-scraper.mjs --allow-network --brand-id 68 --brand-name Mercedes-Benz --append
node scripts/carecufile-scraper.mjs --allow-network --brand-id 6 --brand-name Audi --append
node scripts/carecufile-scraper.mjs --allow-network --brand-id 99 --brand-name Volkswagen --append
```

Aynı araç tekrar çekilirse duplicate yapmaz, mevcut kaydı günceller.

## Önerilen sıra

Önce küçük test:

```powershell
node scripts/carecufile-scraper.mjs --allow-network --brand-id 68 --brand-name Mercedes-Benz --limit-models 2 --limit-generations 2 --limit-engines 2 --append
```

Sonra marka komple:

```powershell
node scripts/carecufile-scraper.mjs --allow-network --brand-id 68 --brand-name Mercedes-Benz --append
```
