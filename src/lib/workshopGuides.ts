export type WorkshopGuideArticle = {
  slug: string;
  shortTitle: string;
  title: string;
  description: string;
  eyebrow: string;
  intentLabel: string;
  intro: [string, string];
  sections: Array<{ title: string; items: string[] }>;
  faq: Array<{ q: string; a: string }>;
  related: Array<{ label: string; href: string }>;
  updatedAt: string;
};

export const workshopGuideArticles: WorkshopGuideArticle[] = [
  {
    slug: "ecu-file-service-online",
    shortTitle: "ECU file service online",
    title: "ECU File Service Online: A Workshop Request Guide",
    description:
      "Understand how a professional online ECU file-service request moves from vehicle identification and original-file preparation to review, status tracking and secure delivery.",
    eyebrow: "ECU file-service fundamentals",
    intentLabel: "ECU workflow",
    intro: [
      "An online ECU file service is more than a file drop. A usable request connects the exact vehicle, engine, control-unit identity, read method, selected service and original file so the workshop and file-service team are working from the same technical context.",
      "MG AutoTech keeps private upload, order communication, review status and completed-file delivery inside the authenticated customer portal. Public pages explain the preparation process but never read, inspect or modify a customer file.",
    ],
    sections: [
      {
        title: "Information to prepare",
        items: [
          "Vehicle brand, model, generation, engine and production year",
          "ECU supplier, family or label information when available",
          "Hardware and software identifiers when the read tool provides them",
          "The explicit read method: OBD, bench, boot, virtual read or unknown",
          "Selected service and a concise workshop note describing the goal",
        ],
      },
      {
        title: "What the workflow should preserve",
        items: [
          "The untouched original file remains connected to the request",
          "Vehicle and controller details stay visible during technical review",
          "Questions and customer-visible answers remain attached to the order",
          "Delivered versions and revision history remain inside the customer account",
          "Credits, payment state and file handling stay server-controlled",
        ],
      },
      {
        title: "Common reasons for clarification",
        items: [
          "The vehicle badge does not identify the installed ECU variant",
          "The read method or read coverage is not stated",
          "The submitted file may not be an untouched original",
          "Hardware changes or diagnostic symptoms are missing from the notes",
          "The requested services are unclear or combine unrelated goals",
        ],
      },
    ],
    faq: [
      {
        q: "Can ECU file support be confirmed from the vehicle model alone?",
        a: "No. The same model can use different ECU hardware and software. Controller identification, read method and the submitted original file may all be needed for confirmation.",
      },
      {
        q: "Does the public website inspect an ECU file?",
        a: "No. Public guides and tools provide preparation help only. Private file submission begins after login through the protected request workflow.",
      },
      {
        q: "Where can a customer track an ECU file request?",
        a: "Request status, customer-visible messages and available delivery files are shown in the authenticated MG AutoTech dashboard.",
      },
    ],
    related: [
      { label: "ECU / TCU file-service hub", href: "/file-service" },
      { label: "File readiness check", href: "/tools/file-readiness-check" },
      { label: "Request brief builder", href: "/tools/request-brief-builder" },
      { label: "Start a secure request", href: "/new-request" },
    ],
    updatedAt: "2026-07-30T00:00:00.000Z",
  },
  {
    slug: "tcu-file-service-workflow",
    shortTitle: "TCU file-service workflow",
    title: "TCU File Service: What a Workshop Should Prepare",
    description:
      "A practical request-preparation guide for TCU and gearbox file service, including controller identity, transmission context, separate original reads and secure delivery.",
    eyebrow: "Transmission request preparation",
    intentLabel: "TCU workflow",
    intro: [
      "A TCU request needs the transmission controller's own identity and original read. The gearbox marketing name or vehicle model is not a reliable substitute for the installed TCU hardware, software and read context.",
      "ECU and TCU work can belong to the same vehicle request, but their files and controller details should remain clearly separated. This prevents the engine and transmission records from being confused during review or delivery.",
    ],
    sections: [
      {
        title: "TCU request essentials",
        items: [
          "Vehicle, engine, gearbox type and production year",
          "Transmission controller family or label details",
          "TCU hardware and software identifiers when known",
          "Original TCU read and the exact read method used",
          "Existing shift concerns, hardware changes and intended request context",
        ],
      },
      {
        title: "Keep ECU and TCU context separate",
        items: [
          "Identify each file as ECU or TCU before submission",
          "Do not rename files in a way that hides the controller source",
          "State whether the request concerns engine, gearbox or both",
          "Attach controller-specific notes to the correct file request",
          "Keep every delivered version associated with its controller role",
        ],
      },
      {
        title: "Review checkpoints",
        items: [
          "Controller identity matches the submitted transmission read",
          "Read coverage is appropriate for the requested review",
          "Vehicle torque and hardware context are stated where relevant",
          "Previous software work or controller replacement is disclosed",
          "The programming method is confirmed by the workshop before writing",
        ],
      },
    ],
    faq: [
      {
        q: "Can a TCU request be prepared without a TCU file?",
        a: "Controller support may be discussed from identification data, but a file-service request normally requires the correct original TCU read for review.",
      },
      {
        q: "Should an ECU file be uploaded as a TCU file?",
        a: "No. ECU and TCU files have different roles and must remain clearly identified. Upload each controller file through the appropriate request context.",
      },
      {
        q: "Does MG AutoTech confirm the workshop write method?",
        a: "The request can include read and controller context, but the workshop remains responsible for using a suitable tool, stable power supply and a verified programming procedure.",
      },
    ],
    related: [
      { label: "TCU and gearbox platform guide", href: "/ecu-platforms/transmission-control-units" },
      { label: "ECU read-method advisor", href: "/tools/ecu-read-method-advisor" },
      { label: "How the portal works", href: "/how-it-works" },
      { label: "Prepare a request brief", href: "/tools/request-brief-builder" },
    ],
    updatedAt: "2026-07-30T00:00:00.000Z",
  },
  {
    slug: "obd-bench-boot-read-methods",
    shortTitle: "OBD, bench and boot reads",
    title: "OBD vs Bench vs Boot: ECU Read Methods Explained",
    description:
      "A customer-safe workshop guide to OBD, bench, boot and virtual ECU reads, why read method matters and what information should accompany a file-service request.",
    eyebrow: "Read-method clarity",
    intentLabel: "Read methods",
    intro: [
      "OBD, bench and boot describe different access situations, not interchangeable file formats. The resulting file coverage can depend on the ECU, tool, protocol and whether the read is physical or supplied as a verified virtual read.",
      "A workshop should record the method reported by its tool instead of guessing from the file name or file size. When the method is uncertain, the safest next step is to identify the ECU and confirm the tool protocol before submission or programming.",
    ],
    sections: [
      {
        title: "Method overview",
        items: [
          "OBD: communication through the vehicle diagnostic connection where supported",
          "Bench: controller access outside normal in-vehicle communication without opening the ECU where supported",
          "Boot: direct controller access that can require ECU opening and a tool-specific procedure",
          "Virtual read: a software-matched original supplied through a supported tool workflow",
          "Unknown: a valid temporary state that should trigger identification and confirmation",
        ],
      },
      {
        title: "What to record",
        items: [
          "Tool and protocol name shown during the read",
          "Whether the file is a full, partial or virtual read when explicitly known",
          "ECU label, supplier, family and hardware/software identifiers",
          "File name and size without treating either as proof of identity",
          "Any tool warning, recovery state or previous programming history",
        ],
      },
      {
        title: "Safety boundaries",
        items: [
          "Do not select a method from vehicle model alone",
          "Do not infer read coverage only from file size",
          "Do not write a file until controller identity and programming method are confirmed",
          "Use stable battery support and follow the tool manufacturer's procedure",
          "Keep an untouched original backup before any workshop programming action",
        ],
      },
    ],
    faq: [
      {
        q: "Is a bench read always more complete than an OBD read?",
        a: "Not as a universal rule. Coverage depends on the ECU and protocol. Record the exact method and tool result instead of assuming completeness from the method name.",
      },
      {
        q: "Can file size identify whether a read is OBD, bench or boot?",
        a: "No. File size is only one metadata point and cannot prove the controller identity, read method or coverage by itself.",
      },
      {
        q: "What should I do if the read method is unknown?",
        a: "Keep the file unchanged, collect ECU and tool identification, and use the read-method advisor or contact MG AutoTech before continuing.",
      },
    ],
    related: [
      { label: "Interactive read-method advisor", href: "/tools/ecu-read-method-advisor" },
      { label: "ECU platform guides", href: "/ecu-platforms" },
      { label: "File readiness check", href: "/tools/file-readiness-check" },
      { label: "ECU HW/SW identification guide", href: "/workshop-guides/ecu-hw-sw-identification" },
    ],
    updatedAt: "2026-07-30T00:00:00.000Z",
  },
  {
    slug: "ecu-file-request-checklist",
    shortTitle: "ECU request checklist",
    title: "ECU File Request Checklist for Workshops",
    description:
      "Use a concise workshop checklist to prepare vehicle, ECU or TCU, read-method, service, diagnostic and original-file context before secure submission.",
    eyebrow: "Before secure submission",
    intentLabel: "Request checklist",
    intro: [
      "A complete request reduces avoidable clarification and helps the technical review begin with the right controller and service context. The checklist should describe facts the workshop has verified, not assumptions inferred from a vehicle badge or file name.",
      "The public checklist does not upload or analyze a file. It helps prepare the information that will later be submitted through the secure MG AutoTech customer request workflow.",
    ],
    sections: [
      {
        title: "Vehicle and controller",
        items: [
          "Brand, model, generation, engine, year and fuel type",
          "ECU or TCU supplier and exact family when available",
          "Hardware, software and calibration identifiers reported by the tool",
          "Gearbox type when the request includes a transmission controller",
          "Previous controller replacement or software history when known",
        ],
      },
      {
        title: "File and service",
        items: [
          "Untouched original file selected from the correct controller",
          "Explicit read method and tool protocol",
          "Every requested service selected individually",
          "Fuel, hardware or drivetrain changes relevant to the request",
          "A safe filename that does not contain unnecessary personal data",
        ],
      },
      {
        title: "Diagnostic and communication context",
        items: [
          "Exact DTC codes when the request concerns a diagnostic code",
          "Symptoms and completed workshop checks stated separately",
          "Clear customer note describing the expected review goal",
          "A reachable account email for customer-visible questions",
          "Final review of request details before the secure upload starts",
        ],
      },
    ],
    faq: [
      {
        q: "Should a workshop include every diagnostic code?",
        a: "Include the exact codes relevant to the request and the diagnostic context. Do not replace verified codes with a general description such as warning light on.",
      },
      {
        q: "Can I submit when the ECU identity is still unknown?",
        a: "The request can state that identification is unknown, but support and processing may require clarification before work can continue.",
      },
      {
        q: "Does completing the checklist guarantee compatibility?",
        a: "No. It improves request quality, while final support still depends on the submitted file, controller identity, requested service and technical review.",
      },
    ],
    related: [
      { label: "Interactive readiness check", href: "/tools/file-readiness-check" },
      { label: "Build a request brief", href: "/tools/request-brief-builder" },
      { label: "Browse vehicle brands", href: "/brands" },
      { label: "View service categories", href: "/services" },
    ],
    updatedAt: "2026-07-30T00:00:00.000Z",
  },
  {
    slug: "ecu-hw-sw-identification",
    shortTitle: "ECU HW/SW identification",
    title: "ECU HW and SW Numbers: A Practical Identification Guide",
    description:
      "Learn what ECU hardware, software and calibration identifiers contribute to a file-service request and why exact identity matters more than model name or file size.",
    eyebrow: "Controller identification",
    intentLabel: "HW / SW identity",
    intro: [
      "Hardware and software identifiers help distinguish control units that may appear in the same vehicle model. They are evidence points for request review, but no single number should be treated as a universal identity when the ECU supplier, family or read context is missing.",
      "Use the identifiers reported by the ECU label or trusted read tool exactly as shown. Preserve punctuation and leading zeros, and avoid rewriting values to resemble another known controller or software version.",
    ],
    sections: [
      {
        title: "Useful identity fields",
        items: [
          "ECU supplier and controller family or type",
          "Manufacturer and supplier hardware part numbers",
          "Software number or software version",
          "Calibration ID when explicitly available",
          "Vehicle, engine, file role and read method",
        ],
      },
      {
        title: "How to record them",
        items: [
          "Copy values exactly from the tool or controller label",
          "Keep hardware and software fields separate",
          "Retain leading zeros, suffixes and punctuation",
          "State which tool or label supplied the value",
          "Mark a field unknown instead of estimating it",
        ],
      },
      {
        title: "What identity data cannot prove alone",
        items: [
          "A software number alone does not prove file originality",
          "A matching file size does not prove a matching ECU",
          "A model and engine badge do not prove the installed controller",
          "A familiar filename does not prove read method or file role",
          "Close identifiers do not authorize cross-vehicle file use",
        ],
      },
    ],
    faq: [
      {
        q: "Are HW and SW numbers the same thing?",
        a: "No. Hardware identifies the controller equipment version, while software identifies installed program or calibration context. Tools and manufacturers may label these fields differently.",
      },
      {
        q: "Can two files with the same size belong to different ECUs?",
        a: "Yes. File size is not a unique identity. Supplier, ECU family, HW/SW, read method and file content context are also relevant.",
      },
      {
        q: "Should an unknown identifier be guessed from the filename?",
        a: "No. Keep the value unknown and provide the original filename only as supporting metadata. Identification should come from explicit controller or tool evidence.",
      },
    ],
    related: [
      { label: "ECU platform library", href: "/ecu-platforms" },
      { label: "Vehicle brand guides", href: "/brands" },
      { label: "Read-method guide", href: "/workshop-guides/obd-bench-boot-read-methods" },
      { label: "Request checklist", href: "/workshop-guides/ecu-file-request-checklist" },
    ],
    updatedAt: "2026-07-30T00:00:00.000Z",
  },
];

export function getWorkshopGuideArticle(slug: string) {
  return workshopGuideArticles.find((article) => article.slug === slug);
}
