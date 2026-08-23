export const publicLogSnapshotMaximumCharacters = 5_000_000;
export const publicLogSnapshotMaximumRows = 50_000;
export const publicLogSnapshotMinimumPairedRows = 5;
export const publicLogSnapshotMinimumRpmSpan = 1_000;
export const publicLogSnapshotMinimumRpm = 400;
export const publicLogSnapshotMaximumRpm = 12_000;
export const publicLogSnapshotMinimumTorqueNm = 1;
export const publicLogSnapshotMaximumTorqueNm = 5_000;
export const publicLogSnapshotMinimumEstimatedPowerHp = 1;
export const publicLogSnapshotMaximumEstimatedPowerHp = 5_000;

const publicLogSnapshotMaximumColumns = 192;
const publicLogSnapshotMaximumPreambleLines = 30;
const publicLogSnapshotMaximumCellCharacters = 512;
const maximumEngineRpmForParsing = 30_000;
const maximumEngineTorqueNmForParsing = 20_000;
const poundFootToNewtonMetre = 1.3558179483;

type PublicLogDelimiter = "," | ";" | "\t";

type PublicLogSnapshotBase = {
  truncated: boolean;
};

export type PublicLogSnapshotReady = PublicLogSnapshotBase & {
  status: "ready";
  peakTorqueNm: number;
  peakPowerHp: number;
};

export type PublicLogSnapshotUnavailable = PublicLogSnapshotBase & {
  status: "incompatible" | "insufficient_data" | "unsupported_range";
  peakTorqueNm: null;
  peakPowerHp: null;
};

export type PublicLogSnapshotAnalysis =
  | PublicLogSnapshotReady
  | PublicLogSnapshotUnavailable;

type HeaderCandidate = {
  index: number;
  score: number;
  torqueFactor?: number;
};

type TableStart = {
  delimiter: PublicLogDelimiter;
  lineIndex: number;
};

function unavailableSnapshot(
  status: PublicLogSnapshotUnavailable["status"],
  truncated: boolean
): PublicLogSnapshotUnavailable {
  return {
    status,
    peakTorqueNm: null,
    peakPowerHp: null,
    truncated,
  };
}

function within(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function normalizeHeader(value: string) {
  return value
    .slice(0, publicLogSnapshotMaximumCellCharacters)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\u00b0/g, " deg ")
    .toLowerCase()
    .replace(/[^a-z0-9%/+.*^-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulBracketUnit(header: string) {
  const matches = [
    ...header
      .slice(0, publicLogSnapshotMaximumCellCharacters)
      .matchAll(/(?:\[([^\]]{1,64})\]|\(([^)]{1,64})\))/g),
  ];
  const qualifiers = new Set([
    "actual",
    "calculated",
    "commanded",
    "desired",
    "ist",
    "measured",
    "nominal",
    "raw",
    "requested",
    "target",
  ]);

  return (
    matches
      .map((match) => match.slice(1).find(Boolean)?.trim())
      .filter((value): value is string => Boolean(value))
      .reverse()
      .find((value) => {
        const tokens = normalizeHeader(value).split(" ").filter(Boolean);
        return tokens.length > 0 && !tokens.every((token) => qualifiers.has(token));
      }) ?? null
  );
}

function rpmUnit(value: string) {
  const normalized = normalizeHeader(value).replace(/\s+/g, "");
  return /^(?:rpm|rev\/min|r\/min|1\/min|min\^?-?1)$/.test(normalized);
}

function torqueFactor(value: string) {
  const normalized = normalizeHeader(value);
  if (
    /\b(?:lb|lbf)\s*[-/]?\s*ft\b|\bft\s*[-/]?\s*(?:lb|lbf)\b|\b(?:lbft|ftlb)\b/.test(
      normalized
    )
  ) {
    return poundFootToNewtonMetre;
  }
  if (/\bn\s*[.*-]?\s*m\b|\bnm\b/.test(normalized)) return 1;
  return null;
}

function hasRequestedOrDerivedMarker(header: string) {
  return (
    /\b(?:target|requested|request|req|cmd|sp|ref|lim|des|limit|limiter|limitation|maximum|max|desired|specified|setpoint|commanded|command|nominal|reference|referenz|demanded|demand|demande|consigne|wunsch|soll|vorgabe|hedef|istenen|error|deviation|difference|delta|offset|reserve|margin|correction|intervention|reduction|drag|loss|gradient|derivative)\b/.test(
      header
    ) ||
    /\bdriver(?: s)? wish\b|\bfahrerwunsch\b|\bsoll(?:wert|moment|drehzahl|druck|position)\b/.test(
      header
    )
  );
}

function rpmHeaderScore(header: string) {
  const normalized = normalizeHeader(header);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const nonEngineRotationalSignal =
    !/\b(?:crankshaft|crank shaft)\b/.test(normalized) &&
    /\b(?:turbo|turbocharger|turbine|compressor|wheel|shaft|input shaft|output shaft|transmission|gearbox|clutch|converter|tc|driveshaft|axle|fan|pump)\b/.test(
      normalized
    );
  if (hasRequestedOrDerivedMarker(normalized) || nonEngineRotationalSignal) return null;

  const recognized =
    /\b(?:rpm|engine speed|engine rpm|motor speed|motor devri|motordrehzahl|drehzahl|regime moteur|n mot|devir|crankshaft speed)\b/.test(
      normalized
    ) || /^(?:nmot|enginespeedrpm|enginerpm)$/.test(compact);
  if (!recognized) return null;

  const explicitUnit = meaningfulBracketUnit(header);
  if (explicitUnit && !rpmUnit(explicitUnit)) return null;
  if (
    /\b(?:engine speed|engine rpm|motor speed|motor devri|motordrehzahl|drehzahl|regime moteur|n mot|crankshaft|crank shaft)\b/.test(
      normalized
    )
  ) {
    return 5;
  }
  return /^(?:rpm|rpm rpm)$/.test(normalized) ? 2 : 1;
}

function torqueHeaderScore(header: string) {
  const normalized = normalizeHeader(header);
  const nonEngineTorqueSignal =
    !/\b(?:crankshaft|crank shaft)\b/.test(normalized) &&
    /\b(?:transmission|gearbox|clutch|converter|turbine|tc|wheel|axle|driveshaft|input shaft|output shaft|friction|loss|brake)\b/.test(
      normalized
    );
  if (hasRequestedOrDerivedMarker(normalized) || nonEngineTorqueSignal) return null;
  if (
    !/\b(?:engine torque|motor torque|actual torque|calculated torque|torque|drehmoment|couple moteur|motor torku|tork|moment)\b/.test(
      normalized
    )
  ) {
    return null;
  }

  let score = 1;
  if (
    /\b(?:engine torque|motor torque|couple moteur|motor torku|drehmoment|crankshaft torque|crank shaft torque)\b/.test(
      normalized
    )
  ) {
    score += 4;
  }
  if (/\b(?:actual|measured|calculated|ist)\b/.test(normalized)) score += 2;
  return score;
}

function decodeCell(value: string) {
  return value
    .slice(0, publicLogSnapshotMaximumCellCharacters)
    .trim()
    .replace(/"+/g, (quotes) => '"'.repeat(Math.floor(quotes.length / 2)));
}

function splitDelimitedLine(
  line: string,
  delimiter: PublicLogDelimiter,
  valueLimit = publicLogSnapshotMaximumColumns + 1
) {
  if (!line.includes(delimiter)) return [decodeCell(line)];

  const values: string[] = [];
  let cellStart = 0;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && next === '"') {
      index += 1;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character !== delimiter || quoted) continue;

    values.push(decodeCell(line.slice(cellStart, index)));
    if (values.length >= valueLimit) return values;
    cellStart = index + 1;
  }

  values.push(decodeCell(line.slice(cellStart)));
  return values;
}

function parseNumericCell(value: string | undefined, rpm = false) {
  if (!value) return null;
  let normalized = value
    .trim()
    .replace(/\u00a0/g, "")
    .replace(/\s+/g, "")
    .replace(/[’']/g, "");
  if (!normalized || /^(?:-|--|n\/?a|null|nan|inf(?:inity)?)$/i.test(normalized)) {
    return null;
  }

  normalized = normalized.replace(/(?:rpm|n\.?m|lb-?ft)$/i, "");
  const hasAmbiguousGroupedSeparator = /^[+-]?\d{1,3}[,.]\d{3}$/.test(normalized);
  if (rpm && hasAmbiguousGroupedSeparator) {
    const grouped = Number(normalized.replace(/[,.]/g, ""));
    return Number.isFinite(grouped) ? grouped : null;
  }
  if (!rpm && hasAmbiguousGroupedSeparator) return null;

  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");
  if (commaIndex !== -1 && dotIndex !== -1) {
    normalized =
      commaIndex > dotIndex
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
  } else if (commaIndex !== -1) {
    normalized = normalized.replace(",", ".");
  }

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function visitNonEmptyLines(
  input: string,
  visitor: (line: string, lineIndex: number) => boolean | void
) {
  let lineStart = 0;
  let nonEmptyLineIndex = 0;
  const visit = (lineEnd: number) => {
    const line = input.slice(lineStart, lineEnd);
    if (!line.trim()) return true;
    const shouldContinue = visitor(line, nonEmptyLineIndex);
    nonEmptyLineIndex += 1;
    return shouldContinue !== false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character !== "\n" && character !== "\r") continue;
    if (!visit(index)) return;
    if (character === "\r" && input[index + 1] === "\n") index += 1;
    lineStart = index + 1;
  }
  if (lineStart <= input.length) visit(input.length);
}

function previewLines(input: string) {
  const lines: string[] = [];
  visitNonEmptyLines(input, (line) => {
    lines.push(line);
    return lines.length < publicLogSnapshotMaximumPreambleLines + 4;
  });
  return lines;
}

function candidateIndexes(headers: string[]) {
  return {
    rpm: headers.flatMap((header, index) =>
      rpmHeaderScore(header) === null ? [] : [index]
    ),
    torque: headers.flatMap((header, index) =>
      torqueHeaderScore(header) === null ? [] : [index]
    ),
  };
}

function findTableStart(lines: string[]): TableStart | null {
  const delimiters: PublicLogDelimiter[] = ["\t", ";", ","];
  let best: (TableStart & { score: number }) | null = null;
  const lastCandidate = Math.min(lines.length - 1, publicLogSnapshotMaximumPreambleLines);

  for (let lineIndex = 0; lineIndex <= lastCandidate; lineIndex += 1) {
    for (const delimiter of delimiters) {
      const headers = splitDelimitedLine(lines[lineIndex] ?? "", delimiter).slice(
        0,
        publicLogSnapshotMaximumColumns
      );
      if (headers.length < 2) continue;
      const indexes = candidateIndexes(headers);
      if (!indexes.rpm.length || !indexes.torque.length) continue;

      const numericPairFound = lines
        .slice(lineIndex + 1, lineIndex + 4)
        .some((line) => {
          const cells = splitDelimitedLine(line, delimiter);
          return indexes.rpm.some((rpmIndex) =>
            indexes.torque.some(
              (torqueIndex) =>
                parseNumericCell(cells[rpmIndex], true) !== null &&
                parseNumericCell(cells[torqueIndex]) !== null
            )
          );
        });
      if (!numericPairFound) continue;

      const recognizedHeaders = indexes.rpm.length + indexes.torque.length;
      const score = recognizedHeaders * 10 + headers.length - lineIndex * 0.1;
      if (!best || score > best.score) {
        best = { delimiter, lineIndex, score };
      }
    }
  }

  return best
    ? { delimiter: best.delimiter, lineIndex: best.lineIndex }
    : null;
}

function mergeSeparateUnitRow(
  headers: string[],
  unitLine: string | undefined,
  delimiter: PublicLogDelimiter
) {
  const cells = splitDelimitedLine(unitLine ?? "", delimiter);
  if (cells.length < 2 || Math.abs(cells.length - headers.length) > 1) {
    return { headers, detected: false };
  }
  const numericCells = cells.filter((cell) => parseNumericCell(cell) !== null).length;
  const recognizedUnits = cells.filter(
    (cell) => rpmUnit(cell.replace(/^[[(]|[\])]$/g, "")) || torqueFactor(cell) !== null
  ).length;
  if (numericCells > 1 || recognizedUnits < 2) {
    return { headers, detected: false };
  }

  return {
    headers: headers.map((header, index) => {
      const unit = cells[index]?.trim().replace(/^[[(]|[\])]$/g, "");
      return unit ? `${header} [${unit}]` : header;
    }),
    detected: true,
  };
}

function selectUniqueCandidate(candidates: HeaderCandidate[]) {
  const ranked = [...candidates].sort(
    (left, right) => right.score - left.score || left.index - right.index
  );
  if (!ranked[0] || ranked[0].score === ranked[1]?.score) return null;
  return ranked[0];
}

function selectPerformanceColumns(headers: string[]) {
  const rpm = selectUniqueCandidate(
    headers.flatMap<HeaderCandidate>((header, index) => {
      const score = rpmHeaderScore(header);
      return score === null ? [] : [{ index, score }];
    })
  );
  const torque = selectUniqueCandidate(
    headers.flatMap<HeaderCandidate>((header, index) => {
      const score = torqueHeaderScore(header);
      const factor = torqueFactor(meaningfulBracketUnit(header) ?? header);
      return score === null || factor === null
        ? []
        : [{ index, score, torqueFactor: factor }];
    })
  );
  return rpm && torque && rpm.index !== torque.index ? { rpm, torque } : null;
}

function powerHpFromTorque(torqueNm: number, rpm: number) {
  return ((torqueNm * rpm) / 9_549) * 1.34102;
}

export function analyzePublicLogSnapshot(text: string): PublicLogSnapshotAnalysis {
  if (!/\S/.test(text)) return unavailableSnapshot("incompatible", false);

  const charactersTruncated = text.length > publicLogSnapshotMaximumCharacters;
  let bounded = text.slice(0, publicLogSnapshotMaximumCharacters);
  if (bounded.charCodeAt(0) === 0xfeff) bounded = bounded.slice(1);
  if (charactersTruncated) {
    const lastCompleteLine = Math.max(bounded.lastIndexOf("\n"), bounded.lastIndexOf("\r"));
    if (lastCompleteLine > 0) bounded = bounded.slice(0, lastCompleteLine);
  }

  const preview = previewLines(bounded);
  const table = findTableStart(preview);
  if (!table) return unavailableSnapshot("incompatible", charactersTruncated);

  let headers = splitDelimitedLine(preview[table.lineIndex] ?? "", table.delimiter).slice(
    0,
    publicLogSnapshotMaximumColumns
  );
  const units = mergeSeparateUnitRow(
    headers,
    preview[table.lineIndex + 1],
    table.delimiter
  );
  headers = units.headers;
  const columns = selectPerformanceColumns(headers);
  const dataStartIndex = table.lineIndex + 1 + (units.detected ? 1 : 0);
  if (!columns) return unavailableSnapshot("incompatible", charactersTruncated);

  let processedRows = 0;
  let pairedRows = 0;
  let rowsTruncated = false;
  let outsideSupportedRange = false;
  let minimumRpm = Number.POSITIVE_INFINITY;
  let maximumRpm = Number.NEGATIVE_INFINITY;
  let peakTorqueNm = Number.NEGATIVE_INFINITY;
  let peakPowerHp = Number.NEGATIVE_INFINITY;
  const valueLimit = Math.max(columns.rpm.index, columns.torque.index) + 1;

  visitNonEmptyLines(bounded, (line, lineIndex) => {
    if (lineIndex < dataStartIndex) return;
    if (processedRows >= publicLogSnapshotMaximumRows) {
      rowsTruncated = true;
      return false;
    }
    processedRows += 1;

    const cells = splitDelimitedLine(line, table.delimiter, valueLimit);
    const rpm = parseNumericCell(cells[columns.rpm.index], true);
    const torqueRaw = parseNumericCell(cells[columns.torque.index]);
    if (rpm === null || torqueRaw === null) return;

    const torqueNm = torqueRaw * (columns.torque.torqueFactor ?? Number.NaN);
    if (
      !Number.isFinite(torqueNm) ||
      rpm < 100 ||
      rpm > maximumEngineRpmForParsing ||
      torqueNm <= 0 ||
      torqueNm > maximumEngineTorqueNmForParsing
    ) {
      return;
    }

    const powerHp = powerHpFromTorque(torqueNm, rpm);
    if (
      !within(rpm, publicLogSnapshotMinimumRpm, publicLogSnapshotMaximumRpm) ||
      !within(
        torqueNm,
        publicLogSnapshotMinimumTorqueNm,
        publicLogSnapshotMaximumTorqueNm
      ) ||
      !within(
        powerHp,
        0,
        publicLogSnapshotMaximumEstimatedPowerHp
      )
    ) {
      outsideSupportedRange = true;
      return;
    }

    pairedRows += 1;
    minimumRpm = Math.min(minimumRpm, rpm);
    maximumRpm = Math.max(maximumRpm, rpm);
    peakTorqueNm = Math.max(peakTorqueNm, torqueNm);
    peakPowerHp = Math.max(peakPowerHp, powerHp);
  });

  const truncated = charactersTruncated || rowsTruncated;
  if (outsideSupportedRange) {
    return unavailableSnapshot("unsupported_range", truncated);
  }
  if (
    Number.isFinite(peakPowerHp) &&
    !within(
      peakPowerHp,
      publicLogSnapshotMinimumEstimatedPowerHp,
      publicLogSnapshotMaximumEstimatedPowerHp
    )
  ) {
    return unavailableSnapshot("unsupported_range", truncated);
  }

  const pairedRatio = pairedRows / Math.max(1, processedRows);
  if (
    pairedRows < publicLogSnapshotMinimumPairedRows ||
    maximumRpm - minimumRpm < publicLogSnapshotMinimumRpmSpan ||
    pairedRatio < 0.75 ||
    !Number.isFinite(peakTorqueNm) ||
    !Number.isFinite(peakPowerHp)
  ) {
    return unavailableSnapshot("insufficient_data", truncated);
  }

  return {
    status: "ready",
    peakTorqueNm,
    peakPowerHp,
    truncated,
  };
}
