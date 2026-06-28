import type {
  FileExpertDetectionStatus,
  FileExpertEcuIdentification,
  FileExpertFileFormat,
  FileExpertModuleType,
  FileExpertReadScope,
} from "./types";

type SignatureRule = {
  family: string;
  supplier: string;
  moduleType: FileExpertModuleType;
  pattern: RegExp;
  exact: boolean;
};

type IdentificationContext = {
  fileName?: string | null;
  submittedEcuType?: string | null;
  submittedReadMethod?: string | null;
};

const signatureRules: SignatureRule[] = [
  { family: "EDC17", supplier: "Bosch", moduleType: "ECU", pattern: /EDC17[\s_.-]*(?:C|CP|CV|U)\d{1,3}/gi, exact: true },
  { family: "EDC16", supplier: "Bosch", moduleType: "ECU", pattern: /EDC16[\s_.-]*[A-Z]{1,3}\d{0,2}/gi, exact: true },
  { family: "EDC15", supplier: "Bosch", moduleType: "ECU", pattern: /EDC15[\s_.-]*[A-Z]{1,3}\d{0,2}/gi, exact: true },
  { family: "MD1", supplier: "Bosch", moduleType: "ECU", pattern: /MD1[\s_.-]*[A-Z]{2}\d{2,3}/gi, exact: true },
  { family: "MG1", supplier: "Bosch", moduleType: "ECU", pattern: /MG1[\s_.-]*[A-Z]{2}\d{2,3}/gi, exact: true },
  { family: "MEVD17", supplier: "Bosch", moduleType: "ECU", pattern: /MEVD17(?:\.[A-Z0-9]+){1,3}/gi, exact: true },
  { family: "MED17", supplier: "Bosch", moduleType: "ECU", pattern: /MED17(?:\.[A-Z0-9]+){1,3}/gi, exact: true },
  { family: "MED9", supplier: "Bosch", moduleType: "ECU", pattern: /MED9(?:\.[A-Z0-9]+){0,2}/gi, exact: true },
  { family: "ME7", supplier: "Bosch", moduleType: "ECU", pattern: /ME7(?:\.[A-Z0-9]+){0,2}/gi, exact: true },
  { family: "MSD", supplier: "Siemens / Continental", moduleType: "ECU", pattern: /\bMSD8\d\b/gi, exact: true },
  { family: "MSV", supplier: "Siemens / Continental", moduleType: "ECU", pattern: /\bMSV\d{2}\b/gi, exact: true },
  { family: "MS", supplier: "Siemens", moduleType: "ECU", pattern: /\bMS(?:4[135]|45|43)\b/gi, exact: true },
  { family: "SID", supplier: "Siemens / Continental", moduleType: "ECU", pattern: /SID[\s_.-]*\d{3,4}[A-Z]?/gi, exact: true },
  { family: "PCR", supplier: "Continental", moduleType: "ECU", pattern: /PCR[\s_-]*2\.1/gi, exact: true },
  { family: "Simos", supplier: "Continental", moduleType: "ECU", pattern: /SIMOS[\s_-]*\d{1,2}(?:\.\d+)?[A-Z]?/gi, exact: true },
  { family: "SIM2K", supplier: "Continental", moduleType: "ECU", pattern: /\bSIM2K[-\s]?\d{2,3}\b/gi, exact: true },
  { family: "EMS", supplier: "Continental", moduleType: "ECU", pattern: /\bEMS\d{3,4}\b/gi, exact: true },
  { family: "DCM", supplier: "Delphi", moduleType: "ECU", pattern: /DCM[\s_-]*\d(?:\.\d+){1,2}[A-Z]{0,3}/gi, exact: true },
  { family: "CRD", supplier: "Delphi", moduleType: "ECU", pattern: /\bCRD[23](?:\.[A-Z0-9]+){1,3}\b/gi, exact: true },
  { family: "MJD", supplier: "Magneti Marelli", moduleType: "ECU", pattern: /MJD[\s_-]*\d[A-Z0-9.]{1,12}/gi, exact: true },
  { family: "IAW", supplier: "Magneti Marelli", moduleType: "ECU", pattern: /\bIAW\s?[A-Z0-9.]{3,12}\b/gi, exact: true },
  { family: "Delco E-Series", supplier: "Delco", moduleType: "ECU", pattern: /\bE(?:39A?|78|80|82|83|87)\b/gi, exact: true },
  { family: "DSG", supplier: "VAG / Temic", moduleType: "TCU", pattern: /DQ(?:200|250|380|381|38X|400|500)/gi, exact: true },
  { family: "S-Tronic", supplier: "VAG / Temic", moduleType: "TCU", pattern: /\bDL(?:382|501)\b/gi, exact: true },
  { family: "ZF", supplier: "ZF", moduleType: "TCU", pattern: /\b(?:6HP|8HP|9HP)\d{2,3}\b/gi, exact: true },
  { family: "Mercedes VGS", supplier: "Continental / Temic", moduleType: "TCU", pattern: /\bVGS[234](?:NAG\d)?\b/gi, exact: true },
  { family: "DCT", supplier: "Getrag", moduleType: "TCU", pattern: /\b[67]DCT\d{3}\b/gi, exact: true },
  { family: "EDC17", supplier: "Bosch", moduleType: "ECU", pattern: /\bEDC17\b/gi, exact: false },
  { family: "EDC16", supplier: "Bosch", moduleType: "ECU", pattern: /\bEDC16\b/gi, exact: false },
  { family: "EDC15", supplier: "Bosch", moduleType: "ECU", pattern: /\bEDC15\b/gi, exact: false },
  { family: "MD1", supplier: "Bosch", moduleType: "ECU", pattern: /\bMD1\b/gi, exact: false },
  { family: "MG1", supplier: "Bosch", moduleType: "ECU", pattern: /\bMG1\b/gi, exact: false },
  { family: "MED17", supplier: "Bosch", moduleType: "ECU", pattern: /\bMED17\b/gi, exact: false },
  { family: "SID", supplier: "Siemens / Continental", moduleType: "ECU", pattern: /\bSID\b/gi, exact: false },
  { family: "DCM", supplier: "Delphi", moduleType: "ECU", pattern: /\bDCM\b/gi, exact: false },
  { family: "Denso", supplier: "Denso", moduleType: "ECU", pattern: /\bDENSO\b/gi, exact: false },
];

const technicalStringHint = /BOSCH|SIEMENS|CONTINENTAL|DELPHI|DENSO|MARELLI|DELCO|HITACHI|EDC|MED|MEVD|MD1|MG1|SID|SIMOS|PCR|DCM|CRD|MJD|IAW|DQ\d|DL\d|[689]HP\d|VGS|DCT|HARDWARE|SOFTWARE|CALIBRATION|CALID|\bHW\b|\bSW\b|1037\d|1039\d|A2C\d|5WP\d|TC17\d|MPC5\d|RH850|SPC5|SH70/i;

function unique(values: Array<string | null | undefined>, limit = 20) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).slice(0, limit);
}

function cleanTechnicalValue(value: string) {
  return value.replace(/^[\s:=_-]+|[\s:;,]+$/g, "").trim();
}

function collectMatches(text: string, regex: RegExp, group = 1, limit = 20) {
  const values: string[] = [];
  for (const match of text.matchAll(regex)) {
    const value = cleanTechnicalValue(match[group] || match[0] || "");
    if (value) values.push(value.toUpperCase());
    if (values.length >= limit) break;
  }
  return unique(values, limit);
}

export function extractTechnicalStrings(buffer: Buffer, limit = 240) {
  const generic: string[] = [];
  const important: string[] = [];
  let current = "";

  const store = () => {
    if (current.length < 4) {
      current = "";
      return;
    }

    const value = current.slice(0, 180).trim();
    current = "";
    if (!value || !/[A-Za-z0-9]/.test(value)) return;

    if (technicalStringHint.test(value)) {
      if (important.length < limit) important.push(value);
    } else if (generic.length < Math.min(100, limit)) {
      generic.push(value);
    }
  };

  for (const byte of buffer) {
    if (byte >= 32 && byte <= 126) {
      if (current.length < 512) current += String.fromCharCode(byte);
    } else {
      store();
    }
  }
  store();

  return unique([...important, ...generic], limit);
}

function detectFileFormat(buffer: Buffer, fileName?: string | null): FileExpertFileFormat {
  const lowerName = fileName?.toLowerCase() || "";
  if (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "zip_archive";
  if (lowerName.endsWith(".frf")) return "frf_container";

  const prefix = buffer.subarray(0, 96).toString("ascii").trimStart();
  if (/^:[0-9A-F]{8}/i.test(prefix)) return "intel_hex";
  if (/^S[0-9][0-9A-F]{6}/i.test(prefix)) return "motorola_srecord";
  return buffer.length ? "raw_binary" : "unknown";
}

function detectReadScope(input: {
  buffer: Buffer;
  format: FileExpertFileFormat;
  fileName?: string | null;
  submittedReadMethod?: string | null;
  entropy: number;
  ffRatio: number;
  zeroRatio: number;
}) {
  const lowerName = input.fileName?.toLowerCase() || "";
  const submitted = input.submittedReadMethod?.toLowerCase() || "";

  if (input.format === "zip_archive" || input.format === "frf_container") {
    return { scope: "container" as FileExpertReadScope, confidence: 0.96 };
  }
  if (submitted === "vr" || /(?:^|[_\-.])vr(?:[_\-.]|$)|virtual/.test(lowerName)) {
    return { scope: "virtual_read" as FileExpertReadScope, confidence: 0.9 };
  }
  if (input.buffer.length < 128 * 1024) {
    return { scope: "partial_read" as FileExpertReadScope, confidence: 0.72 };
  }
  if (input.buffer.length <= 512 * 1024) {
    return { scope: "calibration_area" as FileExpertReadScope, confidence: 0.66 };
  }
  if (
    input.buffer.length >= 1024 * 1024 &&
    (input.ffRatio > 0.015 || input.zeroRatio > 0.015 || input.entropy < 7.75)
  ) {
    return { scope: "full_read" as FileExpertReadScope, confidence: 0.64 };
  }
  return { scope: "unknown" as FileExpertReadScope, confidence: 0.4 };
}

function findSignature(text: string) {
  const candidates: Array<SignatureRule & { variant: string; count: number; firstIndex: number; alternatives: string[] }> = [];

  for (const rule of signatureRules) {
    const matches = Array.from(text.matchAll(rule.pattern));
    if (!matches.length) continue;

    const grouped = new Map<string, { count: number; firstIndex: number }>();
    for (const match of matches) {
      const variant = cleanTechnicalValue(match[0]).toUpperCase().replace(/[\s_-]+/g, "");
      const current = grouped.get(variant);
      grouped.set(variant, {
        count: (current?.count ?? 0) + 1,
        firstIndex: Math.min(current?.firstIndex ?? Number.MAX_SAFE_INTEGER, match.index ?? Number.MAX_SAFE_INTEGER),
      });
    }

    const ranked = Array.from(grouped.entries()).sort((left, right) => {
      if (right[1].count !== left[1].count) return right[1].count - left[1].count;
      return left[1].firstIndex - right[1].firstIndex;
    });
    candidates.push({
      ...rule,
      variant: ranked[0][0],
      count: ranked[0][1].count,
      firstIndex: ranked[0][1].firstIndex,
      alternatives: ranked.slice(1).map(([variant]) => variant),
    });
  }

  return candidates.sort((left, right) => {
    if (left.exact !== right.exact) return left.exact ? -1 : 1;
    if (right.count !== left.count) return right.count - left.count;
    return left.firstIndex - right.firstIndex;
  })[0] ?? null;
}

function detectSupplier(text: string) {
  const upper = text.toUpperCase();
  if (upper.includes("BOSCH")) return "Bosch";
  if (upper.includes("CONTINENTAL")) return "Continental";
  if (upper.includes("SIEMENS")) return "Siemens";
  if (upper.includes("DELPHI")) return "Delphi";
  if (upper.includes("DENSO")) return "Denso";
  if (upper.includes("MAGNETI MARELLI") || upper.includes("MARELLI")) return "Magneti Marelli";
  if (upper.includes("DELCO")) return "Delco";
  if (upper.includes("HITACHI")) return "Hitachi";
  if (upper.includes("TEMIC")) return "Temic";
  if (/(?:^|[^A-Z0-9])ZF(?:[^A-Z0-9]|$)/.test(upper)) return "ZF";
  return null;
}

function detectProcessor(text: string) {
  return collectMatches(
    text,
    /\b(TC1[7-9]\d{2}|MPC5\d{3}|SPC5[A-Z0-9]{2,6}|RH850|SH70\d{2}|TMS570|AURIX)\b/gi,
    1,
    1
  )[0] ?? null;
}

function extractPartNumbers(text: string) {
  const hardwareNumbers = collectMatches(
    text,
    /\b(?:HW|HARDWARE)(?:[ \t]*(?:NO|NR|NUMBER))?[ \t]*[:=_-]?[ \t]*([A-Z0-9][A-Z0-9._/-]{4,24})\b/gi
  );
  const softwareNumbers = collectMatches(
    text,
    /\b(?:SW|SOFTWARE)(?:[ \t]*(?:NO|NR|NUMBER))?[ \t]*[:=_-]?[ \t]*([A-Z0-9][A-Z0-9._/-]{4,24})\b/gi
  );
  const calibrationIds = collectMatches(
    text,
    /\b(?:CALID|CALIBRATION(?:[ \t]*ID)?)[ \t]*[:=_-]?[ \t]*([A-Z0-9][A-Z0-9._/-]{3,30})\b/gi
  );
  const compact = text.toUpperCase().replace(/[\s._-]+/g, "");
  const vagNumbers = collectMatches(
    text.toUpperCase(),
    /(?:^|[^A-Z0-9])(\d[A-Z0-9]{2}[ ._-]*\d{3}[ ._-]*\d{3}[A-Z]{0,2})(?=$|[^A-Z0-9])/g
  ).map((value) => value.replace(/[ ._-]+/g, ""));

  hardwareNumbers.push(
    ...collectMatches(compact, /\b(0(?:261|265|281|285)\d{6})\b/g),
    ...collectMatches(compact, /\b(A2C\d{6,12})\b/g),
    ...collectMatches(compact, /\b(5WP\d{5,10})\b/g),
    ...collectMatches(compact, /\b(\d[A-Z0-9]{2}\d{6}[A-Z]{0,2})\b/g),
    ...collectMatches(compact, /\b(A\d{10})\b/g),
    ...vagNumbers
  );
  softwareNumbers.push(
    ...collectMatches(compact, /\b(10(?:37|39)\d{6})\b/g),
    ...collectMatches(compact, /\b(10SW\d{6})\b/g)
  );

  return {
    hardwareNumbers: unique(hardwareNumbers).filter((value) => /\d/.test(value)),
    softwareNumbers: unique(softwareNumbers).filter((value) => /\d/.test(value)),
    calibrationIds: unique(calibrationIds).filter((value) => /\d/.test(value)),
  };
}

function extractVins(text: string) {
  return collectMatches(text.toUpperCase(), /\b([A-HJ-NPR-Z0-9]{17})\b/g)
    .filter((value) => (value.match(/\d/g)?.length ?? 0) >= 2 && (value.match(/[A-Z]/g)?.length ?? 0) >= 5)
    .slice(0, 4);
}

function extractEngineCodes(contentText: string, fileNameText: string) {
  const explicitContentCodes = collectMatches(
    contentText.toUpperCase(),
    /\b(OM\d{3}(?:\.\d{3})?|[BNSM]\d{2}[A-Z]\d{1,2}[A-Z0-9]{0,2}|K9K|M9R|R9M|DW10|DW12|DV6|EP6|EA(?:189|288|888))\b/g
  );
  const fileNameCodes = collectMatches(
    fileNameText.toUpperCase(),
    /(?:^|[^A-Z0-9])(OM\d{3}(?:\.\d{3})?|[BNSM]\d{2}(?:[A-Z]\d{1,2}[A-Z0-9]{0,2})?|K9K|M9R|R9M|DW10|DW12|DV6|EP6|EA(?:189|288|888))(?=$|[^A-Z0-9])/g
  );
  return unique([...explicitContentCodes, ...fileNameCodes]);
}

function statusForConfidence(confidence: number): FileExpertDetectionStatus {
  if (confidence >= 0.86) return "detected";
  if (confidence >= 0.68) return "probable";
  if (confidence >= 0.45) return "possible";
  return "not_detected";
}

export function identifyFileBuffer(input: {
  buffer: Buffer;
  strings: string[];
  entropy: number;
  ffRatio: number;
  zeroRatio: number;
  context?: IdentificationContext;
}) {
  const context = input.context ?? {};
  const contentText = input.strings.join("\n");
  const fileNameText = context.fileName || "";
  const submittedText = context.submittedEcuType || "";
  const combinedText = [contentText, fileNameText, submittedText].filter(Boolean).join("\n");
  const contentSignature = findSignature(contentText);
  const fileNameSignature = findSignature(fileNameText);
  const submittedSignature = findSignature(submittedText);
  const signature = contentSignature ?? fileNameSignature ?? submittedSignature;
  const evidence: string[] = [];
  let confidence = 0;

  if (contentSignature) {
    confidence = contentSignature.exact ? 0.92 : 0.7;
    evidence.push(`ECU signature ${contentSignature.variant} found inside the binary.`);
    if (contentSignature.alternatives.length) {
      confidence = Math.max(0.62, confidence - 0.12);
      evidence.push(`Additional ECU variant markers were also present: ${contentSignature.alternatives.slice(0, 3).join(", ")}.`);
    }
  } else if (fileNameSignature) {
    confidence = fileNameSignature.exact ? 0.76 : 0.58;
    evidence.push(`ECU signature ${fileNameSignature.variant} found in the uploaded file name.`);
  } else if (submittedSignature) {
    confidence = submittedSignature.exact ? 0.52 : 0.42;
    evidence.push(`ECU type ${submittedSignature.variant} was supplied by the customer, not verified inside the binary.`);
  }

  const supplierFromContent = detectSupplier(contentText);
  const supplier = signature?.supplier ?? supplierFromContent ?? detectSupplier(combinedText);
  if (supplierFromContent) {
    evidence.push(`Supplier marker ${supplierFromContent} found inside the binary.`);
    confidence = Math.min(0.98, confidence + 0.03);
  }

  const processor = detectProcessor(contentText);
  if (processor) evidence.push(`Processor marker ${processor} found inside the binary.`);

  const parts = extractPartNumbers(combinedText);
  const vins = extractVins(contentText);
  const engineCodes = extractEngineCodes(contentText, fileNameText);
  if (parts.hardwareNumbers.length) evidence.push("Hardware identifier extracted from file content or naming.");
  if (parts.softwareNumbers.length) evidence.push("Software identifier extracted from file content or naming.");
  if (vins.length) evidence.push("A VIN-format identifier was found inside the binary.");
  if (engineCodes.length) evidence.push(`Engine code marker ${engineCodes[0]} found in the binary or uploaded file name.`);

  const variant = signature?.exact ? signature.variant : null;
  const family = signature?.family ?? null;
  const displayName = signature
    ? [supplier, variant || family].filter(Boolean).join(" ")
    : supplier
      ? `${supplier} control unit`
      : "Control unit not identified";

  if (!signature && supplierFromContent) confidence = 0.44;

  const fileFormat = detectFileFormat(input.buffer, context.fileName);
  const readScope = detectReadScope({
    buffer: input.buffer,
    format: fileFormat,
    fileName: context.fileName,
    submittedReadMethod: context.submittedReadMethod,
    entropy: input.entropy,
    ffRatio: input.ffRatio,
    zeroRatio: input.zeroRatio,
  });

  const identification: FileExpertEcuIdentification = {
    status: statusForConfidence(confidence),
    module_type: signature?.moduleType ?? "unknown",
    supplier,
    family,
    variant,
    display_name: displayName,
    processor,
    confidence: Number(confidence.toFixed(2)),
    evidence: unique(evidence, 12),
    hardware_numbers: parts.hardwareNumbers,
    software_numbers: parts.softwareNumbers,
    calibration_ids: parts.calibrationIds,
    vins,
    engine_codes: engineCodes,
  };

  return {
    identification,
    fileFormat,
    readScope: readScope.scope,
    readScopeConfidence: readScope.confidence,
    hardwareNumbers: parts.hardwareNumbers,
    softwareNumbers: parts.softwareNumbers,
    calibrationIds: parts.calibrationIds,
    vins,
    engineCodes,
  };
}

export function mergeEcuIdentifications(identifications: FileExpertEcuIdentification[]) {
  const available = identifications.filter((item) => item.status !== "not_detected");
  if (!available.length) return identifications[0];

  const primary = [...available].sort((a, b) => b.confidence - a.confidence)[0];
  const variants = unique(available.map((item) => item.variant || item.family));
  const conflict = variants.length > 1;

  return {
    ...primary,
    status: conflict ? "possible" as const : primary.status,
    confidence: conflict ? Math.min(primary.confidence, 0.48) : primary.confidence,
    evidence: unique([
      ...available.flatMap((item) => item.evidence),
      conflict ? `Conflicting control-unit signatures were found: ${variants.join(", ")}.` : null,
    ], 16),
    hardware_numbers: unique(available.flatMap((item) => item.hardware_numbers)),
    software_numbers: unique(available.flatMap((item) => item.software_numbers)),
    calibration_ids: unique(available.flatMap((item) => item.calibration_ids)),
    vins: unique(available.flatMap((item) => item.vins)),
    engine_codes: unique(available.flatMap((item) => item.engine_codes)),
  } satisfies FileExpertEcuIdentification;
}
