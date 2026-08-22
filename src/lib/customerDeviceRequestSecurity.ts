import {
  checkAdaptiveRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/abuseProtection";

type CustomerDeviceRateOperation = "start" | "resend" | "verify";

const policies: Record<CustomerDeviceRateOperation, {
  accountLimit: number;
  networkLimit: number;
  windowMs: number;
}> = {
  start: { accountLimit: 30, networkLimit: 80, windowMs: 15 * 60 * 1000 },
  resend: { accountLimit: 6, networkLimit: 30, windowMs: 15 * 60 * 1000 },
  verify: { accountLimit: 25, networkLimit: 120, windowMs: 15 * 60 * 1000 },
};

export async function checkCustomerDeviceRequestRate(input: {
  request: Request;
  userId: string;
  operation: CustomerDeviceRateOperation;
}) {
  const policy = policies[input.operation];
  const account = await checkAdaptiveRateLimit({
    request: input.request,
    scope: `customer-device-${input.operation}-account`,
    suffix: input.userId,
    includeClientIp: false,
    limit: policy.accountLimit,
    windowMs: policy.windowMs,
  });
  if (!account.allowed) {
    return {
      allowed: false as const,
      retryAfterSeconds: account.retryAfterSeconds,
      headers: rateLimitResponseHeaders({
        result: account,
        limit: policy.accountLimit,
        windowMs: policy.windowMs,
        blocked: true,
      }),
    };
  }

  const network = await checkAdaptiveRateLimit({
    request: input.request,
    scope: `customer-device-${input.operation}-network`,
    limit: policy.networkLimit,
    windowMs: policy.windowMs,
  });
  if (!network.allowed) {
    return {
      allowed: false as const,
      retryAfterSeconds: network.retryAfterSeconds,
      headers: rateLimitResponseHeaders({
        result: network,
        limit: policy.networkLimit,
        windowMs: policy.windowMs,
        blocked: true,
      }),
    };
  }

  return { allowed: true as const, retryAfterSeconds: 0, headers: {} };
}
