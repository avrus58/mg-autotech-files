export const platformReliabilityEventKinds = [
  "client_error",
  "unhandled_rejection",
  "fatal_render",
  "web_vital",
] as const;

export const platformReliabilityCategories = [
  "chunk_load",
  "network",
  "auth_recovery",
  "render",
  "attribution_handoff",
  "ads_linker",
  "unknown",
] as const;

export const platformWebVitalNames = ["CLS", "FCP", "INP", "LCP", "TTFB"] as const;

export type PlatformReliabilityEventKind = (typeof platformReliabilityEventKinds)[number];
export type PlatformReliabilityCategory = (typeof platformReliabilityCategories)[number];
export type PlatformWebVitalName = (typeof platformWebVitalNames)[number];

const uuidSegment = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opaquePrivateSegment = /^(?=.*\d)[a-z0-9_-]{20,}$/i;

export function normalizeReliabilityRoute(value: string) {
  const pathname = value.split(/[?#]/, 1)[0]?.trim();
  if (!pathname?.startsWith("/") || pathname.length > 300) return null;

  const privateWorkspace = /^\/(?:admin|dashboard|new-request|payment)(?:\/|$)/.test(pathname);
  const normalized = pathname
    .split("/")
    .map((segment, index) => {
      if (index === 0 || !segment) return segment;
      if (uuidSegment.test(segment)) return ":id";
      if (privateWorkspace && opaquePrivateSegment.test(segment)) return ":id";
      return segment.slice(0, 80);
    })
    .join("/")
    .replace(/\/{2,}/g, "/");

  return normalized.length > 180 ? normalized.slice(0, 180) : normalized;
}

function failureText(value: unknown) {
  if (value instanceof Error) return `${value.name} ${value.message}`.toLowerCase();
  if (typeof value === "string") return value.toLowerCase();
  if (value && typeof value === "object") {
    const candidate = value as { name?: unknown; message?: unknown };
    return `${String(candidate.name ?? "")} ${String(candidate.message ?? "")}`.toLowerCase();
  }
  return "";
}

export function classifyPlatformFailure(value: unknown): PlatformReliabilityCategory {
  const text = failureText(value);
  if (/chunkload|loading chunk|dynamically imported module/.test(text)) return "chunk_load";
  if (/network|fetch|timeout|load failed|offline/.test(text)) return "network";
  if (/auth|session|refresh token|jwt/.test(text)) return "auth_recovery";
  if (/render|hydration|react/.test(text)) return "render";
  return "unknown";
}

export function normalizeWebVitalValue(name: PlatformWebVitalName, value: number) {
  if (!Number.isFinite(value)) return null;
  const bounded = Math.min(Math.max(value, 0), name === "CLS" ? 10 : 120_000);
  return Number(bounded.toFixed(name === "CLS" ? 4 : 1));
}
