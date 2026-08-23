import {
  checkAdaptiveRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/abuseProtection";

const FILE_EXPERT_RATE_WINDOW_MS = 60 * 60 * 1000;

function requiresDurableRateLimit() {
  return process.env.NODE_ENV === "production";
}

function rateDecision(result: Awaited<ReturnType<typeof checkAdaptiveRateLimit>>) {
  const unavailable =
    requiresDurableRateLimit() &&
    result.allowed &&
    result.source !== "distributed";

  return {
    allowed: result.allowed && !unavailable,
    unavailable,
  };
}

export async function checkFileExpertCreateRate(request: Request, userId: string) {
  const limit = 10;
  const result = await checkAdaptiveRateLimit({
    request,
    scope: "file-expert-job-create",
    suffix: userId,
    limit,
    windowMs: FILE_EXPERT_RATE_WINDOW_MS,
    includeClientIp: false,
  });
  const decision = rateDecision(result);
  return {
    ...decision,
    headers: rateLimitResponseHeaders({
      result,
      limit,
      windowMs: FILE_EXPERT_RATE_WINDOW_MS,
      blocked: !decision.allowed,
    }),
  };
}

export async function checkFileExpertAnalysisRate(input: {
  request: Request;
  userId: string;
  jobId: string;
  isAdmin: boolean;
}) {
  const accountLimit = input.isAdmin ? 60 : 10;
  const accountResult = await checkAdaptiveRateLimit({
    request: input.request,
    scope: "file-expert-analysis-account",
    suffix: input.userId,
    limit: accountLimit,
    windowMs: FILE_EXPERT_RATE_WINDOW_MS,
    includeClientIp: false,
  });
  const jobLimit = input.isAdmin ? 20 : 3;
  const jobResult = accountResult.allowed
    ? await checkAdaptiveRateLimit({
        request: input.request,
        scope: "file-expert-analysis-job",
        suffix: `${input.userId}:${input.jobId}`,
        limit: jobLimit,
        windowMs: FILE_EXPERT_RATE_WINDOW_MS,
        includeClientIp: false,
      })
    : accountResult;
  const result = accountResult.allowed ? jobResult : accountResult;
  const limit = accountResult.allowed ? jobLimit : accountLimit;
  const decision = rateDecision(result);
  return {
    ...decision,
    headers: rateLimitResponseHeaders({
      result,
      limit,
      windowMs: FILE_EXPERT_RATE_WINDOW_MS,
      blocked: !decision.allowed,
    }),
  };
}
