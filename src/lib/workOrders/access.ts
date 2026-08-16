import {
  hasStaffPermission,
  type StaffAccess,
} from "@/lib/staffPermissions";

export type AdminRequestAccess = {
  customersView: boolean;
  filesDownload: boolean;
  filesUpload: boolean;
  messagesManage: boolean;
  creditsManage: boolean;
  fileExpertManage: boolean;
  aiTrainingManage: boolean;
  ordersManage: boolean;
};

export function buildAdminRequestAccess(access: StaffAccess): AdminRequestAccess {
  return {
    customersView: hasStaffPermission(access, "customers.view"),
    filesDownload: hasStaffPermission(access, "files.download"),
    filesUpload: hasStaffPermission(access, "files.upload"),
    messagesManage: hasStaffPermission(access, "messages.manage"),
    creditsManage: hasStaffPermission(access, "credits.manage"),
    fileExpertManage: hasStaffPermission(access, "file_expert.manage"),
    aiTrainingManage: hasStaffPermission(access, "ai_training.manage"),
    ordersManage: hasStaffPermission(access, "orders.manage"),
  };
}

export const internalAdminRequestAccess: AdminRequestAccess = {
  customersView: true,
  filesDownload: true,
  filesUpload: true,
  messagesManage: true,
  creditsManage: true,
  fileExpertManage: true,
  aiTrainingManage: true,
  ordersManage: true,
};

type UnknownRow = Record<string, unknown>;

/**
 * Explicit response allowlist for order rows returned through staff APIs.
 * Supabase service-role queries may see newly added private columns, so never
 * spread a database row into an HTTP response.
 */
export function projectAdminOrderRow(
  row: UnknownRow,
  access: AdminRequestAccess
): UnknownRow {
  return {
    id: row.id,
    customer_id: access.customersView ? row.customer_id ?? null : null,
    customer_email: access.customersView ? row.customer_email ?? null : null,
    vehicle_brand: row.vehicle_brand ?? null,
    vehicle_model: row.vehicle_model ?? null,
    vehicle_generation: row.vehicle_generation ?? null,
    vehicle_engine: row.vehicle_engine ?? null,
    service_type: row.service_type ?? null,
    credits_required: access.creditsManage ? row.credits_required ?? null : null,
    status: row.status ?? null,
    notes: row.notes ?? null,
    ecu: row.ecu ?? null,
    gearbox: row.gearbox ?? null,
    vehicle_year: row.vehicle_year ?? null,
    read_method: row.read_method ?? null,
    license_plate: access.customersView ? row.license_plate ?? null : null,
    hw_sw: row.hw_sw ?? null,
    master_slave: row.master_slave ?? null,
    uploaded_file_name: access.filesDownload ? row.uploaded_file_name ?? null : null,
    original_file_path: access.filesDownload ? row.original_file_path ?? null : null,
    modified_file_path: access.filesDownload ? row.modified_file_path ?? null : null,
    modified_files: access.filesDownload ? row.modified_files ?? null : null,
    estimated_delivery_label: row.estimated_delivery_label ?? null,
    estimated_delivery_note: row.estimated_delivery_note ?? null,
    customer_upload_enabled: row.customer_upload_enabled ?? null,
    customer_uploads: access.filesDownload ? row.customer_uploads ?? null : null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/** Customer profile data and financial data have independent permissions. */
export function projectAdminProfileRow(
  row: UnknownRow,
  access: AdminRequestAccess
): UnknownRow | null {
  if (!access.customersView) return null;
  return {
    id: row.id,
    email: row.email ?? null,
    customer_id: row.customer_id ?? null,
    full_name: row.full_name ?? null,
    company_name: row.company_name ?? null,
    phone: row.phone ?? null,
    account_status: row.account_status ?? null,
    customer_tags: Array.isArray(row.customer_tags) ? row.customer_tags : [],
    internal_admin_note: row.internal_admin_note ?? null,
    credit_balance: access.creditsManage ? row.credit_balance ?? null : null,
    created_at: row.created_at ?? null,
  };
}
