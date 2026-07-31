export type BrandGuide = {
  slug: string;
  name: string;
  description: string;
  intro: string[];
  ecuFamilies: string[];
  vehicleExamples: string[];
  requestChecks: string[];
  faq: { q: string; a: string }[];
};

export type PlatformGuide = {
  slug: string;
  name: string;
  description: string;
  intro: string[];
  commonApplications: string[];
  identification: string[];
  workflowNotes: string[];
  faq: { q: string; a: string }[];
};

export const brandGuides: BrandGuide[] = [
  {
    slug: "bmw",
    name: "BMW ECU & TCU File Service",
    description: "BMW ECU and TCU file service for workshops working with Bosch DDE/DME, EDC17, MD1, MG1 and supported transmission controllers.",
    intro: [
      "BMW requests can span several generations of diesel and petrol control units, from established EDC17 and MED17 systems to newer MD1 and MG1 families. Correct vehicle, engine, ECU and read-method data is essential because the same model name can contain different hardware and software versions.",
      "MG AutoTech keeps the original read, selected service, diagnostic notes, file versions and delivery history attached to one customer request. Compatibility is checked from the submitted file and identification data before processing.",
    ],
    ecuFamilies: ["Bosch EDC16 / EDC17", "Bosch MD1", "Bosch MED17 / MG1", "BMW DDE / DME", "Supported ZF and DCT TCU families"],
    vehicleExamples: ["1 Series", "3 Series", "5 Series", "7 Series", "X1 / X3 / X5", "Selected M and MINI applications"],
    requestChecks: ["Exact chassis and engine", "ECU identification or HW/SW data", "OBD, Bench or Boot read method", "Original full or virtual read", "Hardware changes and diagnostic context"],
    faq: [
      { q: "Can every BMW file be processed from an OBD read?", a: "No. The correct read type depends on the ECU and tool. Submit the read method and ECU identification so file suitability can be checked." },
      { q: "Are BMW transmission files supported?", a: "Selected TCU families are supported. Controller identification and the original TCU read are required for confirmation." },
    ],
  },
  {
    slug: "mercedes-benz",
    name: "Mercedes-Benz ECU & TCU File Service",
    description: "Mercedes-Benz ECU and TCU file service for supported CDI, MED, MD1, CRD and VGS control units with secure workshop delivery.",
    intro: [
      "Mercedes-Benz file work covers a broad range of diesel, petrol and transmission controllers. CDI and CRD diesel systems, MED petrol ECUs, newer MD1 units and VGS transmission controllers each require accurate identification and an appropriate read method.",
      "The portal groups vehicle data, control-unit information, original files and workshop notes in one request. This reduces confusion when a vehicle family has multiple ECU variants or software updates.",
    ],
    ecuFamilies: ["Bosch EDC16 / EDC17", "Bosch MD1", "Bosch MED17 / MG1", "Delphi CRD", "VGS / selected TCU families"],
    vehicleExamples: ["A-Class", "C-Class", "E-Class", "S-Class", "GLA / GLC / GLE", "Vito / Sprinter"],
    requestChecks: ["Model, engine and production year", "ECU or VGS identification", "Original read and read method", "Existing fault-code context", "Any drivetrain or hardware modifications"],
    faq: [
      { q: "Why is ECU identification important on Mercedes-Benz vehicles?", a: "Similar vehicle descriptions can use different CRD, EDC, MD1 or MED controllers. Identification prevents the request from being matched to the wrong ECU family." },
      { q: "Can ECU and TCU requests be submitted together?", a: "Yes, where supported. Include separate original reads and identification data for each controller." },
    ],
  },
  {
    slug: "audi",
    name: "Audi ECU Software & TCU File Service",
    description: "Custom Audi ECU software and TCU file-service guidance for supported TDI, TFSI, Bosch, SIMOS and S tronic applications with exact HW/SW review.",
    intro: [
      "Audi platforms share powertrain technology across the Volkswagen Group, but that does not make ECU software interchangeable. Model generation, engine code, market, ECU hardware, software and calibration identifiers can all change the correct source-file and review context. Supported TDI and TFSI applications may use Bosch EDC17, MD1, MED17, MG1 or Continental SIMOS systems depending on generation.",
      "Stage 1, Stage 2 and advanced custom calibration requests must be matched to the actual Audi setup. A useful order includes the untouched original read, explicit OBD, bench, boot or virtual-read method, fuel, installed hardware and current diagnostic condition. S tronic or other transmission work requires a separate TCU file and controller identity so engine and gearbox evidence remain traceable.",
    ],
    ecuFamilies: ["Bosch EDC17 / MD1", "Bosch MED17 / MG1", "Continental SIMOS", "Selected DL / DQ transmission controllers", "VAG diesel and petrol platforms"],
    vehicleExamples: ["A3 / S3", "A4 / S4", "A5", "A6 / A7", "Q3 / Q5 / Q7", "Selected RS applications"],
    requestChecks: ["Exact Audi model, generation, engine code and model year", "ECU supplier, family, HW/SW and calibration identifiers where available", "Untouched original read with tool, protocol and read method", "Gearbox and separate TCU identity for S tronic work", "Installed hardware, fuel, fault codes and requested calibration scope"],
    faq: [
      { q: "Is an Audi file interchangeable with another VAG model?", a: "No assumption should be made. Hardware, software and calibration identifiers must match the submitted controller and vehicle." },
      { q: "Do you support S tronic TCU files?", a: "Selected controllers are supported after identification. Submit the TCU type and original read for confirmation." },
      { q: "Can I request Stage 1, Stage 2 or Stage 3 Audi ECU software?", a: "The relevant route can be reviewed after the exact vehicle, ECU software, original file, fuel and hardware setup are supplied. A stage label alone does not confirm compatibility." },
      { q: "Why are Audi ECU HW and SW numbers important?", a: "Audi models with similar badges can use different controller and software variants. Exact identification helps prevent the request from being reviewed against the wrong ECU context." },
      { q: "Should I declare intake, exhaust, turbo or fuel-system changes?", a: "Yes. List every relevant modification and the intended fuel. Modified hardware changes the evidence needed for Stage 2 or Stage 3 review." },
    ],
  },
  {
    slug: "volkswagen",
    name: "Volkswagen ECU & TCU File Service",
    description: "Volkswagen ECU and TCU file service for supported TDI, TSI, Bosch, Continental SIMOS and DSG controller applications.",
    intro: [
      "Volkswagen requests range from older EDC16 systems through EDC17 and modern MD1/MG1 or SIMOS applications. TDI and TSI badges alone are not sufficient identification because ECU and software families vary across model years and engine codes.",
      "MG AutoTech checks the submitted read and technical data before file work. DSG requests are handled with the associated TCU identification and original transmission file where supported.",
    ],
    ecuFamilies: ["Bosch EDC16 / EDC17", "Bosch MD1 / MG1", "Bosch MED17", "Continental SIMOS", "Selected DQ200 / DQ250 / DQ381 / DQ500"],
    vehicleExamples: ["Golf", "Passat", "Polo", "Tiguan", "Touareg", "Transporter / Caddy"],
    requestChecks: ["Vehicle and engine code", "ECU or TCU identification", "Original read type", "DSG controller type if applicable", "Diagnostic and hardware notes"],
    faq: [
      { q: "Can a virtual read be used for every Volkswagen ECU?", a: "No. Suitability depends on the ECU, software match and tool protocol. The read method must be included in the request." },
      { q: "Can DSG and ECU files be coordinated in one job?", a: "Yes where both controllers are supported. Provide both original files and clearly identify each controller." },
    ],
  },
  {
    slug: "porsche",
    name: "Porsche ECU & TCU File Service",
    description: "Porsche ECU and PDK file service for supported Bosch MED, MG1, EDC and transmission controller families with file-by-file verification.",
    intro: [
      "Porsche applications require careful identification because powertrain, market and software revisions can differ even within one model generation. Petrol vehicles may use MED or MG1 families, while supported diesel platforms can use Bosch EDC systems.",
      "Requests are reviewed individually from the original file, ECU identification and vehicle specification. PDK work requires the transmission controller data and original TCU read.",
    ],
    ecuFamilies: ["Bosch MED17", "Bosch MG1", "Bosch EDC17", "Selected SDI systems", "Selected PDK controllers"],
    vehicleExamples: ["Cayenne", "Macan", "Panamera", "Boxster / Cayman", "911", "Selected diesel applications"],
    requestChecks: ["Exact model and generation", "Engine and drivetrain specification", "ECU/TCU identification", "Read method and file type", "Fuel and hardware configuration"],
    faq: [
      { q: "Is support confirmed from the Porsche model name alone?", a: "No. The controller family, hardware/software identification and read type are required for a reliable check." },
      { q: "Are PDK requests supported?", a: "Selected PDK controllers are supported. Submit the TCU identification and original read for review." },
    ],
  },
  {
    slug: "opel",
    name: "Opel ECU File Service",
    description: "Opel ECU file service for supported Bosch, Delphi/Delco, Continental and diesel or petrol controller families.",
    intro: [
      "Opel vehicles can contain Bosch, Delphi/Delco, Continental and other control-unit families depending on model, engine and ownership era. Accurate ECU identification is more useful than relying only on the vehicle badge.",
      "The request workflow captures the original read, vehicle details, read method and fault context. Support is confirmed after the file and controller data are checked.",
    ],
    ecuFamilies: ["Bosch EDC16 / EDC17", "Bosch MD1", "Delphi / Delco E-series", "Continental SID", "Selected petrol ECU families"],
    vehicleExamples: ["Astra", "Corsa", "Insignia", "Mokka", "Vivaro", "Zafira"],
    requestChecks: ["Model, engine and year", "ECU label or identification", "Original file and read method", "Fault codes where relevant", "Hardware and previous repair notes"],
    faq: [
      { q: "Why do Opel vehicles need a controller check?", a: "The same model range can use different Bosch, Delco or Continental systems. File support depends on the actual ECU and software." },
      { q: "Can diagnostic notes be attached to the request?", a: "Yes. Fault codes and workshop findings should be included when they affect the requested service." },
    ],
  },
  {
    slug: "renault",
    name: "Renault ECU File Service",
    description: "Renault ECU file service for supported Bosch EDC/MD1, Continental SID/EMS and Delphi DCM diesel and petrol applications.",
    intro: [
      "Renault powertrains use several Bosch, Continental and Delphi ECU families. Diesel applications in particular may span EDC, SID and DCM controllers, each with different identification and read requirements.",
      "Submitting engine details, ECU information and the correct original read allows the file to be checked efficiently. Workshop notes remain attached to the order throughout processing and delivery.",
    ],
    ecuFamilies: ["Bosch EDC16 / EDC17", "Bosch MD1", "Continental SID / EMS", "Delphi DCM", "Selected petrol ECU families"],
    vehicleExamples: ["Clio", "Megane", "Talisman", "Kadjar", "Koleos", "Master / Trafic"],
    requestChecks: ["Engine designation and power", "ECU family and identification", "Full or virtual read details", "Diagnostic fault context", "Vehicle and emissions-system condition"],
    faq: [
      { q: "Are all Renault DCM and SID controllers handled the same way?", a: "No. Controller generation, software and read type must be checked individually." },
      { q: "What should be included with a diesel request?", a: "Include the original file, ECU identification, read method, exact vehicle data and relevant fault codes or workshop findings." },
    ],
  },
  {
    slug: "peugeot",
    name: "Peugeot ECU File Service",
    description: "Peugeot ECU file service for supported Bosch EDC/MD1, Continental SID and Delphi DCM HDi, BlueHDi and petrol applications.",
    intro: [
      "Peugeot and wider Stellantis applications can use Bosch EDC or MD1, Continental SID and Delphi DCM controllers. HDi and BlueHDi model descriptions should be accompanied by ECU and software identification.",
      "MG AutoTech reviews each file request from the submitted controller data and original read. This supports clearer handling of different ECU variants and diagnostic contexts.",
    ],
    ecuFamilies: ["Bosch EDC16 / EDC17", "Bosch MD1", "Continental SID", "Delphi DCM", "Selected MED and petrol systems"],
    vehicleExamples: ["208", "308", "508", "2008 / 3008 / 5008", "Expert", "Partner"],
    requestChecks: ["Exact engine and model year", "ECU HW/SW identification", "Read method and tool", "Original unmodified file", "Relevant DTCs and workshop notes"],
    faq: [
      { q: "Is HDi or BlueHDi enough to identify the ECU?", a: "No. Multiple ECU families can appear across these engines, so the controller and software identification must be supplied." },
      { q: "Can combined service requests be submitted?", a: "Yes where technically supported. Select all required services and add the diagnostic context to the same order." },
    ],
  },
];

export const platformGuides: PlatformGuide[] = [
  {
    slug: "bosch-edc17",
    name: "Bosch EDC17 ECU File Service",
    description: "Bosch EDC17 file-service workflow for supported diesel ECUs, with ECU identification, read-method checks and secure delivery.",
    intro: ["Bosch EDC17 is a broad diesel ECU family used by many European manufacturers. Tricore variants, protection levels, software structures and read protocols differ across applications.", "The ECU part number, HW/SW identification and whether the file is an OBD, Bench or Boot read should accompany every request."],
    commonApplications: ["BMW and MINI diesel", "Mercedes-Benz CDI", "Volkswagen Group TDI", "Porsche diesel", "Opel, Renault and PSA diesel"],
    identification: ["Bosch ECU number", "Vehicle manufacturer part number", "Hardware and software identifiers", "Microprocessor or ECU suffix where known", "Read tool and protocol"],
    workflowNotes: ["Use an original, unmodified read", "State whether the file is full, partial or virtual", "Include fault codes for diagnostic-related requests", "Do not assume files from similar models are interchangeable"],
    faq: [{ q: "Is every EDC17 file the same size?", a: "No. File size and data coverage depend on ECU variant and read method." }, { q: "Can an OBD read be processed like a Bench read?", a: "Not automatically. The submitted read type must be identified and checked for the requested service." }],
  },
  {
    slug: "bosch-md1",
    name: "Bosch MD1 ECU File Service",
    description: "Bosch MD1 diesel ECU file service for supported modern vehicles with accurate HW/SW identification and read-method verification.",
    intro: ["Bosch MD1 controllers are used in newer diesel applications and require precise identification. Security, software layout and available read methods vary by manufacturer and ECU variant.", "A request should contain the original read, ECU identification, exact vehicle specification and the tool protocol used."],
    commonApplications: ["Modern BMW diesel", "Mercedes-Benz diesel", "Volkswagen Group TDI", "Selected Opel/Stellantis diesel", "Selected commercial vehicles"],
    identification: ["MD1 variant", "Bosch and OEM part numbers", "HW/SW data", "Engine and emission standard", "OBD, Bench or Boot protocol"],
    workflowNotes: ["Confirm read completeness", "Keep the original backup", "List hardware modifications", "Provide diagnostic context for emissions-related work"],
    faq: [{ q: "Why does the exact MD1 variant matter?", a: "MD1 is a family, not one ECU. Variants use different software structures and access methods." }, { q: "Are virtual reads accepted?", a: "They may be supported when the software match is correct. Submit the identification and read method for review." }],
  },
  {
    slug: "bosch-mg1",
    name: "Bosch MG1 ECU File Service",
    description: "Bosch MG1 petrol ECU file service for supported vehicles with calibration context, fuel information and secure file delivery.",
    intro: ["Bosch MG1 is used in many modern petrol and hybrid-era powertrains. ECU variant, software version, fuel specification and vehicle hardware are important to the request context.", "MG AutoTech checks the original read and identification before processing and keeps revisions connected to the order."],
    commonApplications: ["BMW petrol", "Mercedes-Benz petrol", "Volkswagen Group TSI/TFSI", "Porsche petrol", "Selected performance applications"],
    identification: ["MG1 variant", "HW/SW numbers", "Engine and power level", "Fuel grade", "Read method and tool"],
    workflowNotes: ["Declare downpipes, intake or turbo changes", "State the expected fuel grade", "Provide an untouched original read", "Use logs when a revision depends on measured behaviour"],
    faq: [{ q: "Is fuel quality relevant to an MG1 request?", a: "Yes. Fuel grade and market should be stated when they affect the requested calibration." }, { q: "Should hardware changes be listed?", a: "Yes. Undeclared hardware changes can make the request incomplete or unsuitable." }],
  },
  {
    slug: "continental-simos",
    name: "Continental SIMOS ECU File Service",
    description: "Continental SIMOS ECU file service for supported Volkswagen Group petrol applications with version and read-method checks.",
    intro: ["Continental SIMOS controllers are common across several Volkswagen Group petrol platforms. SIMOS generation, engine family, software version and access method must be identified correctly.", "The original read and technical context are reviewed before the requested work is accepted."],
    commonApplications: ["Volkswagen TSI", "Audi TFSI", "Skoda petrol", "SEAT/Cupra petrol", "Selected performance VAG platforms"],
    identification: ["SIMOS generation", "OEM and Continental identifiers", "Engine code", "Software version", "Read protocol"],
    workflowNotes: ["State fuel and hardware setup", "Identify gearbox type", "Attach logs for data-based revisions", "Retain the original controller backup"],
    faq: [{ q: "Does the SIMOS generation affect support?", a: "Yes. Different generations have different software structures and tool access." }, { q: "Can the model name alone identify SIMOS?", a: "No. Engine code and ECU identification are needed for confirmation." }],
  },
  {
    slug: "continental-sid",
    name: "Continental SID ECU File Service",
    description: "Continental SID diesel ECU file service for supported Ford, Renault, PSA and other applications with controller-specific checks.",
    intro: ["Continental and Siemens SID controllers appear across several diesel manufacturers and generations. The SID number and OEM software data are central to reliable identification.", "Submit the original file, read method and diagnostic context so the exact controller can be reviewed."],
    commonApplications: ["Peugeot and Citroën diesel", "Renault diesel", "Ford diesel", "Volvo diesel", "Selected commercial vehicles"],
    identification: ["SID family number", "OEM part number", "HW/SW identifiers", "Engine specification", "Read method"],
    workflowNotes: ["Include all relevant DTCs", "State whether the ECU has been replaced", "Confirm file origin", "Add emissions-system repair context where relevant"],
    faq: [{ q: "Are SID files interchangeable between brands?", a: "No. OEM software and calibration structures remain application-specific." }, { q: "What is the minimum identification needed?", a: "Provide the SID family, HW/SW or OEM numbers, vehicle data and read method." }],
  },
  {
    slug: "delphi-dcm",
    name: "Delphi DCM ECU File Service",
    description: "Delphi DCM diesel ECU file service for supported passenger and commercial vehicles with file-origin and diagnostic checks.",
    intro: ["Delphi DCM controllers are used in many diesel passenger and commercial vehicles. DCM generation, OEM implementation and read coverage vary significantly.", "The portal request should include the precise DCM identification, untouched original read and technical notes."],
    commonApplications: ["Renault and Dacia diesel", "Peugeot/Citroën diesel", "Mercedes-Benz and commercial vehicles", "Ford diesel", "Selected Asian diesel applications"],
    identification: ["DCM generation", "Delphi and OEM part numbers", "HW/SW data", "Vehicle/engine details", "Read type and tool"],
    workflowNotes: ["Clarify full or partial read", "Include immobilizer or replacement history if relevant", "Attach DTC context", "Verify ECU condition before programming"],
    faq: [{ q: "Why must the DCM generation be supplied?", a: "Different DCM generations use different memory layouts, access methods and software handling." }, { q: "Can a partial read always be used?", a: "No. File coverage must be checked against the requested work." }],
  },
  {
    slug: "denso",
    name: "Denso ECU File Service",
    description: "Denso ECU file-service checks for supported diesel and petrol applications, based on exact ECU and file identification.",
    intro: ["Denso controllers cover many manufacturer-specific diesel and petrol applications. Naming, memory layout and read methods can vary more than a generic ECU-family label suggests.", "Each request is reviewed using the OEM identification, Denso number, original file and read protocol."],
    commonApplications: ["Toyota and Lexus", "Mazda", "Volvo", "Jaguar/Land Rover", "Selected Isuzu and commercial vehicles"],
    identification: ["Denso part number", "OEM ECU number", "Vehicle and engine", "File size and read coverage", "Tool and protocol"],
    workflowNotes: ["Do not identify by file size alone", "Keep the complete original backup", "Provide fault context", "Confirm programming method before writing"],
    faq: [{ q: "Can Denso support be confirmed from the brand alone?", a: "No. Exact ECU identification and file data are required." }, { q: "Is file size enough to identify a Denso ECU?", a: "No. Different applications can share file sizes, so part numbers and software identifiers are also needed." }],
  },
  {
    slug: "transmission-control-units",
    name: "TCU & Gearbox File Service",
    description: "TCU file service for supported DSG, ZF, VGS, DCT and PDK transmission controllers with controller-specific identification.",
    intro: ["Transmission calibration requests require the gearbox controller's own identification and original read. Vehicle model or gearbox marketing name alone may not identify the hardware and software variant.", "ECU and TCU requests can be coordinated while keeping separate original files, notes and delivered versions inside the same customer workflow."],
    commonApplications: ["VAG DSG / S tronic", "ZF automatic transmissions", "Mercedes-Benz VGS", "Selected DCT systems", "Selected Porsche PDK"],
    identification: ["TCU hardware family", "Gearbox code", "HW/SW identifiers", "Original TCU read", "Vehicle torque and hardware context"],
    workflowNotes: ["Submit ECU and TCU files separately", "State clutch or gearbox hardware changes", "Include existing shift complaints", "Confirm compatible programming method"],
    faq: [{ q: "Can a TCU request be made without a TCU read?", a: "Support cannot be confirmed reliably without controller identification and the required original data." }, { q: "Should ECU torque changes be mentioned?", a: "Yes. The intended engine torque context is relevant to coordinated drivetrain work." }],
  },
];

export function getBrandGuide(slug: string) {
  return brandGuides.find((guide) => guide.slug === slug);
}

export function getPlatformGuide(slug: string) {
  return platformGuides.find((guide) => guide.slug === slug);
}
