type AdminCompletedMetricFile = {
  uploaded_at?: string | null;
};

export type AdminCompletedMetricOrder = {
  status: string | null;
  created_at: string | null;
  modified_files?: AdminCompletedMetricFile[] | null;
};

const berlinDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getBerlinDayKey(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return berlinDayFormatter.format(date);
}

function getLatestDeliveredAt(order: AdminCompletedMetricOrder) {
  if (!Array.isArray(order.modified_files)) return null;

  return order.modified_files.reduce<Date | null>((latest, file) => {
    const uploadedAt = file.uploaded_at ? new Date(file.uploaded_at) : null;
    if (!uploadedAt || Number.isNaN(uploadedAt.getTime())) return latest;
    return !latest || uploadedAt > latest ? uploadedAt : latest;
  }, null);
}

export function countCompletedToday(orders: readonly AdminCompletedMetricOrder[], now: Date = new Date()) {
  const todayKey = getBerlinDayKey(now);
  if (!todayKey) return 0;

  return orders.filter((order) => {
    if (order.status !== "completed") return false;
    const metricDate = getLatestDeliveredAt(order) ?? order.created_at;
    return getBerlinDayKey(metricDate) === todayKey;
  }).length;
}
