export const CUSTOMER_FILE_DOWNLOAD_EVENT = "customer_file_downloaded";

export type StoredModifiedFileVersion = {
  id: string;
  label: "v1" | "revision" | "final";
  file_name: string;
  file_path: string;
  uploaded_at: string;
};

export type CustomerDeliveryVersion = {
  id: string;
  label: StoredModifiedFileVersion["label"];
  fileName: string;
  deliveredAt: string;
  downloadCount: number;
  lastDownloadedAt: string | null;
};

export type CustomerDeliveryHistory = {
  original: {
    fileName: string | null;
    receivedAt: string;
  };
  versions: CustomerDeliveryVersion[];
};

export type CustomerOrderRecord = {
  id: string;
  customer_id: string;
  customer_email: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  credits_required: number | string | null;
  status: string | null;
  notes: string | null;
  ecu: string | null;
  gearbox: string | null;
  vehicle_year: string | null;
  read_method: string | null;
  license_plate: string | null;
  hw_sw: string | null;
  master_slave: string | null;
  uploaded_file_name: string | null;
  modified_file_path: string | null;
  modified_files: unknown;
  estimated_delivery_label: string | null;
  estimated_delivery_note: string | null;
  customer_upload_enabled?: boolean | null;
  customer_uploads?: unknown;
  created_at: string;
};

export type CustomerDownloadEventRow = {
  event_type?: string | null;
  new_value?: unknown;
  created_at?: string | null;
};

export const customerOrderDetailSelect = [
  "id",
  "customer_id",
  "customer_email",
  "vehicle_brand",
  "vehicle_model",
  "vehicle_generation",
  "vehicle_engine",
  "service_type",
  "credits_required",
  "status",
  "notes",
  "ecu",
  "gearbox",
  "vehicle_year",
  "read_method",
  "license_plate",
  "hw_sw",
  "master_slave",
  "uploaded_file_name",
  "modified_file_path",
  "modified_files",
  "estimated_delivery_label",
  "estimated_delivery_note",
  "customer_upload_enabled",
  "customer_uploads",
  "created_at",
].join(",");

const versionLabels = new Set<StoredModifiedFileVersion["label"]>([
  "v1",
  "revision",
  "final",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function normalizeStoredVersion(value: unknown): StoredModifiedFileVersion | null {
  if (!isRecord(value)) return null;

  const label = value.label;
  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof label !== "string" ||
    !versionLabels.has(label as StoredModifiedFileVersion["label"]) ||
    typeof value.file_name !== "string" ||
    !value.file_name.trim() ||
    typeof value.file_path !== "string" ||
    !value.file_path.trim() ||
    !isIsoDate(value.uploaded_at)
  ) {
    return null;
  }

  return {
    id: value.id,
    label: label as StoredModifiedFileVersion["label"],
    file_name: value.file_name,
    file_path: value.file_path,
    uploaded_at: value.uploaded_at,
  };
}

export function getStoredModifiedFileVersions(
  order: Pick<
    CustomerOrderRecord,
    "modified_files" | "modified_file_path" | "created_at"
  >
) {
  const versions = Array.isArray(order.modified_files)
    ? order.modified_files
        .map(normalizeStoredVersion)
        .filter((version): version is StoredModifiedFileVersion => Boolean(version))
    : [];

  if (versions.length > 0) return versions;
  if (!order.modified_file_path?.trim()) return [];

  return [
    {
      id: "legacy-final",
      label: "final" as const,
      file_name: order.modified_file_path.split("/").pop() || "Modified file",
      file_path: order.modified_file_path,
      uploaded_at: order.created_at,
    },
  ];
}

function getEventVersionId(event: CustomerDownloadEventRow) {
  if (event.event_type !== CUSTOMER_FILE_DOWNLOAD_EVENT) return null;
  if (!isRecord(event.new_value)) return null;
  return typeof event.new_value.version_id === "string"
    ? event.new_value.version_id
    : null;
}

export function projectCustomerDeliveryHistory(
  order: Pick<
    CustomerOrderRecord,
    "uploaded_file_name" | "created_at" | "modified_files" | "modified_file_path"
  >,
  events: CustomerDownloadEventRow[]
): CustomerDeliveryHistory {
  const downloadStats = new Map<
    string,
    { count: number; lastDownloadedAt: string | null }
  >();

  for (const event of events) {
    const versionId = getEventVersionId(event);
    if (!versionId || !isIsoDate(event.created_at)) continue;

    const current = downloadStats.get(versionId) ?? {
      count: 0,
      lastDownloadedAt: null,
    };
    const lastDownloadedAt =
      !current.lastDownloadedAt ||
      Date.parse(event.created_at) > Date.parse(current.lastDownloadedAt)
        ? event.created_at
        : current.lastDownloadedAt;

    downloadStats.set(versionId, {
      count: current.count + 1,
      lastDownloadedAt,
    });
  }

  return {
    original: {
      fileName: order.uploaded_file_name,
      receivedAt: order.created_at,
    },
    versions: getStoredModifiedFileVersions(order).map((version) => {
      const stats = downloadStats.get(version.id);
      return {
        id: version.id,
        label: version.label,
        fileName: version.file_name,
        deliveredAt: version.uploaded_at,
        downloadCount: stats?.count ?? 0,
        lastDownloadedAt: stats?.lastDownloadedAt ?? null,
      };
    }),
  };
}

export function resolveCustomerDeliveryVersion(
  order: Pick<
    CustomerOrderRecord,
    "modified_files" | "modified_file_path" | "created_at"
  >,
  versionId: string
) {
  const matches = getStoredModifiedFileVersions(order).filter(
    (version) => version.id === versionId
  );
  return matches.length === 1 ? matches[0] : null;
}

export function isExpectedCustomerDeliveryPath(
  filePath: string,
  customerId: string,
  requestId: string
) {
  if (!filePath || filePath.includes("..") || filePath.includes("\\")) return false;
  return filePath.startsWith(`${customerId}/modified/${requestId}/`);
}

export function buildCustomerDownloadAuditValue(version: StoredModifiedFileVersion) {
  return {
    version_id: version.id,
    label: version.label,
    file_name: version.file_name,
  };
}

function projectCustomerUpload(value: unknown) {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.file_name !== "string" ||
    typeof value.file_size !== "number" ||
    !isIsoDate(value.uploaded_at)
  ) {
    return null;
  }

  return {
    id: value.id,
    file_name: value.file_name,
    file_size: value.file_size,
    uploaded_at: value.uploaded_at,
  };
}

export function projectCustomerOrder(order: CustomerOrderRecord) {
  return {
    id: order.id,
    customer_email: order.customer_email,
    vehicle_brand: order.vehicle_brand,
    vehicle_model: order.vehicle_model,
    vehicle_generation: order.vehicle_generation,
    vehicle_engine: order.vehicle_engine,
    service_type: order.service_type,
    credits_required: order.credits_required,
    status: order.status,
    notes: order.notes,
    ecu: order.ecu,
    gearbox: order.gearbox,
    vehicle_year: order.vehicle_year,
    read_method: order.read_method,
    license_plate: order.license_plate,
    hw_sw: order.hw_sw,
    master_slave: order.master_slave,
    uploaded_file_name: order.uploaded_file_name,
    estimated_delivery_label: order.estimated_delivery_label,
    estimated_delivery_note: order.estimated_delivery_note,
    customer_upload_enabled: Boolean(order.customer_upload_enabled),
    customer_uploads: Array.isArray(order.customer_uploads)
      ? order.customer_uploads
          .map(projectCustomerUpload)
          .filter((upload): upload is NonNullable<ReturnType<typeof projectCustomerUpload>> =>
            Boolean(upload)
          )
      : [],
    created_at: order.created_at,
  };
}
