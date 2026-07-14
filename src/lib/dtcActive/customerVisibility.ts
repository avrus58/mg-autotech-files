import type { DtcDryRunReport } from "@/lib/dtcActive/phaseBTypes";
import type { CustomerDtcActiveStatus, DtcActivePublicStatus } from "@/lib/dtcActive/types";

const forbiddenCustomerKeys =
  /offset|bytes|operation|rule|adapter|evidence|object|bucket|path|storage|private|confidence|checksum|integrity|event_id|sample|source_reference|source_url|binary|hex/i;

export function buildCustomerDtcActiveStatus(input: {
  requestId: string;
  requestedCodes: readonly string[];
  status?: DtcActivePublicStatus;
  message?: string;
  now?: Date;
}): CustomerDtcActiveStatus {
  const status = input.status ?? (input.requestedCodes.length ? "expert_review" : "action_required");
  return {
    requestId: input.requestId,
    status,
    requestedCodes: [...new Set(input.requestedCodes)].sort(),
    customerMessage: input.message ?? messageForStatus(status),
    downloadable: false,
    updatedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function assertCustomerDtcActiveProjectionSafe(value: unknown) {
  const seen = new WeakSet<object>();

  function visit(node: unknown, path: string): string | null {
    if (!node || typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);

    for (const [key, child] of Object.entries(node)) {
      if (forbiddenCustomerKeys.test(key)) return `${path}.${key}`;
      const nested = visit(child, `${path}.${key}`);
      if (nested) return nested;
    }
    return null;
  }

  const forbiddenPath = visit(value, "$");
  if (forbiddenPath) {
    throw new Error(`Customer DTC status projection contains forbidden key ${forbiddenPath}.`);
  }
}

export function buildCustomerSafeDtcDryRunStatus(
  report: DtcDryRunReport,
  now = new Date()
): CustomerDtcActiveStatus {
  const status: DtcActivePublicStatus = report.success ? "expert_review" : "failed_safely";
  const projection = {
    requestId: report.requestId,
    status,
    requestedCodes: report.requestedCodes,
    customerMessage: report.success
      ? "Your DTC request can be reviewed by MG AutoTech. No automatic file output was created."
      : "The DTC workflow stopped safely and no customer file output was created.",
    downloadable: false as const,
    updatedAt: now.toISOString(),
  };

  assertCustomerDtcActiveProjectionSafe(projection);
  return projection;
}

function messageForStatus(status: DtcActivePublicStatus) {
  if (status === "expert_review") {
    return "Your DTC request is queued for expert review. No automatic file modification is performed.";
  }
  if (status === "unsupported") {
    return "This DTC request is not supported automatically and needs manual review.";
  }
  if (status === "action_required") {
    return "Add valid DTC codes or request notes so the team can review the request.";
  }
  if (status === "failed_safely") {
    return "The DTC workflow stopped safely and no customer file output was created.";
  }
  if (status === "completed") {
    return "A result is available only when MG AutoTech has explicitly published it.";
  }
  return "MG AutoTech is reviewing the DTC request status.";
}
