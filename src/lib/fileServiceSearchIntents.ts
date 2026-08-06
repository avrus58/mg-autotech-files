export type FileServiceSearchDestination = {
  id: string;
  title: string;
  href: string;
  decision: string;
  searchTerms: readonly string[];
};

export type FileServiceSearchIntentGroup = {
  id: string;
  title: string;
  summary: string;
  featured?: boolean;
  destinations: readonly FileServiceSearchDestination[];
};

export const fileServiceSearchIntentGroups: readonly FileServiceSearchIntentGroup[] = [
  {
    id: "online-file-service",
    title: "Online ECU and TCU file service",
    summary:
      "Start with the central workflow when the job is not yet narrowed to one calibration, controller or diagnostic category.",
    featured: true,
    destinations: [
      {
        id: "ecu-file-service",
        title: "ECU file service and custom tuning files",
        href: "/file-service",
        decision:
          "Use the main file-service hub for the secure upload, technical review, tracked delivery and revision workflow.",
        searchTerms: [
          "ECU file service",
          "online ECU file service",
          "ECU tuning file service",
          "custom tuning files",
          "custom ECU calibration service",
          "online tuning file service",
        ],
      },
      {
        id: "workshop-file-service",
        title: "Workshop and dealer file-service workflow",
        href: "/workshop-guides/ecu-file-service-online",
        decision:
          "Use the workshop guide for the information, source file and request context needed before submission.",
        searchTerms: [
          "tuning file service for workshops",
          "ECU remap file service",
          "chip tuning file service",
          "custom remap files for tuners",
          "online tuning file portal",
        ],
      },
    ],
  },
  {
    id: "performance-calibration",
    title: "Stage and performance calibration",
    summary:
      "Route standard-hardware, modified-hardware and engineering-led builds to separate review paths.",
    destinations: [
      {
        id: "stage-1-file-service",
        title: "Stage 1 tuning file service",
        href: "/services/stage-1",
        decision:
          "For stock or near-stock petrol and diesel vehicles with exact ECU identity, fuel, gearbox and original-read context.",
        searchTerms: [
          "Stage 1 tuning file service",
          "Stage 1 ECU tuning file",
          "Stage 1 remap file",
          "custom Stage 1 file",
          "Stage 1 file for workshops",
        ],
      },
      {
        id: "stage-2-file-service",
        title: "Stage 2 tuning file service",
        href: "/services/stage-2",
        decision:
          "For vehicles with documented supporting hardware, drivetrain context and a clear validation plan.",
        searchTerms: [
          "Stage 2 tuning file service",
          "Stage 2 ECU file",
          "custom Stage 2 remap file",
          "modified vehicle tuning file",
        ],
      },
      {
        id: "stage-3-calibration",
        title: "Stage 3 custom calibration review",
        href: "/services/stage-3",
        decision:
          "For extensively modified builds that need a complete specification, feasibility review, logs and revision evidence.",
        searchTerms: [
          "Stage 3 tuning file service",
          "custom Stage 3 calibration",
          "big turbo ECU calibration",
          "custom build tuning file",
        ],
      },
      {
        id: "extended-performance-options",
        title: "ECO, VMAX and driving-feature requests",
        href: "/services",
        decision:
          "Use the full catalog for application-specific ECO, speed-limiter, launch-control, map-switch and sound-feature requests.",
        searchTerms: [
          "ECO tuning file request",
          "VMAX removal file service",
          "launch control file request",
          "Pop and Bang file request",
          "map switch ECU request",
        ],
      },
    ],
  },
  {
    id: "transmission-control",
    title: "TCU and gearbox file service",
    summary:
      "Keep transmission-controller identity and torque coordination separate from the engine ECU request.",
    destinations: [
      {
        id: "tcu-tuning-file-service",
        title: "TCU tuning and gearbox files",
        href: "/services/tcu-tuning",
        decision:
          "For supported transmission controllers with gearbox code, software identity, read method and engine torque context.",
        searchTerms: [
          "TCU tuning file service",
          "gearbox tuning file service",
          "DSG tuning file request",
          "ZF gearbox tuning file",
          "DCT tuning file service",
          "PDK tuning file request",
          "VGS gearbox file service",
        ],
      },
      {
        id: "tcu-request-preparation",
        title: "TCU file request preparation",
        href: "/workshop-guides/tcu-file-service-workflow",
        decision:
          "Use the preparation guide when controller identity, ECU/TCU source separation or torque context is incomplete.",
        searchTerms: [
          "TCU original file upload",
          "gearbox controller file request",
          "TCU file workflow for workshops",
          "ECU and TCU torque coordination",
        ],
      },
    ],
  },
  {
    id: "diagnostic-aftertreatment",
    title: "Diagnostic and aftertreatment requests",
    summary:
      "Choose the exact system, provide diagnostic evidence and keep jurisdiction-sensitive work review-first.",
    destinations: [
      {
        id: "dpf-file-service",
        title: "DPF file-service request",
        href: "/services/dpf-off",
        decision:
          "For supported diesel DPF requests with the original file, fault context and documented system condition.",
        searchTerms: [
          "DPF OFF file service",
          "DPF delete file request",
          "diesel particulate filter ECU file",
        ],
      },
      {
        id: "egr-file-service",
        title: "EGR and AGR file-service request",
        href: "/services/egr-off",
        decision:
          "For supported EGR or AGR requests after the mechanical and diagnostic context has been recorded.",
        searchTerms: [
          "EGR OFF file service",
          "AGR OFF file service",
          "EGR delete ECU file request",
        ],
      },
      {
        id: "adblue-file-service",
        title: "AdBlue and SCR file-service request",
        href: "/services/adblue-off",
        decision:
          "For supported SCR or AdBlue requests with exact DTCs, vehicle identity and system-condition notes.",
        searchTerms: [
          "AdBlue OFF file service",
          "SCR delete file request",
          "AdBlue ECU file solution",
        ],
      },
      {
        id: "dtc-file-service",
        title: "Exact DTC file-service request",
        href: "/services/dtc-off",
        decision:
          "For exact diagnostic codes after root-cause diagnosis, not for hiding an unknown mechanical or electrical fault.",
        searchTerms: [
          "DTC OFF file service",
          "DTC delete file request",
          "diagnostic trouble code ECU file",
          "specific DTC removal request",
        ],
      },
      {
        id: "extended-system-options",
        title: "Other supported system requests",
        href: "/services",
        decision:
          "Use the full catalog for application-specific GPF/OPF, NOx, lambda, flap and start-stop request categories.",
        searchTerms: [
          "GPF OPF file request",
          "NOx system file request",
          "lambda O2 file request",
          "swirl flap file request",
          "start stop software request",
        ],
      },
    ],
  },
  {
    id: "file-verification",
    title: "Original-file checks and read methods",
    summary:
      "Verify source history, controller identity and read coverage before another calibration is considered.",
    destinations: [
      {
        id: "ecu-file-check",
        title: "ECU file check and originality review",
        href: "/services/ecu-file-check",
        decision:
          "For uncertain original or modified files, software-version questions and source-history review.",
        searchTerms: [
          "ECU file check service",
          "original ECU file check",
          "modified ECU file check",
          "ECU file verification",
          "ECU software version check",
        ],
      },
      {
        id: "read-method-guide",
        title: "OBD, bench, boot and virtual-read guidance",
        href: "/workshop-guides/obd-bench-boot-read-methods",
        decision:
          "For workshops deciding how to describe the source read and which controller context must accompany it.",
        searchTerms: [
          "OBD ECU read file",
          "bench ECU read file",
          "boot mode ECU read",
          "virtual read tuning file",
          "AutoTuner KESS3 FLEX file preparation",
        ],
      },
      {
        id: "ecu-hw-sw-identification",
        title: "ECU HW, SW and calibration identification",
        href: "/workshop-guides/ecu-hw-sw-identification",
        decision:
          "For controller identification questions where supplier, family, HW, SW or calibration ID must be recorded exactly.",
        searchTerms: [
          "ECU HW SW identification",
          "ECU software number check",
          "ECU hardware number lookup guide",
          "ECU calibration ID identification",
        ],
      },
      {
        id: "file-readiness",
        title: "File-service request readiness",
        href: "/tools/file-readiness-check",
        decision:
          "Use the public readiness tool before upload when vehicle, source-file or request information may be incomplete.",
        searchTerms: [
          "ECU file request checklist",
          "tuning file upload requirements",
          "original file submission checklist",
          "ECU file readiness check",
        ],
      },
    ],
  },
  {
    id: "vehicle-coverage",
    title: "Vehicle and brand coverage",
    summary:
      "Use brand guides for vehicle-specific intake context; exact support is confirmed from the submitted ECU or TCU identity.",
    destinations: [
      {
        id: "bmw-file-service",
        title: "BMW ECU file-service guide",
        href: "/brands/bmw",
        decision:
          "Use the BMW guide for engine, gearbox, ECU identity and read-method context before opening the request.",
        searchTerms: [
          "BMW ECU file service",
          "BMW Stage 1 tuning file",
          "BMW ECU software request",
        ],
      },
      {
        id: "mercedes-file-service",
        title: "Mercedes-Benz ECU file-service guide",
        href: "/brands/mercedes-benz",
        decision:
          "Use the Mercedes-Benz guide for CDI, petrol, AMG and gearbox-controller request preparation.",
        searchTerms: [
          "Mercedes ECU file service",
          "Mercedes Stage 1 tuning file",
          "Mercedes Benz ECU software request",
        ],
      },
      {
        id: "audi-file-service",
        title: "Audi ECU file-service guide",
        href: "/brands/audi",
        decision:
          "Use the Audi guide for TDI, TFSI, ECU, TCU and exact HW/SW request context.",
        searchTerms: [
          "Audi tuning file service",
          "Audi Stage 1 tuning file",
          "Audi ECU software request",
        ],
      },
      {
        id: "volkswagen-file-service",
        title: "Volkswagen and VAG file-service guide",
        href: "/brands/volkswagen",
        decision:
          "Use the Volkswagen guide for TDI, TSI, DSG and controller-specific request preparation.",
        searchTerms: [
          "Volkswagen ECU tuning file",
          "VW Stage 1 tuning file",
          "VAG tuning file service",
        ],
      },
      {
        id: "porsche-file-service",
        title: "Porsche ECU file-service guide",
        href: "/brands/porsche",
        decision:
          "Use the Porsche guide for engine and PDK controller context before secure submission.",
        searchTerms: [
          "Porsche ECU file service",
          "Porsche Stage 1 tuning file",
          "Porsche PDK file request",
        ],
      },
      {
        id: "opel-file-service",
        title: "Opel ECU file-service guide",
        href: "/brands/opel",
        decision:
          "Use the Opel guide to prepare exact engine, ECU and diesel or petrol request context.",
        searchTerms: [
          "Opel tuning file service",
          "Opel Stage 1 tuning file",
          "Opel ECU software request",
        ],
      },
      {
        id: "renault-file-service",
        title: "Renault ECU file-service guide",
        href: "/brands/renault",
        decision:
          "Use the Renault guide for engine, ECU, transmission and read-method preparation.",
        searchTerms: [
          "Renault ECU tuning file",
          "Renault Stage 1 tuning file",
          "Renault ECU file service",
        ],
      },
      {
        id: "peugeot-file-service",
        title: "Peugeot ECU file-service guide",
        href: "/brands/peugeot",
        decision:
          "Use the Peugeot guide for HDI, petrol, ECU identity and source-file request context.",
        searchTerms: [
          "Peugeot ECU file service",
          "Peugeot Stage 1 tuning file",
          "Peugeot ECU software request",
        ],
      },
    ],
  },
  {
    id: "controller-coverage",
    title: "ECU and TCU platform coverage",
    summary:
      "Use controller-family guides when the search starts with ECU supplier or platform rather than vehicle model.",
    destinations: [
      {
        id: "bosch-edc17-file-service",
        title: "Bosch EDC17 file-service guide",
        href: "/ecu-platforms/bosch-edc17",
        decision:
          "Use the EDC17 guide to prepare the exact subtype, HW, SW, read method and original-file context.",
        searchTerms: [
          "Bosch EDC17 tuning file service",
          "EDC17 Stage 1 tuning file",
          "EDC17 ECU file request",
        ],
      },
      {
        id: "bosch-md1-file-service",
        title: "Bosch MD1 file-service guide",
        href: "/ecu-platforms/bosch-md1",
        decision:
          "Use the MD1 guide for modern diesel ECU identity, representation and read-method preparation.",
        searchTerms: [
          "Bosch MD1 tuning file service",
          "MD1 Stage 1 tuning file",
          "MD1 ECU file request",
        ],
      },
      {
        id: "bosch-mg1-file-service",
        title: "Bosch MG1 file-service guide",
        href: "/ecu-platforms/bosch-mg1",
        decision:
          "Use the MG1 guide for modern petrol ECU identity, software and source-file context.",
        searchTerms: [
          "Bosch MG1 tuning file service",
          "MG1 Stage 1 tuning file",
          "MG1 ECU file request",
        ],
      },
      {
        id: "continental-simos-file-service",
        title: "Continental Simos file-service guide",
        href: "/ecu-platforms/continental-simos",
        decision:
          "Use the Simos guide for exact controller generation, software and read-method preparation.",
        searchTerms: [
          "Continental Simos tuning file",
          "Simos Stage 1 tuning file",
          "Simos ECU file service",
        ],
      },
      {
        id: "continental-sid-file-service",
        title: "Continental SID file-service guide",
        href: "/ecu-platforms/continental-sid",
        decision:
          "Use the SID guide for exact diesel controller identity and source-file preparation.",
        searchTerms: [
          "Continental SID file service",
          "SID Stage 1 tuning file",
          "SID ECU file request",
        ],
      },
      {
        id: "delphi-dcm-file-service",
        title: "Delphi DCM file-service guide",
        href: "/ecu-platforms/delphi-dcm",
        decision:
          "Use the DCM guide for exact Delphi controller, HW/SW and original-read context.",
        searchTerms: [
          "Delphi DCM tuning file service",
          "DCM Stage 1 tuning file",
          "Delphi ECU file request",
        ],
      },
      {
        id: "denso-file-service",
        title: "Denso ECU file-service guide",
        href: "/ecu-platforms/denso",
        decision:
          "Use the Denso guide for exact ECU identity, read method and vehicle-specific request evidence.",
        searchTerms: [
          "Denso ECU file service",
          "Denso Stage 1 tuning file",
          "Denso ECU software request",
        ],
      },
    ],
  },
] as const;

export const fileServiceSearchDestinations: readonly FileServiceSearchDestination[] =
  fileServiceSearchIntentGroups.flatMap((group) => group.destinations);

export function normalizeFileServiceSearchTerm(value: string) {
  return value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}

export function buildFileServiceSearchOwnership() {
  return fileServiceSearchDestinations.flatMap((destination) =>
    destination.searchTerms.map((term) => ({
      term,
      normalizedTerm: normalizeFileServiceSearchTerm(term),
      destinationId: destination.id,
      href: destination.href,
    }))
  );
}
