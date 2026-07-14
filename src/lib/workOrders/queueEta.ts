import {
  labelFromToken,
  type AdminWorkOrderStatus,
  type DeliveryStatus,
  type FinalFileStatus,
  type PaymentReviewStatus,
  type QualityCheckStatus,
  type WorkOrderPriority,
} from "@/lib/workOrders/types";

export type RequestQueueState =
  | "queued_for_review"
  | "waiting_for_file"
  | "file_review"
  | "waiting_for_customer"
  | "payment_review"
  | "expert_review"
  | "in_progress"
  | "quality_check"
  | "ready_for_delivery"
  | "delivered"
  | "blocked"
  | "cancelled";

export type RequestEtaAvailability = "available" | "pending_review" | "unavailable" | "not_applicable";

export type RequestQueueProjectionInput = {
  requestId: string;
  orderStatus: string | null | undefined;
  priority: WorkOrderPriority;
  adminStatus: AdminWorkOrderStatus;
  deliveryStatus: DeliveryStatus;
  finalFileStatus: FinalFileStatus;
  paymentReviewStatus: PaymentReviewStatus;
  qualityCheckStatus: QualityCheckStatus;
  estimatedTurnaroundMinutes: number | null;
  etaNote: string | null;
  createdAt: string | null | undefined;
  updatedAt: string | null | undefined;
  hasOriginalFile: boolean;
  hasDeliveredFile: boolean;
};

export type RequestQueuePosition = {
  position: number | null;
  activeCount: number | null;
  label: string;
  description: string;
};

export type RequestEtaProjection = {
  availability: RequestEtaAvailability;
  minutes: number | null;
  note: string | null;
  label: string;
  description: string;
};

export type RequestQueueProjection = {
  requestId: string;
  state: RequestQueueState;
  stateLabel: string;
  stateDescription: string;
  priority: WorkOrderPriority;
  priorityLabel: string;
  isBlocked: boolean;
  isTerminal: boolean;
  participatesInQueue: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  eta: RequestEtaProjection;
  queuePosition: RequestQueuePosition;
};

export type CustomerRequestQueueProjection = Pick<
  RequestQueueProjection,
  | "requestId"
  | "state"
  | "stateLabel"
  | "stateDescription"
  | "isBlocked"
  | "isTerminal"
  | "createdAt"
  | "updatedAt"
  | "eta"
  | "queuePosition"
>;

const queueStateCopy: Record<RequestQueueState, { label: string; description: string }> = {
  queued_for_review: {
    label: "Queued for review",
    description: "Your request is in the intake queue and waiting for MG AutoTech review.",
  },
  waiting_for_file: {
    label: "Waiting for file",
    description: "The request is waiting for an original file before file work can start.",
  },
  file_review: {
    label: "File review",
    description: "MG AutoTech is checking the original file and request details.",
  },
  waiting_for_customer: {
    label: "Waiting for your information",
    description: "The queue is paused until the requested customer information is provided.",
  },
  payment_review: {
    label: "Payment review",
    description: "The request is waiting for payment or credit review before work can continue.",
  },
  expert_review: {
    label: "Expert review",
    description: "The request needs expert review before the next file-service step.",
  },
  in_progress: {
    label: "In progress",
    description: "The request is being worked on by MG AutoTech.",
  },
  quality_check: {
    label: "Quality check",
    description: "The request is in quality review before delivery.",
  },
  ready_for_delivery: {
    label: "Ready for delivery",
    description: "The request is waiting for the final delivery step.",
  },
  delivered: {
    label: "Delivered",
    description: "The request has reached the delivered or completed stage.",
  },
  blocked: {
    label: "Blocked",
    description: "The request is blocked until MG AutoTech resolves the current blocker.",
  },
  cancelled: {
    label: "Cancelled",
    description: "The request is no longer active in the work queue.",
  },
};

const priorityWeight: Record<WorkOrderPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

function cleanNote(value: string | null) {
  const note = value?.trim();
  return note ? note.slice(0, 500) : null;
}

function toTimestamp(value: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function classifyQueueState(input: RequestQueueProjectionInput): RequestQueueState {
  const orderStatus = input.orderStatus ?? "";

  if (orderStatus === "cancelled" || input.adminStatus === "cancelled") return "cancelled";
  if (
    input.hasDeliveredFile ||
    orderStatus === "completed" ||
    input.adminStatus === "completed" ||
    input.adminStatus === "delivered" ||
    input.deliveryStatus === "delivered"
  ) {
    return "delivered";
  }
  if (input.deliveryStatus === "blocked" || input.finalFileStatus === "blocked") return "blocked";
  if (orderStatus === "customer_info_needed" || input.adminStatus === "waiting_for_customer") return "waiting_for_customer";
  if (
    input.adminStatus === "waiting_for_payment" ||
    input.adminStatus === "payment_review" ||
    input.paymentReviewStatus === "pending" ||
    input.paymentReviewStatus === "requires_review"
  ) {
    return "payment_review";
  }
  if (orderStatus === "revision" || input.adminStatus === "needs_review" || input.deliveryStatus === "revision_requested") {
    return "expert_review";
  }
  if (input.qualityCheckStatus === "failed" || input.qualityCheckStatus === "needs_review") return "expert_review";
  if (input.adminStatus === "quality_check" || input.finalFileStatus === "qc_pending") return "quality_check";
  if (input.adminStatus === "ready_for_delivery" || input.deliveryStatus === "ready" || input.finalFileStatus === "approved") {
    return "ready_for_delivery";
  }
  if (input.adminStatus === "in_progress" || input.adminStatus === "in_analysis" || input.deliveryStatus === "waiting_final_file") {
    return "in_progress";
  }
  if (!input.hasOriginalFile || input.adminStatus === "waiting_for_file") return "waiting_for_file";
  if (orderStatus === "file_check" || input.adminStatus === "file_received") return "file_review";
  return "queued_for_review";
}

function buildEtaProjection(input: RequestQueueProjectionInput, state: RequestQueueState): RequestEtaProjection {
  const note = cleanNote(input.etaNote);
  const minutes = Number.isFinite(input.estimatedTurnaroundMinutes)
    ? input.estimatedTurnaroundMinutes
    : null;

  if (state === "delivered" || state === "cancelled") {
    return {
      availability: "not_applicable",
      minutes: null,
      note: null,
      label: state === "delivered" ? "Delivery complete" : "ETA not applicable",
      description: state === "delivered"
        ? "This request has reached the delivered stage."
        : "Cancelled requests are outside the active work queue.",
    };
  }

  if (state === "blocked" || state === "waiting_for_customer" || state === "payment_review" || state === "waiting_for_file") {
    return {
      availability: "unavailable",
      minutes: null,
      note,
      label: "ETA unavailable",
      description: "A turnaround estimate is unavailable while this request is waiting on a blocker or missing input.",
    };
  }

  if (minutes !== null && minutes >= 0) {
    return {
      availability: "available",
      minutes,
      note,
      label: `Admin estimate: ${formatDuration(minutes)}`,
      description: "This is the current operational estimate from MG AutoTech review, not a guaranteed SLA.",
    };
  }

  if (note) {
    return {
      availability: "available",
      minutes: null,
      note,
      label: "ETA note available",
      description: "MG AutoTech has set a request-specific ETA note, but no exact turnaround duration is available.",
    };
  }

  return {
    availability: "pending_review",
    minutes: null,
    note: null,
    label: "ETA pending review",
    description: "MG AutoTech has not set a turnaround estimate for this request yet.",
  };
}

function defaultQueuePosition(state: RequestQueueState): RequestQueuePosition {
  if (state === "delivered" || state === "cancelled") {
    return {
      position: null,
      activeCount: null,
      label: "Outside active queue",
      description: "This request is no longer waiting in the active queue.",
    };
  }
  if (["blocked", "waiting_for_customer", "payment_review", "waiting_for_file"].includes(state)) {
    return {
      position: null,
      activeCount: null,
      label: "Paused outside active queue",
      description: "Queue movement is paused until the current blocker is cleared.",
    };
  }
  return {
    position: null,
    activeCount: null,
    label: "Queue position pending",
    description: "Queue placement will appear after the active queue is loaded.",
  };
}

export function buildRequestQueueProjection(input: RequestQueueProjectionInput): RequestQueueProjection {
  const state = classifyQueueState(input);
  const copy = queueStateCopy[state];
  const isTerminal = state === "delivered" || state === "cancelled";
  const isBlocked = ["blocked", "waiting_for_customer", "payment_review", "waiting_for_file"].includes(state);

  return {
    requestId: input.requestId,
    state,
    stateLabel: copy.label,
    stateDescription: copy.description,
    priority: input.priority,
    priorityLabel: labelFromToken(input.priority),
    isBlocked,
    isTerminal,
    participatesInQueue: !isTerminal && !isBlocked,
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
    eta: buildEtaProjection(input, state),
    queuePosition: defaultQueuePosition(state),
  };
}

export function compareRequestQueuePlacement(a: RequestQueueProjection, b: RequestQueueProjection) {
  const priorityDelta = priorityWeight[b.priority] - priorityWeight[a.priority];
  if (priorityDelta !== 0) return priorityDelta;
  const createdDelta = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
  if (createdDelta !== 0) return createdDelta;
  return a.requestId.localeCompare(b.requestId);
}

export function withRequestQueuePosition(
  projection: RequestQueueProjection,
  placement: { position: number; activeCount: number } | null
): RequestQueueProjection {
  if (!projection.participatesInQueue || !placement) return projection;
  return {
    ...projection,
    queuePosition: {
      position: placement.position,
      activeCount: placement.activeCount,
      label: `Position ${placement.position} of ${placement.activeCount}`,
      description: "Position is calculated from the currently loaded active queue using priority and request age.",
    },
  };
}

export function projectCustomerRequestQueueProjection(
  projection: RequestQueueProjection
): CustomerRequestQueueProjection {
  return {
    requestId: projection.requestId,
    state: projection.state,
    stateLabel: projection.stateLabel,
    stateDescription: projection.stateDescription,
    isBlocked: projection.isBlocked,
    isTerminal: projection.isTerminal,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    eta: projection.eta,
    queuePosition: projection.queuePosition,
  };
}
