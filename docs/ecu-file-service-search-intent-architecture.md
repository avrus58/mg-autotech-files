# ECU File Service search-intent architecture

## Purpose

This architecture responds to real Search Console visibility for ECU file-service,
Audi ECU software, Stage tuning, DPF, AdBlue and DTC queries. It uses one strong
canonical page per intent instead of spelling variants or thin doorway pages.

The implementation is English-first. Existing translated routes remain intact;
new English-only Stage 2, Stage 3, TCU and file-check pages are not automatically
translated or given unsupported hreflang alternatives.

## Canonical URL map

| Canonical URL | Primary search intent | Supporting intent |
| --- | --- | --- |
| `/file-service` | ECU file service, ECU fileservice, ECU files | Online ECU file service, custom tuning files, tuned ECU file download, ECU calibration service, customer file-management workflow |
| `/services/stage-1` | Stage 1 ECU file | Stage 1 tuning file, vehicle-specific Stage 1 software |
| `/services/stage-2` | Stage 2 ECU file | Stage 2 tuning file, modified-vehicle calibration |
| `/services/stage-3` | Stage 3 ECU file | Stage 3 tuning file, advanced custom calibration |
| `/brands/audi` | Audi ECU software | Audi ECU tuning files, Audi TDI/TFSI and TCU request guidance |
| `/services/dpf-off` | DPF off files | Jurisdiction-sensitive DPF ECU file request |
| `/services/adblue-off` | AdBlue off files | SCR/AdBlue ECU file request |
| `/services/dtc-off` | DTC off | Exact-code DTC file-service request after diagnosis |
| `/services/egr-off` | EGR off files | EGR/AGR diagnostic and lawful-use request context |
| `/services/tcu-tuning` | TCU tuning files | Gearbox-controller file service |
| `/services/ecu-file-check` | ECU file verification | Original-file, identity and read-coverage review |

`/file-service` remains the principal general-purpose canonical. No
`/ecu-file-service`, `ecu-fileservice` or other spelling-variant page is created.
There is therefore no obsolete URL requiring a redirect in this change.

## Titles and descriptions

The root metadata template adds `| MG AutoTech` once.

| URL | Final title | Meta description |
| --- | --- | --- |
| `/file-service` | ECU File Service for Custom Tuning Files \| MG AutoTech | Vehicle-specific ECU tuning files for Stage 1, Stage 2 and Stage 3, with secure original-file submission, technical review and customer portal delivery. |
| `/services/stage-1` | Stage 1 ECU Tuning File Service \| MG AutoTech | Custom Stage 1 ECU tuning files for standard or near-standard vehicles, prepared from the original file, exact vehicle data and reviewed ECU context. |
| `/services/stage-2` | Stage 2 ECU File Service for Modified Vehicles \| MG AutoTech | Review-first Stage 2 ECU file service for workshops with documented hardware changes, exact vehicle and ECU identity, original-file context and technical notes. |
| `/services/stage-3` | Stage 3 ECU File Service for Custom Builds \| MG AutoTech | Review-led Stage 3 ECU file service for extensively modified vehicles with exact turbo, fuel, engine, gearbox, ECU software and logging evidence. |
| `/brands/audi` | Audi ECU Software & TCU File Service \| MG AutoTech | Custom Audi ECU software and TCU file-service guidance for supported TDI, TFSI, Bosch, SIMOS and S tronic applications with exact HW/SW review. |
| `/services/dpf-off` | DPF OFF File Service \| MG AutoTech | DPF-related ECU file service for supported diesel vehicles, handled through a secure workshop-focused request workflow. |
| `/services/egr-off` | EGR OFF File Service \| MG AutoTech | EGR and AGR file service requests for supported ECUs with diagnostic notes, DTC context and secure file delivery. |
| `/services/adblue-off` | AdBlue OFF File Service \| MG AutoTech | AdBlue and SCR-related file service workflow for supported vehicles with clear status tracking and secure delivery. |
| `/services/dtc-off` | DTC OFF File Service \| MG AutoTech | DTC-related ECU file requests with structured fault code notes, file check support and secure customer delivery. |

Each page also publishes matching Open Graph and Twitter metadata using the
existing MG AutoTech social image.

## Content and conversion model

- The file-service hub explains who the workflow is for, what information is
  required, available request routes, quality boundaries and portal delivery.
- One reusable comparison presents Stage 1, Stage 2 and Stage 3 without power
  promises or a universal hardware recipe.
- The main CTA uses the existing `/new-request` workflow. It does not create a
  new upload or lead endpoint.
- Portal wording answers file-management searches accurately: customers can
  submit files, track orders, review messages, see delivered versions and request
  revisions. The platform is not described as standalone ECU editing software.
- Existing consent-aware public analytics records public navigation and
  `/new-request` CTA clicks through the central allowlisted event layer.

## Structured data

- `/file-service`: Organization, WebSite, CollectionPage, Service,
  BreadcrumbList, ItemList and visible FAQPage data.
- Stage 2, Stage 3, TCU and ECU file-check pages: Organization, WebSite, WebPage,
  Service, BreadcrumbList, requirements ItemList and visible FAQPage data.
- Stage 1, DPF, EGR, AdBlue and DTC pages: WebPage, Service, BreadcrumbList and
  visible FAQPage data in addition to existing site entities.
- Brand pages retain WebPage, BreadcrumbList and visible FAQPage data. Audi uses
  the existing `/brands/audi` canonical.

FAQ structured data mirrors questions rendered in the initial HTML. Its presence
does not guarantee a Google rich result.

## Internal linking

- Homepage service heading exposes compact Stage 1, Stage 2, Stage 3 and compare
  links without adding another long homepage section.
- The file-service hub links every Stage route, Audi, TCU, ECU file check, DPF,
  EGR, AdBlue, DTC, supported brands and preparation tools.
- Stage pages link to one another through the shared comparison and related-route
  blocks.
- Audi links back to the file-service hub and all three Stage pages.
- The public header keeps the canonical hub and service catalog visible; mobile
  gets a compact labelled service-catalog icon.
- The footer includes Stage 3 and Audi ECU Software links.

## Indexing and private-route safety

The sitemap includes all canonical public service-intent pages and uses their
content update dates. English-only intent pages are not emitted as translated
duplicates. Robots rules continue to block admin, API, auth, dashboard, payment,
registration and private request routes while allowing public content, assets and
the sitemap.

No customer, order, file, payment, source-reference, storage-path or admin
metadata is added to public copy or structured data.

## Measurement after release

Use the existing SEO Performance Center to compare 28-day and 90-day impressions,
CTR and landing-page request CTA activity. Review the canonical URLs above in
Search Console after recrawl; do not create more pages merely for spelling
variants. Expand content only when query and conversion evidence shows a distinct
unserved intent.

