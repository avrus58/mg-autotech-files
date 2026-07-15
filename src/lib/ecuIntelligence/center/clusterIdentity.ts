import {
  ecuIntelligenceClusterKeyVersion,
  type CanonicalEcuClusterIdentity,
  type EcuClusterIdentityInput,
} from "@/lib/ecuIntelligence/center/types";

const supplierAliases = new Map<string, string>([
  ["bosch", "Bosch"],
  ["robertbosch", "Bosch"],
  ["siemens", "Siemens"],
  ["siemensvdo", "Siemens VDO"],
  ["continental", "Continental"],
  ["conti", "Continental"],
  ["delphi", "Delphi"],
  ["denso", "Denso"],
  ["magnetimarelli", "Magneti Marelli"],
  ["marelli", "Magneti Marelli"],
  ["hitachi", "Hitachi"],
  ["trw", "TRW"],
]);

const familyAliases = new Map<string, string>([
  ["me75", "ME7.5"],
  ["me7.5", "ME7.5"],
  ["edc15p", "EDC15P"],
  ["edc15vm", "EDC15VM+"],
  ["edc15vm+", "EDC15VM+"],
  ["edc16u34", "EDC16U34"],
  ["edc17c50", "EDC17C50"],
  ["edc17cp14", "EDC17CP14"],
  ["med17", "MED17"],
  ["med17.5", "MED17.5"],
]);

const fileRoleAliases = new Map<string, CanonicalEcuClusterIdentity["fileRole"]>([
  ["ori", "ori"],
  ["original", "ori"],
  ["stock", "ori"],
  ["read", "ori"],
  ["backup", "ori"],
  ["mod", "mod"],
  ["modified", "mod"],
  ["tuned", "mod"],
  ["single", "single"],
  ["unknown", "unknown"],
]);

function raw(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

export function normalizeIdentityText(value: unknown) {
  return raw(value).replace(/\s+/g, " ");
}

export function normalizeIdentityToken(value: unknown) {
  return normalizeIdentityText(value).toLowerCase().replace(/[^a-z0-9.+]/g, "");
}

function normalizeSupplier(value: unknown) {
  const text = normalizeIdentityText(value);
  if (!text) return "unknown";
  return supplierAliases.get(normalizeIdentityToken(text)) || text;
}

function normalizeFamily(value: unknown) {
  const text = normalizeIdentityText(value);
  if (!text) return "unknown";
  return familyAliases.get(normalizeIdentityToken(text)) || text.toUpperCase();
}

function normalizeIdentifier(value: unknown) {
  const text = normalizeIdentityText(value);
  if (!text) return "unknown";
  return text.toUpperCase().replace(/\s+/g, "");
}

function normalizeFileRole(value: unknown): CanonicalEcuClusterIdentity["fileRole"] {
  return fileRoleAliases.get(normalizeIdentityToken(value)) || "unknown";
}

function normalizeFileSize(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(Math.round(number)) : "unknown";
}

function normalizeReadMethod(value: unknown) {
  const text = normalizeIdentityText(value);
  if (!text) return "unknown";
  return text.toLowerCase().replace(/\s+/g, "_");
}

function keyPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.+_-]/g, "") || "unknown";
}

function completeness(fields: Record<string, string>) {
  const required = [
    "supplier",
    "ecuFamily",
    "ecuType",
    "hwNumber",
    "swNumber",
    "representationType",
    "fileRole",
    "fileSize",
    "readMethod",
  ];
  const missingFields = required.filter((field) => fields[field] === "unknown");
  const score = Math.round(((required.length - missingFields.length) / required.length) * 100);
  return { score, missingFields };
}

function conflictReasons(input: EcuClusterIdentityInput) {
  const reasons: string[] = [];
  const hw = normalizeIdentityText(input.hwNumber);
  const sw = normalizeIdentityText(input.swNumber);
  const role = normalizeIdentityText(input.fileRole);
  for (const [field, value] of [
    ["hw_number", hw],
    ["sw_number", sw],
    ["file_role", role],
  ] as const) {
    if (/[|,;]/.test(value)) reasons.push(`ambiguous_${field}`);
  }
  return reasons;
}

export function canonicalizeClusterIdentity(input: EcuClusterIdentityInput): CanonicalEcuClusterIdentity {
  const identity = {
    supplier: normalizeSupplier(input.supplier),
    ecuFamily: normalizeFamily(input.ecuFamily),
    ecuType: normalizeIdentifier(input.ecuType),
    hwNumber: normalizeIdentifier(input.hwNumber),
    swNumber: normalizeIdentifier(input.swNumber),
    calibrationId: normalizeIdentifier(input.calibrationId),
    calibrationIdUnavailableReason: normalizeIdentityText(input.calibrationIdUnavailableReason) || "unknown",
    representationType: normalizeIdentifier(input.representationType),
    fileRole: normalizeFileRole(input.fileRole),
    fileSize: normalizeFileSize(input.fileSize),
    readMethod: normalizeReadMethod(input.readMethod),
    segmentManifestDigest: normalizeIdentifier(input.segmentManifestDigest),
  };
  const fields = {
    supplier: identity.supplier.toLowerCase() || "unknown",
    ecuFamily: identity.ecuFamily.toLowerCase() || "unknown",
    ecuType: identity.ecuType.toLowerCase() || "unknown",
    hwNumber: identity.hwNumber.toLowerCase() || "unknown",
    swNumber: identity.swNumber.toLowerCase() || "unknown",
    calibrationId: identity.calibrationId.toLowerCase() || "unknown",
    representationType: identity.representationType.toLowerCase() || "unknown",
    fileRole: identity.fileRole,
    fileSize: identity.fileSize,
    readMethod: identity.readMethod,
    segmentManifestDigest: identity.segmentManifestDigest.toLowerCase() || "unknown",
  };
  const completenessResult = completeness(fields);
  const conflicts = conflictReasons(input);
  const ambiguousFields = conflicts
    .filter((reason) => reason.startsWith("ambiguous_"))
    .map((reason) => reason.replace(/^ambiguous_/, ""));
  const clusterKey = [
    ecuIntelligenceClusterKeyVersion,
    keyPart(identity.supplier),
    keyPart(identity.ecuFamily),
    keyPart(identity.ecuType),
    keyPart(identity.hwNumber),
    keyPart(identity.swNumber),
    keyPart(identity.calibrationId),
    keyPart(identity.calibrationIdUnavailableReason),
    keyPart(identity.representationType),
    keyPart(identity.fileRole),
    keyPart(identity.fileSize),
    keyPart(identity.readMethod),
    keyPart(identity.segmentManifestDigest),
  ].join(":");

  const labelParts = [
    identity.supplier !== "unknown" ? identity.supplier : null,
    identity.ecuFamily !== "unknown" ? identity.ecuFamily : null,
    identity.ecuType !== "unknown" ? identity.ecuType : null,
    identity.hwNumber !== "unknown" ? `HW ${identity.hwNumber}` : null,
    identity.swNumber !== "unknown" ? `SW ${identity.swNumber}` : null,
  ].filter(Boolean);

  return {
    version: ecuIntelligenceClusterKeyVersion,
    ...identity,
    clusterKey,
    displayLabel: labelParts.join(" / ") || "Unknown ECU identity",
    completenessScore: completenessResult.score,
    missingFields: completenessResult.missingFields,
    ambiguousFields,
    conflictReasons: conflicts,
  };
}

export function clusterKeyFromLegacyPairIdentityKey(value: unknown) {
  const text = normalizeIdentityText(value);
  if (!text) return null;
  const parts = text.split("|");
  if (parts.length < 5) return null;
  return canonicalizeClusterIdentity({
    supplier: parts[0],
    ecuFamily: parts[1],
    ecuType: parts[2],
    hwNumber: parts[3],
    swNumber: parts[4],
    calibrationId: parts[5],
    representationType: parts[6],
    readMethod: parts[7],
    fileSize: parts[8],
    fileRole: "unknown",
  });
}
