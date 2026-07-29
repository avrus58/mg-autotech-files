export const FILE_VERSION_LABEL_MAX_LENGTH = 40;

export const presetFileVersionLabels = ["v1", "revision", "final"] as const;

export type PresetFileVersionLabel = (typeof presetFileVersionLabels)[number];

const presetLabelMap: Record<PresetFileVersionLabel, string> = {
  v1: "V1",
  revision: "Revision",
  final: "Final",
};

const allowedLabelPattern = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;

export function normalizeFileVersionLabel(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    !normalized ||
    normalized.length > FILE_VERSION_LABEL_MAX_LENGTH ||
    !allowedLabelPattern.test(normalized)
  ) {
    return null;
  }

  const preset = presetFileVersionLabels.find(
    (candidate) => candidate === normalized.toLowerCase()
  );
  return preset ?? normalized;
}

export function formatFileVersionLabel(value: string) {
  const normalized = normalizeFileVersionLabel(value);
  if (!normalized) return "Version";
  return presetLabelMap[normalized as PresetFileVersionLabel] ?? normalized;
}

export function buildFileVersionPathSegment(value: string) {
  const normalized = normalizeFileVersionLabel(value);
  if (!normalized) return null;

  const pathSegment = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return pathSegment || "custom-version";
}
