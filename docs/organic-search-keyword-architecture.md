# Organic Search Keyword Architecture

Last reviewed: 2026-08-06

## Objective

This document defines how MG AutoTech maps commercial ECU and TCU search
language to useful public pages. It is a route-ownership model, not a keyword
stuffing list. Every phrase has one intended canonical destination so similar
pages do not compete with each other.

The implementation intentionally keeps the homepage compact. The full search
navigator lives on `/services`, while the detailed answer belongs to the
relevant service, workshop, brand or ECU-platform page.

## Research method

The research used three evidence layers:

1. Existing MG AutoTech services and request options were treated as the source
   of truth. Search terms were not added for products that are not represented
   by the current service catalog.
2. Current public search results and file-service websites were reviewed to
   identify the language workshops use around online file service, Stage files,
   gearbox files, diagnostic requests, read methods and original-file checks.
3. Google Search Central guidance was used to keep the result people-first,
   crawlable and resistant to doorway-page and keyword-stuffing patterns.

Research references:

- Google people-first content:
  https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google title-link guidance:
  https://developers.google.com/search/docs/appearance/title-link
- Google crawlable link guidance:
  https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Google spam policies:
  https://developers.google.com/search/docs/essentials/spam-policies
- ECU File Service UK workflow and terminology:
  https://ecufileservice.co.uk/
- Tuning FileService workflow and terminology:
  https://www.tuning-fileservice.com/
- German Fileservice terminology:
  https://www.dts-fileservice.de/
- French remote file-service terminology:
  https://solotofs-performance.fr/file-service
- Italian ECU/TCU file-service terminology:
  https://nmautoremap.it/

No search-volume number is claimed in this repository. Query priority must be
refined with the real Search Console impressions, clicks, countries, positions
and request-conversion data already available to the admin SEO reporting flow.

## Canonical route ownership

| Search need | Canonical route | Representative wording |
| --- | --- | --- |
| General online ECU/TCU service | `/file-service` | ECU file service, online ECU file service, ECU tuning file service, custom tuning files |
| Workshop file-service preparation | `/workshop-guides/ecu-file-service-online` | tuning file service for workshops, ECU remap file service, chip tuning file service |
| Stage 1 | `/services/stage-1` | Stage 1 tuning file service, Stage 1 ECU file, custom Stage 1 file |
| Stage 2 | `/services/stage-2` | Stage 2 tuning file service, modified vehicle tuning file |
| Stage 3 | `/services/stage-3` | Stage 3 tuning file service, custom build calibration |
| Extended performance options | `/services` | ECO, VMAX, launch control, Pop and Bang, map switch requests |
| TCU and gearbox files | `/services/tcu-tuning` | TCU file service, gearbox tuning file, DSG, ZF, DCT, PDK and VGS file requests |
| TCU preparation | `/workshop-guides/tcu-file-service-workflow` | TCU original upload, gearbox-controller request workflow |
| DPF | `/services/dpf-off` | DPF file service, diesel particulate filter ECU request |
| EGR / AGR | `/services/egr-off` | EGR file service, AGR file service |
| AdBlue / SCR | `/services/adblue-off` | AdBlue file service, SCR file request |
| Exact DTC request | `/services/dtc-off` | DTC file service, specific diagnostic-code request |
| Other supported system categories | `/services` | GPF/OPF, NOx, lambda/O2, flap and start-stop requests |
| Original or modified file review | `/services/ecu-file-check` | original ECU file check, modified file check, ECU file verification |
| Read-method preparation | `/workshop-guides/obd-bench-boot-read-methods` | OBD, bench, boot and virtual-read ECU file guidance |
| ECU identity preparation | `/workshop-guides/ecu-hw-sw-identification` | HW/SW number, software version and calibration ID guidance |
| Request readiness | `/tools/file-readiness-check` | original-file submission checklist, tuning-file upload requirements |
| Vehicle-brand intent | `/brands` and child brand guides | BMW, Mercedes-Benz, Audi, Volkswagen, Porsche, Opel, Renault and Peugeot file service |
| Controller-family intent | `/ecu-platforms` and child platform guides | Bosch EDC17, MD1, MG1, Simos, SID, DCM and Denso file service |

The executable allowlist is maintained in
`src/lib/fileServiceSearchIntents.ts`. The `/services` page renders the same
data as crawlable links and customer-readable guidance. Its structured data
uses the same destinations, so visible navigation and JSON-LD cannot drift into
different route ownership.

## Search-intent tiers

### Transactional

- ECU file service
- online ECU file service
- tuning file service for workshops
- custom tuning files
- Stage 1 tuning file service
- Stage 2 tuning file service
- TCU tuning file service
- ECU file check service

These terms map to a service page with a direct account or request next step.

### Service-specific

- Stage 3 custom calibration
- DPF, EGR/AGR, AdBlue/SCR and exact DTC request wording
- ECO, VMAX, launch control, Pop and Bang and map-switch request wording
- DSG, ZF, DCT, PDK and VGS controller wording

Dedicated pages are used only where MG AutoTech already has substantial unique
guidance. Smaller application-specific categories remain in the main catalog
instead of becoming thin landing pages.

### Preparation and verification

- original ECU file check
- ECU HW/SW identification
- OBD vs bench vs boot
- virtual-read file context
- tuning-file upload requirements
- request brief and file readiness

These queries lead to useful public preparation material before secure upload.
They do not upload, inspect, modify or generate files.

### Vehicle and controller long tail

Brand and controller-family queries go to the existing brand and ECU platform
guides. They are not expanded into model, engine, city or country doorway pages.
Exact support is confirmed only after the submitted vehicle and controller
identity is reviewed.

## Multilingual search language

Localized service routes should use the language of the page, not a mixed block
of translated keywords. Common commercial vocabulary to monitor in Search
Console includes:

- English: ECU file service, tuning files, custom remap file, Stage 1 file,
  gearbox tuning file.
- German: ECU Fileservice, Chiptuning Fileservice, Tuningdatei,
  Kennfeldoptimierung, Stage 1 Tuningfile.
- French: service fichier ECU, fichier reprogrammation, reprogrammation a
  distance, fichier Stage 1.
- Italian: file service ECU, calibrazione ECU e TCU, file Stage 1, servizio per
  officine.
- Spanish: servicio de archivos ECU, archivo Stage 1, reprogramacion ECU.
- Turkish: ECU dosya servisi, Stage 1 dosyasi, chiptuning dosya hizmeti.

Runtime copy remains inside the existing locale system. New localized landing
pages should be created only when the translation is complete and the page adds
unique user value.

## Intentionally excluded tactics

- No `meta keywords` tag.
- No hidden search-term blocks.
- No repeated city, country or "near me" doorway pages.
- No mass-generated brand/model/engine pages without unique evidence.
- No fake search volumes, rankings, delivery times, power gains or coverage
  counts.
- No "best", "number one", guaranteed-result or guaranteed-position claims.
- No free-file, cracked-software, database-download or automatic-generation
  search intent.
- No public-road legality claim for jurisdiction-sensitive requests.
- No direct links to private upload, customer, admin or storage internals.

## Measurement and iteration

Review the following every 28 days in the admin SEO reporting flow:

1. Query impressions and average position by canonical route.
2. Click-through rate by title and country.
3. Landing-page engagement and request-start events.
4. Registration-to-request and request-to-paid conversion where privacy-safe
   attribution exists.
5. Queries with impressions but no matching useful answer.
6. Pages that receive the same query and may be cannibalizing each other.

Add a new page only when Search Console shows a distinct intent and MG AutoTech
can provide a complete, accurate answer that is materially different from the
existing canonical route.

## Release checks

- `/services` renders the search navigator without client-only link injection.
- Every listed route is public and customer-safe.
- Every normalized search phrase has exactly one owner.
- The homepage receives no additional long-form section.
- Titles remain concise and page-specific.
- Public schema mirrors visible links.
- Responsive checks cover desktop, small laptop, tablet and mobile.
- Sitemap, robots, canonical and hreflang checks remain clean.
