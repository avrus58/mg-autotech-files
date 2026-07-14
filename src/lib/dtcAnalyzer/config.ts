import { maxDtcTextLength, normalizeDtcInput } from "@/lib/dtcAnalyzer/fallback";
import type {
  DtcAnalyzerNormalizedInput,
  DtcAnalyzerProviderKind,
  DtcAnalyzerProviderStatus,
} from "@/lib/dtcAnalyzer/types";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimit";

export const dtcAnalyzerConfigContractVersion = "dtc-analyzer-config-v1" as const;

export type DtcAnalyzerUsageScope = "customer" | "admin";

export type DtcAnalyzerUsageLimitType =
  | "request_rate"
  | "request_text_length"
  | "dtc_code_count";

export type DtcAnalyzerAdminConfigStatus = {
  contractVersion: typeof dtcAnalyzerConfigContractVersion;
  provider: {
    configured: false;
    providerKind: DtcAnalyzerProviderKind;
    providerStatus: DtcAnalyzerProviderStatus;
    availabilityLabel: string;
  };
  fallback: {
    deterministicFallbackEnabled: true;
    mode: "deterministic_rules";
    modeLabel: string;
  };
  usageLimits: {
    scope: DtcAnalyzerUsageScope;
    requestsPerWindow: number;
    windowSeconds: number;
    maxRequestTextLength: number;
    maxAnalyzedTextLength: number;
    maxCodesPerRequest: number;
  };
  failureHandling: string[];
};

export type DtcAnalyzerUsageAllowed = {
  allowed: true;
  configuration: DtcAnalyzerAdminConfigStatus;
  normalizedInput: DtcAnalyzerNormalizedInput;
  remainingRequests: number;
  resetAt: number;
};

export type DtcAnalyzerUsageLimited = {
  allowed: false;
  type: DtcAnalyzerUsageLimitType;
  httpStatus: 400 | 413 | 429;
  error: string;
  statusLabel: string;
  retryAfterSeconds: number | null;
  retryAt: string | null;
  remainingRequests: number;
  configuration: DtcAnalyzerAdminConfigStatus;
  normalizedInput: DtcAnalyzerNormalizedInput;
};

export type DtcAnalyzerUsageGuardResult =
  | DtcAnalyzerUsageAllowed
  | DtcAnalyzerUsageLimited;

export type DtcAnalyzerUsageLimitPublicProjection = {
  status: "usage_limited";
  type: DtcAnalyzerUsageLimitType;
  statusLabel: string;
  retryAfterSeconds: number | null;
  retryAt: string | null;
  remainingRequests: number;
  limits: {
    requestsPerWindow: number;
    windowSeconds: number;
    maxRequestTextLength: number;
    maxAnalyzedTextLength: number;
    maxCodesPerRequest: number;
  };
};

const usageProfiles = {
  customer: {
    requestsPerWindow: 4,
    windowMs: 15 * 60 * 1000,
  },
  admin: {
    requestsPerWindow: 12,
    windowMs: 15 * 60 * 1000,
  },
} as const;

const localDtcAnalyzerLimits = {
  maxRequestTextLength: 4000,
  maxAnalyzedTextLength: maxDtcTextLength,
  maxCodesPerRequest: 8,
} as const;

export function getDtcAnalyzerAdminConfigStatus(
  scope: DtcAnalyzerUsageScope
): DtcAnalyzerAdminConfigStatus {
  const usageProfile = usageProfiles[scope];

  return {
    contractVersion: dtcAnalyzerConfigContractVersion,
    provider: {
      configured: false,
      providerKind: "unconfigured",
      providerStatus: "unavailable",
      availabilityLabel:
        "No live DTC AI provider is configured for this local analyzer boundary.",
    },
    fallback: {
      deterministicFallbackEnabled: true,
      mode: "deterministic_rules",
      modeLabel:
        "Deterministic non-AI fallback remains available when the provider is unavailable or fails.",
    },
    usageLimits: {
      scope,
      requestsPerWindow: usageProfile.requestsPerWindow,
      windowSeconds: Math.ceil(usageProfile.windowMs / 1000),
      ...localDtcAnalyzerLimits,
    },
    failureHandling: [
      "Provider unavailable or failed states are explicit and never reported as AI success.",
      "Over-limit requests are rejected before analysis and are not recorded as generated DTC analysis.",
      "Customer responses omit provider internals while admin responses show operational status.",
    ],
  };
}

function retryAtFrom(resetAt: number | null) {
  return resetAt ? new Date(resetAt).toISOString() : null;
}

export function projectDtcUsageLimitForResponse(
  result: DtcAnalyzerUsageLimited
): DtcAnalyzerUsageLimitPublicProjection {
  return {
    status: "usage_limited",
    type: result.type,
    statusLabel: result.statusLabel,
    retryAfterSeconds: result.retryAfterSeconds,
    retryAt: result.retryAt,
    remainingRequests: result.remainingRequests,
    limits: {
      requestsPerWindow: result.configuration.usageLimits.requestsPerWindow,
      windowSeconds: result.configuration.usageLimits.windowSeconds,
      maxRequestTextLength: result.configuration.usageLimits.maxRequestTextLength,
      maxAnalyzedTextLength: result.configuration.usageLimits.maxAnalyzedTextLength,
      maxCodesPerRequest: result.configuration.usageLimits.maxCodesPerRequest,
    },
  };
}

export function checkDtcAnalyzerUsage(input: {
  request: Request;
  scope: DtcAnalyzerUsageScope;
  orderId: string;
  actorUserId: string;
  text: string;
}): DtcAnalyzerUsageGuardResult {
  const configuration = getDtcAnalyzerAdminConfigStatus(input.scope);
  const normalizedInput = normalizeDtcInput(input.text);
  const textLength = input.text.trim().length;

  if (textLength > configuration.usageLimits.maxRequestTextLength) {
    return {
      allowed: false,
      type: "request_text_length",
      httpStatus: 413,
      error: `DTC analysis text is too long. Keep request analysis text under ${configuration.usageLimits.maxRequestTextLength} characters.`,
      statusLabel: "Request text limit reached before DTC analysis.",
      retryAfterSeconds: null,
      retryAt: null,
      remainingRequests: 0,
      configuration,
      normalizedInput,
    };
  }

  if (normalizedInput.normalizedCodes.length > configuration.usageLimits.maxCodesPerRequest) {
    return {
      allowed: false,
      type: "dtc_code_count",
      httpStatus: 400,
      error: `DTC analysis supports up to ${configuration.usageLimits.maxCodesPerRequest} codes per request.`,
      statusLabel: "DTC code count limit reached before analysis.",
      retryAfterSeconds: null,
      retryAt: null,
      remainingRequests: 0,
      configuration,
      normalizedInput,
    };
  }

  const rateResult = checkRateLimit({
    key: rateLimitKey(
      input.request,
      `dtc-analysis:${input.scope}`,
      `${input.actorUserId}:${input.orderId}`
    ),
    limit: configuration.usageLimits.requestsPerWindow,
    windowMs: usageProfiles[input.scope].windowMs,
  });

  if (!rateResult.allowed) {
    return {
      allowed: false,
      type: "request_rate",
      httpStatus: 429,
      error: "DTC analysis usage limit reached. Please retry after the cooldown window.",
      statusLabel: "Usage limit reached before DTC analysis.",
      retryAfterSeconds: rateResult.retryAfterSeconds,
      retryAt: retryAtFrom(rateResult.resetAt),
      remainingRequests: rateResult.remaining,
      configuration,
      normalizedInput,
    };
  }

  return {
    allowed: true,
    configuration,
    normalizedInput,
    remainingRequests: rateResult.remaining,
    resetAt: rateResult.resetAt,
  };
}
