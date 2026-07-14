# Otonom gorev kuyrugu

> Yalnizca repository incelemesiyle dogrulanan, kucuk veya orta olcekli ve guvenli gorevler eklenir.

## Ready

- [ ] **P1 RMAP-FILE-AI-EXPLAIN-LAYER-M1-FOUNDATION - AI Explain Layer source labels and unavailable-state foundation**
  - Lane: AI Capability
  - Roadmap: file-platform - File Platform Roadmap
  - Epic: file-ai-explain-layer - AI Explain and Recommendation Layer
  - Feature: file-ai-explain-layer-m1-foundation-feature - Foundation Milestone
  - Roadmap task: RMAP-FILE-AI-EXPLAIN-LAYER-M1-FOUNDATION
  - Fingerprint: `ai-capability|explain-layer|ai-recommendation-surfaces-lack-source-labeled-unavailable-contract|source-label-unavailable-foundation`
  - Strategic score: 36 V2 weighted score; selected score 29.58
  - Scope class: M
  - Expected effort: M roadmap milestone slice
  - Business impact: 4/5
  - User impact: 5/5
  - Admin impact: 3/5
  - Strategic fit: 5/5
  - Confidence: 4/5
  - Effort: 3/5
  - Risk: 2/5
  - Evidence: `.autopilot/runtime/roadmap-selection.json` selected `RMAP-FILE-AI-EXPLAIN-LAYER-M1-FOUNDATION` for `file.mgautotech.de`; product spec `C:\Users\gokka\Documents\MG-AI-OS-V4\artifacts\specs\rmap-file-ai-explain-layer-m1-foundation.md` requires `Source labels` and `Unavailable state`; `Test-Path src/lib/aiExplain` and `Test-Path docs/ai-explain-layer-foundation.md` both returned false; duplicate search found no exact selected task id in `.autopilot`, `docs`, `src` or `tests`; existing `src/lib/dtcAnalyzer/requestIntegration.ts`, `src/lib/tuneAdvisor/requestIntegration.ts`, `src/lib/logAnalyzer/requestIntegration.ts` and `src/lib/fileExpert/reportStatus.ts` provide separate provider/fallback/review patterns but no shared customer-safe explain/recommendation layer.
  - Product value: Customers can understand why an AI-assisted recommendation is shown, which source category supports it and when no AI output is available; experts/admins keep provider and fallback detail without leaking internals to customers.
  - Selection reason: Roadmap V2 selected this P1/M milestone, it depends on the already completed AI File Expert V2 foundation, it is new in repo memory/history, and it continues File Platform AI capability work without production, secret, migration or customer-data access.
  - Scope: Add a local-only AI Explain Layer foundation that defines a typed `ai-explain-layer-v1` contract, source labels, unavailable/provider/fallback states, customer-safe projection, expert projection, no-leak boundaries, deterministic non-AI fallback behavior and an operator runbook. Keep it library/docs/tests only unless an existing route integration is required for local projection tests; do not add live provider routing, upload endpoints, migrations, production analytics, public claims, MOD output, checksum approval, pricing or delivery automation.
  - Acceptance criteria:
    - `src/lib/aiExplain` exposes a versioned contract with explicit source labels for evidence, recommendations, risk flags, human-review gates and unavailable/provider/fallback state.
    - The default local behavior is deterministic and non-AI when no provider is configured; provider unavailable and provider error states are explicit and never presented as successful AI output.
    - Customer projection hides provider id, provider kind, model name, prompt version, fallback internals, raw binary/hex/CSV, hashes, signed URLs, storage paths, filenames, customer identifiers, sample ids and admin-only notes.
    - Expert/admin projection exposes provider status, fallback reason, source labels, required human checks and blocked production actions.
    - Existing DTC, Tune Advisor, Log Analyzer and File Expert contracts remain compatible; no working feature is removed or weakened.
    - Runbook documents safe local validation, privacy boundaries and operator-only future decisions for live provider rollout, UI/API integration, analytics persistence, migrations, deploy, MOD export, checksum workflow and delivery automation.
    - Tests cover source-label generation, unavailable/error fallback states, customer/expert projection separation and forbidden private data patterns.
  - Validation:
    - `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts`
    - `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts`
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`
    - `git diff --check`


## In Progress

## Blocked

## Later

### AUTO-009 [P2] Production smoke dokumani ile local autopilot smoke ayrimini netlestir

Kapsam: `docs/production-smoke-checklist.md` ve ilgili guvenlik notlarinda production smoke'un insan kontrollu, autopilot smoke'un local-only oldugunu ayir.

Kabul kriterleri:

- Production checklist'teki canli URL komutlari insan kontrollu olarak etiketlenir.
- Otonom Codex dongusu icin localhost disi smoke calistirmama kuralina link/veri verilir.
- Mevcut non-mutating production smoke anlamlari korunur.
- Fiyat, odeme kurali veya operasyonel ticari karar degismez.

Dogrulama: Markdown diff incelemesi, `npm test` ilgili source assertion testleri.

Deferred reason: Selected P1/M roadmap milestone `RMAP-FILE-AI-EXPLAIN-LAYER-M1-FOUNDATION` has higher strategic value and starts the next File Platform AI Explain Layer foundation; this is a low-priority documentation cleanup and does not unlock the selected source-label/unavailable-state boundary.

Remediation: Reconsider after the AI Explain Layer M1 milestone is accepted, or if owner explicitly asks for production smoke documentation cleanup.

Expected validation command: `npm test` plus markdown diff review.

### AUTO-010 [P3] Dar kapsamli encoding artifact temizligi yap

Kapsam: Runtime stringlere dokunmadan yalnizca acikca bozulmus kaynak yorumlari veya teknik dokuman satirlarinda encoding artifactlerini temizle.

Kabul kriterleri:

- Ilk pass sadece `src/lib/supabaseServer.ts`, `src/lib/vehicleDatabase.ts` ve gerekirse scraper README yorum/dokuman satirlariyla sinirlidir.
- Public/legal/customer-facing metinler degistirilmez.
- Davranis, API, tasarim ve data icerigi degismez.
- Diff sadece yorum/dokuman karakter duzeltmesi icerir.

Dogrulama: Diff incelemesi, `npm run lint`, `npm run typecheck`.

Deferred reason: Maintenance-only artifact cleanup is intentionally behind selected P1/M roadmap milestone `RMAP-FILE-AI-EXPLAIN-LAYER-M1-FOUNDATION` and should not consume the Ready queue while a high-impact roadmap slice is available.

Remediation: Batch with a future documentation/source-comment maintenance pass after the AI Explain Layer M1 milestone is accepted, or when no P1/P2 product or roadmap milestone is ready.

Expected validation command: `npm run lint` and `npm run typecheck`.

## Done

### RMAP-FILE-AI-LOG-ANALYZER-M1-FOUNDATION [P1] AI Log Analyzer provider fallback and safe log summary foundation

Durum: Done

Fingerprint: `ai-capability|log-analyzer|browser-log-tool-lacks-provider-safe-analysis-contract|provider-fallback-safe-summary-foundation`

Kapsam: AI Log Analyzer M1 icin local-only provider-neutral contract, deterministic non-AI RPM/Nm log summary fallback, customer/expert projection boundary and review-gated runbook eklendi.

Sonuc: `src/lib/logAnalyzer` `log-analyzer-v1` contract'i ile provider unavailable/error/invalid-input states, deterministic fallback, confidence/readiness semantics, evidence, risk flags, recommendation categories, `humanReview.required === true` and blocked production actions saglar. Fallback AutoTuner CSV headersini ve simple RPM/Nm rows'u normalize eder; valid/rejected row count, RPM range, torque range, average torque and peak estimated torque/power facts uretir, fakat AI gibi davranmaz ve dyno-equivalent claim yapmaz. Customer projection provider/model/prompt/fallback internals, raw CSV rows, raw binary/hex, filenames, storage paths, signed URLs, hashes, customer identifiers and admin-only notes tasimaz; expert projection provider/fallback status, normalized counts, required human checks and blocked production actions tasir. No live provider call, upload endpoint, DB migration, public claim, MOD output, checksum approval, production access, `.env*`, secret, package install, commit, push or deploy yapildi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (84/84); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (60/60); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (319/319); `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir, bu no-env/no-live-network foundation run siniri icin guvenli degil.

### RMAP-FILE-AI-TUNE-ADVISOR-M1-FOUNDATION [P1] AI Tune Advisor rule fallback and expert review foundation

Durum: Done

Fingerprint: `ai-capability|tune-advisor|request-service-guidance-lacks-safe-rule-fallback|rule-fallback-expert-review-contract`

Kapsam: AI Tune Advisor M1 icin request/service metadata uzerinden local-only provider-neutral contract, deterministic non-AI fallback, customer/expert projection boundary and review-gated runbook eklendi.

Sonuc: `src/lib/tuneAdvisor` `tune-advisor-v1` contract'i ile provider unavailable/error/invalid-input states, deterministic fallback, confidence/readiness semantics, missing evidence, risk flags, recommendation categories, safety boundaries, `humanReview.required === true` and blocked production actions saglar. Stage/eco/TCU/only-options/original-file plus selected advanced service contexts existing desktop/new-request service taxonomy'sinden cozulur. Customer projection provider/model/prompt/fallback internals, storage paths, hashes, raw binary/hex, sample IDs and admin-only notes tasimaz; expert projection provider/fallback status, required human checks and blocked production actions tasir. Runbook future live/provider rollout icin operator-only decisions and safe validation gates'i belgeler. No pricing, credits, request submission, upload behavior, delivery, MOD output, checksum workflow, public legal/commercial claim, live provider config, production access, migration, `.env*`, secret, package install, commit, push or deploy yapildi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (79/79); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (59/59); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (313/313); `git diff --check` PASS (CRLF warnings only). `npm run build` not run because this repo build can load local Next env files and request Google Fonts, outside this run's no-env/no-live-network boundary.

### RMAP-FILE-AI-EXPERT-V2-M1-FOUNDATION [P1] AI File Expert V2 provider fallback and review gate foundation

Durum: Done

Fingerprint: `ai-capability|file-expert-v2|ai-report-lacks-explicit-review-gate-status-contract|provider-fallback-review-foundation`

Kapsam: Existing File Expert AI report flow now has a local V2 provider/fallback status and review-gate contract without DB migration, live provider call, production access or MOD/checksum export.

Sonuc: `generateAiFileExpertReport` now attaches provider generation metadata for provider-generated, deterministic fallback and provider-error fallback states. `src/lib/fileExpert/reportStatus.ts` defines `file-expert-v2-report-gate-v1` with provider/model/prompt status, fallback reason, human-review requirement, export lock and blocked production actions. New analyses store the status in existing `result_json.ai_report_status`; admin File Expert shows the state and blocked production actions, while customer projection converts it to a provider-free human-review/export-lock notice. The runbook documents safe local validation and operator-only production decisions. No secrets, `.env*`, live service, production data, migration, package install, pricing/legal change, customer-ready MOD output, checksum approval, commit, push or deploy was performed.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (73/73); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (58/58); `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (28/28); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (306/306); `git diff --check` PASS (CRLF warnings only). `npm run build` not run because this repo build can load local Next env files and request Google Fonts, outside this run's no-env/no-live-network boundary.

### RMAP-FILE-DTC-M5-ROLLOUT-READINESS [P1] AI DTC Analyzer rollout readiness pack

Durum: Done

Fingerprint: `ai-capability|dtc-analyzer|rollout-readiness-missing|regression-analytics-documentation-pack`

Kapsam: DTC Analyzer M5 icin local-only rollout readiness contract/report, sanitized fixture analytics helper ve operator runbook eklendi.

Sonuc: `src/lib/dtcAnalyzer/rolloutReadiness.ts` `buildDtcRolloutReadinessReport` ve `projectDtcRolloutAnalyticsSnapshot` helperlarini saglar; regression scenario coverage, provider/fallback/usage boundary summary, allow-listed audit metadata aggregation, blocked production actions and validation gates local kod sozlesmesi olarak raporlanir. `docs/dtc-analyzer-rollout-readiness.md` safe local validation komutlarini, operator-only production rollout checks listesini ve kalan limitasyonlari belgeler. Testler readiness contract, sanitized analytics no-leak behavior and runbook local-only boundaries icin genisletildi. Live provider call, production analytics query, `.env*` read, migration, package install, pricing/legal change, DTC-off approval, checksum/MOD output veya deploy yapilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (71/71); `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (28/28); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (57/57); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (303/303); `git diff --check` PASS (CRLF warnings only). `npm run build` calistirilmadi; bu repo build'i local Next env dosyalarini okuyabilir ve `next/font/google` nedeniyle Google Fonts ag istegi yapabilir.

### RMAP-FILE-DTC-M4-ADMIN-CONFIGURATION [P1] AI DTC Analyzer admin configuration and usage limits

Durum: Done

Fingerprint: `ai-capability|dtc-analyzer|admin-provider-state-and-usage-limits-missing|admin-configuration-boundary`

Kapsam: Existing DTC Analyzer request routes now share a local-only admin configuration and usage-limit boundary before analysis.

Sonuc: Added `src/lib/dtcAnalyzer/config.ts` with provider-unavailable status, deterministic fallback mode, local request/text/code limits and reusable usage guard. Customer/admin DTC routes now enforce the same guard before analysis, return safe over-limit payloads with retry timing where applicable, and skip generated-analysis audit writes for rejected usage. Admin DTC Expert Review now displays provider availability, fallback mode, configured usage limits and limit/failure state while preserving loading, empty, error, retry and accessibility behavior. Customer projection still hides provider/model/prompt/config internals, raw notes, storage paths, hashes, binary/hex data, sample ids and private metadata. Audit metadata marks provider unavailable/error and `analysis_success: false` for fallback/unavailable states.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (69/69); `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (28/28); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (56/56); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (300/300); `git diff --check` PASS (CRLF warnings only). `npm run build` not run because this repo build can load local env files and request Google Fonts, which is outside this run's no-env/no-live-network boundary.

### RMAP-FILE-DTC-M3-REQUEST-INTEGRATION [P1] AI DTC Analyzer request boundary and audit integration

Durum: Done

Fingerprint: `ai-capability|dtc-analyzer|request-notes-not-connected-to-safe-analysis|request-boundary-audit-integration`

Kapsam: Existing DTC analyzer response contract is now connected to request detail lifecycle surfaces with customer/expert projection boundaries and best-effort internal audit events.

Sonuc: Added `src/lib/dtcAnalyzer/requestIntegration.ts` to build request-level DTC analysis from existing order text, service and vehicle fields, project customer-safe and expert/admin-safe responses, and produce sanitized audit metadata. Added authenticated customer and admin POST routes for request DTC analysis with order ownership and `orders.view` staff boundaries. Customer order detail now shows `DTC Diagnostic Guidance` with empty/loading/error/retry/result states and only customer-safe summary, detected codes, missing info, evidence/recommendations/confidence and safety/human-review boundaries. Admin work-order detail now shows `DTC Expert Review` with provider/fallback status and detailed evidence/risk/recommendation structure, then refreshes the internal-only audit timeline. No DB schema, migration execution, live provider call, desktop DTC activation, file processing, MOD output, checksum action, pricing, legal or commercial policy change was added.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (66/66); `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (28/28); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (56/56); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (297/297); `npm run build` PASS (228/228, Next reported `.env.local` presence but no secret values were logged); `git diff --check` PASS (CRLF warnings only).

### RMAP-FILE-DTC-M2-ANALYSIS-SERVICE [P1] AI DTC Analyzer analysis service contract

Durum: Done

Fingerprint: `ai-capability|dtc-analyzer|fallback-output-lacks-evidence-risk-confidence-model|analysis-service-contract`

Kapsam: Existing `src/lib/dtcAnalyzer` response contract now carries local-only analysis-service semantics for structured evidence, deterministic risk flags, categorized recommendations and explicit confidence reasons.

Sonuc: `DtcAnalyzerResponse` and per-code analysis now expose customer-safe `evidence`, `riskFlags`, `recommendations` and `confidenceReasons`. Known DTCs remain capped at `medium`, unknown valid DTCs stay `low`, invalid input stays `none`, and provider-unavailable/provider-error fallback paths preserve provider identity, fallback reason and `isAiGenerated: false`. Recommendation categories separate diagnostic checks, missing information and human review gates without approving DTC-off, file edits, byte patches, checksum work or customer-ready MOD output. No UI, API route, DB schema, migration, external provider, env read, file processing, MOD/checksum action, pricing or customer-data access was added.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (64/64); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (55/55); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (293/293); `npm run build` PASS (228/228); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-058 [P2] Public preparation tools sitemap/robots discovery guclendirilsin

Durum: Done

Fingerprint: `public-seo|public-preparation-tools|homepage-linked-tools-not-crawler-discovered|sitemap-robots-discovery`

Kapsam: Homepage ve tools hub'da one cikan guvenli hazirlik araclari, sitemap ve robots allow listesinde crawler-discoverable hale getirildi.

Sonuc: `/tools/file-readiness-check`, `/tools/request-brief-builder` ve `/tools/ecu-read-method-advisor` `sitemap.ts` toolPaths listesine ve `robots.ts` public allow listesine eklendi. `scripts/check-i18n-seo.mjs` bu uc route'u sitemap/robots kontrati olarak zorunlu kontrol eder. Private/admin/dashboard/API/upload-session/raw/binary/checksum/MOD alanlari sitemap discovery'ye eklenmedi.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (55/55); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (291/291); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-057 [P2] Homepage request preparation HowTo structured data eklensin

Durum: Done

Fingerprint: `public-seo|homepage-request-preparation|visible-readiness-steps-not-machine-readable|safe-howto-jsonld`

Kapsam: Homepage'deki gorunur `Request Readiness Cockpit` adimlari, customer-safe `HowTo` structured data olarak arama motoru/AI search tarafina da anlatildi.

Sonuc: `homepageRequestPreparationHowToJsonLd` eklendi ve mevcut `requestReadinessSteps` kaynagindan uretilir hale getirildi. Root `WebPage` graph'i bu HowTo graph'ini `hasPart` ile referanslar. HowTo yalniz dosya talebine hazirlik, teknik brief, read-method planlama ve secure portal submission adimlarini anlatir; file picker, upload session, binary read, raw/hex, checksum, MOD generation, payment veya admin/private metadata icermez.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (54/54); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (290/290); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-056 [P2] Root homepage page-level structured data guclendirilsin

Durum: Done

Fingerprint: `public-seo|root-homepage|root-page-lacks-webpage-identity-schema|homepage-webpage-jsonld`

Kapsam: Root `/` homepage, FAQPage ve resource ItemList graph'lerinin yaninda explicit WebPage identity JSON-LD basar hale getirildi.

Sonuc: `homepagePageJsonLd` eklendi; root homepage canonical URL, language, Organization/WebSite linkleri, primary image ve FAQ/service/brand/platform schema part referanslariyla page-level identity kazanir. `homepageSearchIntentJsonLd` ve ItemList graph'leri stable `@id` degerleriyle baglandi. Private/admin/payment/AI/file-generation alanlari yok.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (53/53); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (289/289); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-055 [P2] Localized homepage page-level structured data guclendirilsin

Durum: Done

Fingerprint: `public-seo|localized-homepage|locale-routes-lack-page-level-service-schema|localized-webpage-service-itemlist-jsonld`

Kapsam: `/de`, `/tr`, `/fr` ve diger localized homepage route'lari, Organization/WebSite graph'inin yaninda locale-specific WebPage ve service ItemList structured data basar hale getirildi.

Sonuc: `src/app/[locale]/page.tsx` icinde `buildLocalizedHomepageJsonLd` helper'i eklendi. Her localized homepage kendi canonical localized URL'si, language code'u, organization/website baglantisi, primary image ve localized public service listesiyle `WebPage` + `ItemList` JSON-LD uretir. Service listesi `publicServiceSlugs` ve `getServiceSeo(slug, locale)` kaynaklarindan gelir; fiyat/credit, payment, private/admin metadata, API call, DB query, AI generation, file upload veya vehicle import eklenmedi. `scripts/check-i18n-seo.mjs` bu kontrati regression olarak kontrol eder.

Dogrulama: `node scripts/check-i18n-seo.mjs` PASS; `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (52/52); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (288/288); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-054 [P2] Homepage resource structured data public link hub'larini tanitsin

Durum: Done

Fingerprint: `public-seo|homepage-resource-structured-data|visible-link-hubs-not-described-as-itemlists|resource-itemlist-jsonld`

Kapsam: Homepage'deki service, brand ve ECU platform public link hub'lari, ayni kaynak veriden uretilen customer-safe ItemList structured data ile arama motorlarina aciklandi.

Sonuc: `/` artik FAQPage JSON-LD'nin yaninda service landing page, supported brand guide ve ECU/TCU platform guide ItemList JSON-LD graph'i basar. Service ItemList sadece mevcut `/services/...` landing page'leri kapsar; TCU `new-request` fallback'i structured data'ya resource gibi eklenmez. Fiyat/credit, raw/private/admin metadata, API call, DB query, payment/credit mutation, AI generation, vehicle import, email, desktop veya work-order logic eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (51/51); `node scripts/check-i18n-seo.mjs` PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (287/287); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-053 [P2] Homepage ECU platform library public guide ic linklerini guclendirsin

Durum: Done

Fingerprint: `public-seo|homepage-ecu-platform-library|platform-pages-not-linked-from-homepage|deep-linked-ecu-platform-hub`

Kapsam: Public ana sayfaya, mevcut `/ecu-platforms/[slug]` technical guide sayfalarina dogrudan ic link veren `ECU Platform Library` bolumu eklendi.

Sonuc: `/` artik Bosch EDC17, Bosch MD1, Bosch MG1, Continental SIMOS, Continental SID, Delphi DCM, Denso ve TCU & Gearbox public guide sayfalarina gorunur kartlarla link verir. Bolum controller family, read method ve identification bilgisi hazirlamayi anlatir; public guide'larin dosya edit/uretme/checksum-correct yapmadigi guvenli sinir olarak belirtilir. Yeni API, DB query, payment/credit mutation, AI generation, vehicle import, email, desktop veya work-order logic eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (50/50); `node scripts/check-i18n-seo.mjs` PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (286/286); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-052 [P2] Homepage brand cards public brand page ic linklerini guclendirsin

Durum: Done

Fingerprint: `public-seo|homepage-brand-cards|brand-pages-not-linked-from-homepage|deep-linked-brand-hub-cards`

Kapsam: Public ana sayfadaki supported brand kartlari, mevcut `/brands/[slug]` landing page'lere dogrudan ic link veren tiklanabilir kartlara donusturuldu.

Sonuc: `/` icindeki `Supported Brands` kartlari artik BMW, Mercedes-Benz, Audi, Volkswagen, Porsche, Opel, Renault ve Peugeot icin mevcut `/brands/...` sayfalarina gider. Kartlara net marka CTA'si eklendi; `Need another brand?` manual request yolu korunur. Yeni API, DB query, payment/credit mutation, AI generation, vehicle import, email, desktop veya work-order logic eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (49/49); `node scripts/check-i18n-seo.mjs` PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (285/285); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-051 [P2] Homepage servis kartlari public landing page ic linklerini guclendirsin

Durum: Done

Fingerprint: `public-seo|homepage-service-cards|service-pages-not-linked-from-cards|deep-linked-service-hub-cards`

Kapsam: Public ana sayfadaki servis kartlari, mevcut public service landing page'lere dogrudan ic link veren tıklanabilir kartlara donusturuldu.

Sonuc: `/` icindeki `Our Services` kartlari artik Stage 1, DPF OFF, EGR / AGR OFF, AdBlue OFF ve DTC OFF icin mevcut `/services/...` landing page'lerine gider. TCU Tuning karti, public service slug'i olmadigi icin yeni claim uretmeden mevcut `/new-request` review yoluna gider. Kartlara service intent rozeti ve net CTA eklendi. Fiyat/credit metinleri degistirilmedi. Yeni upload, file picker, API call, DB query, payment/credit mutation, AI generation, vehicle import, email, desktop veya work-order logic eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (48/48); `node scripts/check-i18n-seo.mjs` PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (284/284); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-050 [P2] Homepage search-intent FAQ schema ve workshop guide gostersin

Durum: Done

Fingerprint: `public-seo|homepage-search-intent|common-file-service-questions-hidden|faq-schema-workshop-guide`

Kapsam: Public ana sayfa, dosya yuklemeden once aranan temel file-service sorularini gorunur `Workshop Search Guide` bolumu ve customer-safe `FAQPage` structured data ile cevaplar hale getirildi.

Sonuc: `/` artik `Workshop Search Guide` bolumunde file request hazirligi, public preparation tools siniri, private dashboard delivery ve manual vehicle request yolunu net cevaplar. Ayni kaynak veriden `homepageSearchIntentJsonLd` uretilir ve `application/ld+json` olarak sayfaya eklenir. Bolum yalniz mevcut `/tools`, `/tools/file-readiness-check`, `/how-it-works` ve `/new-request` route'larina gider. Yeni upload, file picker, API call, DB query, payment/credit mutation, AI generation, vehicle import, email, desktop veya work-order logic eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (47/47); `node scripts/check-i18n-seo.mjs` PASS; `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (283/283); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-049 [P2] Musteri dashboard preparation-to-delivery workflow map gostersin

Durum: Done

Fingerprint: `customer-experience|dashboard-workflow|actions-scattered-without-end-to-end-map|preparation-to-delivery-workflow-map`

Kapsam: Musteri dashboard, hazirlik araclari, secure request, order tracking ve delivery adimlarini tek bir `Customer Workflow Map` bolumunde siraladi.

Sonuc: `/dashboard` artik `Customer Workflow Map` ile `Prepare file`, `Build request brief`, `Submit secure request`, `Track live work` ve `Review delivery` adimlarini gosterir. Adimlar yalniz mevcut public tool, new-request ve customer dashboard route'larina gider. `Track live work` needs-response varsa dogrudan response filtresine, yoksa order listesine gider. Bolum `No raw file is handled by these prep tools` sinirini aciklar. Yeni API, DB query, payment/credit policy, upload flow, AI, vehicle, email, desktop veya work-order logic degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (46/46); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (282/282); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-048 [P2] Musteri settings hesap hazirligini canli gostersin

Durum: Done

Fingerprint: `customer-experience|settings-profile|form-only-account-details|live-account-readiness-and-copy-reference`

Kapsam: Musteri settings sayfasi, sadece editable profil formu olmaktan cikarak canli account readiness ozeti ve tek tik bank-transfer reference kopyalama aksiyonu kazandi.

Sonuc: `/dashboard/settings` artik `Account Readiness` bolumunde contact details, invoice contact, billing address ve account type/company profile kontrollerini canli tamamlandi/eksik durumuyla gosterir. Readiness yuzdesi form alanlari degistikce hesaplanir. Bank Transfer Reference kartina `Copy reference` aksiyonu eklendi; kopyalama basariliysa `Reference copied`, basarisizsa customer-safe manuel kopyalama mesaji gosterir. Yeni API, DB query, payment mutation, email, vehicle, AI, desktop veya work-order logic degismedi; referans mevcut customer ID formatter'indan gelir.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (45/45); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (281/281); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-047 [P2] Legacy admin dashboard daily command brief gostersin

Durum: Done

Fingerprint: `admin-operations|legacy-admin-dashboard|priority-signals-scattered|daily-command-brief`

Kapsam: Legacy `/admin` dashboard, mevcut order/customer metriklerini tek bir `Daily Command Brief` bolumunde oncelikli operasyon kararina cevirdi.

Sonuc: Admin ana paneli artik `Daily Command Brief` ile `Start with new file intake`, `Resolve customer info blockers`, `Clear revision requests`, `Move file checks forward`, `Monitor active work` ve `Queue under control` onceliklerini otomatik siralar. `Open priority queue` mevcut order filtresini ayarlar; `Queue health` file coverage/open work/blocked signal/last sync gosterir. `Operational links` permission-gated olarak Work-order Center, File Expert, Vehicle Database ve Revenue Control'a gider. Yeni API, DB mutation, payment/credit policy, AI, vehicle, email, desktop veya work-order logic degismedi; customer email, internal note, file path, signed URL, storage, raw/hex gibi private alanlar bu brief'te kullanilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (44/44); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (280/280); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-046 [P2] Public homepage request readiness cockpit gostersin

Durum: Done

Fingerprint: `public-homepage|request-preparation|tools-hidden-below-fold|readiness-cockpit-before-upload`

Kapsam: Public homepage, tools hub'daki guvenli hazirlik araclarini ana sayfada gorunur bir `Request Readiness Cockpit` bolumune bagladi.

Sonuc: `/` artik live workload bolumunden sonra `Request Readiness Cockpit` gosterir. Bolum musteriyi sirayla file readiness check, request brief builder, ECU read method advisor ve secure new-request akisine yonlendirir. Yan panelde hazirlik araclarinin file upload/modification yapmadigi, kredilerin request creation sirasinda dogrulandigi, teslimlerin customer dashboard icinde kaldigi ve kompleks islerin human review altinda oldugu netlesir. Yeni bolum yalniz mevcut public tool/new-request linklerine gider; file picker, upload session, API/admin call, binary read, checksum veya MOD generation eklenmedi. Payment/credit policy, customer auth, AI, vehicle, email, desktop ve work-order mantigi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (43/43); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (279/279); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-045 [P2] Public tools hub musteri hazirlik akisini gostersin

Durum: Done

Fingerprint: `public-tools|tools-hub|tool-list-without-guided-flow|recommended-request-prep-workflow`

Kapsam: Public `/tools` sayfasi, tek tek arac listesinin yaninda musteriye dosya talebinden once hangi sirayla hazirlanacagini gosteren guvenli bir workflow seridi ve guncel SEO aciklamalariyla iyilestirildi.

Sonuc: Tools hub artik `Recommended workflow` bolumunde `Check readiness`, `Build a clean brief`, `Plan the read method` ve `Submit the request` adimlarini gosterir. Hero, metadata, Open Graph, Twitter ve JSON-LD aciklamalari yalniz eski torque/log araclarina odaklanmak yerine mevcut readiness, brief builder, read method advisor ve browser-based calculator kapsamini yansitir. Yeni bolum yalniz mevcut public tool/new-request linklerine gider; file picker, upload session, API/admin call, binary read, checksum veya MOD generation eklenmedi. Payment/credit policy, customer auth, AI, vehicle, email, desktop ve work-order mantigi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (42/42); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (278/278); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-044 [P2] Musteri order detayinda guvenli destek ozetini kopyalat

Durum: Done

Fingerprint: `customer-experience|order-detail-support-summary|manual-reference-copying|safe-copyable-support-summary`

Kapsam: Musteri order detail destek bolumune, destek ekibine yazarken kullanilabilecek customer-safe siparis ozetini tek tikla kopyalama aksiyonu eklendi.

Sonuc: `/dashboard/orders/[id]` Support karti artik `Support summary` bolumu ve `Copy safe summary` aksiyonu gosterir. Kopyalanan metin yalniz siparis referansi, durum, arac ozeti, hizmet ve olusturma tarihini icerir. Storage path, signed URL, raw/hex, hash, admin note, internal note, source/confidence veya dosya yolu gibi private alanlar ozete dahil edilmez. Mevcut mailto support linki, download, revision, additional upload, live sync ve customer-scoped order query davranisi korunur. Payment/credit policy, order mutation, AI, vehicle, email, desktop ve work-order mantigi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (41/41); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (277/277); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-043 [P2] Musteri siparis arsivi yuklenen sayfa ozetini gostersin

Durum: Done

Fingerprint: `customer-experience|order-archive-loaded-summary|loaded-orders-hidden-context|safe-page-level-summary-strip`

Kapsam: Musteri siparis arsivi, aktif filtrede yuklenen sayfanin kac kayit, kac aksiyon gereken is, kac teslim dosyasi ve kac kredi degeri icerdigini kompakt customer-safe ozet kartlariyla gosterir hale getirildi.

Sonuc: `/dashboard/orders` artik order archive sync basarili oldugunda `Loaded page`, `Action needed`, `Delivered files` ve `Credits shown` kartlarini gosterir. Ozet sadece mevcut customer-scoped loaded orders listesinden hesaplanir ve tam arşiv toplamı gibi yaniltici iddia uretmez; `Loaded page` karti `loaded / total` gosterir. Search, view filtreleri, pagination, retryable error state, order detail linkleri ve existing order query scoping korunur. Payment/credit policy, order mutation, AI, vehicle, email, desktop ve work-order mantigi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (40/40); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (276/276); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-042 [P2] Musteri dashboard'u tek oncelikli siradaki aksiyonu gostersin

Durum: Done

Fingerprint: `customer-experience|dashboard-next-action|scattered-action-signals|prioritized-next-best-action-card`

Kapsam: Musteri dashboard'undaki profil, aksiyon gereken siparis, kredi, aktif is ve yeni talep sinyalleri tek bir `Next best action` kartinda onceliklendirildi.

Sonuc: Dashboard artik customer-safe bir ust aksiyon karti gosterir. Oncelik sirasiyla eksik profil bilgileri, `customer_info_needed` siparisleri, 0 kredi bakiyesi, aktif is takibi ve yeni dosya talebi CTA'sina yonlendirir. Mevcut profil completion karti, kredi/siparis metrikleri, quick actions, credit ledger preview, realtime sync ve retryable dashboard hata state'i korunur. Payment/credit policy, request creation, order mutation, AI, vehicle, email, desktop ve work-order mantigi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (39/39); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (275/275); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-041 [P2] Yeni istek formu submit oncesi hazirlik checklist'i gostersin

Durum: Done

Fingerprint: `customer-experience|new-request-submit|missing-required-step-visibility-before-click|live-submit-readiness-checklist`

Kapsam: Yeni istek ekranindaki sticky `Request Summary`, submit butonuna tiklamadan once zorunlu adimlarin hangilerinin tamamlandigini canli checklist olarak gosterir hale getirildi.

Sonuc: Summary kartinda `Submit Readiness` bolumu; arac/motor, servis, orijinal dosya, kredi uygunlugu, kredi kullanim onayi ve sorumluluk onayini tamamlandi/eksik olarak gosterir. `Create Request` butonu eksik zorunlu adimlar varken `Complete Required Steps` etiketiyle disabled kalir. `handleSubmit` icindeki mevcut validasyonlar korunur; payment/credit policy, kredi hesabi, upload flow, RPC payload shape, servis katalogu ve customer privacy davranisi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (38/38); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (274/274); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities).

### AUTO-040 [P2] Yeni istek ozeti secilen ekstra hizmetleri isimleriyle gostersin

Durum: Done

Fingerprint: `customer-experience|new-request-summary|extra-options-count-only|selected-extra-service-names`

Kapsam: Yeni istek ekranindaki sticky `Request Summary`, secilen ekstra hizmetleri sadece adet olarak gostermek yerine isim ve krediyle customer-visible hale getirildi.

Sonuc: Summary kartinda `Extra Options` satiri secili ekstra hizmetleri tek tek listeler ve hic secim yoksa `None selected` gosterir. Toplam kredi hesabi ve backend'e giden `serviceSummary` ayni `selectedExtraServices` kaynagindan beslenir. Kredi fiyatlari, submit validasyonu, payment/credit policy, RPC payload shape, servis katalogu ve advanced service collapse davranisi degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (37/37); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (273/273); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities).

### AUTO-025 [P3] Desktop uploader local history statuslari okunabilir etiket kullansin

Durum: Done

Fingerprint: `desktop-uploader|local-upload-history|raw-status-values-in-history|human-readable-status-labels`

Kapsam: Desktop uploader local upload history preview, filter chip ve row status gorunumleri mevcut `statusLabel` helper'iyle customer-readable hale getirildi.

Sonuc: Dashboard local history preview ve full Local Upload History rows artik `Submitted`, `Failed` gibi okunabilir etiketler gosterir. Filter chip'leri de okunabilir etiket kullanir, ancak stored `row.status` degeri ve filtreleme semantigi degismeden kalir. Request list/detail status label davranisi, local-only history storage, request links, checksum satiri ve diagnostic privacy korunur.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\customer-uploader.test.ts` PASS (23/23); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (272/272); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities).

### AUTO-036 [P2] Musteri settings profil hatasinda varsayilan form gostermesin

Durum: Done

Fingerprint: `customer-experience|settings-profile-load|supabase-profile-error-renders-default-editable-form|retryable-profile-settings-error-state`

Kapsam: Musteri settings profil yukleme hatasi, default editable profile formu ve varsayilan bank-transfer reference gostermeden retry edilebilir customer-safe hata state'iyle ayrildi.

Sonuc: Ilk profile sync hatasinda `Customer settings sync failed` karti gorunur; settings formu, default `MGA-10001` customer reference ve bank-transfer reference render edilmez. Basarili profile yuklemesi sonrasi mevcut Customer ID, credits, contact/company/address fields ve save akisi korunur. Save failure raw backend mesajini basmaz; `Settings could not be saved...` customer-safe kopyasi kullanilir ve kullanicinin girdigi form degerleri retry icin korunur. Login redirect, verified-email guard ve own-profile `id` scoping degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (36/36); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (271/271); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities).

### AUTO-032 [P2] Musteri siparis arsivi sorgu hatasini bos liste gibi gostermesin

Durum: Done

Fingerprint: `customer-experience|order-archive|supabase-query-error-renders-with-empty-state|retryable-order-archive-error-state`

Kapsam: Musteri siparis arsivi, ilk `orders` sorgu hatasini normal bos liste gibi gostermek yerine retry edilebilir customer-safe hata state'iyle ayiracak sekilde guncellendi.

Sonuc: Ilk order archive sync hatasinda `Order archive sync failed` retry karti gorunur ve `No orders found in this view` bos state'i render edilmez. Basarili yukleme sonrasi load-more, search/reload veya realtime refresh hatasi olursa son yuklu order listesi korunur ve inline `Order archive sync needs retry` uyarisi gorunur. Basarili sifir-result yuklemelerinde mevcut bos state korunur. Active, Needs Response, Completed, Cancelled ve All view filtreleri, search, pagination, realtime refresh, customer_id scoping, login redirect ve verified-email guard davranislari korunur.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (35/35); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (270/270); `npm run build` PASS (228/228); `node scripts/check-payment-env.js --schema-only` PASS; `npm audit --omit=dev --audit-level=high` PASS (0 vulnerabilities).

### RMAP-FILE-DTC-M1 [P1] AI DTC Analyzer provider boundary and deterministic fallback

Durum: Done

Fingerprint: `ai-capability|dtc-analyzer|missing-provider-boundary-and-fallback|deterministic-provider-contract`

Roadmap: `file-platform`; Epic: `file-ai-dtc-analyzer`; Feature: `file-dtc-m1-provider-boundary`; Scope class: L.

Kapsam: Text DTC input icin provider-neutral analyzer contract, explicit provider-unavailable response state ve deterministic non-AI fallback eklendi.

Sonuc: `src/lib/dtcAnalyzer` altinda `DtcAnalyzerProvider` interface'i, `dtc-analyzer-v1` response contract'i, unavailable provider, deterministic fallback provider, input normalization/validation ve `analyzeDtcText` entrypoint'i olusturuldu. Fallback `P0401`, `P2002`, `U0100` gibi valid DTC kodlarini normalize eder, bilinen kodlar icin diagnostic context/check guidance uretir, invalid/empty input'u provider cagirmadan customer-safe sekilde reddeder ve her response'ta fallback usage, provider identity/status, confidence/uncertainty, missing information, safety boundaries ve human review requirement ayirir. No fake AI output: default provider explicit unavailable kalir ve fallback `isAiGenerated: false` dondurur. Dosya yukleme, binary inspection, API route, database schema, MOD generation, checksum result, price/payment/service claim, env read veya production service cagrisi eklenmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (62/62); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (34/34); `.\node_modules\.bin\tsx.cmd --test tests\customer-uploader.test.ts` PASS (22/22); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (269/269); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-039 [P2] File Expert analiz listesi yukleme hatasini bos analiz gibi gostermesin

Durum: Done

Fingerprint: `customer-experience|file-expert-dashboard-load|jobs-api-error-renders-empty-analysis-list|retryable-file-expert-jobs-error-state`

Kapsam: Musteri File Expert dashboard'u, analiz gecmisi `/api/file-expert/jobs` yukleme hatalarini gercek bos analiz listesi veya sifir metrik gibi gostermek yerine retry edilebilir customer-safe hata durumuyla ayiracak sekilde guncellendi.

Sonuc: Ilk jobs API hatasinda `File Expert history sync failed` retry karti gorunur; history metrikleri ve `No analysis yet` bos durumu render edilmez. Basarili yukleme sonrasi silent refresh hatasi olursa son yuklu analiz listesi ve metrikler korunur, inline `File Expert history sync needs retry` uyarisi ve retry aksiyonu gosterilir. Basarili sifir-job yuklemelerinde mevcut `No analysis yet` bos durumu korunur. Jobs API GET sorgu hatasinda raw backend mesaji yerine generic `File Expert jobs could not be loaded.` cevabi dondurur. Login redirect, verified-email guard, intake limit guidance, prepare/upload/finalize akisi, report navigation, status label'lari ve customer-safe job projection korunur. Raw backend mesajlari, Supabase/analyzer internalleri, raw binary data, storage path, signed URL, token veya admin-only alan hata UI'inda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (33/33); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (264/264); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-038 [P2] Admin request control center yukleme hatasini bos filtre gibi gostermesin

Durum: Done

Fingerprint: `admin-operations|request-control-center-load|api-load-error-renders-empty-filter|retryable-admin-requests-error-state`

Kapsam: Admin request control center, `/api/admin/requests` yukleme hatalarini normal bos filtre sonucu veya sifir metrik gibi gostermek yerine retry edilebilir admin-safe hata durumuyla ayiracak sekilde guncellendi.

Sonuc: Ilk request queue API hatasinda `Request queue sync failed` retry state'i gorunur; metrikler, filtreler ve `No work orders match this filter` bos sonucu render edilmez. Basarili yukleme sonrasi manuel refresh/API hatasi olursa son yuklu queue, metrikler, filtreler, Review only davranisi ve migration fallback banner korunur; inline `Admin request sync needs retry` uyarisi ve retry aksiyonu gosterilir. API catch artik raw exception mesajini dondurmez ve generic `Admin requests could not be loaded.` cevabi kullanir. Login redirect, verified-email guard, staff permission boundary, work-order satir alanlari ve review signal logic degistirilmedi. Raw Supabase hata metni, stack trace, service-role detayi, storage path, signed URL, payment internali, customer file internali veya admin-only payload internali hata UI'inda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (27/27); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (32/32); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (263/263); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-030 [P2] Musteri kredi ledger hatasini bos hareket gibi gostermesin

Durum: Done

Fingerprint: `customer-experience|credit-ledger-page|credit-transaction-query-error-looks-empty|retryable-ledger-error-state`

Kapsam: Musteri kredi ledger history sayfasi, profile veya `credit_transactions` sorgu hatalarini gercek bos hareket listesi gibi gostermek yerine retry edilebilir customer-safe hata durumuyla ayiracak sekilde guncellendi.

Sonuc: Ilk yukleme hatasinda `Credit ledger sync failed` retry karti gorunur ve `No credit ledger yet` bos hareket durumu render edilmez. Basarili yukleme sonrasi manuel, interval veya realtime refresh hatasi olursa son yuklu balance ve ledger hareketleri korunur, refreshing indikatoru kapanir ve inline `Credit ledger sync needs retry` uyarisi gorunur. Basarili sifir transaction yuklemelerinde mevcut bos ledger state'i ve Buy Credits linki korunur. Login redirect, unverified-email redirect, customer-scoped `user_id` ledger sorgusu, live polling/subscription davranisi, ledger formatting ve payment/credit policy degistirilmedi. Raw backend error, metadata select'i, visible `credit_transactions` table copy'si, storage path, signed URL, secret veya admin-only alan hata UI'inda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (31/31); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (261/261); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-037 [P2] File Expert yukleme formu API limitlerini gondermeden once gostersin

Durum: Done

Fingerprint: `customer-experience|file-expert-intake|server-side-file-and-field-limits-only|client-side-file-expert-limit-guidance`

Kapsam: Musteri File Expert intake formu, mevcut server text/file limitlerini prepare cagrisindan once gorunur ve local olarak dogrulanir hale getirildi.

Sonuc: Brand/model/engine alanlari 100, ECU/TCU hint 120 ve customer notes 2000 karakter kontratini `maxLength` ve kalan karakter yardimiyla gosterir. ORI/MOD secicileri desteklenen `.bin/.ori/.mod/.frf/.hex/.zip` uzantilarini ve 32 MB limitini gosterir; bos, buyuk veya desteklenmeyen dosyalar `/api/file-expert/jobs/prepare` cagrilmadan once reddedilir. Submit, en az bir gecerli ORI veya MOD dosyasi secilmeden ve text alanlari limit icinde olmadan disabled kalir. Prepare/upload/finalize akisi, private bucket upload davranisi, report navigation ve customer-safe redaction korunur. Raw binary, private storage path, signed URL, hash, analyzer internali, secret veya admin-only alan UI'da aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (30/30); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (260/260); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-035 [P2] Musteri widget workspace yukleme hatasini abonelik yok gibi gostermesin

Durum: Done

Fingerprint: `customer-experience|widget-dashboard-client-load|api-load-error-looks-like-missing-subscription|retryable-widget-load-error`

Kapsam: Musteri widget dashboard client yukleme akisi, `/api/widget/client` hatalarini no-subscription/plan CTA fallback'i yerine ayri customer-safe retry state ile gosterecek sekilde guncellendi.

Sonuc: Widget workspace ilk yukleme hatasinda artik `Widget workspace sync failed` retry ekrani gorunur; `View plans` no-subscription CTA'si sadece gercek no-client/no-subscription sonucu icin kalir. Retry ayni `load` yolunu kullanir ve mevcut login/verified-email redirectlerini korur. Basarili client yuklemesi sonrasi tekrar sync hatasi olursa son yuklu widget ayarlari korunur ve inline `Retry sync` uyarisi gorunur. Billing portal, domain-change request, pending domain guidance, settings save, embed code generation ve live preview davranislari korunur. Raw API hata mesaji, Stripe internali, Supabase internali, audit detayi, secret veya admin-only alan hata UI'inda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (29/29); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (259/259); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-034 [P2] Legacy admin panel yukleme hatasini bos operasyon listesi gibi gostermesin

Durum: Done

Fingerprint: `admin-operations|legacy-admin-dashboard|orders-customers-query-error-renders-empty-state|retryable-admin-load-error`

Kapsam: Legacy admin dashboard data-load akisi, orders/customers query hatalarini admin-safe retry state ile ele alacak ve basarisiz sync durumunda son basarili operasyon verisini koruyacak sekilde guncellendi.

Sonuc: Dashboard artik orders veya customers sorgu hatasinda raw backend mesajini `message` banner'ina basmaz. Ilk yukleme hatasinda `Admin data sync failed` retry karti gorunur ve orders/customers panelleri render edilmedigi icin normal `No orders found` veya `No customers found` bos durumlariyla karismaz. Basarili yukleme sonrasi silent/live refresh hatasinda `Admin sync needs retry` inline uyarisi gorunur, syncing indikatoru kapanir ve son basarili orders/customers listeleri ile secimler korunur. Auth/session redirectleri, verified-email guard, staff permission denial, filtreler, order/customer selection, notification sound, delivery estimate behavior ve mutation permission kontrolleri korunur. Supabase table/column internalleri, raw error mesajlari, storage path, signed URL, secret, payment internali veya customer file internali hata UI'inda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (28/28); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (258/258); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-029 [P2] Musteri dashboard veri senkron hatasini bos durum gibi gostermesin

Durum: Done

Fingerprint: `customer-experience|dashboard-data-sync|supabase-load-errors-look-empty-or-syncing|retryable-error-state`

Kapsam: Musteri dashboard data-load akisi, profile/orders/credit ledger/count query hatalarini customer-safe retry state ile ele alacak ve basarisiz sync durumunda son basarili dashboard verisini koruyacak sekilde guncellendi.

Sonuc: Dashboard artik Supabase query error degerlerini toplu kontrol eder ve tum queryler basarili olmadan credits, orders, ledger preview veya status count state'lerini overwrite etmez. Ilk yukleme hatasinda `Dashboard sync failed` ekrani ve `Try again` aksiyonu gorunur; live/silent refresh hatasinda syncing indikatoru kapanir, son basarili veri korunur ve inline retry banner'i gosterilir. Auth/session ve verified-email redirect akisi, customer-scoped `user_id` / `customer_id` queryleri, realtime subscriptions, profile completion karti, credit ledger preview, order count kartlari ve signed-url download davranisi korundu. Supabase table internals, storage path, signed URL, payment internals, secret, metadata veya admin-only alan aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (27/27); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (257/257); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-033 [P2] Legacy admin teslim tahmini kaydedilmeden 30 dk varsaymasin

Durum: Done

Fingerprint: `admin-operations|legacy-admin-order-modal|unset-delivery-estimate-defaults-to-30-min|explicit-estimate-selection`

Kapsam: Legacy admin order modal delivery estimate control'u, null estimate durumunu neutral not-set olarak gosterecek ve kayit icin acik estimate secimi isteyecek sekilde guncellendi.

Sonuc: Modal artik unset `estimated_delivery_label` degerini `usually_30_min` olarak baslatmaz. Preview `Estimate not set yet` gosterir, select disabled not-set placeholder'i gosterir, delivery note ve save aksiyonu explicit estimate secilene kadar disabled kalir. Mevcut non-null estimate label'lari, optional note edit davranisi, permission guard, SQL-column fallback mesaji, order status akisi ve customer detail display korunur. Fiyat, garanti, hukuki claim, SLA policy, database schema, production data veya live service davranisi degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (26/26); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (256/256); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-028 [P2] Desktop uploader not alanlari API sinirini gondermeden once gostersin

Durum: Done

Fingerprint: `desktop-uploader|request-notes-contract|api-length-limits-and-silent-1000-char-truncation|client-side-field-limits-guidance`

Kapsam: Desktop request wizard notes adimi, mevcut finalize API kontratina gore ECU, gearbox, read-method ve combined notes limitlerini musteriye gorunur hale getirecek sekilde guncellendi.

Sonuc: ECU ve gearbox alanlari 200, read method 120 karakter limitini `maxLength` ve kalan karakter yardimiyla gosterir. Customer notes ve special request alanlari combined finalize notes payload'una bagli 4000 karakter sayacini gosterir; notes adimindan review'a gecis ve review submit aksiyonu over-limit durumda engellenir. Finalize payload artik ayni shared notes builder'i kullanir ve `safeUploadPayload` bu path icin 4000 karakterlik API kontratini korur; varsayilan 1000 karakter guvenli payload davranisi diger kullanimlar icin korunur. Service catalogue, credit calculation, upload idempotency, private storage upload, app-check, local history, price/credit policy, raw file data, storage path, token ve admin-only alanlar degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\customer-uploader.test.ts` PASS (21/21); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (255/255); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-031 [P2] Admin bank payment formu API kontratini gondermeden once dogrulasin

Durum: Done

Fingerprint: `admin-operations|payment-control-bank-entry|server-side-payment-action-limits-only|client-side-bank-payment-validation`

Kapsam: Admin Payment & Revenue Control bank payment formuna mevcut server action kontratiyla uyumlu yerel dogrulama, input limitleri, not kalan karakter bilgisi ve inline guidance eklendi.

Sonuc: Customer secimi, bank reference, credits, amount EUR ve internal note alanlari POST oncesinde dogrulanir. Match payment & add credits aksiyonu form valid, migration ready ve saving degilken aktif olur; invalid durumda handler POST'a gecmeden admin-safe mesaj verir. Submitted payload shape, `admin_record_bank_payment` RPC, audit/email/server validation, Stripe/refund davranisi, fiyat/credit policy ve customer list loading degistirilmedi. Canli payment servisi, production servis cagrisi, migration, secret veya gercek musteri verisi kullanilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (25/25); `.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts` PASS (59/59); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (254/254); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-027 [P2] Musteri bildirim paneli yukleme hatasini sessiz gecmesin

Durum: Done

Fingerprint: `customer-experience|notification-bell|load-error-silent-empty-state|visible-retryable-notification-state`

Kapsam: Musteri notification bell dropdown'i, ilk yukleme ve Supabase query hatalarini sessiz bos durum gibi gostermek yerine yerel loading/error/retry state'leriyle guncellendi.

Sonuc: Bildirimler ilk yuklenirken dropdown kompakt `Loading notifications...` durumunu gosterir. Query hata verirse customer-safe `Notification sync failed` mesaji ve `Try again` aksiyonu gorunur; retry mevcut customer-scoped notification sorgusunu tekrar tetikler. Basarili yuklemede mevcut notification itemlari, unread count, toast, sound toggle, order linkleri, polling/realtime sync ve mark-all-read `user_id` scope'u korunur. Uzun notification title/body metinleri dropdown genisligi icinde wrap davranisi kazandi; storage path, signed URL, secret, admin note, metadata veya admin-only alan aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (24/24); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (253/253); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-023 [P2] Admin widget clients listesi bekleyen domain taleplerini gostersin

Durum: Done

Fingerprint: `admin-operations|widget-clients-list|pending-domain-requests-hidden|domain-request-queue-signal`

Kapsam: Admin widget clients list API'si ve liste UI'i, mevcut `widget_domain_change_requests` pending taleplerinden yalniz guvenli ozet sinyali kullanacak sekilde guncellendi.

Sonuc: Liste API'si pending domain taleplerini `client_id`, `requested_domain` ve `created_at` alanlariyla okur, her client icin pending count ve latest requested domain dondurur. Admin liste UI'i toplam pending domain request metrigi, masaustu `Domain review` link rozeti ve mobil `Pending` metric'i gosterir; search latest requested domain ve pending review terimleriyle de eslesir. Activate/suspend, copy embed, public key, usage, blocked-domain ve existing Stripe display davranisi korunur.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (23/23); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (252/252); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-026 [P2] Request chat uzun mesajlari gondermeden once sinirlasin

Durum: Done

Fingerprint: `customer-experience|request-chat-composer|api-4000-character-limit-only-server-side|client-side-length-guidance`

Kapsam: Customer/admin request chat composer mevcut `/api/requests/[id]/messages` 4000 karakter sozlesmesine uygun sekilde yerel `maxLength`, kalan karakter sayaci ve ortak send-disable durumu ile guncellendi.

Sonuc: Composer artik 4000 karakter ustunu textarea seviyesinde engeller, kalan karakter sayisini gorunur ve `aria-live` destekli olarak gosterir, bos trimlenmis mesajlari ve sending durumunu tek `canSendMessage` guard'i ile bloke eder. Enter ile gonderme ve Shift+Enter ile yeni satir davranisi, mevcut API hata mesaji alani, mesaj yukleme/senkron, visibility filtering, permission, notification sound ve message storage davranisi korunur.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (22/22); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (251/251); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-024 [P2] Musteri widget domain talebi beklemedeyken tekrar gonderilemesin

Durum: Done

Fingerprint: `customer-experience|widget-dashboard-domain-change|pending-request-still-submit-able|pending-state-guidance`

Kapsam: Musteri widget dashboard domain-change karti, mevcut `domainRequests` payload'undaki pending talebi customer-safe sekilde kullanarak ikinci talep gonderimini engelleyecek sekilde guncellendi.

Sonuc: Bekleyen domain-change talebi varsa dashboard artik istenen domaini `Pending admin review` durumuyla gosterir, input ve Send aksiyonunu disabled yapar ve handler seviyesinde duplicate gonderimi durdurur. Approved/rejected gecmis talepler listede gorunmeye devam eder ve pending yoksa yeni talep akisi korunur. Domain normalization, admin approval/rejection, Stripe billing, pricing, schema, audit log detayi ve private/internal alanlar degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (21/21); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (250/250); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-020 [P2] Musteri ek dosya yuklemesi asamalari acik geri bildirim versin

Durum: Done

Fingerprint: `customer-experience|order-detail-additional-upload|single-generic-uploading-state|phase-aware-upload-feedback`

Kapsam: Musteri order detayindaki ek dosya yukleme akisi, tek generic uploading etiketi yerine prepare, upload ve verify/save asamalarini musteriye guvenli sekilde gosterecek yerel phase state ile guncellendi.

Sonuc: Ek dosya yukleme karti artik "Preparing upload", "Uploading file" ve "Verifying upload" asamalarini aktif/tamamlanan/bekleyen durumlarla gosterir. Prepare, Supabase Storage upload ve finalize API akisi, tek dosya 32 MB siniri, private bucket, one-time permission kapatma ve basarili upload listeye ekleme davranisi korundu. Hata durumlarinda phase `idle` durumuna doner ve musteri yeniden deneyebilir; storage path, signed URL, hash, binary data, secret, payment data veya admin-only not aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (20/20); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (249/249); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-019 [P2] Musteri order teslim tahmini yalniz acik estimate varsa sure gostersin

Durum: Done

Fingerprint: `customer-experience|order-detail-estimated-delivery|null-estimate-shows-default-30min|explicit-estimate-only`

Kapsam: Musteri order detayindaki Estimated Delivery karti, null veya taninmayan `estimated_delivery_label` icin varsayilan "Usually around 30 min" etiketi yerine not-set durumunu gosterecek sekilde guncellendi.

Sonuc: Explicit admin secimleri `usually_30_min`, `same_day`, `24h`, `48h` ve `manual_review` icin mevcut etiketler korunur. Estimate yoksa kart "Estimate not set yet" ve review sonrasi estimate gelecegini belirten neutral copy gosterir. Explicit estimate yokken saved note veya varsayilan spesifik sure iddiasi gosterilmez; order actions, revision/download akisi, admin delivery secenekleri, SLA/fiyat/hukuki metin ve schema degismedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (19/19); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (248/248); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-018 [P2] Musteri dashboard kredi gecmisi gercek ledger'dan beslensin

Durum: Done

Fingerprint: `customer-experience|dashboard-credit-history-preview|orders-used-as-credit-ledger|safe-ledger-preview`

Kapsam: Musteri dashboard `Credit History` onizlemesi, son siparislerin `credits_required` alanindan turetilmek yerine customer-scoped `credit_transactions` ledger satirlarindan beslenecek sekilde guncellendi.

Sonuc: Dashboard artik son kredi hareketlerini `user_id` ile filtrelenen ledger kaynagindan yukler; description/type, delta, balance-after ve tarih alanlarini customer-safe sekilde gosterir. Pozitif hareketler yesil, negatif hareketler kirmizi ayrilir. Bos state buy credits ve full ledger linkleri verir. Recent orders, credit balance, live refresh ve `/dashboard/credits/history` akisi korunur; source id, metadata, odeme kaydi internali, secret veya admin-only not aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (18/18); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (247/247); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-022 [P2] Admin audit timeline event gorunurlugunu rozetlesin

Durum: Done

Fingerprint: `admin-operations|work-order-audit-timeline|customer-visible-events-unbadged|visibility-badges-for-audit-events`

Kapsam: Admin work-order audit timeline kartlarina mevcut `event.customer_visible` boolean'ini kullanan kompakt gorunurluk rozeti eklendi.

Sonuc: Customer-visible eventler `Customer-visible`, internal-only eventler `Internal-only` olarak ayriliyor. Event tipi, tarih, mesaj, siralama, API shape, customer API'leri, internal note gorunurlugu ve fallback empty/read-only davranislari korunur. `old_value`, `new_value`, metadata, risk flag, private path, hidden customer message veya admin-only note payload'i audit kartlarinda aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (26/26); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (17/17); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (246/246); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-021 [P2] Admin request listesi musteri ek dosya sinyalini gostersin

Durum: Done

Fingerprint: `admin-operations|request-control-center|customer-upload-indicator-hidden|show-supporting-file-signal`

Kapsam: Admin request control center listesine mevcut `item.indicators.hasCustomerUpload` boolean'ini kullanan kompakt, non-sensitive musteri ek dosya rozeti eklendi.

Sonuc: Ek musteri dosyasi olan request satirlari artik `Customer file` rozetiyle listede fark edilir. ORI/MOD/AI indikator grid'i korunur; dosya adi, storage path, signed URL, hash, binary metadata, odeme/kredi verisi veya admin-only note listede aciga cikarilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (25/25); `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (17/17); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (245/245); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-017 [P2] Admin completed-today metrigi teslim zamanini baz alsin

Durum: Done

Fingerprint: `admin-operations|legacy-admin-notification-center|completed-today-uses-created-at|delivery-time-completion-metric`

Kapsam: Legacy admin dashboard `Completed today` metrigi, teslim edilen modified file `uploaded_at` zamanini onceleyen testli bir helper'a tasindi.

Sonuc: Completed orders artik teslim dosyasinin en son `modified_files.uploaded_at` gunu bugunse sayilir. Teslim zaman kaniti yoksa mevcut `created_at` fallback'i korunur; completed olmayan orderlar ve gecersiz tarihli teslim kayitlari sayimi bozmaz. DB migration, production veri degisikligi, odeme/fiyat kurali veya live servis cagrisi yapilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (17/17); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (244/244); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-016 [P2] Musteri dashboard'u eksik profil bilgilerini tamamlatmaya yoneltsin

Durum: Done

Fingerprint: `customer-experience|customer-dashboard-profile|settings-fields-not-surfaced|profile-completion-next-step`

Kapsam: Musteri dashboard'una settings ekraninda zaten duzenlenebilen customer-safe profil alanlarina dayali, yalniz eksik bilgi varsa gorunen profil tamamlama sinyali eklendi.

Sonuc: Dashboard `profiles` sorgusu artik `full_name`, `phone`, `preferred_contact`, `invoice_email`, account/company ve billing address alanlarini credit/customer id ile birlikte yukluyor. Eksik full name, phone/contact, invoice e-mail, account/company veya billing address bilgileri settings linkli "Complete your customer profile" kartinda ozetleniyor; eksik yoksa kart render edilmiyor. Credit display, customer ID formatting, settings save davranisi, payment/pricing kurallari ve account policy degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (16/16); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (243/243); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-014 [P2] Musteri paneli aksiyon gereken siparisleri ayri gostersin

Durum: Done

Fingerprint: `customer-experience|customer-dashboard-orders|action-required-statuses-hidden-in-active-orders|needs-response-surface`

Kapsam: Musteri dashboard'u ve siparis arsivi `customer_info_needed` durumundaki siparisleri ayri "Needs Response" sinyaliyle gosterir.

Sonuc: Dashboard artik customer-safe `customer_info_needed` sayacini yukluyor, masaustu ve mobil navigasyondan `/dashboard/orders?view=needs_response` linki veriyor ve ozet kartinda aksiyon gereken siparis sayisini ayri gosteriyor. Siparis arsivine `needs_response` view'i eklendi; tab secimi URL query state'ini guncelliyor. Active, Completed, Cancelled ve All gorunumleri korundu; `revision` siparisleri "Revision review in progress" olarak aksiyon bekleyen musteri durumundan ayri gosteriliyor.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (15/15); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (242/242); `git diff --check` PASS (yalniz CRLF uyarilari). `npm run build` bilinen restricted-network Google Fonts / Next env yukleme riski nedeniyle calistirilmadi.

### AUTO-013 [P2] Musteri order timeline'i bekleme ve revizyon adimlarini acik gostersin

Durum: Done

Fingerprint: `responsive-ux|customer-order-detail|timeline-collapses-actionable-statuses|clear-next-step-status`

Kapsam: Musteri order detay timeline'i `customer_info_needed` ve `revision` durumlarini generic file-check/in-progress adimlarina sikistirmadan ayri gosterir.

Sonuc: Timeline artik order durumuna gore safe, dinamik adimlar olusturuyor. `customer_info_needed` durumunda "Waiting for Your Information" adimi aktif gorunur; `revision` durumunda teslim sonrasi "Revision Review" adimi Completed sonrasinda gorunur. Download ve revision request aksiyonlari degistirilmedi; timeline basligi ve satirlari uzun status/metin tasmasina karsi wrap davranisi kazandi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (14/14); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (241/241); `git diff --check` PASS (yalniz CRLF uyarilari).

### AUTO-008 [P1] Offline build bagimliligini dokumante et

Durum: Done

Fingerprint: `documentation|offline-build|google-fonts-build-dependency-undocumented|documented-local-automation-note`

Kapsam: `next/font/google` nedeniyle restricted/offline build'in Google Fonts fetch hatasina takildigini README veya docs icinde local automation notu olarak belgele.

Sonuc: Zaten karsilanmis olarak kapatildi. `README.md:73-76` `npm run build` icin restricted/offline automation ortaminda `next/font/google` kaynakli Google Fonts fetch riski oldugunu ve local fonts gecisinin ayri onayli gorev olmasi gerektigini acikliyor. Font, tasarim, uygulama kodu veya ticari metin degistirilmedi.

Dogrulama: Markdown evidence/diff incelemesi, `npm run lint`.

### AUTO-007 [P1] Vehicle JSON fallback icin data integrity testi ekle

Durum: Done

Fingerprint: `vehicle-catalog|json-fallback-data|public-data-contract-untested|covered-integrity-regression`

Kapsam: `data/vehicle-database.json` ve `data/vehicle-performance-overrides.json` public fallback sozlesmesi icin data integrity testleri eklendi.

Sonuc: Gercek JSON fallback satirlari public projection uzerinden forbidden admin/private alanlara karsi kontrol ediliyor; normalize edilmis public duplicate adaylari mevcut import summary raporuyla eslestiriliyor; performance override keyleri dort parcali legacy format ve mevcut fallback satirlariyla uyumlu dogrulaniyor. Data dosyalari degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\vehicle-control-center.test.ts` PASS (41/41); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (240/240); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-015 [P1] Yeni istek formu katalog yokken manuel arac bilgisi kabul etsin

Durum: Done

Fingerprint: `customer-experience|new-request-vehicle-intake|manual-vehicle-copy-without-form-path|manual-catalog-fallback`

Kapsam: Yeni istek formuna katalog secimi varsayilan kalacak sekilde manuel arac bilgisi fallback modu eklendi.

Sonuc: Katalog yuklenemediginde veya katalog bos geldiginde form manuel arac bilgisi moduna gecer; musteri isterse katalog varken de manuel moda gecebilir. Manuel brand/model/engine degerleri request progress, validasyon, ozet ve mevcut order RPC string alanlarinda kullanilir. Katalog secimi ve vehicle intelligence paneli katalog modu icin korunur; manuel degerler UI'da customer-provided/unverified olarak isaretlenir.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts` PASS (13/13); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (238/238); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-006 [P1] `src/proxy.ts` locale davranisi icin unit test ekle

Durum: Done

Fingerprint: `i18n|proxy-locale-routing|locale-cookie-header-resolution-untested|covered-locale-contract`

Kapsam: Locale cookie/header cozumu ve localized path davranisi icin dar kapsamli unit test eklendi.

Sonuc: `tests/proxy-locale.test.ts` path locale onceligini, path locale yokken cookie dilinin korunmasini, cookie yokken `accept-language` fallback davranisini ve mevcut non-api/static matcher sozlesmesini dogrular. `src/proxy.ts` urun davranisi degistirilmedi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\proxy-locale.test.ts` PASS (4/4); `npm test` PASS (238/238); `npm run lint` PASS; `npm run typecheck` PASS; `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-011 [P1] Admin review filtresi payment ve kalite sinyallerini kapsasin

Durum: Done

Fingerprint: `responsive-ux|admin-request-control-center|review-filter-misses-payment-quality-signals|complete-review-queue`

Kapsam: Admin request listesinde Review only filtresi ve Needs review metrigi ortak `hasReviewSignal` helper'i ile guncellendi.

Sonuc: Mevcut admin status review davranisi korundu; payment `requires_review`, quality `failed`/`needs_review` ve delivery `blocked`/`revision_requested` sinyalleri Review only sonucuna ve Needs review sayacina dahil edildi. Odeme, kredi, fiyat, DB mutasyonu veya production servis islemi yapilmadi.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (24/24); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (234/234); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-012 [P1] Work-order fallback modunda mutasyon kontrollerini read-only yap

Durum: Done

Fingerprint: `observability|admin-work-order-detail|fallback-mode-actions-still-enabled|read-only-state-with-actionable-feedback`

Kapsam: `payload.migrationReady === false` fallback modunda admin work-order detay ekranindaki mutasyon kontrolleri read-only/disabled hale getirildi.

Sonuc: Start Work, status/priority/tuner/payment review/quality/delivery/final file secimleri, note ekleme, customer upload permission ve customer message visibility aksiyonlari fallback modunda tetiklenemez. Mevcut read-only banner genisletildi; Refresh, ozet panelleri ve migration hazir oldugundaki mevcut aksiyon davranislari korundu.

Dogrulama: `.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts` PASS (23/23); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (233/233); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-005 [P0] Scraper scriptlerine explicit network guard ekle

Durum: Done

Fingerprint: `security|scraper-scripts|external-network-without-explicit-opt-in|explicit-careecufile-network-guard`

Kapsam: `scripts/carecufile-scraper.mjs` ve `scripts/scrape-all-brands.mjs` dis aga cikmadan once explicit `--allow-network` flag'i veya `ALLOW_CAREECU_NETWORK=1` env izni gerektirir.

Sonuc: Izin yokken scraperlar fetch, child scraping veya veri dosyasi yazma adimina gelmeden anlasilir mesajla cikar. Explicit izinle mevcut scraping argumanlari korunur; tum marka scripti `--allow-network` bayragini child scraper'a aktarir. `scripts/README-carecufile-scraper.md` yeni guard'i aciklar.

Dogrulama: `node scripts/carecufile-scraper.mjs --brands-only` beklenen guard cikisi; `.\node_modules\.bin\tsx.cmd --test tests/carecufile-scraper-guard.test.ts` PASS (4/4); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (232/232); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-004 [P0] Smoke scriptlerine non-local hedef guard'i ekle

Durum: Done

Fingerprint: `security|smoke-scripts|non-local-target-without-explicit-override|local-only-autopilot-guard`

Kapsam: `scripts/smoke-public-platform.mjs`, `scripts/smoke-admin-unauthenticated.mjs`, `scripts/smoke-admin-work-orders.mjs` ve `scripts/smoke-vehicle-control-center.mjs` icin ortak local-only smoke URL guard'i eklendi.

Sonuc: Default `localhost` hedefleri korunur; non-local smoke hedefleri `ALLOW_NON_LOCAL_SMOKE=1` olmadan fetch'e gecmeden reddedilir. Production smoke dokumanlari human-controlled override kosulunu gosterir; non-mutating source assertion testleri korundu ve guard testi eklendi.

Dogrulama: no-network guard kontrolu PASS; hedefli `tsx --test tests/admin-work-orders.test.ts tests/vehicle-control-center.test.ts` PASS (61/61); `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS (228/228); `git diff --check` PASS (yalnizca CRLF uyarilari).

### AUTO-003 [P0] Desktop env checker icin otonom guvenli mod ekle

Durum: Done

Fingerprint: `security|desktop-env-checker|env-file-secret-read|schema-only-public-contract-validation`

Kapsam: `apps/customer-uploader/scripts/check-env.mjs` icin `.env`/`.env.local` okumayan ve yalnizca public desktop env sozlesmesini dogrulayan guvenli mod eklendi.

Sonuc: Varsayilan desktop build/dev oncesi env kontrol davranisi korundu; `--schema-only` modu root/app `.env*` dosyalarina dokunmadan yalnizca public Vite env sozlesmesini raporlar ve service-role/server secret uyarisi yapar.

Dogrulama: `node apps/customer-uploader/scripts/check-env.mjs --schema-only`, hedefli desktop test, `npm run lint`, `npm run typecheck`, `npm test`.

### AUTO-002 [P0] Payment env checker icin otonom guvenli mod ekle

Durum: Done

Fingerprint: `security|payment-env-checker|env-local-secret-read|schema-only-contract-validation`

Kapsam: `scripts/check-payment-env.js` icin `.env.local` okumadan yalnizca gerekli key listesini ve dokumantasyon sozlesmesini kontrol eden `--schema-only` modu eklendi.

Sonuc: Varsayilan OK/MISS raporu korundu; `--schema-only` modu env dosyasi okumadan yalnizca gerekli key sozlesmesini raporlar. Yeni testler guvenli modun dosya okuma API'lerine gitmedigini ve output'un deger basmadigini dogrular.

Dogrulama: `node scripts/check-payment-env.js --schema-only`, hedefli test, `npm run lint`, `npm run typecheck`, `npm test`.

### AUTO-001 [P0] Root README'yi gercek proje rehberine cevir

Durum: Done

Fingerprint: `developer-experience|root-readme|default-create-next-app|project-specific-safe-setup-guide`

Kapsam: Default create-next-app README icerigini, bu repository'nin gercek amaci, mimarisi, npm komutlari, local setup notlari ve guvenli calisma sinirlariyla degistir.

Kabul kriterleri:

- README kok Next.js app, `apps/customer-uploader` desktop app ve opsiyonel `file-expert-analyzer` rollerini aciklar.
- npm package manager ve mevcut guvenli komutlar listelenir.
- `.env` okumama, production servislerine baglanmama, SQL/deploy calistirmama sinirlari net yazilir.
- Fiyat, garanti, hukuki iddia veya yeni urun vaadi eklenmez.

Dogrulama: Markdown diff incelemesi, `npm run lint`.
