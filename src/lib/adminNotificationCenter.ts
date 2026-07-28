export type AdminNotificationOrder = {
  id: string;
  status: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  created_at: string | null;
};

export type AdminOperationalAlert = {
  key: string;
  orderId: string;
  status: string;
  title: string;
  detail: string;
  vehicleLabel: string;
  receivedAt: string | null;
  priority: "urgent" | "attention" | "watch";
  priorityRank: number;
};

const operationalStatusCopy: Record<
  string,
  Pick<AdminOperationalAlert, "title" | "detail" | "priority" | "priorityRank">
> = {
  revision: {
    title: "Revision requires review",
    detail: "Check the requested revision and decide the next workshop step.",
    priority: "urgent",
    priorityRank: 5,
  },
  new_request: {
    title: "New request awaiting triage",
    detail: "Review the vehicle, service selection and uploaded file.",
    priority: "urgent",
    priorityRank: 4,
  },
  file_check: {
    title: "File check pending",
    detail: "The request is ready for its file and identity review.",
    priority: "attention",
    priorityRank: 3,
  },
  customer_info_needed: {
    title: "Waiting for customer information",
    detail: "Keep this request visible until the customer responds.",
    priority: "watch",
    priorityRank: 2,
  },
};

const recentStatusCopy: Record<string, string> = {
  new_request: "Request received",
  file_check: "File check queue",
  in_progress: "Work in progress",
  customer_info_needed: "Customer information pending",
  revision: "Revision requested",
  completed: "Request completed",
  cancelled: "Request cancelled",
};

function receivedTime(value: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getAdminOrderVehicleLabel(order: AdminNotificationOrder) {
  return [order.vehicle_brand, order.vehicle_model].filter(Boolean).join(" ") || "Vehicle details pending";
}

export function getAdminOperationalAlerts(orders: AdminNotificationOrder[]): AdminOperationalAlert[] {
  return orders
    .flatMap((order) => {
      const status = order.status ?? "";
      const copy = operationalStatusCopy[status];
      if (!copy) return [];

      return [
        {
          key: `${order.id}:${status}`,
          orderId: order.id,
          status,
          title: copy.title,
          detail: copy.detail,
          vehicleLabel: getAdminOrderVehicleLabel(order),
          receivedAt: order.created_at,
          priority: copy.priority,
          priorityRank: copy.priorityRank,
        },
      ];
    })
    .sort((left, right) => {
      if (left.priorityRank !== right.priorityRank) return right.priorityRank - left.priorityRank;
      return receivedTime(right.receivedAt) - receivedTime(left.receivedAt);
    });
}

export function getAdminRecentOrderActivity(orders: AdminNotificationOrder[], limit = 5) {
  return [...orders]
    .sort((left, right) => receivedTime(right.created_at) - receivedTime(left.created_at))
    .slice(0, Math.max(0, limit))
    .map((order) => ({
      key: `${order.id}:${order.status ?? "unknown"}:recent`,
      orderId: order.id,
      status: order.status ?? "unknown",
      title: recentStatusCopy[order.status ?? ""] ?? "Request status updated",
      vehicleLabel: getAdminOrderVehicleLabel(order),
      receivedAt: order.created_at,
    }));
}

export function getAdminNotificationSummary(orders: AdminNotificationOrder[]) {
  const alerts = getAdminOperationalAlerts(orders);
  return {
    activeAlerts: alerts.length,
    urgentAlerts: alerts.filter((alert) => alert.priority === "urgent").length,
    inProgress: orders.filter((order) => order.status === "in_progress").length,
  };
}
