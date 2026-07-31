export const serviceIntentGuideSlugs = [
  "stage-2",
  "stage-3",
  "tcu-tuning",
  "ecu-file-check",
] as const;

export type ServiceIntentGuideSlug = (typeof serviceIntentGuideSlugs)[number];

export type ServiceIntentGuide = {
  slug: ServiceIntentGuideSlug;
  name: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  heroTitle: string;
  lead: string;
  cardLabel: string;
  fitSignals: string[];
  requiredInputs: string[];
  reviewChecks: Array<{ title: string; text: string }>;
  workflow: Array<{ title: string; text: string }>;
  faq: Array<{ q: string; a: string }>;
  related: Array<{ label: string; href: string }>;
  publishedAt: string;
  updatedAt: string;
};

export const serviceIntentGuides: ServiceIntentGuide[] = [
  {
    slug: "stage-2",
    name: "Stage 2 ECU File Service",
    metaTitle: "Stage 2 ECU File Service for Modified Vehicles",
    description:
      "Review-first Stage 2 ECU file service for workshops with documented hardware changes, exact vehicle and ECU identity, original-file context and technical notes.",
    eyebrow: "Performance request route",
    heroTitle: "Stage 2 ECU file requests built around the actual hardware setup.",
    lead:
      "Stage 2 should not be treated as a generic step above Stage 1. The request needs a clear hardware inventory, exact ECU identity, original-file context and a realistic technical target before compatibility can be reviewed.",
    cardLabel: "Hardware-specific",
    fitSignals: [
      "The vehicle has documented hardware changes that are relevant to calibration.",
      "The workshop can provide an untouched original ECU read and the explicit read method.",
      "Fuel, engine setup, installed parts and intended use can be described before review.",
      "Transmission torque context is available when ECU and TCU behavior must be coordinated.",
    ],
    requiredInputs: [
      "Vehicle brand, model, generation, engine and model year",
      "ECU supplier, family and HW/SW identifiers when available",
      "Untouched original ECU file and explicit OBD, bench, boot or virtual-read context",
      "Complete hardware-change list, including relevant intake, exhaust and turbo changes",
      "Fuel type, available logs, current fault codes and workshop observations",
      "Requested result and any gearbox or torque-limit constraints",
    ],
    reviewChecks: [
      {
        title: "Identity before calibration",
        text: "Vehicle, ECU, software and read coverage must agree before the request can move forward.",
      },
      {
        title: "Hardware-to-file fit",
        text: "The submitted hardware description is reviewed against the requested service scope instead of assuming a universal Stage 2 setup.",
      },
      {
        title: "Drivetrain context",
        text: "Gearbox type and known torque constraints stay attached to the request when they affect the target.",
      },
    ],
    workflow: [
      { title: "Document the setup", text: "Prepare the vehicle, ECU, hardware, fuel, read method and target as one technical brief." },
      { title: "Submit the original", text: "Open the request inside the secure portal and attach the untouched source file." },
      { title: "Compatibility review", text: "MG AutoTech reviews identity, file context and the requested scope before work continues." },
      { title: "Track the request", text: "Questions, status, delivered versions and revisions remain connected to the private order." },
    ],
    faq: [
      {
        q: "Is Stage 2 automatically available for every vehicle?",
        a: "No. Availability depends on the exact ECU, software, original-file quality, installed hardware, read method and technical target. The route remains review-first.",
      },
      {
        q: "Why is a hardware list required?",
        a: "Stage 2 context depends on what is physically installed. A clear hardware list prevents a request from being reviewed as a generic Stage 1 job.",
      },
      {
        q: "Should I include logs and fault codes?",
        a: "Include them when available. Logs, active faults and workshop observations can reveal missing context before a file is prepared or written.",
      },
      {
        q: "Can ECU and TCU requests be coordinated?",
        a: "Yes, but the ECU and TCU should keep separate original files and controller identities. Mention the gearbox and torque context in the request.",
      },
    ],
    related: [
      { label: "Stage 1 ECU file service", href: "/services/stage-1" },
      { label: "Stage 3 custom calibration", href: "/services/stage-3" },
      { label: "TCU tuning file service", href: "/services/tcu-tuning" },
      { label: "Request brief builder", href: "/tools/request-brief-builder" },
      { label: "ECU read-method advisor", href: "/tools/ecu-read-method-advisor" },
      { label: "Complete service catalog", href: "/services" },
    ],
    publishedAt: "2026-07-31",
    updatedAt: "2026-07-31",
  },
  {
    slug: "stage-3",
    name: "Stage 3 Custom ECU Calibration",
    metaTitle: "Stage 3 ECU File Service for Custom Builds",
    description:
      "Review-led Stage 3 ECU file service for extensively modified vehicles with exact turbo, fuel, engine, gearbox, ECU software and logging evidence.",
    eyebrow: "Advanced calibration review",
    heroTitle: "Stage 3 calibration starts with the complete build, not a generic file.",
    lead:
      "Stage 3 describes an extensively modified powertrain, not one universal software package. Feasibility and calibration scope depend on the exact turbocharger, injectors, fuel system, engine components, sensors, cooling, transmission, ECU identity and the quality of the available technical evidence.",
    cardLabel: "Engineering review",
    fitSignals: [
      "The workshop can document every relevant engine, air, fuel, turbo, cooling and drivetrain modification.",
      "The exact ECU supplier, family, HW/SW identity, calibration context and untouched source file are available.",
      "The vehicle can be logged safely and the workshop can support a controlled validation and revision process.",
      "The requested result is defined by the real build and operating limits rather than a generic Stage 3 label.",
    ],
    requiredInputs: [
      "Vehicle, engine, model year, intended use and complete mechanical specification",
      "Turbocharger, injectors, pumps, fuel system, sensors, intercooler and exhaust details",
      "ECU supplier, family, HW/SW, calibration ID and original-file context when available",
      "Transmission type, controller details, clutch or gearbox changes and relevant torque constraints",
      "Fuel type, octane or blend, boost-control setup and known operating limits",
      "Read method, current diagnostic state, baseline logs and an explicit technical target",
    ],
    reviewChecks: [
      {
        title: "Build identity",
        text: "The declared hardware must describe the vehicle that will actually receive the calibration; incomplete or conflicting specifications stop the review.",
      },
      {
        title: "Control-system fit",
        text: "ECU software, sensors, actuators, fuel delivery and gearbox context are considered together before a viable calibration plan can be discussed.",
      },
      {
        title: "Validation path",
        text: "Logging conditions, human review and possible revisions are established before the request is treated as an advanced calibration project.",
      },
    ],
    workflow: [
      {
        title: "Build the specification",
        text: "Record every relevant component, controller identifier, fuel choice, read method, diagnostic condition and project target.",
      },
      {
        title: "Submit for feasibility review",
        text: "Open a secure request with the original ECU file and complete technical brief; availability is not assumed from the vehicle name.",
      },
      {
        title: "Define the validation plan",
        text: "MG AutoTech reviews the evidence, identifies missing information and confirms whether logs or additional checks are required.",
      },
      {
        title: "Track review and revisions",
        text: "Questions, customer-visible findings, delivered versions and any evidence-led revision remain attached to the private order.",
      },
    ],
    faq: [
      {
        q: "Is Stage 3 available as an instant downloadable file?",
        a: "No. Stage 3 is a custom technical review for a specific modified combination. The exact hardware, ECU software, fuel and validation path must be understood first.",
      },
      {
        q: "Which hardware changes are required for Stage 3?",
        a: "There is no universal parts list. Turbo, injector, pump, cooling, engine and gearbox requirements depend on the platform and target, so every installed change must be declared.",
      },
      {
        q: "Are data logs required?",
        a: "Advanced projects normally need a credible validation route. The exact log channels and conditions depend on the ECU, build and question being evaluated.",
      },
      {
        q: "Can an unknown or previously modified source file be used?",
        a: "Do not assume so. File history, identity and read coverage must be reviewed. An untouched original or verified source context may be required before work can continue.",
      },
      {
        q: "How does Stage 3 differ from Stage 2?",
        a: "Stage 2 is reviewed around documented supporting modifications. Stage 3 involves a substantially changed powertrain and a deeper engineering, logging and revision requirement.",
      },
    ],
    related: [
      { label: "Stage 1 ECU file service", href: "/services/stage-1" },
      { label: "Stage 2 ECU file service", href: "/services/stage-2" },
      { label: "ECU and TCU file-service hub", href: "/file-service" },
      { label: "Request brief builder", href: "/tools/request-brief-builder" },
      { label: "AutoTuner log analyzer", href: "/tools/autotuner-log-analyzer" },
      { label: "TCU tuning file service", href: "/services/tcu-tuning" },
    ],
    publishedAt: "2026-07-31",
    updatedAt: "2026-07-31",
  },
  {
    slug: "tcu-tuning",
    name: "TCU Tuning File Service",
    metaTitle: "TCU Tuning File Service for Gearbox Controllers",
    description:
      "TCU and gearbox file-service workflow for supported DSG, ZF, VGS, DCT and PDK controller requests with exact identity, original-read and torque context.",
    eyebrow: "Transmission request route",
    heroTitle: "TCU tuning requests with gearbox identity kept separate and clear.",
    lead:
      "A gearbox name alone is not enough to identify a TCU file. The controller family, software, original read, vehicle torque context and current transmission behavior should travel together through the request.",
    cardLabel: "Controller-specific",
    fitSignals: [
      "The workshop has a separate original TCU read or exact controller identification.",
      "The gearbox family, vehicle application and read method can be stated explicitly.",
      "Current shift behavior, hardware changes and known faults can be described clearly.",
      "Engine torque context is available when ECU and TCU requests need coordination.",
    ],
    requiredInputs: [
      "Vehicle, engine, gearbox type and model year",
      "TCU supplier, controller family, gearbox code and HW/SW identifiers when available",
      "Original TCU file with explicit OBD, bench, boot or virtual-read context",
      "Current ECU setup and intended engine torque context",
      "Existing shift complaints, clutch or gearbox hardware changes and diagnostic codes",
      "Requested transmission behavior described without mixing it into the ECU file",
    ],
    reviewChecks: [
      {
        title: "Exact TCU identity",
        text: "Controller and software identity are reviewed independently from the vehicle badge or gearbox marketing name.",
      },
      {
        title: "Separate source files",
        text: "ECU and TCU reads remain separate artifacts so controller history and delivered versions stay traceable.",
      },
      {
        title: "Torque coordination",
        text: "Engine and transmission targets are reviewed together when torque monitoring or limit interaction matters.",
      },
    ],
    workflow: [
      { title: "Identify the gearbox", text: "Record the TCU family, gearbox code, software, vehicle and read method." },
      { title: "Submit the TCU source", text: "Create the secure request and attach the correct original transmission-controller file." },
      { title: "Technical review", text: "MG AutoTech reviews the controller, request scope, faults and ECU torque context." },
      { title: "Receive tracked versions", text: "Customer-visible messages, delivery and revisions stay inside the protected order page." },
    ],
    faq: [
      {
        q: "Can a TCU request be identified from the gearbox name alone?",
        a: "No. Controller family, software identifiers, gearbox code, vehicle context and the original read may all be needed for reliable review.",
      },
      {
        q: "Should the ECU file be included in a TCU request?",
        a: "If coordinated ECU and TCU work is required, mention it and submit each controller through the correct file context. Do not combine two controller reads into one file.",
      },
      {
        q: "Are DSG, ZF, VGS, DCT and PDK requests all handled the same way?",
        a: "No. They describe different controller and gearbox families. Each request is checked against its own hardware, software and read-method context.",
      },
      {
        q: "Does this public page upload or inspect a TCU file?",
        a: "No. It prepares the request. File submission and private technical handling start only inside the authenticated customer portal.",
      },
    ],
    related: [
      { label: "Transmission controller guide", href: "/ecu-platforms/transmission-control-units" },
      { label: "Stage 2 ECU file service", href: "/services/stage-2" },
      { label: "ECU and TCU file-service hub", href: "/file-service" },
      { label: "ECU read-method advisor", href: "/tools/ecu-read-method-advisor" },
      { label: "Complete service catalog", href: "/services" },
    ],
    publishedAt: "2026-07-31",
    updatedAt: "2026-07-31",
  },
  {
    slug: "ecu-file-check",
    name: "ECU File Check Service",
    metaTitle: "ECU File Check and Original File Verification",
    description:
      "ECU file-check request route for workshops that need source-file, identity, read coverage or original-file context reviewed before further work.",
    eyebrow: "Verification request route",
    heroTitle: "Check ECU file context before a workshop commits to the next step.",
    lead:
      "A file name or file size cannot prove that an ECU read is correct or original. A useful review combines the source file with exact controller identity, read method, vehicle context and the reason the workshop needs verification.",
    cardLabel: "Verification-first",
    fitSignals: [
      "The workshop is unsure whether a file is original, complete or associated with the stated controller.",
      "HW/SW, calibration or read-method context needs to be checked before another service request.",
      "A replacement, previous modification or uncertain file history needs to be documented.",
      "The workshop wants a review record without exposing the file on a public page.",
    ],
    requiredInputs: [
      "Vehicle, engine, model year and ECU supplier or family",
      "HW, SW, calibration or OEM identifiers when available",
      "The file to be reviewed, submitted only through the authenticated portal",
      "Explicit read method, tool context and whether the read is full, partial or virtual when known",
      "Known file history, previous work, replacement history and current fault codes",
      "A precise question: originality, identity, read coverage, software version or request readiness",
    ],
    reviewChecks: [
      {
        title: "Identity consistency",
        text: "Vehicle, controller, HW/SW and file context are checked for conflicts instead of relying on the filename.",
      },
      {
        title: "Read coverage",
        text: "The stated read method and available metadata are considered before the file is treated as a usable source.",
      },
      {
        title: "History and uncertainty",
        text: "Known prior modifications, replacement history and missing evidence stay visible rather than being silently assumed away.",
      },
    ],
    workflow: [
      { title: "State the question", text: "Describe exactly what needs checking and why the file history is uncertain." },
      { title: "Submit securely", text: "Attach the file and controller context only through the authenticated request flow." },
      { title: "Review evidence", text: "MG AutoTech reviews the available identity, source and read-method evidence without relying on one weak signal." },
      { title: "Keep the result attached", text: "Customer-visible findings and next steps remain connected to the private request." },
    ],
    faq: [
      {
        q: "Can a filename prove that an ECU file is original?",
        a: "No. Filenames are useful labels, not proof. Controller identity, read method, file context and known history should be reviewed together.",
      },
      {
        q: "Can file size identify an ECU file by itself?",
        a: "No. Different controllers or read types can share the same size. File size is only one supporting signal.",
      },
      {
        q: "Does the public file-check page read my file?",
        a: "No. This page explains the preparation route. Any file is submitted only inside the protected customer request flow.",
      },
      {
        q: "Will a file check automatically approve another service?",
        a: "No. The result can clarify the next step, but service compatibility remains dependent on the exact request and available evidence.",
      },
    ],
    related: [
      { label: "File readiness check", href: "/tools/file-readiness-check" },
      { label: "ECU HW/SW identification guide", href: "/workshop-guides/ecu-hw-sw-identification" },
      { label: "OBD, bench and boot guide", href: "/workshop-guides/obd-bench-boot-read-methods" },
      { label: "Request brief builder", href: "/tools/request-brief-builder" },
      { label: "Complete service catalog", href: "/services" },
    ],
    publishedAt: "2026-07-31",
    updatedAt: "2026-07-31",
  },
];

export function getServiceIntentGuide(slug: string) {
  return serviceIntentGuides.find((guide) => guide.slug === slug) ?? null;
}
