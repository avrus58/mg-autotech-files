export type StageTuningLevel = "stage-1" | "stage-2" | "stage-3";

export type StageTuningComparison = {
  slug: StageTuningLevel;
  name: string;
  shortName: string;
  href: `/services/${StageTuningLevel}`;
  summary: string;
  hardwareCondition: string;
  calibrationScope: string;
  supportingModifications: string;
  logging: string;
  intendedFor: string;
  reviewRequirement: string;
  orderingMethod: string;
};

export const stageTuningComparisons: StageTuningComparison[] = [
  {
    slug: "stage-1",
    name: "Stage 1 ECU File Service",
    shortName: "Stage 1",
    href: "/services/stage-1",
    summary:
      "Vehicle-specific calibration for a standard or near-standard vehicle after ECU identity, source-file context and operating condition are reviewed.",
    hardwareCondition: "Standard or near-standard engine hardware",
    calibrationScope: "Calibrated torque, load and response within the reviewed standard-hardware context",
    supportingModifications: "Normally not required; every vehicle and existing change must still be declared",
    logging: "Useful when available and may be requested when condition or behavior needs confirmation",
    intendedFor: "Road and workshop customers seeking a measured first performance step",
    reviewRequirement: "Vehicle, engine, ECU, fuel, gearbox and original-file review",
    orderingMethod: "Submit the original ECU file through the secure request portal",
  },
  {
    slug: "stage-2",
    name: "Stage 2 ECU File Service",
    shortName: "Stage 2",
    href: "/services/stage-2",
    summary:
      "Hardware-aware calibration for a modified vehicle. The exact installed parts, ECU identity and drivetrain context must be documented before review.",
    hardwareCondition: "Documented supporting hardware changes",
    calibrationScope: "Custom review aligned with the declared intake, exhaust, cooling, turbo or fuel setup",
    supportingModifications: "Application-specific; there is no universal Stage 2 parts list",
    logging: "Commonly useful and may be required to validate the setup or guide revisions",
    intendedFor: "Workshops and owners with a clearly documented modified setup",
    reviewRequirement: "Exact hardware inventory, ECU/SW identity, fuel and drivetrain constraints",
    orderingMethod: "Submit the original file and a complete hardware brief for compatibility review",
  },
  {
    slug: "stage-3",
    name: "Stage 3 Custom Calibration",
    shortName: "Stage 3",
    href: "/services/stage-3",
    summary:
      "Engineering-led calibration request for extensively modified combinations where turbo, fuel, engine and transmission specifications define the work.",
    hardwareCondition: "Extensively modified, fully documented powertrain",
    calibrationScope: "Custom calibration plan built around the exact mechanical and control-system combination",
    supportingModifications: "Turbo, injectors, fuel system, cooling, engine or gearbox changes may be relevant",
    logging: "Expected as part of technical validation; revisions may be necessary",
    intendedFor: "Professional workshops and advanced projects with complete technical evidence",
    reviewRequirement: "Mandatory technical review; availability is never assumed from the model name alone",
    orderingMethod: "Open a request with the full specification for feasibility and scope review",
  },
];

